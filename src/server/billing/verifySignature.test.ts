import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { verifySignature } from "./verifySignature";

type SampleEvent = { headers: { "Stripe-Signature": string }; payload: string };

const SECRET = "whsec_test_sample";
const hasSamples = existsSync("data/stripe-events.json");
const samples = hasSamples
  ? (JSON.parse(readFileSync("data/stripe-events.json", "utf8")).events as SampleEvent[])
  : [];
const sample = samples[0] ?? { headers: { "Stripe-Signature": "" }, payload: "" };
const sampleTime = 1791211200; // t= in the first sample's header

function sign(timestamp: number, body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

function check(
  header: string | null,
  rawBody = sample.payload,
  extra: { toleranceSeconds?: number; now?: number } = {},
) {
  return verifySignature({
    header,
    rawBody,
    secret: SECRET,
    nowSeconds: extra.now ?? sampleTime,
    toleranceSeconds: extra.toleranceSeconds,
  });
}

// The Stripe sample dataset isn't included in this checkout.
const sampleDataDescribe = hasSamples ? describe : describe.skip;

sampleDataDescribe("verifySignature", () => {
  it("accepts every sample event with the sample secret", () => {
    for (const event of samples) {
      expect(check(event.headers["Stripe-Signature"], event.payload)).toEqual({ ok: true });
    }
  });

  it("rejects a body changed by one character", () => {
    const tampered = sample.payload.replace('"active"', '"activE"');
    expect(check(sample.headers["Stripe-Signature"], tampered)).toEqual({ ok: false, reason: "mismatch" });
  });

  it("rejects a signature made with another secret", () => {
    const header = `t=${sampleTime},v1=${sign(sampleTime, sample.payload, "whsec_other")}`;
    expect(check(header)).toEqual({ ok: false, reason: "mismatch" });
  });

  it("uses the secret including its whsec_ prefix", () => {
    const header = `t=${sampleTime},v1=${sign(sampleTime, sample.payload, "candidate-search_assessment_sample")}`;
    expect(check(header)).toEqual({ ok: false, reason: "mismatch" });
  });

  it("rejects a missing or empty header", () => {
    expect(check(null)).toEqual({ ok: false, reason: "missing_header" });
    expect(check("")).toEqual({ ok: false, reason: "missing_header" });
  });

  it("rejects a header without t, without v1, or with a non-numeric t", () => {
    const signature = sign(sampleTime, sample.payload);
    expect(check(`v1=${signature}`)).toEqual({ ok: false, reason: "bad_format" });
    expect(check(`t=${sampleTime}`)).toEqual({ ok: false, reason: "bad_format" });
    expect(check(`t=soon,v1=${signature}`)).toEqual({ ok: false, reason: "bad_format" });
    expect(check("garbage")).toEqual({ ok: false, reason: "bad_format" });
  });

  it("treats a short or non-hex v1 as a mismatch instead of throwing", () => {
    expect(check(`t=${sampleTime},v1=abc`)).toEqual({ ok: false, reason: "mismatch" });
    expect(check(`t=${sampleTime},v1=${"z".repeat(64)}`)).toEqual({ ok: false, reason: "mismatch" });
  });

  it("signs t, not the event's created time, so a changed t fails", () => {
    const signature = sign(sampleTime, sample.payload);
    expect(check(`t=${sampleTime + 1},v1=${signature}`)).toEqual({ ok: false, reason: "mismatch" });
  });

  it("accepts the header when any one v1 matches", () => {
    const header = `t=${sampleTime}, v1=${"0".repeat(64)}, v1=${sign(sampleTime, sample.payload)}, v0=ignored`;
    expect(check(header)).toEqual({ ok: true });
  });

  it("has no age check when no tolerance is set", () => {
    expect(check(sample.headers["Stripe-Signature"], sample.payload, { now: sampleTime + 365 * 86400 })).toEqual({
      ok: true,
    });
  });

  it("rejects an old signature only when a tolerance is set", () => {
    const header = sample.headers["Stripe-Signature"];
    expect(check(header, sample.payload, { toleranceSeconds: 300, now: sampleTime + 300 })).toEqual({ ok: true });
    expect(check(header, sample.payload, { toleranceSeconds: 300, now: sampleTime + 301 })).toEqual({
      ok: false,
      reason: "too_old",
    });
    expect(check(header, sample.payload, { toleranceSeconds: 300, now: sampleTime - 301 })).toEqual({
      ok: false,
      reason: "too_old",
    });
  });

  it("does not report too_old for a signature that is also wrong", () => {
    const header = `t=${sampleTime},v1=${"0".repeat(64)}`;
    expect(check(header, sample.payload, { toleranceSeconds: 300, now: sampleTime + 9999 })).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });
});
