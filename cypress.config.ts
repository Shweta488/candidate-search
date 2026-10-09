// End-to-end tests against the running app (make setup, then make dev). See docs/TESTING.md.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { defineConfig } from "cypress";

// Local Supabase values from .env.local, for test setup only.
function readEnvLocal(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

async function setSearchesUsed(company: string, used: number): Promise<null> {
  const env = readEnvLocal();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.schema("private").from("companies").update({ searches_used: used }).eq("code", company);
  if (error) throw new Error(`Could not set searches for ${company}: ${error.message}`);
  return null;
}

export default defineConfig({
  e2e: {
    baseUrl: process.env.APP_URL ?? "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    video: false,
    screenshotOnRunFailure: true,
    setupNodeEvents(on) {
      on("task", {
        // Gives a company its free search back, so a spec can run a real search.
        resetSearches: (company: string) => setSearchesUsed(company, 0),
        // Uses up a company's free search, to show the free plan at its limit.
        useFreeSearch: (company: string) => setSearchesUsed(company, 1),
      });
    },
  },
});
