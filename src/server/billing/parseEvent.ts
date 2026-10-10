import "server-only";
import { z } from "zod";

// The event shape we rely on, checked only after the signature passes (LLD 5.3).
// Stripe sends many more fields; zod ignores them.

const SUBSCRIPTION_TYPES = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

const eventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  created: z.number().int(),
});

const subscriptionSchema = z.object({
  data: z.object({
    object: z.object({
      id: z.string().min(1),
      status: z.string().min(1),
      metadata: z.object({ company: z.string().min(1) }),
    }),
  }),
});

export type StripeEvent = {
  id: string;
  type: string;
  created: number;
  // null for any type other than the three subscription events, which are recorded as ignored
  subscription: { id: string; companyCode: string; status: string } | null;
};

// Throws a ZodError (400 invalid_request) when a field we need is missing.
export function parseEvent(body: unknown): StripeEvent {
  const event = eventSchema.parse(body);
  if (!(SUBSCRIPTION_TYPES as readonly string[]).includes(event.type)) {
    return { ...event, subscription: null };
  }

  const subscription = subscriptionSchema.parse(body).data.object;
  return {
    ...event,
    subscription: {
      id: subscription.id,
      companyCode: subscription.metadata.company,
      // A deleted subscription is over, whatever status the payload carries.
      status: event.type === "customer.subscription.deleted" ? "canceled" : subscription.status,
    },
  };
}
