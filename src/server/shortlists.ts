import "server-only";
import { z } from "zod";
import type { Shortlist, ShortlistSummary } from "@/shared/types";
import type { Recruiter } from "./auth";
import { AppError } from "./errors";
import { getCandidateSummaries } from "./people";
import { recruiterClient } from "./supabase";

// Shortlists (LLD 1.5). Every query runs as the recruiter, so RLS limits it to their
// company: another company's list matches no row, and that is answered as not found.

export const ShortlistName = z.object({ name: z.string().trim().min(1).max(80) });

const listNotFound = () => new AppError("not_found", "We couldn't find this list.");
const nameTaken = () => new AppError("name_taken", "You already have a list with this name.");

const isUuid = (id: string) => z.uuid().safeParse(id).success;

// Postgres error code for a unique violation: the name is already used in this company.
function isNameTaken(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export async function listShortlists(recruiter: Recruiter): Promise<ShortlistSummary[]> {
  const { data, error } = await recruiterClient(recruiter.token)
    .from("shortlists")
    .select("id, name, created_at, shortlist_members(count)")
    .order("created_at", { ascending: false })
    .returns<{ id: string; name: string; created_at: string; shortlist_members: { count: number }[] }[]>();
  if (error) throw error;
  return data.map(({ shortlist_members, ...list }) => ({ ...list, member_count: shortlist_members[0]?.count ?? 0 }));
}

export async function createShortlist(recruiter: Recruiter, name: string): Promise<{ id: string; name: string }> {
  const { data, error } = await recruiterClient(recruiter.token)
    .from("shortlists")
    // company_id comes from the recruiter lookup; RLS rejects any other value.
    .insert({ company_id: recruiter.companyId, name })
    .select("id, name")
    .single<{ id: string; name: string }>();
  if (isNameTaken(error)) throw nameTaken();
  if (error) throw error;
  return data;
}

export async function getShortlist(recruiter: Recruiter, id: string): Promise<Shortlist> {
  if (!isUuid(id)) throw listNotFound();
  const { data, error } = await recruiterClient(recruiter.token)
    .from("shortlists")
    .select("id, name, created_at, shortlist_members(candidate_id, added_at)")
    .eq("id", id)
    .order("added_at", { referencedTable: "shortlist_members", ascending: false })
    .maybeSingle<{
      id: string;
      name: string;
      created_at: string;
      shortlist_members: { candidate_id: string; added_at: string }[];
    }>();
  if (error) throw error;
  if (!data) throw listNotFound();

  // Candidates are server-only data, read for exactly the members RLS returned.
  const summaries = await getCandidateSummaries(data.shortlist_members.map((m) => m.candidate_id));
  const byId = new Map(summaries.map((candidate) => [candidate.id, candidate]));
  return {
    id: data.id,
    name: data.name,
    created_at: data.created_at,
    members: data.shortlist_members.flatMap((m) => {
      const candidate = byId.get(m.candidate_id);
      return candidate ? [{ added_at: m.added_at, candidate }] : [];
    }),
  };
}

export async function renameShortlist(
  recruiter: Recruiter,
  id: string,
  name: string,
): Promise<{ id: string; name: string }> {
  if (!isUuid(id)) throw listNotFound();
  const { data, error } = await recruiterClient(recruiter.token)
    .from("shortlists")
    .update({ name })
    .eq("id", id)
    .select("id, name")
    .maybeSingle<{ id: string; name: string }>();
  if (isNameTaken(error)) throw nameTaken();
  if (error) throw error;
  if (!data) throw listNotFound();
  return data;
}

// Members are removed with the list (on delete cascade).
export async function deleteShortlist(recruiter: Recruiter, id: string): Promise<void> {
  if (!isUuid(id)) throw listNotFound();
  const { data, error } = await recruiterClient(recruiter.token).from("shortlists").delete().eq("id", id).select("id");
  if (error) throw error;
  if (data.length === 0) throw listNotFound();
}

// The list must be one of the recruiter's, or it's not found.
async function requireList(recruiter: Recruiter, id: string): Promise<void> {
  if (!isUuid(id)) throw listNotFound();
  const { data, error } = await recruiterClient(recruiter.token)
    .from("shortlists")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw listNotFound();
}

// Adding someone already on the list changes nothing and says so ({ added: false }).
export async function addMember(recruiter: Recruiter, id: string, candidateId: string): Promise<{ added: boolean }> {
  await requireList(recruiter, id);
  const { data, error } = await recruiterClient(recruiter.token)
    .from("shortlist_members")
    .upsert(
      { shortlist_id: id, candidate_id: candidateId },
      { onConflict: "shortlist_id,candidate_id", ignoreDuplicates: true },
    )
    .select("candidate_id");
  // 23503: the candidate doesn't exist (foreign key).
  if (error?.code === "23503") throw new AppError("not_found", "We couldn't find this candidate.");
  if (error) throw error;
  return { added: data.length > 0 };
}

// Removing someone who isn't on the list is fine; only an unknown list is not found.
export async function removeMember(recruiter: Recruiter, id: string, candidateId: string): Promise<void> {
  await requireList(recruiter, id);
  const { error } = await recruiterClient(recruiter.token)
    .from("shortlist_members")
    .delete()
    .eq("shortlist_id", id)
    .eq("candidate_id", candidateId);
  if (error) throw error;
}

// Which of the recruiter's lists each of these candidates is on, for result cards.
// Read as the recruiter, so RLS limits it to their company's lists.
export async function shortlistIdsByCandidate(
  recruiter: Recruiter,
  candidateIds: string[],
): Promise<Map<string, string[]>> {
  const byCandidate = new Map<string, string[]>();
  if (candidateIds.length === 0) return byCandidate;
  const { data, error } = await recruiterClient(recruiter.token)
    .from("shortlist_members")
    .select("candidate_id, shortlist_id")
    .in("candidate_id", candidateIds)
    .returns<{ candidate_id: string; shortlist_id: string }[]>();
  if (error) throw error;
  for (const row of data) {
    byCandidate.set(row.candidate_id, [...(byCandidate.get(row.candidate_id) ?? []), row.shortlist_id]);
  }
  return byCandidate;
}
