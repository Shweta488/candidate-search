// POST /api/search and paging through the running app. Every search here sends filters,
// which skips the LLM: these tests are about credits, paging and isolation, and cost nothing.
import type { ApiErrorBody, PlanResponse, SearchPage, SearchResponse } from "@/shared/types";
import { api, postJson, RECRUITERS, resetSearches, SAMPLE_BRIEF, SAMPLE_FILTERS, signIn } from "./helpers";

describe("search and paging", () => {
  let acme: string;
  let globex: string;
  let search: SearchResponse;

  beforeAll(async () => {
    acme = (await signIn(RECRUITERS.acme)).token;
    globex = (await signIn(RECRUITERS.globex)).token;
    await resetSearches("acme");
  });

  afterAll(() => resetSearches("acme"));

  it("rejects a search without a token", async () => {
    const { status } = await postJson("/api/search", { brief: SAMPLE_BRIEF });
    expect(status).toBe(401);
  });

  it("rejects unknown filters with a 400, without spending the search", async () => {
    const { status, body } = await postJson<ApiErrorBody>(
      "/api/search",
      { brief: SAMPLE_BRIEF, filters: { skills: ["Cobol"] } },
      acme,
    );
    expect(status).toBe(400);
    expect(body.error.message).toMatch(/^filters\.skills\.0: /);
    expect((await api<PlanResponse>("/api/plan", acme)).body.searches_remaining).toBe(1);
  });

  // One invalid brief and one invalid body show the route maps both to 400; every other
  // invalid input is a unit test (runSearch.test.ts, http.test.ts).
  it.each([
    ["an empty brief", { brief: "   " }],
    ["a body that isn't JSON", "brief=go"],
  ])("rejects %s with a 400", async (_case, body) => {
    const { status } = await postJson("/api/search", body, acme);
    expect(status).toBe(400);
  });

  it("runs the free search and returns page 1 of the ranked results", async () => {
    const { status, body } = await postJson<SearchResponse>(
      "/api/search",
      { brief: SAMPLE_BRIEF, filters: SAMPLE_FILTERS },
      acme,
    );
    expect(status).toBe(200);
    search = body;
    expect(body).toMatchObject({ page: 1, page_size: 20, total: 21, total_pages: 2, searches_remaining: 0 });
    expect(body.results).toHaveLength(20);
    // Ranking: open to work first, then most years of experience.
    const rank = body.results.map((c) => [c.open_to_work ? 1 : 0, c.years_experience]);
    expect(rank).toEqual([...rank].sort((a, b) => b[0] - a[0] || b[1] - a[1]));
  });

  it("refuses a second search on the free plan with 402", async () => {
    const { status, body } = await postJson<ApiErrorBody>(
      "/api/search",
      { brief: SAMPLE_BRIEF, filters: SAMPLE_FILTERS },
      acme,
    );
    expect(status).toBe(402);
    expect(body.error.code).toBe("search_limit_reached");
  });

  it("pages through the search without spending a search", async () => {
    const page2 = await api<SearchPage>(`/api/search/${search.search_id}?page=2`, acme);
    expect(page2.status).toBe(200);
    expect(page2.body).toMatchObject({ page: 2, total: 21, total_pages: 2, brief: SAMPLE_BRIEF });
    expect(page2.body.results).toHaveLength(1);

    const page1Ids = search.results.map((c) => c.id);
    expect(page1Ids).not.toContain(page2.body.results[0]?.id);

    const past = await api<SearchPage>(`/api/search/${search.search_id}?page=3`, acme);
    expect(past.status).toBe(200);
    expect(past.body.results).toEqual([]);

    expect((await api<PlanResponse>("/api/plan", acme)).body.searches_remaining).toBe(0);
  });

  it.each(["0", "-1", "1.5", "two"])("rejects page=%s with a 400", async (page) => {
    const { status } = await api(`/api/search/${search.search_id}?page=${page}`, acme);
    expect(status).toBe(400);
  });

  it("answers 404 for another company's search, an unknown id or a malformed id", async () => {
    expect((await api(`/api/search/${search.search_id}`, globex)).status).toBe(404);
    expect((await api("/api/search/00000000-0000-4000-8000-000000000000", acme)).status).toBe(404);
    expect((await api("/api/search/not-a-search", acme)).status).toBe(404);
  });
});
