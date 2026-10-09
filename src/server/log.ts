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
