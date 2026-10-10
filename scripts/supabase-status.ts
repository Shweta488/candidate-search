// Reads the local Supabase URL and keys from `supabase status`, so scripts can run
// before .env.local exists (LLD 9).
import { execFileSync } from "node:child_process";

type Status = Record<string, string | undefined>;

type LocalSupabase = { url: string; publishableKey: string; secretKey: string };

export function readLocalSupabase(): LocalSupabase {
  const output = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  // The CLI can print notices around the JSON, so parse from the first brace.
  const status = JSON.parse(output.slice(output.indexOf("{"))) as Status;
  return {
    url: pick(status, "API_URL"),
    publishableKey: pick(status, "PUBLISHABLE_KEY"),
    secretKey: pick(status, "SECRET_KEY"),
  };
}

function pick(status: Status, name: string): string {
  const value = status[name];
  if (!value) throw new Error(`supabase status did not include ${name}. Is Supabase running?`);
  return value;
}
