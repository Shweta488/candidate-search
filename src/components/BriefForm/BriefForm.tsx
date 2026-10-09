"use client";

import { useId } from "react";
import { Button } from "../Button/Button";
import styles from "./BriefForm.module.css";

type Props = {
  defaultBrief: string;
  autoFocus?: boolean;
  searching: boolean;
  error?: string;
  onSearch: (brief: string) => void;
};

// The brief box. Uncontrolled: the page remounts it (with a key) when it shows a
// different search, so it always starts from that search's brief.
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
      <div className={styles.row}>
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
        <Button type="submit" loading={searching} loadingLabel="Searching…" className={styles.button}>
          Search
        </Button>
      </div>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
