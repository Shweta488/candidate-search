// Stripe webhook through the running app (LLD 4.7, 5). Replays data/stripe-events.json byte
// for byte, then edge cases with events signed here using STRIPE_WEBHOOK_SECRET, which must
// match the secret make dev was started with. Every billing row made here is deleted before
// and after, so the stack ends where make setup left it (both companies free).
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import type { ApiErrorBody, PlanResponse } from "@/shared/types";
import {
  adminClient,
  api,
  APP_URL,
  RECRUITERS,
  resetSearches,
  SAMPLE_BRIEF,
  SAMPLE_FILTERS,
  postJson,
  signIn,
} from "./helpers";

type SampleFile = {
  events: { description: string; headers: { "Stripe-Signature": string }; payload: string }[];
};

const SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_test_sample";
const samples = (JSON.parse(readFileSync("data/stripe-events.json", "utf8")) as SampleFile).events;
const RUN = Date.now();

type Outcome = { outcome: string };

async function send(
  rawBody: string,
  signature: string | null,
): Promise<{ status: number; body: Outcome & ApiErrorBody }> {
  const response = await fetch(`${APP_URL}/api/billing/events`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(signature === null ? {} : { "stripe-signature": signature }) },
    body: rawBody,
  });
  return { status: response.status, body: await response.json() };
}

function sign(rawBody: string, secret = SECRET): string {
  const t = Math.floor(Date.now() / 1000);
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex")}`;
}

// A subscription event with ids unique to this run, so cleanup can find it.
function subscriptionEvent(
  name: string,
  options: { type?: string; created: number; status?: string; sub: string; company?: string },
) {
  return JSON.stringify({
    id: `evt_test_${RUN}_${name}`,
    object: "event",
    type: options.type ?? "customer.subscription.updated",
    created: options.created,
    data: {
      object: {
        id: `sub_test_${RUN}_${options.sub}`,
        object: "subscription",
        status: options.status ?? "active",
        metadata: { company: options.company ?? "acme" },
      },
    },
  });
}

async function sendSigned(rawBody: string) {
  return send(rawBody, sign(rawBody));
}

async function cleanUp() {
  const db = adminClient().schema("private");
  for (const table of ["stripe_events", "subscriptions"]) {
    const prefix = table === "stripe_events" ? "evt_" : "sub_";
    const { error } = await db.from(table).delete().or(`id.like.${prefix}sample_%,id.like.${prefix}test_%`);
    if (error) throw new Error(`Could not clean ${table}: ${error.message}`);
  }
}

async function subscriptionStatus(sub: string): Promise<string | undefined> {
  const { data } = await adminClient()
    .schema("private")
    .from("subscriptions")
    .select("status")
    .eq("id", `sub_test_${RUN}_${sub}`)
    .maybeSingle<{ status: string }>();
  return data?.status;
}

describe("Stripe webhook", () => {
  const tokens = { acme: "", globex: "" };

  async function plans(): Promise<{ acme: string; globex: string }> {
    const acme = await api<PlanResponse>("/api/plan", tokens.acme);
    const globex = await api<PlanResponse>("/api/plan", tokens.globex);
    return { acme: acme.body.plan, globex: globex.body.plan };
  }

  beforeAll(async () => {
    await cleanUp();
    tokens.acme = (await signIn(RECRUITERS.acme)).token;
    tokens.globex = (await signIn(RECRUITERS.globex)).token;
  });

  afterAll(async () => {
    await cleanUp();
    await resetSearches("acme");
    await resetSearches("globex");
  });

  describe("sample replay (LLD 5.5)", () => {
    const expected = [
      { outcome: "applied", plans: { acme: "paid", globex: "free" } },
      { outcome: "duplicate", plans: { acme: "paid", globex: "free" } },
      { outcome: "applied", plans: { acme: "paid", globex: "paid" } },
      { outcome: "stale", plans: { acme: "paid", globex: "paid" } },
      { outcome: "applied", plans: { acme: "free", globex: "paid" } },
    ];

    it("starts with both companies free", async () => {
      expect(await plans()).toEqual({ acme: "free", globex: "free" });
    });

    samples.forEach((event, index) => {
      it(`${index + 1}. ${event.description}: ${expected[index].outcome}`, async () => {
        const response = await send(event.payload, event.headers["Stripe-Signature"]);
        expect(response).toEqual({ status: 200, body: { outcome: expected[index].outcome } });
        expect(await plans()).toEqual(expected[index].plans);
      });
    });

    it("gives the paid company unlimited searches", async () => {
      await resetSearches("globex");
      for (let i = 0; i < 3; i++) {
        const search = await postJson("/api/search", { brief: SAMPLE_BRIEF, filters: SAMPLE_FILTERS }, tokens.globex);
        expect(search.status).toBe(200);
      }
      expect((await api<PlanResponse>("/api/plan", tokens.globex)).body).toEqual({
        plan: "paid",
        searches_remaining: null,
      });
    });

    it("records each sample event once, with its outcome", async () => {
      const { data } = await adminClient()
        .schema("private")
        .from("stripe_events")
        .select("id, outcome")
        .like("id", "evt_sample_%")
        .order("id");
      expect(data).toEqual([
        { id: "evt_sample_acme_1", outcome: "applied" },
        { id: "evt_sample_acme_2", outcome: "applied" },
        { id: "evt_sample_globex_1", outcome: "stale" },
        { id: "evt_sample_globex_2", outcome: "applied" },
      ]);
    });
  });

  describe("signature", () => {
    const body = () => subscriptionEvent("sig", { created: 100, sub: "sig" });

    it("rejects a tampered body", async () => {
      const original = body();
      const response = await send(original.replace('"active"', '"trialing"'), sign(original));
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("invalid_signature");
    });

    it("rejects a signature made with another secret", async () => {
      const response = await send(body(), sign(body(), "whsec_wrong"));
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("invalid_signature");
    });

    it("rejects a missing or malformed header", async () => {
      expect((await send(body(), null)).body.error.code).toBe("invalid_signature");
      expect((await send(body(), "v1=abc")).body.error.code).toBe("invalid_signature");
    });

    it("changes nothing when the signature fails", async () => {
      expect(await subscriptionStatus("sig")).toBeUndefined();
    });

    it("rejects a signed body that isn't JSON, or misses a field we need, as invalid_request", async () => {
      const notJson = await sendSigned("not json");
      expect(notJson.status).toBe(400);
      expect(notJson.body.error.code).toBe("invalid_request");

      const noCompany = JSON.stringify({
        id: `evt_test_${RUN}_nocompany`,
        type: "customer.subscription.updated",
        created: 100,
        data: { object: { id: `sub_test_${RUN}_nocompany`, status: "active", metadata: {} } },
      });
      const missing = await sendSigned(noCompany);
      expect(missing.status).toBe(400);
      expect(missing.body.error.code).toBe("invalid_request");
    });

    it("rejects a body over 16 KB", async () => {
      const big = JSON.stringify({ id: `evt_test_${RUN}_big`, type: "x", created: 1, padding: "x".repeat(17_000) });
      const response = await sendSigned(big);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("invalid_request");
    });
  });

  describe("order and repeats", () => {
    it("ignores a repeat delivery", async () => {
      const created = subscriptionEvent("repeat", { created: 100, sub: "repeat", status: "past_due" });
      expect((await sendSigned(created)).body.outcome).toBe("applied");
      expect((await sendSigned(created)).body.outcome).toBe("duplicate");
      expect(await subscriptionStatus("repeat")).toBe("past_due");
    });

    it("keeps a deletion that arrives before the older created event", async () => {
      const deleted = subscriptionEvent("del_2", {
        type: "customer.subscription.deleted",
        created: 200,
        sub: "deleted_first",
        status: "active", // the deleted type wins over the payload's status
      });
      const createdEvent = subscriptionEvent("del_1", {
        type: "customer.subscription.created",
        created: 100,
        sub: "deleted_first",
      });
      expect((await sendSigned(deleted)).body.outcome).toBe("applied");
      expect((await sendSigned(createdEvent)).body.outcome).toBe("stale");
      expect(await subscriptionStatus("deleted_first")).toBe("canceled");
      expect((await plans()).acme).toBe("free");
    });

    it("breaks a same-second tie by event id, whatever the arrival order", async () => {
      // Same created second; event id "b" sorts after "a", so "b" (canceled) is final.
      const forward = {
        a: subscriptionEvent("tie1_a", { created: 300, sub: "tie1", status: "active" }),
        b: subscriptionEvent("tie1_b", { created: 300, sub: "tie1", status: "canceled" }),
      };
      expect((await sendSigned(forward.a)).body.outcome).toBe("applied");
      expect((await sendSigned(forward.b)).body.outcome).toBe("applied");

      const reverse = {
        a: subscriptionEvent("tie2_a", { created: 300, sub: "tie2", status: "active" }),
        b: subscriptionEvent("tie2_b", { created: 300, sub: "tie2", status: "canceled" }),
      };
      expect((await sendSigned(reverse.b)).body.outcome).toBe("applied");
      expect((await sendSigned(reverse.a)).body.outcome).toBe("stale");

      expect(await subscriptionStatus("tie1")).toBe("canceled");
      expect(await subscriptionStatus("tie2")).toBe("canceled");
    });

    it("records an event for an unknown company as ignored", async () => {
      const response = await sendSigned(
        subscriptionEvent("unknown", { created: 100, sub: "unknown", company: "initech" }),
      );
      expect(response).toEqual({ status: 200, body: { outcome: "ignored" } });
      expect(await subscriptionStatus("unknown")).toBeUndefined();
    });

    it("records an unrelated event type as ignored", async () => {
      const invoice = JSON.stringify({ id: `evt_test_${RUN}_invoice`, type: "invoice.paid", created: 100, data: {} });
      expect(await sendSigned(invoice)).toEqual({ status: 200, body: { outcome: "ignored" } });
      expect(await sendSigned(invoice)).toEqual({ status: 200, body: { outcome: "duplicate" } });
    });

    it("leaves both companies on the plans the sample replay ended with", async () => {
      expect(await plans()).toEqual({ acme: "free", globex: "paid" });
    });
  });
});
