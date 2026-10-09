import type { Vocabulary } from "@/shared/types";
import {
  filterToolSchema,
  filtersSchema,
  hasAnyFilter,
  LIST_FIELDS,
  llmOutputSchema,
  sanitizeLlmFilters,
} from "./filterSchema";

const vocabulary: Vocabulary = {
  roles: ["Backend Engineer", "Frontend Engineer"],
  seniorities: ["junior", "mid", "senior", "staff"],
  cities: ["Austin", "New York"],
  states: ["NY", "TX"],
  skills: ["Go", "Kubernetes", "React"],
  companies: ["Copperline"],
  company_types: ["enterprise", "startup"],
  schools: ["Stanford University"],
  degrees: ["BS", "PhD"],
  fields_of_study: ["Computer Science"],
  years_experience: { min: 0, max: 15 },
};

describe("filtersSchema (filters sent by the client)", () => {
  const schema = filtersSchema(vocabulary);

  it("accepts known values and drops empty lists", () => {
    expect(schema.parse({ skills: ["React"], cities: [], open_to_work: true })).toEqual({
      skills: ["React"],
      open_to_work: true,
    });
  });

  it("removes repeated values", () => {
    expect(schema.parse({ skills: ["React", "React"] })).toEqual({ skills: ["React"] });
  });

  it("rejects a value that isn't in the vocabulary, naming the field", () => {
    const result = schema.safeParse({ skills: ["Rust"] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["skills", 0]);
  });

  it("rejects unknown fields", () => {
    expect(schema.safeParse({ salary: ["high"] }).success).toBe(false);
  });

  it("rejects min_years above max_years, and years outside 0 to 60", () => {
    expect(schema.safeParse({ min_years: 5, max_years: 2 }).success).toBe(false);
    expect(schema.safeParse({ min_years: -1 }).success).toBe(false);
    expect(schema.safeParse({ max_years: 61 }).success).toBe(false);
    expect(schema.safeParse({ min_years: 2.5 }).success).toBe(false);
    expect(schema.parse({ min_years: 5, max_years: 5 })).toEqual({ min_years: 5, max_years: 5 });
  });
});

describe("sanitizeLlmFilters (filters from the LLM)", () => {
  it("keeps known values", () => {
    const output = llmOutputSchema.parse({ roles: ["Backend Engineer"], skills: ["Go"], unsupported: [] });
    expect(sanitizeLlmFilters(output, vocabulary)).toEqual({
      filters: { roles: ["Backend Engineer"], skills: ["Go"] },
      unsupported: [],
    });
  });

  it("moves unknown values into unsupported", () => {
    const output = llmOutputSchema.parse({
      skills: ["React", "Rust"],
      cities: ["Paris"],
      unsupported: ["speaks Japanese"],
    });
    expect(sanitizeLlmFilters(output, vocabulary)).toEqual({
      filters: { skills: ["React"] },
      unsupported: ["speaks Japanese", "Paris", "Rust"],
    });
  });

  it("treats an impossible years range as unsupported", () => {
    const output = llmOutputSchema.parse({ min_years: 10, max_years: 3, unsupported: [] });
    expect(sanitizeLlmFilters(output, vocabulary)).toEqual({ filters: {}, unsupported: ["years of experience"] });
  });

  it("keeps a valid years range and open_to_work, and ignores nulls", () => {
    const output = llmOutputSchema.parse({ min_years: 5, max_years: null, open_to_work: true, unsupported: [] });
    expect(sanitizeLlmFilters(output, vocabulary).filters).toEqual({ min_years: 5, open_to_work: true });
  });

  it("caps unsupported at 5 items of 80 characters, without blanks or repeats", () => {
    const long = "x".repeat(200);
    const output = llmOutputSchema.parse({ unsupported: [long, " ", "a", "a", "b", "c", "d", "e"] });
    const { unsupported } = sanitizeLlmFilters(output, vocabulary);
    expect(unsupported).toEqual(["x".repeat(80), "a", "b", "c", "d"]);
  });
});

describe("hasAnyFilter", () => {
  it("is false for no filters", () => {
    expect(hasAnyFilter({})).toBe(false);
    expect(hasAnyFilter({ open_to_work: false })).toBe(true);
  });
});

describe("filterToolSchema", () => {
  const schema = filterToolSchema(vocabulary);

  it("offers every list field as an enum of vocabulary values", () => {
    for (const [field, list] of Object.entries(LIST_FIELDS)) {
      expect(schema.properties[field as keyof typeof schema.properties]).toMatchObject({
        type: "array",
        items: { type: "string", enum: vocabulary[list] },
      });
    }
  });

  it("allows no other properties", () => {
    expect(schema.additionalProperties).toBe(false);
  });

  it("requires every field, so the model decides on each one", () => {
    expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
    expect(schema.properties.open_to_work.anyOf).toEqual([{ type: "boolean" }, { type: "null" }]);
  });
});
