import type { ApiErrorBody, ErrorCode } from "@/shared/types";
import { browserSupabase } from "./supabase";

// One wrapper for every /api call (LLD 6.3): adds the token, sends JSON, and turns
// non-2xx responses into ApiError. A 401 signs out, which sends the recruiter to sign-in.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | "network_error",
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data } = await browserSupabase().auth.getSession();
  const headers: Record<string, string> = {};
  if (data.session) headers.authorization = `Bearer ${data.session.access_token}`;
  if (body !== undefined) headers["content-type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "network_error", "Could not reach the server. Check your connection and try again.");
  }

  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) await browserSupabase().auth.signOut();
    const error = (payload as ApiErrorBody | null)?.error;
    throw new ApiError(response.status, error?.code ?? "internal_error", error?.message ?? "Something went wrong.");
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, "internal_error", "Something went wrong.");
}
