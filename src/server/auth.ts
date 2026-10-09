import "server-only";
import { AppError } from "./errors";
import { serverClient } from "./supabase";

// The auth gate (LLD 4.2). companyId comes only from our recruiters table, never from the request.

export type Recruiter = { userId: string; companyId: string; token: string };

const BEARER = /^Bearer\s+(\S+)$/i;

function unauthenticated(): AppError {
  return new AppError("unauthenticated", "Sign in to continue.");
}

export async function requireRecruiter(request: Request): Promise<Recruiter> {
  const match = BEARER.exec(request.headers.get("authorization") ?? "");
  if (!match) throw unauthenticated();
  const token = match[1];

  const { data: auth, error: authError } = await serverClient().auth.getUser(token);
  if (authError || !auth.user) throw unauthenticated();

  const { data: recruiter, error } = await serverClient()
    .from("recruiters")
    .select("company_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  // A signed-in user with no recruiter row belongs to no company.
  if (!recruiter) throw unauthenticated();

  return { userId: auth.user.id, companyId: recruiter.company_id, token };
}
