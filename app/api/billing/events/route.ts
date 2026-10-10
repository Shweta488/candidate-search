import { verifySignature } from "@/server/billing/verifySignature";
import { parseEvent } from "@/server/billing/parseEvent";
import { handleStripeEvent } from "@/server/billing/handleStripeEvent";
import { getStripeWebhookEnv } from "@/server/env";
import { AppError } from "@/server/errors";
import { json, parseJsonText, readRawBody, withRequestLog } from "@/server/http";
import { logSignatureRejected } from "@/server/log";

export const runtime = "nodejs";

// Stripe calls this without a recruiter token; the signature is the only gate (LLD 4.7).
// It is checked on the raw text before anything parses the body.
export const POST = withRequestLog(async (request, requestId) => {
  const rawBody = await readRawBody(request);
  const { secret, toleranceSeconds } = getStripeWebhookEnv();
  const check = verifySignature({
    header: request.headers.get("stripe-signature"),
    rawBody,
    secret,
    nowSeconds: Math.floor(Date.now() / 1000),
    toleranceSeconds,
  });
  if (!check.ok) {
    logSignatureRejected(requestId, check.reason);
    throw new AppError("invalid_signature", "The Stripe signature is not valid.");
  }

  const event = parseEvent(parseJsonText(rawBody));
  return json({ outcome: await handleStripeEvent(event) });
});
