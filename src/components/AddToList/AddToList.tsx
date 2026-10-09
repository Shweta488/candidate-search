"use client";

import { useEffect, useId, useRef, useState } from "react";
import { api, toApiError } from "@/client/api";
import type { ShortlistSummary } from "@/shared/types";
import { Button } from "../Button/Button";
import styles from "./AddToList.module.css";

// "Add to list" for one candidate (LLD 6.5): a small panel with the company's lists,
// loaded each time it opens, and a way to make a new list. After adding it says
// "Added to {list}" or "Already on {list}". Escape or a click outside closes it.

type Props = {
  candidateId: string;
  candidateName: string;
  onAdded?: (listId: string) => void;
};

export function AddToList({ candidateId, candidateName, onAdded }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<ShortlistSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const wrapper = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    api.get<{ shortlists: ShortlistSummary[] }>("/api/shortlists").then(
      (result) => active && setLists(result.shortlists),
      () => active && setLoadError(true),
    );
    // A click anywhere outside closes the panel.
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      active = false;
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function openPanel() {
    setLists(null);
    setLoadError(false);
    setCreating(false);
    setNewName("");
    setFormError(null);
    setStatus("");
    setOpen(true);
  }

  function close() {
    setOpen(false);
    toggle.current?.focus();
  }

  async function add(list: { id: string; name: string }) {
    setBusy(true);
    try {
      const { added } = await api.post<{ added: boolean }>(
        `/api/shortlists/${list.id}/people/${encodeURIComponent(candidateId)}`,
      );
      setStatus(added ? `Added to ${list.name}` : `Already on ${list.name}`);
      onAdded?.(list.id);
      close();
    } catch {
      setFormError("Couldn't add to that list. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function createAndAdd(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return setFormError("Give the list a name.");
    setBusy(true);
    setFormError(null);
    try {
      const list = await api.post<{ id: string; name: string }>("/api/shortlists", { name });
      await add(list);
    } catch (error) {
      setFormError(
        toApiError(error).code === "name_taken"
          ? "You already have a list with this name."
          : "Couldn't create the list. Try again.",
      );
      setBusy(false);
      nameInput.current?.focus(); // back to the name, to fix it
    }
  }

  return (
    <div
      ref={wrapper}
      className={styles.wrapper}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <Button
        ref={toggle}
        variant="secondary"
        size="sm"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-label={`Add ${candidateName} to a list`}
        onClick={() => (open ? close() : openPanel())}
      >
        Add to list ▾
      </Button>
      <p className={styles.status} role="status">
        {status}
      </p>
      {open && (
        <div id={`${id}-panel`} className={styles.panel}>
          {loadError ? (
            <p className={styles.note}>Couldn&apos;t load your lists.</p>
          ) : !lists ? (
            <p className={styles.note}>Loading lists…</p>
          ) : (
            <>
              {lists.length === 0 && !creating && <p className={styles.note}>You have no lists yet.</p>}
              {lists.length > 0 && (
                <ul className={styles.lists} aria-label="Your lists">
                  {lists.map((list) => (
                    <li key={list.id}>
                      <button type="button" className={styles.item} disabled={busy} onClick={() => void add(list)}>
                        <span className={styles.itemName}>{list.name}</span>
                        <span className={styles.count}>{list.member_count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {creating ? (
                <form className={styles.create} onSubmit={(event) => void createAndAdd(event)}>
                  <label htmlFor={`${id}-name`} className={styles.label}>
                    New list name
                  </label>
                  <input
                    ref={nameInput}
                    id={`${id}-name`}
                    className={styles.input}
                    value={newName}
                    maxLength={80}
                    autoFocus
                    aria-invalid={formError ? true : undefined}
                    aria-describedby={formError ? `${id}-error` : undefined}
                    onChange={(event) => setNewName(event.target.value)}
                  />
                  <Button type="submit" size="sm" loading={busy} loadingLabel="Adding…">
                    Create and add
                  </Button>
                </form>
              ) : (
                <button type="button" className={styles.item} onClick={() => setCreating(true)}>
                  + New list
                </button>
              )}
              {formError && (
                <p id={`${id}-error`} className={styles.error} role="alert">
                  {formError}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
