import "server-only";
import { ZodError } from "zod";
import type { ApiErrorBody, ErrorCode } from "@/shared/types";
import { logError } from "./log";

// One place turns any failure into the { error: { code, message } } shape (LLD 1.1, 4.4).

const STATUS: Record<ErrorCode, number> = {
  invalid_request: 400,
  invalid_signature: 400,
  unauthenticated: 401,
  search_limit_reached: 402,
  not_found: 404,
  internal_error: 500,
  search_unavailable: 503,
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    options?: ErrorOptions, // { cause } keeps the underlying error for the log
  ) {
    super(message, options);
    this.name = "AppError";
  }

  get status(): number {
    return STATUS[this.code];
  }
}

// Postgres error codes that mean something to the API. 42501 is what an RLS write rule
// raises on another company's row; answering 404 never confirms that the row exists.
const POSTGRES_CODES: Record<string, { code: ErrorCode; message: string }> = {
  "23503": { code: "not_found", message: "Not found." },
  "42501": { code: "not_found", message: "Not found." },
};

function body(code: ErrorCode, message: string): ApiErrorBody {
  return { error: { code, message } };
}

function postgresCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return undefined;
}

export function toErrorResponse(error: unknown, requestId: string): Response {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.join(".") || "body";
    return Response.json(body("invalid_request", `${field}: ${issue?.message ?? "invalid"}`), { status: 400 });
  }
  if (error instanceof AppError) {
    if (error.cause) logError(requestId, error.cause); // for example why the LLM call failed
    return Response.json(body(error.code, error.message), { status: error.status });
  }
  const mapped = POSTGRES_CODES[postgresCode(error) ?? ""];
  if (mapped) {
    return Response.json(body(mapped.code, mapped.message), { status: STATUS[mapped.code] });
  }
  logError(requestId, error);
  return Response.json(body("internal_error", `Something went wrong. Reference: ${requestId}`), { status: 500 });
}
