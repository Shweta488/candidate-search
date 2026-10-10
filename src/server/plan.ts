import "server-only";
import type { PlanResponse } from "@/shared/types";
import { AppError } from "./errors";
import { serverClient } from "./supabase";

// The plan is derived on read by private.get_plan (LLD 4.6), with the company name for the header.
export async function getPlan(companyId: string): Promise<PlanResponse> {
  const { data, error } = await serverClient()
    .schema("private")
    .rpc("get_plan", { p_company_id: companyId })
    .single<PlanResponse>();
  if (error) throw error;
  return { plan: data.plan, searches_remaining: data.searches_remaining, company_name: data.company_name };
}

// Spends one search (LLD 4.6). Returns the searches left after this one, or null on the
// paid plan. private.spend_search_credit returns no row when the free search is used up.
export async function spendSearchCredit(companyId: string): Promise<number | null> {
  const { data, error } = await serverClient()
    .schema("private")
    .rpc("spend_search_credit", { p_company_id: companyId });
  if (error) throw error;
  const row = (data as { searches_remaining: number | null }[] | null)?.[0];
  if (!row) throw new AppError("search_limit_reached", "You've used your free search.");
  return row.searches_remaining;
}

// Gives the search back when it couldn't run (the LLM failed or the search errored).
export async function refundSearchCredit(companyId: string): Promise<void> {
  const { error } = await serverClient().schema("private").rpc("refund_search_credit", { p_company_id: companyId });
  if (error) throw error;
}
