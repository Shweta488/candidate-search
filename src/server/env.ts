import "server-only";
import { z } from "zod";

// Server environment variables (LLD 9), validated the first time each group is used,
// so a missing value fails with its name instead of deep inside a request.

const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export type SupabaseEnv = { url: string; publishableKey: string; secretKey: string };

let supabaseEnv: SupabaseEnv | undefined;

export function getSupabaseEnv(source: Record<string, string | undefined> = process.env): SupabaseEnv {
  if (supabaseEnv && source === process.env) return supabaseEnv;
  const parsed = supabaseSchema.safeParse(source);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables: ${names}. Run make setup.`);
  }
  const env = {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    secretKey: parsed.data.SUPABASE_SECRET_KEY,
  };
  if (source === process.env) supabaseEnv = env;
  return env;
}
