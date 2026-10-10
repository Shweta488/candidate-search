// The webhook route itself (app/api/billing/events/route.ts), with only the database faked:
// which answers are 400, which are 200, and that a database failure is a 500.
import { createHmac } from "node:crypto";
import { POST } from "../../../app/api/billing/events/route";
import { serverClient } from "../supabase";

jest.mock("../supabase", () => ({ serverClient: jest.fn() }));

const SECRET = "whsec_unit_test";

function fakeRpc(result: { data: unknown; error: unknown }) {
  const rpc = jest.fn().mockResolvedValue(result);
  jest.mocked(serverClient).mockReturnValue({ schema: () => ({ rpc }) } as never);
  return rpc;
}

function sign(rawBody: string): string {
  const t = Math.floor(Date.now() / 1000);
  return `t=${t},v1=${createHmac("sha256", SECRET).update(`${t}.${rawBody}`).digest("hex")}`;
}

function post(rawBody: string, signature: string | null = sign(rawBody)): Promise<Response> {
  const headers: Record<string, string> = signature === null ? {} : { "stripe-signature": signature };
  return POST(new Request("http://localhost/api/billing/events", { method: "POST", headers, body: rawBody }));
}

function subscriptionEvent(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: "evt_1",
    type: "customer.subscription.updated",
    created: 100,
    data: { object: { id: "sub_1", status: "active", metadata: { company: "acme" } } },
    ...extra,
  });
}

describe("POST /api/billing/events", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    jest.restoreAllMocks();
    jest.mocked(serverClient).mockReset();
  });

  it("applies a correctly signed event", async () => {
    const rpc = fakeRpc({ data: "applied", error: null });
    const response = await post(subscriptionEvent());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "applied" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("applies a signed event larger than the 16 KB allowed on other routes", async () => {
    fakeRpc({ data: "applied", error: null });
    const response = await post(subscriptionEvent({ padding: "x".repeat(20 * 1024) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "applied" });
  });

  it.each([
    ["a missing signature header", subscriptionEvent(), null],
    ["a signature made for another body", subscriptionEvent(), sign("{}")],
  ])("answers 400 for %s, without touching the database", async (_case, rawBody, signature) => {
    const rpc = fakeRpc({ data: "applied", error: null });
    const response = await post(rawBody, signature);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_signature");
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["isn't JSON", "not json", "body is not JSON"],
    [
      "has no metadata.company",
      JSON.stringify({
        id: "evt_2",
        type: "customer.subscription.updated",
        created: 100,
        data: { object: { id: "sub_2", status: "active", metadata: {} } },
      }),
      expect.stringMatching(/^data\.object\.metadata\.company: /),
    ],
  ])("answers 200 ignored for a signed body that %s, and records nothing", async (_case, rawBody, reason) => {
    const rpc = fakeRpc({ data: "applied", error: null });
    const response = await post(rawBody);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "ignored" });
    expect(rpc).not.toHaveBeenCalled();

    const line = JSON.parse(jest.mocked(console.warn).mock.calls[0][0] as string);
    expect(line).toMatchObject({ type: "event_ignored", reason });
  });

  // Deliberate: Stripe retries on a 500, so an outage on our side loses no event.
  it("answers 500 when the database fails, so Stripe sends the event again", async () => {
    fakeRpc({ data: null, error: { code: "XX000", message: "down" } });
    const response = await post(subscriptionEvent());
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });

  it("answers 400 for a body over 1 MB", async () => {
    const response = await post("x".repeat(1024 * 1024 + 1));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_request");
  });
});
