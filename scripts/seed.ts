// Seeds the local database (LLD 7.4): the two companies, one recruiter each, and the
// 5,000 candidates from data/candidates.json.
// Safe to run more than once: companies, recruiters and candidates are upserts, existing
// users are reused, and experiences and educations are replaced.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { readLocalSupabase } from "./supabase-status.ts";

const PASSWORD = "demo-password";
const COMPANIES = [
  { code: "acme", name: "Acme", recruiterEmail: "recruiter@acme.test" },
  { code: "globex", name: "Globex", recruiterEmail: "recruiter@globex.test" },
];

const BATCH_SIZE = 500;
const EXPECTED = { companies: 2, recruiters: 2, candidates: 5000, experiences: 9620, educations: 5000 };

const Experience = z.object({
  title: z.string(),
  company: z.string(),
  company_logo_url: z.string(),
  company_type: z.string(),
  start_year: z.number().int(),
  end_year: z.number().int().nullable(),
  description: z.string(),
});
const Education = z.object({
  school: z.string(),
  degree: z.string(),
  field: z.string(),
  graduation_year: z.number().int(),
});
const CandidateRecord = z.object({
  id: z.string(),
  full_name: z.string(),
  headline: z.string(),
  avatar_url: z.string(),
  current_title: z.string(),
  current_company: z.string(),
  current_company_logo_url: z.string(),
  role: z.string(),
  seniority: z.enum(["junior", "mid", "senior", "staff"]),
  years_experience: z.number().int().min(0).max(60),
  location: z.object({ city: z.string(), state: z.string(), country: z.string() }),
  open_to_work: z.boolean(),
  skills: z.array(z.string()),
  experiences: z.array(Experience),
  education: z.array(Education),
});
type CandidateRecord = z.infer<typeof CandidateRecord>;

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

function readCandidates(): CandidateRecord[] {
  const raw: unknown = JSON.parse(readFileSync(new URL("../data/candidates.json", import.meta.url), "utf8"));
  if (!Array.isArray(raw)) throw new Error("data/candidates.json should be a list of candidates.");
  return raw.map((record: { id?: unknown }) => {
    const parsed = CandidateRecord.safeParse(record);
    if (!parsed.success) {
      throw new Error(`Candidate ${String(record.id)} is invalid: ${parsed.error.issues[0]?.message}`);
    }
    return parsed.data;
  });
}

const distinct = (values: string[]) => [...new Set(values)];

// One flat row per candidate: location flattened, and the arrays every filter needs
// (LLD 2.2) derived from experiences and education.
function candidateRow(c: CandidateRecord) {
  return {
    id: c.id,
    full_name: c.full_name,
    headline: c.headline,
    avatar_url: c.avatar_url,
    current_title: c.current_title,
    current_company: c.current_company,
    current_company_logo_url: c.current_company_logo_url,
    role: c.role,
    seniority: c.seniority,
    years_experience: c.years_experience,
    city: c.location.city,
    state: c.location.state,
    country: c.location.country,
    open_to_work: c.open_to_work,
    skills: c.skills,
    past_companies: distinct(c.experiences.map((e) => e.company)),
    past_company_types: distinct(c.experiences.map((e) => e.company_type)),
    schools: distinct(c.education.map((e) => e.school)),
    degrees: distinct(c.education.map((e) => e.degree)),
    fields_of_study: distinct(c.education.map((e) => e.field)),
  };
}

async function insertInBatches(table: string, rows: object[], onConflict?: string): Promise<void> {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const { error } = onConflict
      ? await privateSchema.from(table).upsert(batch, { onConflict })
      : await privateSchema.from(table).insert(batch);
    if (error) throw new Error(`Could not seed ${table}: ${error.message}`);
  }
}

async function seedCandidates(): Promise<void> {
  const candidates = readCandidates();
  await insertInBatches("candidates", candidates.map(candidateRow), "id");

  // Replace experiences and education, so a second run doesn't duplicate them.
  for (const table of ["experiences", "educations"]) {
    const { error } = await privateSchema.from(table).delete().gte("id", 0);
    if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
  }
  await insertInBatches(
    "experiences",
    candidates.flatMap((c) => c.experiences.map((e, position) => ({ candidate_id: c.id, position, ...e }))),
  );
  await insertInBatches(
    "educations",
    candidates.flatMap((c) => c.education.map((e) => ({ candidate_id: c.id, ...e }))),
  );
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

await seedCandidates();

const counts = {
  companies: await count("companies", "private"),
  recruiters: await count("recruiters", "public"),
  candidates: await count("candidates", "private"),
  experiences: await count("experiences", "private"),
  educations: await count("educations", "private"),
};
console.log(
  `Seeded: ${counts.companies} companies, ${counts.recruiters} recruiters, ${counts.candidates} candidates, ` +
    `${counts.experiences} experiences, ${counts.educations} educations`,
);
const wrong = Object.entries(EXPECTED).filter(([table, expected]) => counts[table as keyof typeof counts] !== expected);
if (wrong.length > 0) {
  console.error(`Seed counts are wrong: expected ${wrong.map(([table, n]) => `${n} ${table}`).join(", ")}.`);
  process.exit(1);
}
