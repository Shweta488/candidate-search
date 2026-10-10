import { readFileSync } from "node:fs";
import { ZodError } from "zod";
import { parseEvent } from "./parseEvent";

const samples = JSON.parse(readFileSync("data/stripe-events.json", "utf8")).events as { payload: string }[];

function subscriptionEvent(type: string, object: Record<string, unknown>) {
  return { id: "evt_1", type, created: 100, data: { object } };
}

const subscription = { id: "sub_1", status: "active", metadata: { company: "acme" } };

describe("parseEvent", () => {
  it("reads the sample events", () => {
    expect(parseEvent(JSON.parse(samples[0].payload))).toEqual({
      id: "evt_sample_acme_1",
      type: "customer.subscription.created",
      created: 1791211200,
      subscription: { id: "sub_sample_acme", companyCode: "acme", status: "active" },
    });
    expect(parseEvent(JSON.parse(samples[3].payload)).subscription?.status).toBe("incomplete");
  });

  it("treats a deleted subscription as canceled whatever its status says", () => {
    const event = parseEvent(subscriptionEvent("customer.subscription.deleted", subscription));
    expect(event.subscription?.status).toBe("canceled");
  });

  it("needs id, type and a whole-number created on every event", () => {
    expect(() => parseEvent({ type: "invoice.paid", created: 1 })).toThrow(ZodError);
    expect(() => parseEvent({ id: "evt_1", created: 1 })).toThrow(ZodError);
    expect(() => parseEvent({ id: "evt_1", type: "invoice.paid", created: "1" })).toThrow(ZodError);
    expect(() => parseEvent({ id: "evt_1", type: "invoice.paid", created: 1.5 })).toThrow(ZodError);
    expect(() => parseEvent(null)).toThrow(ZodError);
  });

  it("needs the subscription id, status and company on subscription events", () => {
    const type = "customer.subscription.updated";
    expect(() => parseEvent(subscriptionEvent(type, { ...subscription, id: undefined }))).toThrow(ZodError);
    expect(() => parseEvent(subscriptionEvent(type, { ...subscription, status: undefined }))).toThrow(ZodError);
    expect(() => parseEvent(subscriptionEvent(type, { ...subscription, metadata: {} }))).toThrow(ZodError);
    expect(() => parseEvent({ id: "evt_1", type, created: 100 })).toThrow(ZodError);
  });

  it("keeps any other type, with no subscription, so it is recorded as ignored", () => {
    expect(parseEvent({ id: "evt_1", type: "invoice.paid", created: 100, data: {} })).toEqual({
      id: "evt_1",
      type: "invoice.paid",
      created: 100,
      subscription: null,
    });
  });
});
