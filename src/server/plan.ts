import "server-only";
import type { PlanResponse } from "@/shared/types";
import { serverClient } from "./supabase";

// The plan is derived on read by private.get_plan (LLD 4.6).
export async function getPlan(companyId: string): Promise<PlanResponse> {
  const { data, error } = await serverClient()
    .schema("private")
    .rpc("get_plan", { p_company_id: companyId })
    .single<PlanResponse>();
  if (error) throw error;
  return { plan: data.plan, searches_remaining: data.searches_remaining };
}
