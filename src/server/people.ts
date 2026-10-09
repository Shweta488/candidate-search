import "server-only";
import type { Candidate, CandidateSummary, Education } from "@/shared/types";
import type { Recruiter } from "./auth";
import { AppError } from "./errors";
import { recruiterClient, serverClient } from "./supabase";

// One candidate with their experience and education (LLD 1.4). Candidates are shared
// data, so any signed-in recruiter can read any of them; which lists they are on comes
// from the recruiter's own client, so RLS limits it to the recruiter's company.

// The CandidateSummary columns (LLD 1.2), for result cards and shortlist members.
export const SUMMARY_COLUMNS =
  "id, full_name, headline, avatar_url, current_title, current_company, current_company_logo_url, " +
  "city, state, seniority, years_experience, open_to_work, skills";

const COLUMNS = `
  id, full_name, headline, avatar_url, current_title, current_company, current_company_logo_url,
  role, seniority, years_experience, city, state, country, open_to_work, skills,
  experiences (title, company, company_logo_url, company_type, start_year, end_year, description),
  educations (school, degree, field, graduation_year)
`;

type Row = Omit<Candidate, "education" | "shortlist_ids"> & { educations: Education[] };

const notFound = () => new AppError("not_found", "We couldn't find this candidate.");

export async function getCandidate(recruiter: Recruiter, id: string): Promise<Candidate> {
  if (id.length > 64) throw notFound(); // no real id is this long

  const [candidate, lists] = await Promise.all([
    serverClient()
      .schema("private")
      .from("candidates")
      .select(COLUMNS)
      .eq("id", id)
      // Position is the order in the source data, which is newest first (0 is the current job).
      .order("position", { referencedTable: "experiences" })
      .maybeSingle<Row>(),
    recruiterClient(recruiter.token).from("shortlist_members").select("shortlist_id").eq("candidate_id", id),
  ]);
  if (candidate.error) throw candidate.error;
  if (lists.error) throw lists.error;
  if (!candidate.data) throw notFound();

  const { educations, ...rest } = candidate.data;
  return { ...rest, education: educations, shortlist_ids: lists.data.map((row) => row.shortlist_id as string) };
}

// Summaries for the given ids, in the same order. Ids that don't exist are left out.
export async function getCandidateSummaries(ids: string[]): Promise<CandidateSummary[]> {
  if (ids.length === 0) return [];
  const { data, error } = await serverClient()
    .schema("private")
    .from("candidates")
    .select(SUMMARY_COLUMNS)
    .in("id", ids)
    .returns<CandidateSummary[]>();
  if (error) throw error;
  const byId = new Map(data.map((candidate) => [candidate.id, candidate]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}
