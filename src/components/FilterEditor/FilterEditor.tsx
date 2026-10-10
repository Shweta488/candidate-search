"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  EDITOR_LABELS,
  FIELD_ORDER,
  FIELDS,
  type FilterField,
  type FilterValue,
  valueLabel,
} from "@/client/filterDraft";
import { useVocabulary } from "@/client/vocabulary";
import { Button } from "../Button/Button";
import styles from "./FilterEditor.module.css";

// Adds a filter, or changes one (then the field is fixed). Only values that exist in the
// data can be chosen. Escape or Cancel closes it.

type Props = {
  editing?: { field: FilterField; value: FilterValue };
  onSave: (field: FilterField, value: FilterValue) => void;
  onCancel: () => void;
};

// Lists longer than this get a text box with suggestions instead of a menu.
const MENU_LIMIT = 30;

export function FilterEditor({ editing, onSave, onCancel }: Props) {
  const id = useId();
  const { vocabulary, error } = useVocabulary();
  const [field, setField] = useState<FilterField>(editing?.field ?? "roles");
  const [value, setValue] = useState(() => {
    if (!editing) return "";
    if (typeof editing.value === "boolean") return editing.value ? "yes" : "no";
    return String(editing.value);
  });
  const [problem, setProblem] = useState<string | null>(null);
  const firstControl = useRef<HTMLSelectElement & HTMLInputElement>(null);

  useEffect(() => {
    firstControl.current?.focus();
  }, [vocabulary]);

  const list = FIELDS[field].list;
  const options = list && vocabulary ? vocabulary[list] : [];
  const yearsField = field === "min_years" || field === "max_years";

  function save() {
    if (field === "open_to_work") return onSave(field, value !== "no");
    if (yearsField) {
      const years = Number(value);
      if (value === "" || !Number.isInteger(years) || years < 0 || years > 60) {
        return setProblem("Enter a whole number of years from 0 to 60.");
      }
      return onSave(field, years);
    }
    if (!options.includes(value)) {
      return setProblem(`Choose a ${EDITOR_LABELS[field].toLowerCase()} from the list.`);
    }
    onSave(field, value);
  }

  function chooseField(next: FilterField) {
    setField(next);
    setValue("");
    setProblem(null);
  }

  const valueId = `${id}-value`;
  const problemId = `${id}-problem`;
  const describedBy = problem ? problemId : undefined;

  return (
    <form
      className={styles.editor}
      aria-label={editing ? "Change filter" : "Add filter"}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      {error ? (
        <p className={styles.problem} role="alert">
          Couldn&apos;t load the filter options. Close this and try again.
        </p>
      ) : !vocabulary ? (
        <p className={styles.loading}>Loading options…</p>
      ) : (
        <div className={styles.row}>
          {/* Changing a tag keeps its field, so only the value is shown, labelled with the field. */}
          {!editing && (
            <div className={styles.control}>
              <label htmlFor={`${id}-field`}>Filter on</label>
              <select
                id={`${id}-field`}
                ref={firstControl}
                value={field}
                onChange={(event) => chooseField(event.target.value as FilterField)}
              >
                {FIELD_ORDER.map((f) => (
                  <option key={f} value={f}>
                    {EDITOR_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={styles.control}>
            <label htmlFor={valueId}>{editing ? EDITOR_LABELS[field] : "Value"}</label>
            {field === "open_to_work" ? (
              <select
                id={valueId}
                ref={editing ? firstControl : undefined}
                value={value || "yes"}
                onChange={(event) => setValue(event.target.value)}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            ) : yearsField ? (
              <input
                id={valueId}
                ref={editing ? firstControl : undefined}
                type="number"
                min={0}
                max={60}
                inputMode="numeric"
                value={value}
                aria-invalid={problem ? true : undefined}
                aria-describedby={describedBy}
                onChange={(event) => setValue(event.target.value)}
              />
            ) : options.length > MENU_LIMIT ? (
              <>
                <input
                  id={valueId}
                  ref={editing ? firstControl : undefined}
                  list={`${id}-options`}
                  value={value}
                  autoComplete="off"
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => setValue(event.target.value)}
                />
                <datalist id={`${id}-options`}>
                  {options.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </>
            ) : (
              <select
                id={valueId}
                ref={editing ? firstControl : undefined}
                value={value}
                aria-invalid={problem ? true : undefined}
                aria-describedby={describedBy}
                onChange={(event) => setValue(event.target.value)}
              >
                <option value="">Choose…</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {valueLabel(field, option)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className={styles.actions}>
            <Button type="submit" size="sm">
              {editing ? "Change" : "Add"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {problem && (
        <p id={problemId} className={styles.problem} role="alert">
          {problem}
        </p>
      )}
    </form>
  );
}
