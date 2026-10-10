// Saved search routes through the running app (LLD 1.6). Searches send filters, so the
// LLM is never called. Saved searches made here are deleted at the end.
import type { ApiErrorBody, PlanResponse, SavedBrief, SearchResponse } from "@/shared/types";
import { adminClient, api, APP_URL, postJson, RECRUITERS, resetSearches, SAMPLE_FILTERS, signIn } from "./helpers";

const RUN = `test ${Date.now()}`;

async function remove(path: string, token: string) {
  const response = await fetch(`${APP_URL}${path}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
  return response.status;
}

describe("saved searches", () => {
  let token: string;
  let firstId: string;
  let secondId: string;

  beforeAll(async () => {
    token = (await signIn(RECRUITERS.acme)).token;
  });

  afterAll(async () => {
    await adminClient().from("saved_briefs").delete().like("brief", `${RUN}%`);
    await resetSearches("acme");
  });

  it("rejects requests without a token", async () => {
    expect((await api("/api/saved-briefs")).status).toBe(401);
    expect((await postJson("/api/saved-briefs", { brief: "x", filters: {} })).status).toBe(401);
    expect(await remove("/api/saved-briefs/6f1c6a8e-1d1b-4c55-9d8e-0a6b1f1f2c3d", "")).toBe(401);
  });

  it("saves a search and stores its filters cleaned, without keys it doesn't know", async () => {
    const first = await postJson<{ id: string }>(
      "/api/saved-briefs",
      {
        brief: `  ${RUN} react  `,
        filters: {
          ...SAMPLE_FILTERS,
          cities: ["New York", "New York"],
          schools: [],
          colour: ["blue"], // a key we don't know is left out, not rejected
        },
      },
      token,
    );
    expect(first.status).toBe(201);
    firstId = first.body.id;

    const second = await postJson<{ id: string }>(
      "/api/saved-briefs",
      { brief: `${RUN} go`, filters: { skills: ["Go"] } },
      token,
    );
    expect(second.status).toBe(201);
    secondId = second.body.id;
  });

  it("lists them newest first", async () => {
    const { status, body } = await api<{ saved_briefs: SavedBrief[] }>("/api/saved-briefs", token);
    expect(status).toBe(200);
    const mine = body.saved_briefs.filter((s) => s.brief.startsWith(RUN));
    expect(mine.map((s) => s.id)).toEqual([secondId, firstId]);
    expect(mine[1].brief).toBe(`${RUN} react`);
    expect(mine[1].filters).toEqual(SAMPLE_FILTERS); // exactly these: no repeats, empty lists or unknown keys
  });

  // The other invalid inputs are unit tests (savedBriefs.test.ts, filterSchema.test.ts).
  it.each([
    ["missing filters", { brief: "x" }],
    ["an empty brief", { brief: "  ", filters: {} }],
  ])("rejects %s with a 400", async (_case, body) => {
    const { status, body: error } = await postJson<ApiErrorBody>("/api/saved-briefs", body, token);
    expect(status).toBe(400);
    expect(error.error.code).toBe("invalid_request");
  });

  it("names the filter that is wrong", async () => {
    const { body } = await postJson<ApiErrorBody>(
      "/api/saved-briefs",
      { brief: "x", filters: { skills: ["Cobol"] } },
      token,
    );
    expect(body.error.message).toMatch(/^filters\.skills\.0:/);
  });

  it("re-running a saved search is a new search", async () => {
    await resetSearches("acme");
    const { body } = await api<{ saved_briefs: SavedBrief[] }>("/api/saved-briefs", token);
    const saved = body.saved_briefs.find((s) => s.id === firstId)!;

    const run = await postJson<SearchResponse>("/api/search", { brief: saved.brief, filters: saved.filters }, token);
    expect(run.status).toBe(200);
    expect(run.body.filters).toEqual(SAMPLE_FILTERS);
    expect((await api<PlanResponse>("/api/plan", token)).body).toEqual({
      plan: "free",
      searches_remaining: 0,
      company_name: "Acme",
    });
  });

  it("deletes one, and a second delete is not found", async () => {
    expect(await remove(`/api/saved-briefs/${secondId}`, token)).toBe(204);
    expect(await remove(`/api/saved-briefs/${secondId}`, token)).toBe(404);
    const { body } = await api<{ saved_briefs: SavedBrief[] }>("/api/saved-briefs", token);
    expect(body.saved_briefs.map((s) => s.id)).not.toContain(secondId);
  });
});
