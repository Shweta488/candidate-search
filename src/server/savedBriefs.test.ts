import { ZodError } from "zod";
import type { Vocabulary } from "@/shared/types";
import { deleteSavedBrief, listSavedBriefs, saveBrief, SavedBriefBody } from "./savedBriefs";
import { getVocabulary } from "./search/vocabulary";
import { recruiterClient } from "./supabase";

jest.mock("./supabase", () => ({ recruiterClient: jest.fn() }));
jest.mock("./search/vocabulary", () => ({ getVocabulary: jest.fn() }));

const recruiter = { userId: "u1", companyId: "c1", token: "t1" };
const SAVED = "6f1c6a8e-1d1b-4c55-9d8e-0a6b1f1f2c3d";

const vocabulary: Vocabulary = {
  roles: [],
  seniorities: ["senior"],
  cities: [],
  states: [],
  skills: ["Go", "React"],
  companies: [],
  company_types: [],
  schools: [],
  degrees: [],
  fields_of_study: [],
  years_experience: { min: 0, max: 15 },
};

// A chainable query, like Supabase's: each awaited query gets the next queued result.
function fakeDb(...results: { data: unknown; error: unknown }[]) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "insert", "delete", "eq", "order", "returns", "single"]) {
    query[method] = jest.fn(() => query);
  }
  query.then = (resolve: (value: unknown) => void) => resolve(results.shift());
  const from = jest.fn(() => query);
  jest.mocked(recruiterClient).mockReturnValue({ from } as never);
  return { from, query: query as Record<string, jest.Mock> };
}

beforeEach(() => jest.mocked(getVocabulary).mockResolvedValue(vocabulary));

describe("SavedBriefBody", () => {
  it("cleans the brief like a search does", () => {
    expect(SavedBriefBody.parse({ brief: "  go\u0000 engineers ", filters: {} }).brief).toBe("go engineers");
    expect(SavedBriefBody.safeParse({ brief: " ", filters: {} }).success).toBe(false);
    expect(SavedBriefBody.safeParse({ brief: "x".repeat(501), filters: {} }).success).toBe(false);
  });
});

describe("saved searches", () => {
  it("lists newest first, as the recruiter", async () => {
    const rows = [{ id: SAVED, brief: "go", filters: { skills: ["Go"] }, created_at: "t" }];
    const { query } = fakeDb({ data: rows, error: null });
    await expect(listSavedBriefs(recruiter)).resolves.toEqual(rows);
    expect(recruiterClient).toHaveBeenCalledWith("t1");
    expect(query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("saves for the recruiter's company, with the filters cleaned", async () => {
    const { query } = fakeDb({ data: { id: SAVED }, error: null });
    await expect(
      saveBrief(recruiter, {
        brief: "go",
        filters: { skills: ["Go", "Go"], cities: [] },
      }),
    ).resolves.toEqual({ id: SAVED });
    expect(query.insert).toHaveBeenCalledWith({
      company_id: "c1",
      brief: "go",
      filters: { skills: ["Go"] },
    });
  });

  it("drops keys it doesn't know and saves the rest", async () => {
    const { query } = fakeDb({ data: { id: SAVED }, error: null });
    await expect(
      saveBrief(recruiter, { brief: "go", filters: { skills: ["Go"], colour: ["blue"], limit: 5 } }),
    ).resolves.toEqual({ id: SAVED });
    expect(query.insert).toHaveBeenCalledWith({ company_id: "c1", brief: "go", filters: { skills: ["Go"] } });
  });

  it("keeps every key a search understands", async () => {
    const { query } = fakeDb({ data: { id: SAVED }, error: null });
    const filters = {
      roles: ["Backend Engineer"],
      seniorities: ["senior"],
      cities: ["Austin"],
      states: ["TX"],
      skills: ["Go"],
      worked_at_companies: ["Copperline"],
      worked_at_company_types: ["startup"],
      schools: ["MIT"],
      degrees: ["BSc"],
      fields_of_study: ["Physics"],
      open_to_work: true,
      min_years: 2,
      max_years: 9,
    };
    jest.mocked(getVocabulary).mockResolvedValue({
      roles: filters.roles,
      seniorities: filters.seniorities,
      cities: filters.cities,
      states: filters.states,
      skills: filters.skills,
      companies: filters.worked_at_companies,
      company_types: filters.worked_at_company_types,
      schools: filters.schools,
      degrees: filters.degrees,
      fields_of_study: filters.fields_of_study,
      years_experience: { min: 0, max: 15 },
    });
    await saveBrief(recruiter, { brief: "go", filters });
    expect(query.insert).toHaveBeenCalledWith({ company_id: "c1", brief: "go", filters });
  });

  it.each([
    ["missing", undefined],
    ["a string", "skills"],
    ["an array", [{ skills: ["Go"] }]],
    ["null", null],
  ])("the body needs filters to be an object: %s is rejected", (_case, filters) => {
    expect(SavedBriefBody.safeParse({ brief: "go", filters }).success).toBe(false);
  });

  it.each([
    ["an unknown value", { skills: ["Cobol"] }],
    ["an unknown value next to an unknown key", { skills: ["Cobol"], colour: ["blue"] }],
    ["min_years over max_years", { min_years: 9, max_years: 2 }],
  ])("rejects %s before touching the database", async (_case, filters) => {
    const { from } = fakeDb();
    await expect(saveBrief(recruiter, { brief: "go", filters })).rejects.toBeInstanceOf(ZodError);
    expect(from).not.toHaveBeenCalled();
  });

  it("names the field that is wrong", async () => {
    fakeDb();
    await expect(saveBrief(recruiter, { brief: "go", filters: { skills: ["Cobol"] } })).rejects.toMatchObject({
      issues: [expect.objectContaining({ path: ["filters", "skills", 0] })],
    });
  });

  it("is not found for an id that isn't a uuid, without asking the database", async () => {
    const { from } = fakeDb();
    await expect(deleteSavedBrief(recruiter, "nope")).rejects.toMatchObject({
      status: 404,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("is not found when the delete matched nothing (missing or another company's)", async () => {
    fakeDb({ data: [], error: null });
    await expect(deleteSavedBrief(recruiter, SAVED)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("deletes the recruiter's own saved search", async () => {
    const { query } = fakeDb({ data: [{ id: SAVED }], error: null });
    await expect(deleteSavedBrief(recruiter, SAVED)).resolves.toBeUndefined();
    expect(query.eq).toHaveBeenCalledWith("id", SAVED);
  });
});
