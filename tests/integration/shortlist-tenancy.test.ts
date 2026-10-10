// Shortlist isolation (NFR1, LLD 2.4, docs/TESTING.md). Globex makes a list; acme tries
// to read and change it through our API and directly through Supabase with its own
// token. Every attempt must fail or match nothing, and globex's list must be unchanged.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Candidate, SearchResponse, ShortlistSummary } from "@/shared/types";
import { adminClient, anonClient, api, APP_URL, postJson, RECRUITERS, resetSearches, signIn } from "./helpers";

const NAME = `globex tenancy ${Date.now()}`;

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
  return response.status;
}

describe("shortlist tenancy", () => {
  let acme: { client: SupabaseClient; token: string };
  let globexListId: string;
  let globexCompanyId: string;

  beforeAll(async () => {
    acme = await signIn(RECRUITERS.acme);
    const globex = await signIn(RECRUITERS.globex);
    const created = await postJson<{ id: string }>("/api/shortlists", { name: NAME }, globex.token);
    globexListId = created.body.id;
    await send("POST", `/api/shortlists/${globexListId}/people/cand_0629`, globex.token);
    const { data } = await adminClient()
      .schema("private")
      .from("companies")
      .select("id")
      .eq("code", "globex")
      .single();
    globexCompanyId = data?.id as string;
  });

  afterAll(async () => {
    await adminClient().from("shortlists").delete().eq("id", globexListId);
  });

  // Globex's list must be exactly as it was made.
  async function expectGlobexUnchanged() {
    const { data } = await adminClient()
      .from("shortlists")
      .select("name, company_id, shortlist_members(candidate_id)")
      .eq("id", globexListId)
      .single();
    expect(data).toEqual({
      name: NAME,
      company_id: globexCompanyId,
      shortlist_members: [{ candidate_id: "cand_0629" }],
    });
  }

  describe("through our API", () => {
    it("never shows globex's list to acme", async () => {
      const lists = await api<{ shortlists: ShortlistSummary[] }>("/api/shortlists", acme.token);
      expect(lists.body.shortlists.map((l) => l.id)).not.toContain(globexListId);
      expect((await api(`/api/shortlists/${globexListId}`, acme.token)).status).toBe(404);
      const candidate = await api<Candidate>("/api/people/cand_0629", acme.token);
      expect(candidate.body.shortlist_ids).not.toContain(globexListId);
    });

    it("never shows globex's list on acme's search results", async () => {
      await resetSearches("acme");
      const search = await postJson<SearchResponse>(
        "/api/search",
        { brief: "tenancy on results", filters: MATCHES_CAND_0629 },
        acme.token,
      );
      await resetSearches("acme");
      expect(search.status).toBe(200);
      const sameCandidate = search.body.results.find((result) => result.id === "cand_0629");
      expect(sameCandidate).toBeDefined(); // the candidate globex listed is in acme's results
      expect(search.body.results.flatMap((result) => result.shortlist_ids)).not.toContain(globexListId);
    });

    it("answers 404 to every change acme tries", async () => {
      expect(await send("PATCH", `/api/shortlists/${globexListId}`, acme.token, { name: "taken over" })).toBe(404);
      expect(await send("POST", `/api/shortlists/${globexListId}/people/cand_0001`, acme.token)).toBe(404);
      expect(await send("DELETE", `/api/shortlists/${globexListId}/people/cand_0629`, acme.token)).toBe(404);
      expect(await send("DELETE", `/api/shortlists/${globexListId}`, acme.token)).toBe(404);
      await expectGlobexUnchanged();
    });
  });

  describe("directly through Supabase with acme's token", () => {
    it("reads none of globex's lists or members", async () => {
      const lists = await acme.client.from("shortlists").select("id").eq("id", globexListId);
      expect(lists.data).toEqual([]);
      const members = await acme.client
        .from("shortlist_members")
        .select("candidate_id")
        .eq("shortlist_id", globexListId);
      expect(members.data).toEqual([]);
    });

    it("can't create a list for globex", async () => {
      const { error } = await acme.client.from("shortlists").insert({ company_id: globexCompanyId, name: "sneaky" });
      expect(error).not.toBeNull();
    });

    it("can't move its own list to globex", async () => {
      const own = await acme.client
        .from("shortlists")
        .insert({ company_id: await acmeCompanyId(), name: `${NAME} own` })
        .select("id")
        .single();
      expect(own.error).toBeNull(); // acme can make its own list, so the refusal below is about company_id
      const moved = await acme.client.from("shortlists").update({ company_id: globexCompanyId }).eq("id", own.data?.id);
      expect(moved.error).not.toBeNull(); // only the name may be updated
      await acme.client.from("shortlists").delete().eq("id", own.data?.id);
    });

    it("can't rename, delete or add to globex's list", async () => {
      const renamed = await acme.client
        .from("shortlists")
        .update({ name: "taken over" })
        .eq("id", globexListId)
        .select();
      expect(renamed.data ?? []).toEqual([]);
      const deleted = await acme.client.from("shortlists").delete().eq("id", globexListId).select();
      expect(deleted.data ?? []).toEqual([]);
      const added = await acme.client
        .from("shortlist_members")
        .insert({ shortlist_id: globexListId, candidate_id: "cand_0001" });
      expect(added.error).not.toBeNull();
      const removed = await acme.client
        .from("shortlist_members")
        .delete()
        .eq("shortlist_id", globexListId)
        .select();
      expect(removed.data ?? []).toEqual([]);
      await expectGlobexUnchanged();
    });

    it("gives a caller who isn't signed in nothing", async () => {
      const lists = await anonClient().from("shortlists").select("id");
      expect(lists.data ?? []).toEqual([]);
      const members = await anonClient().from("shortlist_members").select("candidate_id");
      expect(members.data ?? []).toEqual([]);
    });
  });

  async function acmeCompanyId(): Promise<string> {
    const { data } = await acme.client.from("recruiters").select("company_id").single();
    return data?.company_id as string;
  }
});
