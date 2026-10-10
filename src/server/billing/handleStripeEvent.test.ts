import { serverClient } from "../supabase";
import { handleStripeEvent } from "./handleStripeEvent";

jest.mock("../supabase", () => ({ serverClient: jest.fn() }));

function fakeRpc(result: { data: unknown; error: unknown }) {
  const rpc = jest.fn().mockResolvedValue(result);
  const schema = jest.fn().mockReturnValue({ rpc });
  jest.mocked(serverClient).mockReturnValue({ schema } as never);
  return { schema, rpc };
}

describe("handleStripeEvent", () => {
  it("passes a subscription event to private.apply_stripe_event and returns the outcome", async () => {
    const { schema, rpc } = fakeRpc({ data: "applied", error: null });
    const outcome = await handleStripeEvent({
      id: "evt_1",
      type: "customer.subscription.created",
      created: 100,
      subscription: { id: "sub_1", companyCode: "acme", status: "active" },
    });

    expect(outcome).toBe("applied");
    expect(schema).toHaveBeenCalledWith("private");
    expect(rpc).toHaveBeenCalledWith("apply_stripe_event", {
      p_event_id: "evt_1",
      p_type: "customer.subscription.created",
      p_created: 100,
      p_subscription_id: "sub_1",
      p_company_code: "acme",
      p_status: "active",
    });
  });

  it("sends nulls for an event with no subscription", async () => {
    const { rpc } = fakeRpc({ data: "ignored", error: null });
    await handleStripeEvent({ id: "evt_2", type: "invoice.paid", created: 100, subscription: null });
    expect(rpc).toHaveBeenCalledWith(
      "apply_stripe_event",
      expect.objectContaining({ p_subscription_id: null, p_company_code: null, p_status: null }),
    );
  });

  it("passes database errors on", async () => {
    fakeRpc({ data: null, error: { code: "XX000", message: "down" } });
    await expect(
      handleStripeEvent({ id: "evt_3", type: "invoice.paid", created: 1, subscription: null }),
    ).rejects.toMatchObject({ code: "XX000" });
  });
});
