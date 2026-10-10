"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { api } from "@/client/api";
import { peopleText, shortDate } from "@/client/format";
import { useApiQuery } from "@/client/useApiQuery";
import { Button } from "@/components/Button/Button";
import { PageHeading } from "@/components/PageHeading/PageHeading";
import { StatePanel } from "@/components/StatePanel/StatePanel";
import { TextField } from "@/components/TextField/TextField";
import type { ShortlistSummary } from "@/shared/types";
import styles from "./shortlists.module.css";

// The company's shortlists, newest first, and a form to make a new one (LLD 1.5).
export function ShortlistsView() {
  const { data, error, reload } = useApiQuery<{ shortlists: ShortlistSummary[] }>("/api/shortlists");

  return (
    <div className={styles.page}>
      <PageHeading>Shortlists</PageHeading>
      <CreateList onCreated={reload} />
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
        <p className={styles.muted}>Loading your lists…</p>
      ) : data.shortlists.length === 0 ? (
        <StatePanel tone="plain" title="You have no lists yet.">
          Lists keep the people you want to come back to. Create one here, or use Add to list on any search result.
        </StatePanel>
      ) : (
        <ul className={styles.lists} aria-label="Your lists">
          {data.shortlists.map((list) => (
            <li key={list.id} className={styles.list}>
              <Link href={`/shortlists/${list.id}`} className={styles.name}>
                {list.name}
              </Link>
              <span className={styles.meta}>
                {peopleText(list.member_count)} · created {shortDate(list.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateList({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the list a name.");
      return input.current?.focus();
    }
    setBusy(true);
    setError(undefined);
    try {
      const list = await api.post<{ name: string }>("/api/shortlists", { name: trimmed });
      setName("");
      setStatus(`Created ${list.name}`);
      onCreated();
    } catch {
      setError("Couldn't create the list. Try again.");
      requestAnimationFrame(() => input.current?.focus()); // back to the name, to fix it
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.create} onSubmit={(event) => void create(event)} noValidate>
      <TextField
        ref={input}
        label="New list name"
        value={name}
        maxLength={80}
        error={error}
        className={styles.nameField}
        onChange={(event) => setName(event.target.value)}
      />
      <Button type="submit" loading={busy} loadingLabel="Creating…">
        Create list
      </Button>
      <p className={styles.status} role="status">
        {status}
      </p>
    </form>
  );
}
