import "server-only";
import { z } from "zod";
import type { Filters, SavedBrief } from "@/shared/types";
import type { Recruiter } from "./auth";
import { AppError } from "./errors";
import { Brief } from "./search/brief";
import { filtersSchema } from "./search/filterSchema";
import { getVocabulary } from "./search/vocabulary";
import { recruiterClient } from "./supabase";

// Saved searches (LLD 1.6). Every query runs as the recruiter, so RLS limits it to their
// company: another company's saved search matches no row, and that is answered as not found.
// Re-running one is an ordinary POST /api/search with its brief and filters.

export const SavedBriefBody = z.object({
  brief: Brief,
  filters: z.unknown(), // required; checked against the vocabulary in saveBrief
});

export type SavedBriefBody = z.infer<typeof SavedBriefBody>;

const savedBriefNotFound = () => new AppError("not_found", "We couldn't find this saved search.");

export async function listSavedBriefs(recruiter: Recruiter): Promise<SavedBrief[]> {
  const { data, error } = await recruiterClient(recruiter.token)
    .from("saved_briefs")
    .select("id, brief, filters, created_at")
    .order("created_at", { ascending: false })
    .returns<SavedBrief[]>();
  if (error) throw error;
  return data;
}

export async function saveBrief(recruiter: Recruiter, body: SavedBriefBody): Promise<{ id: string }> {
  // Checked exactly like the filters of a corrected search, so a saved search can always
  // be re-run. Unknown values are a 400 naming the field, e.g. "filters.skills.0".
  const vocabulary = await getVocabulary();
  const filters: Filters = z.object({ filters: filtersSchema(vocabulary) }).parse({ filters: body.filters }).filters;

  const { data, error } = await recruiterClient(recruiter.token)
    .from("saved_briefs")
    // company_id comes from the recruiter lookup; RLS rejects any other value.
    .insert({ company_id: recruiter.companyId, brief: body.brief, filters })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return data;
}

export async function deleteSavedBrief(recruiter: Recruiter, id: string): Promise<void> {
  if (!z.uuid().safeParse(id).success) throw savedBriefNotFound();
  const { data, error } = await recruiterClient(recruiter.token)
    .from("saved_briefs")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (data.length === 0) throw savedBriefNotFound();
}
