import "server-only";
import { z } from "zod";

// Server environment variables (LLD 9), validated the first time each group is used,
// so a missing value fails with its name instead of deep inside a request.

const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

type SupabaseEnv = { url: string; publishableKey: string; secretKey: string };

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

// The model key is read from the shell (make dev refuses to start without it) and is
// only used by src/server/search/extractFilters.ts.
export function getAnthropicApiKey(source: Record<string, string | undefined> = process.env): string {
  const key = source.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("Missing environment variable: ANTHROPIC_API_KEY. Export it before make dev.");
  return key;
}

type StripeWebhookEnv = { secret: string; toleranceSeconds: number | undefined };

// The webhook secret is read from the shell (make dev refuses to start without it). The age
// check is off unless STRIPE_WEBHOOK_TOLERANCE_SECONDS is set (LLD 5.2).
export function getStripeWebhookEnv(source: Record<string, string | undefined> = process.env): StripeWebhookEnv {
  const secret = source.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("Missing environment variable: STRIPE_WEBHOOK_SECRET. Export it before make dev.");

  const tolerance = source.STRIPE_WEBHOOK_TOLERANCE_SECONDS?.trim();
  if (!tolerance) return { secret, toleranceSeconds: undefined };
  const seconds = Number(tolerance);
  if (!Number.isInteger(seconds) || seconds <= 0) {
    throw new Error(
      "Invalid environment variable: STRIPE_WEBHOOK_TOLERANCE_SECONDS must be a whole number of seconds.",
    );
  }
  return { secret, toleranceSeconds: seconds };
}
