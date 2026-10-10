// Shared setup for integration tests: local URLs and keys from .env.local, and signed-in clients.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function readEnvLocal(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

const env = readEnvLocal();

export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
export const PUBLISHABLE_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const PASSWORD = "demo-password";

export const RECRUITERS = { acme: "recruiter@acme.test", globex: "recruiter@globex.test" } as const;

const noSession = { persistSession: false, autoRefreshToken: false };

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: noSession });
}

export async function signIn(email: string): Promise<{ client: SupabaseClient; token: string; userId: string }> {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw new Error(`Could not sign in ${email}: ${error?.message}`);
  return { client, token: data.session.access_token, userId: data.session.user.id };
}

export async function api<T = unknown>(path: string, token?: string): Promise<{ status: number; body: T }> {
  const response = await fetch(`${APP_URL}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { status: response.status, body: await response.json() };
}

// The server's own client (secret key), used only to set up test state: resetting a
// company's free search and counting rows. It never stands in for a recruiter.
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: noSession });
}

// Gives the company its free search back, so a test can search (the free plan allows 1).
export async function resetSearches(company: "acme" | "globex"): Promise<void> {
  const { error } = await adminClient()
    .schema("private")
    .from("companies")
    .update({ searches_used: 0 })
    .eq("code", company);
  if (error) throw new Error(`Could not reset searches for ${company}: ${error.message}`);
}

export async function postJson<T = unknown>(
  path: string,
  body: unknown,
  token?: string,
): Promise<{ status: number; body: T }> {
  const response = await fetch(`${APP_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

// Filters for the first sample brief. Sending filters skips the LLM, so tests that are
// about credits and paging cost nothing (LLD 1.3).
export const SAMPLE_FILTERS = {
  seniorities: ["senior"],
  skills: ["React"],
  cities: ["New York"],
  worked_at_company_types: ["startup"],
};
export const SAMPLE_BRIEF = "senior React engineers in New York who have worked at a startup";
