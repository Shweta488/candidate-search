"use client";

import { useId } from "react";
import styles from "./BriefForm.module.css";

type Props = {
  defaultBrief: string;
  autoFocus?: boolean;
  searching: boolean;
  error?: string;
  onSearch: (brief: string) => void;
};

// The brief box: one rounded box holding the text and, inside it, a round search button.
// Uncontrolled: the page remounts it (with a key) when it shows a different search, so it
// always starts from that search's brief.
export function BriefForm({ defaultBrief, autoFocus, searching, error, onSearch }: Props) {
  const id = useId();
  const errorId = `${id}-error`;

  function submit(form: HTMLFormElement) {
    const brief = String(new FormData(form).get("brief") ?? "").trim();
    if (brief) onSearch(brief);
  }

  return (
    <form
      className={styles.form}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        submit(event.currentTarget);
      }}
    >
      <label htmlFor={id} className={styles.label}>
        Describe who you&apos;re looking for
      </label>
      <div className={error ? `${styles.box} ${styles.invalid}` : styles.box}>
        <textarea
          id={id}
          name="brief"
          className={styles.textarea}
          rows={2}
          maxLength={500}
          required
          defaultValue={defaultBrief}
          autoFocus={autoFocus}
          placeholder="Role, skills, location, seniority…"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onKeyDown={(event) => {
            // Enter searches; Shift+Enter adds a new line.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (event.currentTarget.form) submit(event.currentTarget.form);
            }
          }}
        />
        <span className={styles.hint} aria-hidden="true">
          Enter to search · Shift+Enter for a new line
        </span>
        {/* An icon button, centred on the right; its name for screen readers is the hidden text. */}
        <button type="submit" className={styles.submit} disabled={searching} aria-busy={searching || undefined}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.25" />
            <path d="M16.5 16.5 21 21" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
          </svg>
          <span className="visually-hidden">{searching ? "Searching…" : "Search"}</span>
        </button>
      </div>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
