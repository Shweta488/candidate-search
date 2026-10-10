import "server-only";
import { z } from "zod";
import type { CandidateSummary, Filters, SearchPage } from "@/shared/types";
import { AppError } from "../errors";
import { serverClient } from "../supabase";

// One page of a stored search (LLD 3.7). Never spends a search and never calls the LLM.

const PAGE_SIZE = 20; // also fixed inside private.get_search_page

export function totalPages(total: number): number {
  return Math.ceil(total / PAGE_SIZE);
}

type StoredPage = {
  search_id: string;
  brief: string;
  filters: Filters;
  unsupported: string[];
  total: number;
  results: CandidateSummary[];
};

const notFound = () => new AppError("not_found", "This search was not found.");

export async function getSearchPage(companyId: string, searchId: string, page: number): Promise<SearchPage> {
  // An id that isn't a uuid can't exist, so it is "not found" rather than a database error.
  if (!z.uuid().safeParse(searchId).success) throw notFound();

  const { data, error } = await serverClient()
    .schema("private")
    .rpc("get_search_page", { p_company_id: companyId, p_search_id: searchId, p_page: page });
  if (error) throw error;
  // null: no such search for this company. Another company's search is "not found" too.
  if (!data) throw notFound();

  const stored = data as StoredPage;
  return {
    search_id: stored.search_id,
    brief: stored.brief,
    filters: stored.filters,
    unsupported: stored.unsupported,
    page,
    page_size: PAGE_SIZE,
    total: stored.total,
    total_pages: totalPages(stored.total),
    results: stored.results,
  };
}
