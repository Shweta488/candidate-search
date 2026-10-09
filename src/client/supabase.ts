import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "./env";

// The browser Supabase client, used for auth only. Data goes through our /api routes.
let client: SupabaseClient | undefined;

export function browserSupabase(): SupabaseClient {
  client ??= createClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey);
  return client;
}
