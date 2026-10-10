// Result order (LLD 3.6): closer matches first, then open to work, then most experienced,
// then id. Searches send filters, so the LLM is never called.
import type { SearchPage, SearchResponse } from "@/shared/types";
import { adminClient, api, postJson, RECRUITERS, resetSearches, signIn } from "./helpers";

type Result = SearchPage["results"][number];

async function allResults(filters: object, token: string): Promise<Result[]> {
  await resetSearches("acme");
  const first = await postJson<SearchResponse>("/api/search", { brief: "ranking test", filters }, token);
  expect(first.status).toBe(200);
  const results = [...first.body.results];
  for (let page = 2; page <= first.body.total_pages; page++) {
    const next = await api<SearchPage>(`/api/search/${first.body.search_id}?page=${page}`, token);
    results.push(...next.body.results);
  }
  expect(results).toHaveLength(first.body.total);
  return results;
}

// The order among equally close matches: open to work, then experience, then id.
function tieBreak(a: Result, b: Result): number {
  return (
    Number(b.open_to_work) - Number(a.open_to_work) ||
    b.years_experience - a.years_experience ||
    a.id.localeCompare(b.id)
  );
}

describe("result order", () => {
  let token: string;

  beforeAll(async () => {
    token = (await signIn(RECRUITERS.acme)).token;
  });

  afterAll(() => resetSearches("acme"));

  it("puts people who match more of the brief's companies first", async () => {
    const companies = ["Copperline", "Hexlane"];
    const results = await allResults({ worked_at_companies: companies }, token);

    const { data, error } = await adminClient()
      .schema("private")
      .from("candidates")
      .select("id, past_companies")
      .in(
        "id",
        results.map((r) => r.id),
      );
    if (error) throw error;
    const pastCompanies = new Map(data.map((row) => [row.id as string, row.past_companies as string[]]));
    const matches = results.map((r) => companies.filter((c) => pastCompanies.get(r.id)?.includes(c)).length);

    expect(matches[0]).toBe(2);
    expect(matches).toEqual([...matches].sort((a, b) => b - a)); // never a 1 before a 2
    expect(matches).toContain(1);

    // Within the same number of matches, the tie-break order applies.
    const both = results.filter((_, i) => matches[i] === 2);
    expect(both).toEqual([...both].sort(tieBreak));
  });

  it("uses only the tie-break order when the brief has no multi-value field", async () => {
    const results = await allResults({ roles: ["Backend Engineer"], cities: ["Austin"] }, token);
    expect(results.length).toBeGreaterThan(20);
    expect(results).toEqual([...results].sort(tieBreak));
  });
});
