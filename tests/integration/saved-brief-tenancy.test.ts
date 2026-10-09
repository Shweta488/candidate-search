// Saved search isolation (NFR1, LLD 2.4, docs/TESTING.md). Globex saves a search; acme
// tries to read and change it through our API and directly through Supabase with its own
// token. Every attempt must fail or match nothing, and globex's saved search must be unchanged.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SavedBrief } from "@/shared/types";
import { adminClient, anonClient, api, APP_URL, postJson, RECRUITERS, signIn } from "./helpers";

const BRIEF = `globex tenancy ${Date.now()}`;
const FILTERS = { skills: ["React"] };

async function remove(path: string, token: string) {
  const response = await fetch(`${APP_URL}${path}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
  return response.status;
}

describe("saved search tenancy", () => {
  let acme: { client: SupabaseClient; token: string };
  let globexSavedId: string;
  let globexCompanyId: string;
  let acmeCompanyId: string;

  beforeAll(async () => {
    acme = await signIn(RECRUITERS.acme);
    const globex = await signIn(RECRUITERS.globex);
    const created = await postJson<{ id: string }>(
      "/api/saved-briefs",
      { brief: BRIEF, filters: FILTERS },
      globex.token,
    );
    globexSavedId = created.body.id;
    const { data } = await adminClient().schema("private").from("companies").select("id, code");
    globexCompanyId = data?.find((c) => c.code === "globex")?.id as string;
    acmeCompanyId = data?.find((c) => c.code === "acme")?.id as string;
  });

  afterAll(async () => {
    await adminClient().from("saved_briefs").delete().like("brief", `${BRIEF}%`);
  });

  // Globex's saved search must be exactly as it was made.
  async function expectGlobexUnchanged() {
    const { data } = await adminClient()
      .from("saved_briefs")
      .select("brief, filters, company_id")
      .eq("id", globexSavedId)
      .single();
    expect(data).toEqual({ brief: BRIEF, filters: FILTERS, company_id: globexCompanyId });
  }

  describe("through our API", () => {
    it("never shows globex's saved search to acme", async () => {
      const saved = await api<{ saved_briefs: SavedBrief[] }>("/api/saved-briefs", acme.token);
      expect(saved.status).toBe(200);
      expect(saved.body.saved_briefs.map((s) => s.id)).not.toContain(globexSavedId);
    });

    it("answers 404 when acme deletes it", async () => {
      expect(await remove(`/api/saved-briefs/${globexSavedId}`, acme.token)).toBe(404);
      await expectGlobexUnchanged();
    });

    it("saves acme's searches for acme, whatever the body says", async () => {
      const created = await postJson<{ id: string }>(
        "/api/saved-briefs",
        { brief: `${BRIEF} acme`, filters: FILTERS, company_id: globexCompanyId },
        acme.token,
      );
      expect(created.status).toBe(201);
      const { data } = await adminClient().from("saved_briefs").select("company_id").eq("id", created.body.id).single();
      expect(data?.company_id).toBe(acmeCompanyId);
    });
  });

  describe("directly through Supabase with acme's token", () => {
    it("reads none of globex's saved searches", async () => {
      const { data } = await acme.client.from("saved_briefs").select("id").eq("id", globexSavedId);
      expect(data).toEqual([]);
    });

    it("can't save a search for globex", async () => {
      // acme can save its own, so the refusal below is about company_id.
      const own = await acme.client
        .from("saved_briefs")
        .insert({ company_id: acmeCompanyId, brief: `${BRIEF} own`, filters: FILTERS });
      expect(own.error).toBeNull();
      const theirs = await acme.client
        .from("saved_briefs")
        .insert({ company_id: globexCompanyId, brief: `${BRIEF} sneaky`, filters: FILTERS });
      expect(theirs.error).not.toBeNull();
    });

    it("can't change or delete globex's saved search", async () => {
      const changed = await acme.client
        .from("saved_briefs")
        .update({ brief: "taken over" })
        .eq("id", globexSavedId)
        .select();
      expect(changed.error).not.toBeNull(); // no update grant at all
      const deleted = await acme.client.from("saved_briefs").delete().eq("id", globexSavedId).select();
      expect(deleted.data ?? []).toEqual([]);
      await expectGlobexUnchanged();
    });

    it("can't move its own saved search to globex", async () => {
      const { data: own } = await acme.client
        .from("saved_briefs")
        .select("id")
        .like("brief", `${BRIEF}%`)
        .limit(1)
        .single();
      const moved = await acme.client.from("saved_briefs").update({ company_id: globexCompanyId }).eq("id", own?.id);
      expect(moved.error).not.toBeNull();
    });

    it("gives a caller who isn't signed in nothing", async () => {
      const read = await anonClient().from("saved_briefs").select("id");
      expect(read.data ?? []).toEqual([]);
      const written = await anonClient()
        .from("saved_briefs")
        .insert({ company_id: globexCompanyId, brief: `${BRIEF} anon`, filters: FILTERS });
      expect(written.error).not.toBeNull();
    });
  });
});
