import "server-only";
import { z } from "zod";
import type { Filters, SearchResponse } from "@/shared/types";
import type { Recruiter } from "../auth";
import { logError, logSearch } from "../log";
import { refundSearchCredit, spendSearchCredit } from "../plan";
import { serverClient } from "../supabase";
import { Brief } from "./brief";
import { extractFilters } from "./extractFilters";
import { filtersSchema, hasAnyFilter } from "./filterSchema";
import { getSearchPage } from "./getSearchPage";
import { getVocabulary } from "./vocabulary";

// A new search (LLD 3.8): validate, spend a search, brief to filters, run, return page 1.
// Whenever the search can't run after the credit was spent, the credit is given back.

export const SearchBody = z.object({
  brief: Brief,
  filters: z.unknown().optional(), // validated against the vocabulary in runSearch
});

export type SearchBody = z.infer<typeof SearchBody>;

// Each filter becomes its own typed SQL parameter; null means no constraint (LLD 3.6).
export function toRunSearchParams(filters: Filters) {
  return {
    p_roles: filters.roles ?? null,
    p_seniorities: filters.seniorities ?? null,
    p_cities: filters.cities ?? null,
    p_states: filters.states ?? null,
    p_skills: filters.skills ?? null,
    p_companies: filters.worked_at_companies ?? null,
    p_company_types: filters.worked_at_company_types ?? null,
    p_schools: filters.schools ?? null,
    p_degrees: filters.degrees ?? null,
    p_fields: filters.fields_of_study ?? null,
    p_open_to_work: filters.open_to_work ?? null,
    p_min_years: filters.min_years ?? null,
    p_max_years: filters.max_years ?? null,
  };
}

export async function runSearch(recruiter: Recruiter, body: SearchBody, requestId: string): Promise<SearchResponse> {
  const companyId = recruiter.companyId;
  const started = performance.now();
  const vocabulary = await getVocabulary();

  // 1. Filters sent by the client (a corrected or saved search) are checked before any
  //    credit is spent. Unknown values are a 400 naming the field, e.g. "filters.skills.0".
  const sentFilters =
    body.filters === undefined
      ? undefined
      : z.object({ filters: filtersSchema(vocabulary) }).parse({ filters: body.filters }).filters;

  // 2. Spend a search. Throws search_limit_reached (402) when the free search is used up.
  const searchesRemaining = await spendSearchCredit(companyId);

  const giveBack = async () => {
    await refundSearchCredit(companyId).catch((error: unknown) => logError(requestId, error));
  };

  try {
    // 3. Brief to filters, unless the client sent them.
    const llmStarted = performance.now();
    const extraction = sentFilters
      ? { filters: sentFilters, unsupported: [], usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }
      : await extractFilters(body.brief, vocabulary);
    const llmMs = sentFilters ? 0 : Math.round(performance.now() - llmStarted);

    // 4. Return nobody rather than the wrong people (LLD 3.5).
    const returnNobody = extraction.unsupported.length > 0 || !hasAnyFilter(extraction.filters);

    // 5. Filter, rank and store every match, then read page 1.
    const sqlStarted = performance.now();
    const { data, error } = await serverClient()
      .schema("private")
      .rpc("run_search", {
        p_company_id: companyId,
        p_brief: body.brief,
        p_filters: extraction.filters,
        p_unsupported: extraction.unsupported,
        p_return_nobody: returnNobody,
        ...toRunSearchParams(extraction.filters),
      })
      .single<{ search_id: string; total: number }>();
    if (error) throw error;
    const page = await getSearchPage(recruiter, data.search_id, 1);
    const sqlMs = Math.round(performance.now() - sqlStarted);

    // 6. One log line per search. The brief itself is never logged.
    logSearch({
      request_id: requestId,
      search_id: data.search_id,
      company_id: companyId,
      llm_ms: llmMs,
      sql_ms: sqlMs,
      total_ms: Math.round(performance.now() - started),
      total: data.total,
      input_tokens: extraction.usage.input,
      output_tokens: extraction.usage.output,
      cache_read_input_tokens: extraction.usage.cacheRead,
      cache_creation_input_tokens: extraction.usage.cacheWrite,
    });

    return { ...page, searches_remaining: searchesRemaining };
  } catch (error) {
    await giveBack();
    throw error;
  }
}
