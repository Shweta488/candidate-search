// The free plan allows exactly one search, even when many arrive at once (LLD 4.6).
// Searches send filters, so the LLM is never called.
import type { PlanResponse, SearchResponse } from "@/shared/types";
import { api, postJson, RECRUITERS, resetSearches, SAMPLE_BRIEF, SAMPLE_FILTERS, signIn } from "./helpers";

describe("free plan under concurrency", () => {
  afterAll(() => resetSearches("globex"));

  it("lets exactly 1 of 20 simultaneous searches through", async () => {
    await resetSearches("globex");
    const { token } = await signIn(RECRUITERS.globex);

    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        postJson<SearchResponse>("/api/search", { brief: SAMPLE_BRIEF, filters: SAMPLE_FILTERS }, token),
      ),
    );
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 402)).toHaveLength(19);

    // Paging the one successful search still works and doesn't count as a search.
    const success = responses.find((r) => r.status === 200)!.body;
    expect((await api(`/api/search/${success.search_id}?page=2`, token)).status).toBe(200);
    expect((await api<PlanResponse>("/api/plan", token)).body).toEqual({ plan: "free", searches_remaining: 0 });
  });
});
