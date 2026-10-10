import "server-only";
import { serverClient } from "../supabase";
import type { StripeEvent } from "./parseEvent";

type StripeEventOutcome = "applied" | "duplicate" | "stale" | "ignored";

// Records the event and updates the subscription in one transaction (LLD 5.4). The plan
// itself is never stored: is_paid reads subscriptions on every request.
export async function handleStripeEvent(event: StripeEvent): Promise<StripeEventOutcome> {
  const { data, error } = await serverClient()
    .schema("private")
    .rpc("apply_stripe_event", {
      p_event_id: event.id,
      p_type: event.type,
      p_created: event.created,
      p_subscription_id: event.subscription?.id ?? null,
      p_company_code: event.subscription?.companyCode ?? null,
      p_status: event.subscription?.status ?? null,
    });
  if (error) throw error;
  return data as StripeEventOutcome;
}
