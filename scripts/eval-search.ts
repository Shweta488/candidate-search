// Search accuracy report (docs/TESTING.md): runs data/queries.json and data/extra-queries.json
// through POST /api/search on the running app, pages to the end, and prints precision,
// recall, F1 and page-1 precision per brief. Needs make dev with a real ANTHROPIC_API_KEY.
// Each brief is one Claude call. Exits with 1 if any of the 10 samples is below 100%.
// Words after the command keep only briefs containing one of them, to re-run a few:
//   npm run eval:search -- "senior React" recruiters
//
// Extra briefs give either expected_ids, or expected_filters: the filters a recruiter would
// mean, which are searched directly (no LLM) to get the expected people.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { readLocalSupabase } from "./supabase-status.ts";

type Query = { brief: string; note?: string; expected_ids?: string[]; expected_filters?: Record<string, unknown> };
type Page = {
  search_id: string;
  total_pages: number;
  filters: unknown;
  unsupported: string[];
  results: { id: string }[];
};

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const local = readLocalSupabase();
const admin = createClient(local.url, local.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

function readQueries(file: string): Query[] {
  return JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), "utf8")) as Query[];
}

async function signIn(): Promise<string> {
  const client = createClient(local.url, local.publishableKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email: "recruiter@acme.test",
    password: "demo-password",
  });
  if (error || !data.session) throw new Error(`Could not sign in: ${error?.message}`);
  return data.session.access_token;
}

// The free plan allows one search, so the counter is reset before each one.
async function resetSearches(): Promise<void> {
  const { error } = await admin.schema("private").from("companies").update({ searches_used: 0 }).eq("code", "acme");
  if (error) throw new Error(`Could not reset searches: ${error.message}`);
}

async function call<T>(token: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${APP_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await response.json()) as T & { error?: { message: string } };
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${json.error?.message}`);
  return json;
}

// Runs a search and pages to the end. Returns every id in rank order and page 1's ids.
async function searchAll(
  token: string,
  body: unknown,
): Promise<{ first: Page; ids: string[]; page1: string[]; ms: number }> {
  await resetSearches();
  const started = performance.now();
  const first = await call<Page>(token, "/api/search", body);
  const ms = Math.round(performance.now() - started);
  const ids = first.results.map((c) => c.id);
  for (let page = 2; page <= first.total_pages; page++) {
    const next = await call<Page>(token, `/api/search/${first.search_id}?page=${page}`);
    ids.push(...next.results.map((c) => c.id));
  }
  return { first, ids, page1: first.results.map((c) => c.id), ms };
}

const pct = (n: number) => `${Math.round(n * 100)}%`.padStart(5);

function score(expected: Set<string>, got: string[], page1: string[]) {
  const hits = got.filter((id) => expected.has(id)).length;
  // An empty result for an empty expectation is a perfect answer.
  const precision = got.length === 0 ? (expected.size === 0 ? 1 : 0) : hits / got.length;
  const recall = expected.size === 0 ? (got.length === 0 ? 1 : 0) : hits / expected.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const page1Precision =
    page1.length === 0 ? (expected.size === 0 ? 1 : 0) : page1.filter((id) => expected.has(id)).length / page1.length;
  return { precision, recall, f1, page1Precision };
}

const only = process.argv.slice(2).map((word) => word.toLowerCase());
const selected = (query: Query) => only.length === 0 || only.some((word) => query.brief.toLowerCase().includes(word));

const token = await signIn();
let samplesPerfect = true;

for (const [file, isSample] of [
  ["queries.json", true],
  ["extra-queries.json", false],
] as const) {
  const header = ["P", "R", "F1", "P@1"].map((h) => h.padStart(5)).join(" ");
  console.log(`\n${file}\n${header}  exp  got     ms  brief`);
  for (const query of readQueries(file).filter(selected)) {
    const expectedIds =
      query.expected_ids ?? (await searchAll(token, { brief: query.brief, filters: query.expected_filters })).ids;
    const expected = new Set(expectedIds);
    const started = performance.now();
    let result: Awaited<ReturnType<typeof searchAll>>;
    try {
      result = await searchAll(token, { brief: query.brief });
    } catch (error) {
      // For example a 503 when the LLM timed out: report it and carry on.
      const ms = Math.round(performance.now() - started);
      if (isSample) samplesPerfect = false;
      console.log(`  failed after ${ms} ms: ${(error as Error).message}  ${query.brief}`);
      continue;
    }
    const { first, ids, page1, ms } = result;
    const s = score(expected, ids, page1);
    if (isSample && s.f1 < 1) samplesPerfect = false;
    const scores = [s.precision, s.recall, s.f1, s.page1Precision].map(pct).join(" ");
    const counts = `${String(expected.size).padStart(4)} ${String(ids.length).padStart(4)}`;
    console.log(`${scores} ${counts} ${String(ms).padStart(6)}  ${query.brief}`);
    if (s.f1 < 1) {
      console.log(`      filters: ${JSON.stringify(first.filters)}  unsupported: ${JSON.stringify(first.unsupported)}`);
    }
  }
}

await resetSearches();
console.log(samplesPerfect ? "\nAll 10 samples at 100%." : "\nSome samples are below 100%.");
process.exit(samplesPerfect ? 0 : 1);
