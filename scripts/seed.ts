// Seeds the local database (LLD 7.4): the two companies and one recruiter each.
// Safe to run more than once: every write is an upsert and existing users are reused.
// Candidates are added in a later story.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readLocalSupabase } from "./supabase-status.ts";

const PASSWORD = "demo-password";
const COMPANIES = [
  { code: "acme", name: "Acme", recruiterEmail: "recruiter@acme.test" },
  { code: "globex", name: "Globex", recruiterEmail: "recruiter@globex.test" },
];

const local = readLocalSupabase();
const supabase = createClient(local.url, local.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const privateSchema = supabase.schema("private");

async function seedCompany(code: string, name: string): Promise<string> {
  const { data, error } = await privateSchema
    .from("companies")
    .upsert({ code, name, searches_used: 0 }, { onConflict: "code" })
    .select("id")
    .single();
  if (error) throw new Error(`Could not seed company ${code}: ${error.message}`);
  return data.id;
}

async function findOrCreateUser(client: SupabaseClient, email: string): Promise<string> {
  const created = await client.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (created.data.user) return created.data.user.id;

  // Already exists from an earlier run: look it up instead.
  const { data, error } = await client.auth.admin.listUsers();
  if (error) throw new Error(`Could not list users: ${error.message}`);
  const existing = data.users.find((user) => user.email === email);
  if (!existing) throw new Error(`Could not create ${email}: ${created.error?.message}`);
  return existing.id;
}

async function seedRecruiter(email: string, companyId: string): Promise<void> {
  const userId = await findOrCreateUser(supabase, email);
  const { error } = await supabase
    .from("recruiters")
    .upsert({ user_id: userId, company_id: companyId }, { onConflict: "user_id" });
  if (error) throw new Error(`Could not seed recruiter ${email}: ${error.message}`);
}

async function count(table: string, schema: "public" | "private"): Promise<number> {
  const { count: rows, error } = await supabase.schema(schema).from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`Could not count ${schema}.${table}: ${error.message}`);
  return rows ?? 0;
}

for (const company of COMPANIES) {
  const companyId = await seedCompany(company.code, company.name);
  await seedRecruiter(company.recruiterEmail, companyId);
}

const counts = { companies: await count("companies", "private"), recruiters: await count("recruiters", "public") };
console.log(`Seeded: ${counts.companies} companies, ${counts.recruiters} recruiters`);
if (counts.companies !== 2 || counts.recruiters !== 2) {
  console.error("Seed counts are wrong: expected 2 companies and 2 recruiters.");
  process.exit(1);
}
