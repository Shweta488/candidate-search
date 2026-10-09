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
export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
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

export async function api(path: string, token?: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${APP_URL}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { status: response.status, body: await response.json() };
}
