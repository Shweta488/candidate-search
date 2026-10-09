// Writes .env.local with the local Supabase URL and keys from `supabase status` (LLD 7.5).
// The model key and webhook secret are never written here; Next.js reads them from the shell.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

type Status = Record<string, string | undefined>;

function readStatus(): Status {
  const output = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  // The CLI can print notices around the JSON, so parse from the first brace.
  return JSON.parse(output.slice(output.indexOf("{"))) as Status;
}

function pick(status: Status, ...names: string[]): string {
  for (const name of names) {
    const value = status[name];
    if (value) return value;
  }
  throw new Error(`supabase status did not include any of: ${names.join(", ")}`);
}

const status = readStatus();
const lines = [
  "# Written by scripts/write-env.ts from `supabase status`. Local values only; never commit.",
  `NEXT_PUBLIC_SUPABASE_URL=${pick(status, "API_URL")}`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${pick(status, "PUBLISHABLE_KEY")}`,
  `SUPABASE_SECRET_KEY=${pick(status, "SECRET_KEY")}`,
];
writeFileSync(".env.local", lines.join("\n") + "\n");
console.log("Wrote .env.local");
