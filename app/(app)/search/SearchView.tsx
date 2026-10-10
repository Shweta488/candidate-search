"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { api, toApiError, type ApiError } from "@/client/api";
import { usePlan } from "@/client/plan";
import { sameFilters } from "@/client/filterDraft";
import { useApiQuery } from "@/client/useApiQuery";
import { AddToList } from "@/components/AddToList/AddToList";
import { BriefForm } from "@/components/BriefForm/BriefForm";
import { Button } from "@/components/Button/Button";
import { CandidateCard, CandidateCardSkeleton } from "@/components/CandidateCard/CandidateCard";
import { FilterTags } from "@/components/FilterTags/FilterTags";
import { PageHeading } from "@/components/PageHeading/PageHeading";
import { Pager } from "@/components/Pager/Pager";
import { StatePanel } from "@/components/StatePanel/StatePanel";
import { UpgradeButton } from "@/components/UpgradeDialog/UpgradeDialog";
import type { Filters, PlanResponse, SearchPage, SearchResponse } from "@/shared/types";
import styles from "./search.module.css";

// The search page (LLD 6.5). The URL holds the search being shown (?id=…&page=n), so
// refresh and back keep the results. A new search is POSTed; any page of an existing
// search is read with GET, which never spends a search.

export function SearchView() {
  return (
    <>
      <PageHeading>Find candidates</PageHeading>
      <Suspense>
        <Search />
      </Suspense>
    </>
  );
}

function pageFromUrl(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

function Search() {
  const router = useRouter();
  const params = useSearchParams();
  const plan = usePlan();
  const searchId = params.get("id");
  const page = pageFromUrl(params.get("page"));

  const [posted, setPosted] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [postError, setPostError] = useState<{
    brief: string;
    filters?: Filters;
    error: ApiError;
  } | null>(null);
  // Filters the recruiter is editing, for the search they were shown on.
  const [draft, setDraft] = useState<{
    searchId: string;
    filters: Filters;
  } | null>(null);
  const [example, setExample] = useState(""); // an example brief the recruiter picked

  // Page 1 of a search we just ran is already here; anything else is read from the API.
  const showPosted = posted !== null && posted.search_id === searchId && page === 1;
  const query = useApiQuery<SearchPage>(
    searchId && !showPosted ? `/api/search/${encodeURIComponent(searchId)}?page=${page}` : null,
  );
  const shown = showPosted ? posted : searchId ? query.data : undefined;

  // A new search. With filters (a corrected search) the server skips the LLM, but it
  // still counts as a search (product decision 1).
  async function search(brief: string, filters?: Filters) {
    setSearching(true);
    setPostError(null);
    try {
      const result = await api.post<SearchResponse>("/api/search", filters ? { brief, filters } : { brief });
      setPosted(result);
      router.push(`/search?id=${encodeURIComponent(result.search_id)}`);
    } catch (error) {
      setPostError({ brief, filters, error: toApiError(error) });
    } finally {
      setSearching(false);
      plan.reload(); // the searches left changed (or the limit was reached)
    }
  }

  const inputError = postError?.error.status === 400 ? postError.error.message : undefined;
  // An old or mistyped link opens the same welcoming start page as a first visit.
  const missing = searchId !== null && isNotFound(query.error);
  const failed = postError !== null && !inputError;
  const starting = !searching && !failed && !shown && (searchId === null || missing);
  const draftFilters = shown && draft?.searchId === shown.search_id ? draft.filters : shown?.filters;

  return (
    <div className={styles.search}>
      <BriefForm
        key={shown?.search_id ?? `new:${example}`}
        defaultBrief={shown?.brief ?? example}
        autoFocus={example !== "" && !shown}
        searching={searching}
        error={inputError}
        onSearch={search}
      />
      {shown && draftFilters && !searching && !failed && (
        <FilterBar
          filters={draftFilters}
          changed={!sameFilters(draftFilters, shown.filters)}
          plan={plan.plan}
          onChange={(filters) => setDraft({ searchId: shown.search_id, filters })}
          onUndo={() => setDraft(null)}
          onRun={() => search(shown.brief, draftFilters)}
        />
      )}
      {/* Announces the results count and state messages to screen readers. */}
      <div className={styles.results} aria-live="polite">
        {searching ? (
          <Searching />
        ) : failed ? (
          <SearchFailed error={postError.error} onRetry={() => search(postError.brief, postError.filters)} />
        ) : starting ? null : searchId && !shown ? (
          query.error ? (
            <LoadFailed onRetry={query.reload} />
          ) : (
            <Searching />
          )
        ) : shown ? (
          <Results page={shown} plan={plan.plan} onSearchWithout={() => search(shown.brief, shown.filters)} />
        ) : null}
      </div>
      {starting && <Welcome onPick={setExample} />}
    </div>
  );
}

const EXAMPLES = [
  "senior React engineers in New York who have worked at a startup",
  "data scientists with a PhD",
  "product designers in San Francisco who are open to work",
];

// The start page: what to do, what happens next, and examples to try.
// Picking an example fills the brief box without searching, because on the free plan a
// search can't be taken back.
function Welcome({ onPick }: { onPick: (brief: string) => void }) {
  const { plan } = usePlan();
  return (
    <section className={styles.welcome} aria-labelledby="welcome-heading">
      <h2 id="welcome-heading" className={styles.welcomeTitle}>
        Find the right people by describing them
      </h2>
      <p className={styles.welcomeText}>
        Write who you&apos;re looking for the way you&apos;d tell a colleague. We&apos;ll turn it into filters you can
        see, then show everyone who matches, best matches first.
      </p>
      <div className={styles.examples}>
        <span className={styles.examplesLabel} id="examples-label">
          Try one:
        </span>
        <ul className={styles.exampleList} aria-labelledby="examples-label">
          {EXAMPLES.map((brief) => (
            <li key={brief}>
              <button type="button" className={styles.example} onClick={() => onPick(brief)}>
                {brief}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {plan?.plan === "free" && (
        <p className={styles.planNote}>
          {plan.searches_remaining === 0
            ? "You've used your free search. You can still page through searches you've already run."
            : `On the free plan you have ${plan.searches_remaining} ${
                plan.searches_remaining === 1 ? "search" : "searches"
              }. Paging through its results doesn't use another.`}
        </p>
      )}
    </section>
  );
}

function Searching() {
  return (
    <>
      <h2 className={styles.count}>Searching…</h2>
      <div className={styles.cards}>
        <CandidateCardSkeleton />
        <CandidateCardSkeleton />
        <CandidateCardSkeleton />
      </div>
    </>
  );
}

// The filters of the search being shown, editable. After a change, says that running
// them is a new search (and what that means on the free plan) before anything runs.
function FilterBar(props: {
  filters: Filters;
  changed: boolean;
  plan: PlanResponse | undefined;
  onChange: (filters: Filters) => void;
  onUndo: () => void;
  onRun: () => void;
}) {
  return (
    <div className={styles.filterBar}>
      <FilterTags filters={props.filters} onChange={props.onChange} />
      {props.changed && (
        <div className={styles.changed}>
          <p className={styles.changedText} role="status">
            You changed the filters. Running them is a new search. <SearchCost plan={props.plan} />
          </p>
          <div className={styles.changedActions}>
            <Button size="sm" onClick={props.onRun}>
              Run search
            </Button>
            <Button size="sm" variant="ghost" onClick={props.onUndo}>
              Undo changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// What a new search costs on the free plan. Nothing to say on the paid plan.
function SearchCost({ plan }: { plan: PlanResponse | undefined }) {
  if (plan?.plan !== "free") return null;
  return plan.searches_remaining === 0 ? (
    <>You&apos;ve used your free search, so it can&apos;t run on the free plan.</>
  ) : (
    <>This uses your free search.</>
  );
}

function Results(props: { page: SearchPage; plan: PlanResponse | undefined; onSearchWithout: () => void }) {
  const { page } = props;
  const hasFilters = Object.keys(page.filters).length > 0;

  if (page.unsupported.length > 0) {
    return (
      <StatePanel
        tone="warning"
        title={`Couldn't filter on: ${page.unsupported.join(", ")}`}
        action={
          hasFilters && (
            <div className={styles.panelAction}>
              <Button variant="secondary" onClick={props.onSearchWithout}>
                Search without these
              </Button>
              <span className={styles.cost}>
                <SearchCost plan={props.plan} />
              </span>
            </div>
          )
        }
      >
        We search on role, seniority, location, skills, education and past companies. We&apos;re showing nobody rather
        than the wrong people.
      </StatePanel>
    );
  }
  if (!hasFilters) {
    return (
      <StatePanel tone="plain" title="We couldn't find any requirement in that brief.">
        Try a role, skill, location or seniority, or add a filter yourself.
      </StatePanel>
    );
  }
  if (page.total === 0) {
    return (
      <StatePanel tone="plain" title="No candidates match all of these filters.">
        Try removing a filter.
      </StatePanel>
    );
  }

  const matchedSkills = page.filters.skills ?? [];
  return (
    <>
      <div className={styles.head}>
        <h2 className={styles.count}>
          {page.total} {page.total === 1 ? "candidate" : "candidates"}
        </h2>
        {page.total_pages > 1 && (
          <span className={styles.position}>
            Page {page.page} of {page.total_pages}
          </span>
        )}
        <SaveSearch key={page.search_id} brief={page.brief} filters={page.filters} />
      </div>
      {page.results.length > 0 ? (
        <div className={styles.cards}>
          {page.results.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              matchedSkills={matchedSkills}
              href={candidateHref(candidate.id, page)}
              action={<AddToList candidateId={candidate.id} candidateName={candidate.full_name} />}
            />
          ))}
        </div>
      ) : (
        <StatePanel tone="plain" title="There are no more results.">
          <Link href={`/search?id=${encodeURIComponent(page.search_id)}`}>Back to the first page</Link>
        </StatePanel>
      )}
      <Pager searchId={page.search_id} page={page.page} totalPages={page.total_pages} />
    </>
  );
}

// Saves the search as it ran: its brief and the filters used, not unsaved edits (LLD 6.5).
// Only offered with results, so never for a search with "Couldn't filter on" items, which
// re-running from its filters alone would turn into a different search.
function SaveSearch({ brief, filters }: { brief: string; filters: Filters }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const savedLink = useRef<HTMLAnchorElement>(null);

  // The button is replaced by the link, so focus moves there instead of being lost.
  useEffect(() => {
    if (state === "saved") savedLink.current?.focus();
  }, [state]);

  async function save() {
    setState("saving");
    try {
      await api.post("/api/saved-briefs", { brief, filters });
      setState("saved");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className={styles.save}>
      {state === "saved" ? (
        <Link ref={savedLink} href="/saved-searches" className={styles.saved}>
          Saved · View saved searches
        </Link>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          loading={state === "saving"}
          loadingLabel="Saving…"
          onClick={() => void save()}
        >
          Save search
        </Button>
      )}
      <span className="visually-hidden" role="status">
        {state === "saved" ? "Search saved" : ""}
      </span>
      {state === "failed" && (
        <span className={styles.saveError} role="alert">
          Couldn&apos;t save the search. Try again.
        </span>
      )}
    </div>
  );
}

// The candidate page, remembering this search and page so "Back to results" returns here.
function candidateHref(candidateId: string, page: SearchPage): string {
  const results = `/search?id=${encodeURIComponent(page.search_id)}&page=${page.page}`;
  return `/people/${encodeURIComponent(candidateId)}?back=${encodeURIComponent(results)}`;
}

// A new search failed (LLD 6.6, 6.7).
function SearchFailed({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  if (error.code === "search_limit_reached") {
    return (
      <StatePanel tone="limit" title="You've used your free search." action={<UpgradeButton />}>
        You can still page through the searches you&apos;ve already run.
      </StatePanel>
    );
  }
  if (error.code === "search_unavailable") {
    return (
      <StatePanel tone="error" title="Search is unavailable right now." action={<RetryButton onClick={onRetry} />}>
        Your search wasn&apos;t used.
      </StatePanel>
    );
  }
  return <StatePanel tone="error" title="Something went wrong." action={<RetryButton onClick={onRetry} />} />;
}

function isNotFound(error: ApiError | undefined): boolean {
  return error?.status === 404 || error?.status === 400;
}

// Opening ?id=… failed for a reason other than "not found".
function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return <StatePanel tone="error" title="Something went wrong." action={<RetryButton onClick={onRetry} />} />;
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" onClick={onClick}>
      Try again
    </Button>
  );
}
