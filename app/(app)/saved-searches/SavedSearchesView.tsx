"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, toApiError, type ApiError } from "@/client/api";
import { shortDate } from "@/client/format";
import { usePlan } from "@/client/plan";
import { useApiQuery } from "@/client/useApiQuery";
import { Button } from "@/components/Button/Button";
import { FilterTags } from "@/components/FilterTags/FilterTags";
import { PageHeading } from "@/components/PageHeading/PageHeading";
import { StatePanel } from "@/components/StatePanel/StatePanel";
import type { PlanResponse, SavedBrief, SearchResponse } from "@/shared/types";
import styles from "./saved-searches.module.css";

// The company's saved searches, newest first (LLD 1.6, 6.5). Running one is a new search
// with its brief and filters, so on the free plan the page says so first (product
// decision 1). Deleting one asks first, in the page.
export function SavedSearchesView() {
  const { data, error, reload } = useApiQuery<{ saved_briefs: SavedBrief[] }>("/api/saved-briefs");
  const [status, setStatus] = useState("");

  function deleted() {
    setStatus("Saved search deleted");
    reload();
    // The item and its buttons are gone; start again from the page heading.
    document.querySelector<HTMLElement>("h1")?.focus();
  }

  return (
    <div className={styles.page}>
      <PageHeading>Saved searches</PageHeading>
      <p className={styles.status} role="status">
        {status}
      </p>
      {error ? (
        <StatePanel
          tone="error"
          title="Something went wrong."
          action={
            <Button variant="secondary" onClick={reload}>
              Try again
            </Button>
          }
        />
      ) : !data ? (
        <p className={styles.muted}>Loading your saved searches…</p>
      ) : data.saved_briefs.length === 0 ? (
        <StatePanel
          tone="plain"
          title="You have no saved searches yet."
          action={<Link href="/search">Find candidates</Link>}
        >
          Save a search from its results to run it again later with the same filters.
        </StatePanel>
      ) : (
        <ul className={styles.items} aria-label="Your saved searches">
          {data.saved_briefs.map((saved) => (
            <SavedSearch key={saved.id} saved={saved} onDeleted={deleted} />
          ))}
        </ul>
      )}
    </div>
  );
}

type Mode = "view" | "confirm-run" | "running" | "confirm-delete";

function SavedSearch({ saved, onDeleted }: { saved: SavedBrief; onDeleted: () => void }) {
  const router = useRouter();
  const plan = usePlan();
  const [mode, setMode] = useState<Mode>("view");
  const [runError, setRunError] = useState<ApiError | null>(null);

  // Running is a new search: on the paid plan straight away, otherwise after saying so.
  function askToRun() {
    setRunError(null);
    if (plan.plan?.plan === "paid") void run();
    else setMode("confirm-run");
  }

  async function run() {
    setMode("running");
    try {
      const result = await api.post<SearchResponse>("/api/search", {
        brief: saved.brief,
        filters: saved.filters,
      });
      router.push(`/search?id=${encodeURIComponent(result.search_id)}`);
    } catch (error) {
      setRunError(toApiError(error));
      setMode("view");
    } finally {
      plan.reload(); // the searches left changed (or the limit was reached)
    }
  }

  return (
    <li className={styles.item}>
      <h2 className={styles.brief}>{saved.brief}</h2>
      <FilterTags filters={saved.filters} headingLevel="h3" />
      <p className={styles.muted}>Saved {shortDate(saved.created_at)}</p>

      {mode === "confirm-run" ? (
        <ConfirmRun plan={plan.plan} onRun={() => void run()} onCancel={() => setMode("view")} />
      ) : mode === "confirm-delete" ? (
        <ConfirmDelete id={saved.id} onCancel={() => setMode("view")} onDeleted={onDeleted} />
      ) : (
        <div className={styles.actions}>
          <Button size="sm" loading={mode === "running"} loadingLabel="Searching…" onClick={askToRun}>
            Run search
          </Button>
          <Button variant="ghost" size="sm" disabled={mode === "running"} onClick={() => setMode("confirm-delete")}>
            Delete
          </Button>
        </div>
      )}
      {runError && <RunFailed error={runError} />}
    </li>
  );
}

// What running costs on the free plan, before anything runs. With no free search left
// there is nothing to confirm, only the reason it can't run.
function ConfirmRun(props: { plan: PlanResponse | undefined; onRun: () => void; onCancel: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  const usedUp = props.plan?.plan === "free" && props.plan.searches_remaining === 0;

  // Focus starts on Cancel, the safe choice.
  useEffect(() => cancel.current?.focus(), []);

  return (
    <div
      className={styles.panel}
      role="group"
      aria-label="Run this saved search?"
      onKeyDown={(event) => event.key === "Escape" && props.onCancel()}
    >
      <p className={styles.question}>
        {usedUp
          ? "You've used your free search, so this can't run on the free plan."
          : props.plan?.plan === "free"
            ? "Running this is a new search. It uses your free search."
            : "Running this is a new search."}
      </p>
      <div className={styles.actions}>
        {!usedUp && (
          <Button size="sm" onClick={props.onRun}>
            Run search
          </Button>
        )}
        <Button ref={cancel} variant="ghost" size="sm" onClick={props.onCancel}>
          {usedUp ? "OK" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}

function ConfirmDelete(props: { id: string; onCancel: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);

  // Focus starts on Cancel, the safe choice.
  useEffect(() => cancel.current?.focus(), []);

  async function confirm() {
    setBusy(true);
    try {
      await api.delete(`/api/saved-briefs/${encodeURIComponent(props.id)}`);
      props.onDeleted();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div
      className={`${styles.panel} ${styles.danger}`}
      role="group"
      aria-label="Delete this saved search?"
      onKeyDown={(event) => event.key === "Escape" && props.onCancel()}
    >
      <p className={styles.question}>Delete this saved search? Searches you&apos;ve already run stay as they are.</p>
      {failed && (
        <p className={styles.error} role="alert">
          Couldn&apos;t delete the saved search. Try again.
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="danger" size="sm" loading={busy} loadingLabel="Deleting…" onClick={() => void confirm()}>
          Delete
        </Button>
        <Button ref={cancel} variant="ghost" size="sm" onClick={props.onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// Running failed (LLD 6.6). The saved search stays, so the recruiter can try again.
function RunFailed({ error }: { error: ApiError }) {
  const message =
    error.code === "search_limit_reached"
      ? "You've used your free search, so this can't run on the free plan."
      : error.code === "search_unavailable"
        ? "Search is unavailable right now. Your search wasn't used. Try again."
        : error.code === "invalid_request"
          ? "This saved search no longer works. Delete it and save a new one."
          : "Something went wrong. Try again.";
  return (
    <p className={styles.error} role="alert">
      {message}
    </p>
  );
}
