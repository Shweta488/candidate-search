"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/client/api";
import { peopleText } from "@/client/format";
import { useApiQuery } from "@/client/useApiQuery";
import { Button } from "@/components/Button/Button";
import { CandidateCard } from "@/components/CandidateCard/CandidateCard";
import { PageHeading } from "@/components/PageHeading/PageHeading";
import { StatePanel } from "@/components/StatePanel/StatePanel";
import { TextField } from "@/components/TextField/TextField";
import type { Shortlist } from "@/shared/types";
import styles from "../shortlists.module.css";
import own from "./shortlist.module.css";

// One list (LLD 1.5): its people, newest first, with Remove; Rename; and Delete list
// after a confirmation in the page.
export function ShortlistView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, reload } = useApiQuery<Shortlist>(`/api/shortlists/${encodeURIComponent(id)}`);
  const [mode, setMode] = useState<"view" | "rename" | "delete">("view");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (data) document.title = `${data.name} · Candidate Search`;
  }, [data]);

  if (error?.status === 404) {
    return (
      <div className={styles.page}>
        <BackLink />
        <PageHeading>Shortlist</PageHeading>
        <StatePanel
          tone="plain"
          title="We couldn't find this list."
          action={<Link href="/shortlists">All shortlists</Link>}
        />
      </div>
    );
  }
  if (error) {
    return (
      <div className={styles.page}>
        <BackLink />
        <PageHeading>Shortlist</PageHeading>
        <StatePanel
          tone="error"
          title="Something went wrong."
          action={
            <Button variant="secondary" onClick={reload}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }
  if (!data) {
    return (
      <div className={styles.page}>
        <BackLink />
        <p className={styles.muted}>Loading the list…</p>
      </div>
    );
  }

  async function remove(candidateId: string, name: string) {
    try {
      await api.delete(`/api/shortlists/${encodeURIComponent(id)}/people/${encodeURIComponent(candidateId)}`);
      setStatus(`Removed ${name}`);
      reload();
    } catch {
      setStatus(`Couldn't remove ${name}. Try again.`);
    }
  }

  const back = encodeURIComponent(`/shortlists/${id}`);
  return (
    <div className={styles.page}>
      <BackLink />
      <div className={own.head}>
        <PageHeading>{data.name}</PageHeading>
        {mode === "view" && (
          <div className={own.actions}>
            <Button variant="secondary" size="sm" onClick={() => setMode("rename")}>
              Rename
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setMode("delete")}>
              Delete list
            </Button>
          </div>
        )}
      </div>
      <p className={styles.meta}>{peopleText(data.members.length)}</p>

      {mode === "rename" && (
        <RenameForm
          id={id}
          name={data.name}
          onDone={(renamed) => {
            setMode("view");
            if (renamed) {
              setStatus(`Renamed to ${renamed}`);
              reload();
            }
          }}
        />
      )}
      {mode === "delete" && (
        <ConfirmDelete
          id={id}
          name={data.name}
          onCancel={() => setMode("view")}
          onDeleted={() => router.push("/shortlists")}
        />
      )}

      <p className={styles.status} role="status">
        {status}
      </p>

      {data.members.length === 0 ? (
        <StatePanel tone="plain" title="No one on this list yet.">
          Find people in Search and use Add to list on their card or their page.
        </StatePanel>
      ) : (
        <div className={own.members}>
          {data.members.map(({ candidate }) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              href={`/people/${encodeURIComponent(candidate.id)}?back=${back}`}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Remove ${candidate.full_name} from this list`}
                  onClick={() => void remove(candidate.id, candidate.full_name)}
                >
                  Remove
                </Button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/shortlists" className={own.back}>
      ‹ All shortlists
    </Link>
  );
}

function RenameForm({ id, name, onDone }: { id: string; name: string; onDone: (renamed?: string) => void }) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Give the list a name.");
      return input.current?.focus();
    }
    if (trimmed === name) return onDone();
    setBusy(true);
    try {
      const list = await api.patch<{ name: string }>(`/api/shortlists/${encodeURIComponent(id)}`, { name: trimmed });
      onDone(list.name);
    } catch {
      setError("Couldn't rename the list. Try again.");
      setBusy(false);
      requestAnimationFrame(() => input.current?.focus()); // back to the name, to fix it
    }
  }

  return (
    <form
      className={own.panel}
      onSubmit={(event) => void save(event)}
      onKeyDown={(event) => event.key === "Escape" && onDone()}
      noValidate
    >
      <TextField
        ref={input}
        label="List name"
        value={value}
        maxLength={80}
        error={error}
        autoFocus
        className={own.grow}
        onChange={(event) => setValue(event.target.value)}
      />
      <div className={own.panelActions}>
        <Button type="submit" size="sm" loading={busy} loadingLabel="Saving…">
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onDone()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ConfirmDelete(props: { id: string; name: string; onCancel: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);

  // Focus starts on Cancel, the safe choice.
  useEffect(() => cancel.current?.focus(), []);

  async function confirm() {
    setBusy(true);
    try {
      await api.delete(`/api/shortlists/${encodeURIComponent(props.id)}`);
      props.onDeleted();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div
      className={`${own.panel} ${own.danger}`}
      role="group"
      aria-labelledby="delete-question"
      onKeyDown={(event) => event.key === "Escape" && props.onCancel()}
    >
      <p id="delete-question" className={own.question}>
        Delete &ldquo;{props.name}&rdquo;? This removes the list, but not the candidates on it.
      </p>
      {failed && (
        <p className={own.error} role="alert">
          Couldn&apos;t delete the list. Try again.
        </p>
      )}
      <div className={own.panelActions}>
        <Button variant="danger" size="sm" loading={busy} loadingLabel="Deleting…" onClick={() => void confirm()}>
          Delete list
        </Button>
        <Button ref={cancel} variant="ghost" size="sm" onClick={props.onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
