import "server-only";
import type { z } from "zod";
import { requireRecruiter, type Recruiter } from "./auth";
import { AppError, toErrorResponse } from "./errors";
import { logRequest } from "./log";

// The shape every recruiter route follows (LLD 4.3): auth, read input, call one service,
// return. Errors and the request log are handled here once.

type Params = Record<string, string | string[] | undefined>;

export type RecruiterContext<P extends Params> = { recruiter: Recruiter; params: P; requestId: string };

export function withRecruiter<P extends Params = Record<string, never>>(
  handler: (request: Request, context: RecruiterContext<P>) => Promise<Response>,
) {
  return async (request: Request, route: { params: Promise<P> }): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const started = performance.now();
    let companyId: string | null = null;
    let response: Response;
    try {
      const recruiter = await requireRecruiter(request);
      companyId = recruiter.companyId;
      response = await handler(request, { recruiter, params: await route.params, requestId });
    } catch (error) {
      response = toErrorResponse(error, requestId);
    }
    logRequest({
      request_id: requestId,
      method: request.method,
      route: new URL(request.url).pathname,
      status: response.status,
      ms: Math.round(performance.now() - started),
      company_id: companyId,
    });
    return response;
  };
}

// For routes called without a recruiter token (the Stripe webhook): the same error
// handling and request log as withRecruiter, with no company.
export function withRequestLog(handler: (request: Request, requestId: string) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const started = performance.now();
    let response: Response;
    try {
      response = await handler(request, requestId);
    } catch (error) {
      response = toErrorResponse(error, requestId);
    }
    logRequest({
      request_id: requestId,
      method: request.method,
      route: new URL(request.url).pathname,
      status: response.status,
      ms: Math.round(performance.now() - started),
      company_id: null,
    });
    return response;
  };
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

const MAX_BODY_BYTES = 16 * 1024; // LLD 1.1

// Reads a JSON body: rejects bodies over 16 KB and anything that isn't JSON, then
// validates with the schema (a ZodError becomes a 400 naming the field).
export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  return schema.parse(parseJsonText(await readRawBody(request)));
}

// The body as text, exactly as sent, up to 16 KB. The Stripe webhook needs the raw text
// because the signature covers those exact bytes (LLD 4.7).
export async function readRawBody(request: Request): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw tooLarge();
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw tooLarge();
  return text;
}

export function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("invalid_request", "The request body must be JSON.");
  }
}

// Validates path params or query values with the schema, the same way as a body.
export function parseParams<S extends z.ZodType>(params: unknown, schema: S): z.infer<S> {
  return schema.parse(params);
}

function tooLarge(): AppError {
  return new AppError("invalid_request", "The request body must be 16 KB or less.");
}
