// Request and response shapes shared by src/client and src/server. Types only (RULES.md section 3).

export type ErrorCode =
  | "invalid_request"
  | "unauthenticated"
  | "search_limit_reached"
  | "not_found"
  | "name_taken"
  | "internal_error"
  | "search_unavailable"
  | "invalid_signature";

export type ApiErrorBody = { error: { code: ErrorCode; message: string } };

export type PlanResponse = { plan: "free" | "paid"; searches_remaining: number | null; company_name: string };

// Search filters (LLD 3.1). Every field is optional; an omitted field means no constraint.
// Values inside a list are OR-ed, except skills, which must all be present.
export type Filters = {
  roles?: string[];
  seniorities?: string[];
  cities?: string[];
  states?: string[];
  skills?: string[];
  worked_at_companies?: string[];
  worked_at_company_types?: string[];
  schools?: string[];
  degrees?: string[];
  fields_of_study?: string[];
  open_to_work?: boolean;
  min_years?: number;
  max_years?: number;
};

// Every value a filter may use (LLD 3.2).
export type Vocabulary = {
  roles: string[];
  seniorities: string[];
  cities: string[];
  states: string[];
  skills: string[];
  companies: string[];
  company_types: string[];
  schools: string[];
  degrees: string[];
  fields_of_study: string[];
  years_experience: { min: number; max: number };
};

export type CandidateSummary = {
  id: string;
  full_name: string;
  headline: string;
  avatar_url: string;
  current_title: string;
  current_company: string;
  current_company_logo_url: string;
  city: string;
  state: string;
  seniority: string;
  years_experience: number;
  open_to_work: boolean;
  skills: string[];
};

// One page of a stored search (GET /api/search/{id}).
export type SearchPage = {
  search_id: string;
  brief: string;
  filters: Filters;
  unsupported: string[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  results: CandidateSummary[];
};

// POST /api/search: page 1 of the new search, plus the searches left (null on the paid plan).
export type SearchResponse = SearchPage & { searches_remaining: number | null };

export type Experience = {
  title: string;
  company: string;
  company_logo_url: string;
  company_type: string;
  start_year: number;
  end_year: number | null; // null: current job
  description: string;
};

export type Education = { school: string; degree: string; field: string; graduation_year: number };

// The candidate page (LLD 1.2). Experiences are newest first.
export type Candidate = CandidateSummary & {
  role: string;
  country: string;
  experiences: Experience[];
  education: Education[];
  shortlist_ids: string[]; // the caller's company's lists this candidate is on
};

// Shortlists (LLD 1.5).
export type ShortlistSummary = { id: string; name: string; member_count: number; created_at: string };
export type Shortlist = {
  id: string;
  name: string;
  created_at: string;
  members: { added_at: string; candidate: CandidateSummary }[]; // most recently added first
};

// Saved searches (LLD 1.6). Newest first.
export type SavedBrief = { id: string; brief: string; filters: Filters; created_at: string };
