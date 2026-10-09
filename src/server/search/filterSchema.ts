import "server-only";
import { z } from "zod";
import type { Filters, Vocabulary } from "@/shared/types";

// One set of filter rules (LLD 3.1, 3.4), built from the vocabulary, used three ways:
// - filtersSchema: filters sent by the client. Anything unknown is a 400.
// - sanitizeLlmFilters: filters from the LLM. Anything unknown moves to `unsupported`.
// - filterToolSchema: the JSON schema of the set_filters tool the LLM must call.

export type ListField = Exclude<keyof Filters, "open_to_work" | "min_years" | "max_years">;
type VocabularyList = Exclude<keyof Vocabulary, "years_experience">;

// Which vocabulary list each filter field draws its values from.
export const LIST_FIELDS: Record<ListField, VocabularyList> = {
  roles: "roles",
  seniorities: "seniorities",
  cities: "cities",
  states: "states",
  skills: "skills",
  worked_at_companies: "companies",
  worked_at_company_types: "company_types",
  schools: "schools",
  degrees: "degrees",
  fields_of_study: "fields_of_study",
};

const LIST_FIELD_NAMES = Object.keys(LIST_FIELDS) as ListField[];
const MAX_YEARS = 60;
const MAX_UNSUPPORTED = 5;
const MAX_UNSUPPORTED_LENGTH = 80;

// Empty lists mean "no constraint", so they are removed: { skills: [] } is no skill filter.
function withoutEmptyLists(filters: Filters): Filters {
  const result: Filters = {};
  for (const [field, value] of Object.entries(filters) as [keyof Filters, Filters[keyof Filters]][]) {
    if (value === undefined || (Array.isArray(value) && value.length === 0)) continue;
    (result as Record<string, unknown>)[field] = Array.isArray(value) ? [...new Set(value)] : value;
  }
  return result;
}

export function filtersSchema(vocabulary: Vocabulary) {
  const list = (field: ListField) => {
    const allowed = new Set(vocabulary[LIST_FIELDS[field]]);
    return z.array(z.string().refine((value) => allowed.has(value), { message: "is not a known value" })).optional();
  };
  const years = z.number().int().min(0).max(MAX_YEARS).optional();

  return z
    .strictObject({
      ...(Object.fromEntries(LIST_FIELD_NAMES.map((field) => [field, list(field)])) as Record<
        ListField,
        ReturnType<typeof list>
      >),
      open_to_work: z.boolean().optional(),
      min_years: years,
      max_years: years,
    })
    .refine((f) => f.min_years === undefined || f.max_years === undefined || f.min_years <= f.max_years, {
      message: "must not be less than min_years",
      path: ["max_years"],
    })
    .transform((filters) => withoutEmptyLists(filters));
}

// The loose shape of the tool input. This only fails if the model's output is broken;
// the caller treats that as the LLM failing. Values are checked by sanitizeLlmFilters.
export const llmOutputSchema = z.object({
  ...(Object.fromEntries(LIST_FIELD_NAMES.map((field) => [field, z.array(z.string()).optional()])) as Record<
    ListField,
    z.ZodOptional<z.ZodArray<z.ZodString>>
  >),
  open_to_work: z.boolean().nullish(),
  min_years: z.number().nullish(),
  max_years: z.number().nullish(),
  unsupported: z.array(z.string()).optional(),
});

export type LlmOutput = z.infer<typeof llmOutputSchema>;

// Keeps only values in the vocabulary; anything else goes to `unsupported`, so the
// search returns nobody rather than ignoring part of the brief (LLD 3.4, 3.5).
export function sanitizeLlmFilters(
  output: LlmOutput,
  vocabulary: Vocabulary,
): { filters: Filters; unsupported: string[] } {
  const filters: Filters = {};
  const unsupported = [...(output.unsupported ?? [])];

  for (const field of LIST_FIELD_NAMES) {
    const allowed = new Set(vocabulary[LIST_FIELDS[field]]);
    const values = output[field] ?? [];
    filters[field] = values.filter((value) => allowed.has(value));
    unsupported.push(...values.filter((value) => !allowed.has(value)));
  }

  if (typeof output.open_to_work === "boolean") filters.open_to_work = output.open_to_work;

  const validYears = (n: number | null | undefined) => n == null || (Number.isInteger(n) && n >= 0 && n <= MAX_YEARS);
  const { min_years: min, max_years: max } = output;
  if (validYears(min) && validYears(max) && (min == null || max == null || min <= max)) {
    if (min != null) filters.min_years = min;
    if (max != null) filters.max_years = max;
  } else {
    unsupported.push("years of experience");
  }

  const cleaned = [...new Set(unsupported.map((item) => item.trim()).filter(Boolean))]
    .slice(0, MAX_UNSUPPORTED)
    .map((item) => item.slice(0, MAX_UNSUPPORTED_LENGTH));

  return { filters: withoutEmptyLists(filters), unsupported: cleaned };
}

export function hasAnyFilter(filters: Filters): boolean {
  return Object.keys(filters).length > 0;
}

// JSON schema for the set_filters tool. Every list is an enum of vocabulary values, which
// tells the model exactly which values exist; sanitizeLlmFilters enforces it.
// Every field is required (an empty list or null means "not in the brief"): this makes
// the model decide on each field in turn instead of stopping early and leaving some out.
export function filterToolSchema(vocabulary: Vocabulary) {
  const list = (field: ListField, description: string) => ({
    type: "array",
    items: { type: "string", enum: vocabulary[LIST_FIELDS[field]] },
    description: `${description} Empty if the brief doesn't say.`,
  });
  const nullable = (type: "boolean" | "integer", description: string) => ({
    anyOf: [{ type }, { type: "null" }],
    description: `${description} null if the brief doesn't say.`,
  });
  const properties = {
    roles: list("roles", "Job roles named in the brief."),
    seniorities: list("seniorities", "Seniority levels named in the brief."),
    skills: list("skills", "Skills the candidate must have. All listed skills are required."),
    cities: list("cities", "Cities the candidate lives in."),
    states: list("states", "US state codes, when the brief names a state rather than a city."),
    worked_at_companies: list("worked_at_companies", "Companies the candidate has worked at."),
    worked_at_company_types: list("worked_at_company_types", "Types of company the candidate has worked at."),
    schools: list("schools", "Schools the candidate studied at."),
    degrees: list("degrees", "Degrees the candidate holds."),
    fields_of_study: list("fields_of_study", "Fields the candidate studied."),
    open_to_work: nullable("boolean", "true when the brief asks for people open to work."),
    min_years: nullable("integer", "Minimum years of experience, 0 to 60."),
    max_years: nullable("integer", "Maximum years of experience, 0 to 60."),
    unsupported: {
      type: "array",
      items: { type: "string" },
      description: "Requirements in the brief that none of the other fields can express, in a few words each.",
    },
  };
  return {
    type: "object" as const,
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}
