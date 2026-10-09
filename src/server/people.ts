import "server-only";
import type { Candidate, Education } from "@/shared/types";
import { AppError } from "./errors";
import { serverClient } from "./supabase";

// One candidate with their experience and education (LLD 1.4). Candidates are shared
// data, so any signed-in recruiter can read any of them.

const COLUMNS = `
  id, full_name, headline, avatar_url, current_title, current_company, current_company_logo_url,
  role, seniority, years_experience, city, state, country, open_to_work, skills,
  experiences (title, company, company_logo_url, company_type, start_year, end_year, description),
  educations (school, degree, field, graduation_year)
`;

type Row = Omit<Candidate, "education"> & { educations: Education[] };

const notFound = () => new AppError("not_found", "We couldn't find this candidate.");

export async function getCandidate(id: string): Promise<Candidate> {
  if (id.length > 64) throw notFound(); // no real id is this long

  const { data, error } = await serverClient()
    .schema("private")
    .from("candidates")
    .select(COLUMNS)
    .eq("id", id)
    // Position is the order in the source data, which is newest first (0 is the current job).
    .order("position", { referencedTable: "experiences" })
    .maybeSingle<Row>();
  if (error) throw error;
  if (!data) throw notFound();

  const { educations, ...candidate } = data;
  return { ...candidate, education: educations };
}
