// Writes .env.local with the local Supabase URL and keys from `supabase status` (LLD 7.5).
// The model key and webhook secret are never written here; Next.js reads them from the shell.
import { writeFileSync } from "node:fs";
import { readLocalSupabase } from "./supabase-status.ts";

const supabase = readLocalSupabase();
const lines = [
  "# Written by scripts/write-env.ts from `supabase status`. Local values only; never commit.",
  `NEXT_PUBLIC_SUPABASE_URL=${supabase.url}`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${supabase.publishableKey}`,
  `SUPABASE_SECRET_KEY=${supabase.secretKey}`,
];
writeFileSync(".env.local", lines.join("\n") + "\n");
console.log("Wrote .env.local");
