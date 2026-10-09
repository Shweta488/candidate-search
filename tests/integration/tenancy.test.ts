// Tenant isolation when a recruiter calls Supabase directly with their own token (LLD 2.4).
// Grows with each story that adds company data (shortlists in S5, saved searches in S6).
import { anonClient, RECRUITERS, signIn } from "./helpers";

describe("direct Supabase access", () => {
  it("shows a recruiter only their own recruiter row", async () => {
    const acme = await signIn(RECRUITERS.acme);
    const { data, error } = await acme.client.from("recruiters").select("user_id, company_id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].user_id).toBe(acme.userId);
  });

  it("does not let a recruiter add themselves to another company", async () => {
    const acme = await signIn(RECRUITERS.acme);
    const globex = await signIn(RECRUITERS.globex);
    const { data: globexRow } = await globex.client.from("recruiters").select("company_id").single();

    const { error } = await acme.client.from("recruiters").insert({ user_id: acme.userId, company_id: globexRow?.company_id });
    expect(error).not.toBeNull();
    const { error: updateError, data: updated } = await acme.client
      .from("recruiters")
      .update({ company_id: globexRow?.company_id })
      .eq("user_id", acme.userId)
      .select();
    expect(updateError ?? (updated?.length === 0 ? "no rows" : null)).not.toBeNull();
  });

  it("does not allow new accounts to be created", async () => {
    const { data, error } = await anonClient().auth.signUp({ email: "stranger@example.test", password: "a-long-password-1" });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });

  it("returns nothing to a caller who is not signed in", async () => {
    const { data } = await anonClient().from("recruiters").select("user_id");
    expect(data ?? []).toHaveLength(0);
  });

  it.each(["companies", "subscriptions"])("refuses private.%s to a recruiter", async (table) => {
    const acme = await signIn(RECRUITERS.acme);
    const { data, error } = await acme.client.schema("private").from(table).select("*");
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("refuses private functions to a recruiter", async () => {
    const acme = await signIn(RECRUITERS.acme);
    const { data: own } = await acme.client.from("recruiters").select("company_id").single();
    const { data, error } = await acme.client.schema("private").rpc("get_plan", { p_company_id: own?.company_id });
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});
