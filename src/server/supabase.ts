import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

// Two clients (LLD 4.1). serverClient is our server acting as itself (secret key, bypasses RLS):
// used only where we have already decided what the recruiter may see.
// recruiterClient acts as the recruiter, so Postgres applies RLS to every query.

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

let server: SupabaseClient | undefined;

export function serverClient(): SupabaseClient {
  if (!server) {
    const env = getSupabaseEnv();
    server = createClient(env.url, env.secretKey, { auth: noSession });
  }
  return server;
}

export function recruiterClient(token: string): SupabaseClient {
  const env = getSupabaseEnv();
  return createClient(env.url, env.publishableKey, {
    auth: noSession,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
