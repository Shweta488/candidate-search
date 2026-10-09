// Request and response shapes shared by src/client and src/server. Types only (RULES.md section 3).

export type ErrorCode =
  | "invalid_request"
  | "unauthenticated"
  | "search_limit_reached"
  | "not_found"
  | "name_taken"
  | "internal_error"
  | "search_unavailable"
  | "invalid_signature";

export type ApiErrorBody = { error: { code: ErrorCode; message: string } };

export type PlanResponse = { plan: "free" | "paid"; searches_remaining: number | null };
