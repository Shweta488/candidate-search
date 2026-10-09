import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Filters, Vocabulary } from "@/shared/types";
import { getAnthropicApiKey } from "../env";
import { AppError } from "../errors";
import { filterToolSchema, llmOutputSchema, sanitizeLlmFilters } from "./filterSchema";
import { SYSTEM_PROMPT } from "./prompt";

// Brief to filters with Claude Haiku (LLD 3.3). One forced call to a tool whose fields
// are enums of vocabulary values. No candidate data is ever sent.
//
// Strict tool use is off: it made each call about 0.5 s slower, and searches must finish
// within 3 s. It isn't needed for safety, because llmOutputSchema and sanitizeLlmFilters
// check every value and move anything unknown to `unsupported`.

export const MODEL = "claude-haiku-5-5";
const TOOL_NAME = "set_filters";

export type Extraction = { filters: Filters; unsupported: string[]; cacheReadTokens: number };

type MessagesClient = Pick<Anthropic, "messages">;

let client: MessagesClient | undefined;

function defaultClient(): MessagesClient {
  // Searches must finish within 3 s, so one attempt with a short timeout; a failure
  // gives the search back instead of making the recruiter wait.
  client ??= new Anthropic({ apiKey: getAnthropicApiKey(), timeout: 2_800, maxRetries: 0 });
  return client;
}

function unavailable(reason: unknown): AppError {
  return new AppError("search_unavailable", "Search is unavailable right now. Your search wasn't used.", {
    cause: reason,
  });
}

export async function extractFilters(
  brief: string,
  vocabulary: Vocabulary,
  anthropic: MessagesClient = defaultClient(),
): Promise<Extraction> {
  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      tools: [
        {
          name: TOOL_NAME,
          description: "Set the search filters that express the recruiter's brief.",
          input_schema: filterToolSchema(vocabulary),
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
      // The breakpoint on the system prompt caches the tool definition and the prompt together.
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      // Angle brackets are removed so the brief can't close the <brief> tag early.
      messages: [{ role: "user", content: `<brief>${brief.replace(/[<>]/g, " ")}</brief>` }],
    });
  } catch (error) {
    throw unavailable(error);
  }

  if (response.stop_reason !== "tool_use") {
    throw unavailable(new Error(`LLM stopped with ${response.stop_reason} instead of calling ${TOOL_NAME}`));
  }
  const call = response.content.find((block) => block.type === "tool_use" && block.name === TOOL_NAME);
  const parsed = llmOutputSchema.safeParse(call?.type === "tool_use" ? call.input : undefined);
  if (!parsed.success) {
    throw unavailable(new Error(`LLM returned no usable ${TOOL_NAME} call`));
  }

  return {
    ...sanitizeLlmFilters(parsed.data, vocabulary),
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
  };
}
