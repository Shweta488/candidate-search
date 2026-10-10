// Sends data/stripe-events.json to POST /api/billing/events on the running app, byte for
// byte with each event's own Stripe-Signature header, then prints each company's plan.
// Needs make dev with STRIPE_WEBHOOK_SECRET=whsec_test_sample. Expected end:
// acme free, globex paid. Running it again only reports duplicates; make reset undoes it.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { requireRunningApp } from "./app-running.ts";
import { readLocalSupabase } from "./supabase-status.ts";

type SampleFile = {
  events: { description: string; headers: { "Stripe-Signature": string }; payload: string }[];
  expected_plans_after: Record<string, string>;
};

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const samples = JSON.parse(readFileSync(new URL("../data/stripe-events.json", import.meta.url), "utf8")) as SampleFile;

await requireRunningApp(APP_URL);

for (const event of samples.events) {
  const response = await fetch(`${APP_URL}/api/billing/events`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": event.headers["Stripe-Signature"] },
    body: event.payload,
  });
  const body = (await response.json()) as { outcome?: string; error?: { code: string } };
  const result = response.ok ? body.outcome : `${response.status} ${body.error?.code}`;
  console.log(`${event.description.padEnd(40)} ${result}`);
}

const local = readLocalSupabase();
const admin = createClient(local.url, local.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: companies, error } = await admin.schema("private").from("companies").select("id, code").order("code");
if (error) throw error;

const plans: string[] = [];
let allExpected = true;
for (const company of companies) {
  const { data, error: planError } = await admin
    .schema("private")
    .rpc("get_plan", { p_company_id: company.id })
    .single<{ plan: string }>();
  if (planError) throw planError;
  plans.push(`${company.code} ${data.plan}`);
  if (samples.expected_plans_after[company.code] !== data.plan) allExpected = false;
}
console.log(`\nPlans now: ${plans.join(", ")}`);
if (!allExpected) {
  console.log("That isn't the expected acme free, globex paid. Was the database reset first (make reset)?");
  process.exitCode = 1;
}
