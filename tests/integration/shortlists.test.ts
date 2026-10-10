// Shortlist routes through the running app (LLD 1.5). Lists made here are deleted at the end.
import type { ApiErrorBody, Candidate, SearchResponse, Shortlist, ShortlistSummary } from "@/shared/types";
import { adminClient, api, APP_URL, postJson, RECRUITERS, resetSearches, signIn } from "./helpers";

const RUN = `test ${Date.now()}`;

// Filters that match cand_0629 (the person put on a list here) and a few others.
const MATCHES_CAND_0629 = {
  roles: ["Full Stack Engineer"],
  seniorities: ["senior"],
  cities: ["New York"],
  skills: ["AWS", "Postgres", "React"],
};

async function send(method: "PATCH" | "DELETE" | "POST", path: string, token: string, body?: unknown) {
  const response = await fetch(`${APP_URL}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as unknown) : null };
}

describe("shortlists", () => {
  let token: string;
  let listId: string;

  beforeAll(async () => {
    token = (await signIn(RECRUITERS.acme)).token;
  });

  afterAll(async () => {
    await adminClient().from("shortlists").delete().like("name", `${RUN}%`);
    await resetSearches("acme");
  });

  it("rejects requests without a token", async () => {
    expect((await api("/api/shortlists")).status).toBe(401);
    expect((await postJson("/api/shortlists", { name: "x" })).status).toBe(401);
  });

  it("creates a list, trimming the name", async () => {
    const { status, body } = await postJson<{ id: string; name: string }>(
      "/api/shortlists",
      { name: `  ${RUN} frontend  ` },
      token,
    );
    expect(status).toBe(201);
    expect(body.name).toBe(`${RUN} frontend`);
    listId = body.id;
  });

  it.each([
    ["an empty name", { name: "   " }],
    ["no name", {}],
  ])("rejects %s with a 400", async (_case, body) => {
    expect((await postJson("/api/shortlists", body, token)).status).toBe(400);
  });

  it("refuses the same name in another case with a 409", async () => {
    const { status, body } = await postJson<ApiErrorBody>("/api/shortlists", { name: `${RUN} FRONTEND` }, token);
    expect(status).toBe(409);
    expect(body.error).toEqual({ code: "name_taken", message: "You already have a list with this name." });
  });

  it("adds a person once, and says when they're already on the list", async () => {
    const first = await send("POST", `/api/shortlists/${listId}/people/cand_0629`, token);
    expect(first).toEqual({ status: 200, body: { added: true } });
    const again = await send("POST", `/api/shortlists/${listId}/people/cand_0629`, token);
    expect(again).toEqual({ status: 200, body: { added: false } });
    await send("POST", `/api/shortlists/${listId}/people/cand_0001`, token);
  });

  it("says on search results which lists each person is on", async () => {
    await resetSearches("acme");
    const search = await postJson<SearchResponse>(
      "/api/search",
      { brief: "list ids on results", filters: MATCHES_CAND_0629 },
      token,
    );
    expect(search.status).toBe(200);
    const onList = search.body.results.find((result) => result.id === "cand_0629");
    expect(onList?.shortlist_ids).toContain(listId);
    const others = search.body.results.filter((result) => result.id !== "cand_0629");
    expect(others.length).toBeGreaterThan(0);
    for (const result of others) expect(result.shortlist_ids).not.toContain(listId);

    // Paging reads the same field.
    const page = await api<SearchResponse>(`/api/search/${search.body.search_id}?page=1`, token);
    expect(page.body.results.find((result) => result.id === "cand_0629")?.shortlist_ids).toContain(listId);
  });

  it("answers 404 for an unknown person or list", async () => {
    expect((await send("POST", `/api/shortlists/${listId}/people/cand_9999`, token)).status).toBe(404);
    const unknownList = "00000000-0000-4000-8000-000000000000";
    expect((await send("POST", `/api/shortlists/${unknownList}/people/cand_0001`, token)).status).toBe(404);
    expect((await api(`/api/shortlists/${unknownList}`, token)).status).toBe(404);
    expect((await api("/api/shortlists/not-a-list", token)).status).toBe(404);
  });

  it("lists it with its member count, and shows it on the candidate", async () => {
    const { body } = await api<{ shortlists: ShortlistSummary[] }>("/api/shortlists", token);
    expect(body.shortlists.find((l) => l.id === listId)).toMatchObject({ name: `${RUN} frontend`, member_count: 2 });

    const candidate = await api<Candidate>("/api/people/cand_0629", token);
    expect(candidate.body.shortlist_ids).toContain(listId);
  });

  it("opens the list with its members, most recently added first", async () => {
    const { status, body } = await api<Shortlist>(`/api/shortlists/${listId}`, token);
    expect(status).toBe(200);
    expect(body.members.map((m) => m.candidate.id)).toEqual(["cand_0001", "cand_0629"]);
    expect(body.members[0]?.candidate).toHaveProperty("full_name");
  });

  it("removes a person, also when they're not on the list", async () => {
    expect((await send("DELETE", `/api/shortlists/${listId}/people/cand_0001`, token)).status).toBe(204);
    expect((await send("DELETE", `/api/shortlists/${listId}/people/cand_0001`, token)).status).toBe(204);
    const { body } = await api<Shortlist>(`/api/shortlists/${listId}`, token);
    expect(body.members.map((m) => m.candidate.id)).toEqual(["cand_0629"]);
  });

  it("renames, refusing a name already used", async () => {
    const other = await postJson<{ id: string }>("/api/shortlists", { name: `${RUN} backend` }, token);
    expect((await send("PATCH", `/api/shortlists/${listId}`, token, { name: `${RUN} Backend` })).status).toBe(409);
    const renamed = await send("PATCH", `/api/shortlists/${listId}`, token, { name: `${RUN} react` });
    expect(renamed).toEqual({ status: 200, body: { id: listId, name: `${RUN} react` } });
    await send("DELETE", `/api/shortlists/${other.body.id}`, token);
  });

  it("deletes the list with its members", async () => {
    expect((await send("DELETE", `/api/shortlists/${listId}`, token)).status).toBe(204);
    expect((await api(`/api/shortlists/${listId}`, token)).status).toBe(404);
    expect((await send("DELETE", `/api/shortlists/${listId}`, token)).status).toBe(404);
    const { count } = await adminClient()
      .from("shortlist_members")
      .select("*", { count: "exact", head: true })
      .eq("shortlist_id", listId);
    expect(count).toBe(0);
  });
});
