import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Checks a Stripe-Signature header against the raw request body (LLD 5.2). Pure: the
// caller passes the secret and the current time, so it is easy to test.
//
// Header: t=<unix seconds>,v1=<hex>[,v1=<hex>...]. Stripe sends several v1 values while a
// secret is being rolled, so any one matching is enough.

export type SignatureFailure = "missing_header" | "bad_format" | "mismatch" | "too_old";

export type SignatureResult = { ok: true } | { ok: false; reason: SignatureFailure };

export type SignatureInput = {
  header: string | null;
  rawBody: string;
  secret: string;
  nowSeconds: number;
  toleranceSeconds?: number; // unset: no age check (DECISIONS, Oct 8)
};

export function verifySignature(input: SignatureInput): SignatureResult {
  if (!input.header) return { ok: false, reason: "missing_header" };

  const parsed = parseHeader(input.header);
  if (!parsed) return { ok: false, reason: "bad_format" };

  // The secret is used as-is, including the whsec_ prefix.
  const expected = Buffer.from(
    createHmac("sha256", input.secret).update(`${parsed.timestamp}.${input.rawBody}`).digest("hex"),
  );
  const matches = parsed.signatures.some((signature) => {
    const given = Buffer.from(signature);
    // timingSafeEqual throws on different lengths, so a wrong length is simply no match.
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!matches) return { ok: false, reason: "mismatch" };

  if (input.toleranceSeconds !== undefined && Math.abs(input.nowSeconds - parsed.timestamp) > input.toleranceSeconds) {
    return { ok: false, reason: "too_old" };
  }
  return { ok: true };
}

function parseHeader(header: string): { timestamp: number; signatures: string[] } | null {
  let timestamp: number | undefined;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t" && /^\d+$/.test(value)) timestamp = Number(value);
    if (key === "v1" && value) signatures.push(value);
  }
  if (timestamp === undefined || signatures.length === 0) return null;
  return { timestamp, signatures };
}
