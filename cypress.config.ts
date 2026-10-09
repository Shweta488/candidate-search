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
  const { error } = await adminClient()
    .schema("private")
    .from("companies")
    .update({ searches_used: used })
    .eq("code", company);
  if (error) throw new Error(`Could not set searches for ${company}: ${error.message}`);
  return null;
}

function adminClient() {
  const env = readEnvLocal();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function companyId(company: string): Promise<string> {
  const { data, error } = await adminClient()
    .schema("private")
    .from("companies")
    .select("id")
    .eq("code", company)
    .single();
  if (error) throw new Error(`Could not find ${company}: ${error.message}`);
  return data.id as string;
}

// Deletes all of a company's rows in one of its public tables, so a spec starts from none.
async function deleteCompanyRows(table: "shortlists" | "saved_briefs", company: string): Promise<null> {
  const { error } = await adminClient()
    .from(table)
    .delete()
    .eq("company_id", await companyId(company));
  if (error) throw new Error(`Could not delete ${table} for ${company}: ${error.message}`);
  return null;
}

async function saveBrief(args: { company: string; brief: string; filters: object }): Promise<null> {
  const { error } = await adminClient()
    .from("saved_briefs")
    .insert({
      company_id: await companyId(args.company),
      brief: args.brief,
      filters: args.filters,
    });
  if (error) throw new Error(`Could not save a search for ${args.company}: ${error.message}`);
  return null;
}

export default defineConfig({
  e2e: {
    baseUrl: process.env.APP_URL ?? "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    video: false,
    // make dev compiles a page on its first visit and shares the machine with the test
    // browser, so allow up to 10 s (Cypress's default is 4 s) before an element counts as missing.
    defaultCommandTimeout: 10_000,
    screenshotOnRunFailure: true,
    setupNodeEvents(on) {
      on("task", {
        // Gives a company its free search back, so a spec can run a real search.
        resetSearches: (company: string) => setSearchesUsed(company, 0),
        // Uses up a company's free search, to show the free plan at its limit.
        useFreeSearch: (company: string) => setSearchesUsed(company, 1),
        // Deletes a company's shortlists, so a spec starts from none.
        deleteShortlists: (company: string) => deleteCompanyRows("shortlists", company),
        // Deletes a company's saved searches, so a spec starts from none.
        deleteSavedBriefs: (company: string) => deleteCompanyRows("saved_briefs", company),
        // Saves a search for a company directly, so a spec can start from one.
        saveBrief,
      });
    },
  },
});
