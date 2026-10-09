"use client";

import { useId, useRef, useState } from "react";
import {
  addValue,
  removeValue,
  replaceValue,
  tagsFor,
  type FilterField,
  type FilterValue,
  type Tag,
} from "@/client/filterDraft";
import type { Filters } from "@/shared/types";
import { FilterEditor } from "../FilterEditor/FilterEditor";
import styles from "./FilterTags.module.css";

// The filters of a search, one tag per value. With onChange they can be edited: click a
// tag to change it, × to remove it, "+ Add filter" to add one (LLD 6.5). Changes only
// update the draft; the page decides when to run them.

// headingLevel: h3 where the tags sit under another h2, such as a saved search.
type Props = {
  filters: Filters;
  onChange?: (filters: Filters) => void;
  headingLevel?: "h2" | "h3";
};

type Editing = { mode: "add" } | { mode: "change"; tag: Tag };

export function FilterTags({ filters, onChange, headingLevel: Heading = "h2" }: Props) {
  const tags = tagsFor(filters);
  const headingId = useId(); // unique, as a page can show several sets of tags
  const [editing, setEditing] = useState<Editing | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  if (tags.length === 0 && !onChange) return null;

  function open(next: Editing, from: HTMLElement) {
    opener.current = from;
    setEditing(next);
  }

  function close() {
    setEditing(null);
    // Back to the control that opened the editor, or to "+ Add filter" if it's gone.
    requestAnimationFrame(() => (opener.current?.isConnected ? opener.current : addButton.current)?.focus());
  }

  function save(field: FilterField, value: FilterValue) {
    if (!onChange || !editing) return;
    onChange(
      editing.mode === "change"
        ? replaceValue(filters, editing.tag.field, editing.tag.value, value)
        : addValue(filters, field, value),
    );
    opener.current = null; // the tag may have changed; focus "+ Add filter"
    close();
  }

  function remove(tag: Tag) {
    onChange?.(removeValue(filters, tag.field, tag.value));
    requestAnimationFrame(() => addButton.current?.focus());
  }

  return (
    <div className={styles.block}>
      <div className={styles.filters}>
        <Heading className={styles.heading} id={headingId}>
          Filters
        </Heading>
        <ul className={styles.list} aria-labelledby={headingId}>
          {tags.map((tag) => (
            <li key={`${tag.field}:${String(tag.value)}`} className={styles.tag}>
              {onChange ? (
                <>
                  <button
                    type="button"
                    className={styles.tagEdit}
                    aria-label={`Change ${tag.label}: ${tag.text}`}
                    onClick={(event) => open({ mode: "change", tag }, event.currentTarget)}
                  >
                    <span className={styles.key}>{tag.label}:</span> {tag.text}
                  </button>
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={`Remove ${tag.label}: ${tag.text}`}
                    onClick={() => remove(tag)}
                  >
                    ×
                  </button>
                </>
              ) : (
                <span className={styles.tagText}>
                  <span className={styles.key}>{tag.label}:</span> {tag.text}
                </span>
              )}
            </li>
          ))}
        </ul>
        {onChange && (
          <button
            ref={addButton}
            type="button"
            className={styles.add}
            aria-expanded={editing?.mode === "add"}
            onClick={(event) => open({ mode: "add" }, event.currentTarget)}
          >
            + Add filter
          </button>
        )}
      </div>
      {editing && (
        <FilterEditor
          key={editing.mode === "change" ? `${editing.tag.field}:${String(editing.tag.value)}` : "add"}
          editing={editing.mode === "change" ? { field: editing.tag.field, value: editing.tag.value } : undefined}
          onSave={save}
          onCancel={close}
        />
      )}
    </div>
  );
}
