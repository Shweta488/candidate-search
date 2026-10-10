// Latency targets (NFR6, docs/TESTING.md): paging under 300 ms at p95, and a new search
// under 3 s end to end. The new searches send real briefs, so this file makes 5 Claude
// calls: sending filters would skip the part that takes the time. Run it by path, and only
// with the other Claude tests at the end of a story (RULES.md section 6).
import type { SearchResponse } from "@/shared/types";
import {
  adminClient,
  APP_URL,
  postJson,
  RECRUITERS,
  resetSearches,
  SAMPLE_BRIEF,
  SAMPLE_FILTERS,
  signIn,
} from "./helpers";

const BRIEFS = [
  "senior React engineers in New York who have worked at a startup",
  "product designers in San Francisco who are open to work",
  "backend engineers in Austin who know Go and Kubernetes",
  "software engineers in California",
  "data scientists with a PhD",
];

async function timed(request: () => Promise<Response>): Promise<{ ms: number; status: number }> {
  const started = performance.now();
  const response = await request();
  await response.arrayBuffer(); // the time includes reading the whole body
  return { ms: performance.now() - started, status: response.status };
}

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

// Paid plan for the duration, so 5 new searches don't hit the free limit.
async function setGlobexPaid(paid: boolean): Promise<void> {
  const db = adminClient().schema("private");
  if (!paid) {
    await db.from("subscriptions").delete().eq("id", "sub_test_latency");
    return;
  }
  const { data: company } = await db.from("companies").select("id").eq("code", "globex").single<{ id: string }>();
  const { error } = await db.from("subscriptions").upsert({
    id: "sub_test_latency",
    company_id: company?.id,
    status: "active",
    last_event_created: 0,
    last_event_id: "evt_test_latency",
  });
  if (error) throw new Error(`Could not make globex paid: ${error.message}`);
}

describe("latency", () => {
  let token: string;

  beforeAll(async () => {
    token = (await signIn(RECRUITERS.globex)).token;
    await setGlobexPaid(true);
  });

  // Searches still count while paid, so give globex its free search back too.
  afterAll(async () => {
    await setGlobexPaid(false);
    await resetSearches("globex");
  });

  it("pages a stored search in under 300 ms at p95", async () => {
    const search = await postJson<SearchResponse>(
      "/api/search",
      { brief: SAMPLE_BRIEF, filters: SAMPLE_FILTERS },
      token,
    );
    expect(search.status).toBe(200);
    const pages = search.body.total_pages;
    const headers = { authorization: `Bearer ${token}` };

    // One warm-up call so the first-request compile in next dev isn't counted.
    await fetch(`${APP_URL}/api/search/${search.body.search_id}?page=1`, { headers });

    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const page = (i % pages) + 1;
      const { ms, status } = await timed(() =>
        fetch(`${APP_URL}/api/search/${search.body.search_id}?page=${page}`, { headers }),
      );
      expect(status).toBe(200);
      times.push(ms);
    }
    console.log(`paging p95 ${Math.round(p95(times))} ms, max ${Math.round(Math.max(...times))} ms`);
    expect(p95(times)).toBeLessThan(300);
  });

  it("answers a new search, including the Claude call, in under 3 s", async () => {
    const times: number[] = [];
    for (const brief of BRIEFS) {
      const { ms, status } = await timed(() =>
        fetch(`${APP_URL}/api/search`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ brief }),
        }),
      );
      expect(status).toBe(200);
      times.push(ms);
    }
    console.log(`new search times ${times.map((ms) => Math.round(ms)).join(", ")} ms`);
    for (const ms of times) expect(ms).toBeLessThan(3_000);
  }, 30_000);
});
