import "server-only";

// One JSON line per request to stdout (LLD 4.8). Tokens, request bodies and briefs are never logged.

export type RequestLog = {
  request_id: string;
  method: string;
  route: string;
  status: number;
  ms: number;
  company_id: string | null;
};

export function logRequest(entry: RequestLog): void {
  console.log(JSON.stringify({ type: "request", ...entry }));
}

export function logError(requestId: string, error: unknown): void {
  const detail = error instanceof Error ? { message: error.message, stack: error.stack } : { error };
  console.error(JSON.stringify({ type: "error", request_id: requestId, ...detail }));
}

// Why a webhook signature was rejected. The caller only sees 400 invalid_signature.
export function logSignatureRejected(requestId: string, reason: string): void {
  console.warn(JSON.stringify({ type: "signature_rejected", request_id: requestId, reason }));
}

export type SearchLog = {
  request_id: string;
  search_id: string;
  company_id: string;
  llm_ms: number;
  sql_ms: number;
  total_ms: number;
  total: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
};

export function logSearch(entry: SearchLog): void {
  console.log(JSON.stringify({ type: "search", ...entry }));
}
