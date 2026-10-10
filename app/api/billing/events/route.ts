import { ZodError } from "zod";
import { verifySignature } from "@/server/billing/verifySignature";
import { parseEvent, type StripeEvent } from "@/server/billing/parseEvent";
import { handleStripeEvent } from "@/server/billing/handleStripeEvent";
import { getStripeWebhookEnv } from "@/server/env";
import { AppError } from "@/server/errors";
import { json, readRawBody, withRequestLog } from "@/server/http";
import { logEventIgnored, logSignatureRejected } from "@/server/log";

export const runtime = "nodejs";

// A full Stripe subscription event can be larger than the 16 KB allowed on recruiter routes.
const MAX_EVENT_BYTES = 1024 * 1024;

// Stripe calls this without a recruiter token; the signature is the only gate (LLD 4.7).
// It is checked on the raw text before anything parses the body.
export const POST = withRequestLog(async (request, requestId) => {
  const rawBody = await readRawBody(request, MAX_EVENT_BYTES);
  const { secret, toleranceSeconds } = getStripeWebhookEnv();
  const check = verifySignature({
    header: request.headers.get("stripe-signature"),
    rawBody,
    secret,
    nowSeconds: Math.floor(Date.now() / 1000),
    toleranceSeconds,
  });
  if (!check.ok) {
    logSignatureRejected(requestId, check.reason);
    throw new AppError("invalid_signature", "The Stripe signature is not valid.");
  }

  // From here the sender is Stripe, so the answer is 200 whatever the event holds: a 400
  // would only make Stripe send the same event again. An event we can't read is ignored.
  let event: StripeEvent;
  try {
    event = parseEvent(JSON.parse(rawBody));
  } catch (error) {
    logEventIgnored(requestId, unreadableReason(error));
    return json({ outcome: "ignored" });
  }

  // A database failure here is not caught: it becomes a 500, and Stripe retries later.
  return json({ outcome: await handleStripeEvent(event) });
});

// Names the missing field, never its value: request bodies are not logged (LLD 4.8).
function unreadableReason(error: unknown): string {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return `${issue?.path.join(".") || "body"}: ${issue?.message ?? "invalid"}`;
  }
  return "body is not JSON";
}
