import type { Filters } from "@/shared/types";
import styles from "./FilterTags.module.css";

// The filters the search actually used, one tag per value. Read-only until S3 adds editing.

const LIST_LABELS: [keyof Filters, string][] = [
  ["roles", "Role"],
  ["seniorities", "Seniority"],
  ["skills", "Skill"],
  ["cities", "City"],
  ["states", "State"],
  ["worked_at_companies", "Worked at"],
  ["worked_at_company_types", "Worked at"],
  ["schools", "School"],
  ["degrees", "Degree"],
  ["fields_of_study", "Studied"],
];

export function filterTags(filters: Filters): { key: string; label: string; value: string }[] {
  const tags = LIST_LABELS.flatMap(([field, label]) =>
    ((filters[field] as string[] | undefined) ?? []).map((value) => ({ key: `${field}:${value}`, label, value })),
  );
  if (filters.open_to_work !== undefined) {
    tags.push({ key: "open_to_work", label: "Open to work", value: filters.open_to_work ? "yes" : "no" });
  }
  if (filters.min_years !== undefined) {
    tags.push({ key: "min_years", label: "At least", value: `${filters.min_years} years` });
  }
  if (filters.max_years !== undefined) {
    tags.push({ key: "max_years", label: "At most", value: `${filters.max_years} years` });
  }
  return tags;
}

export function FilterTags({ filters }: { filters: Filters }) {
  const tags = filterTags(filters);
  if (tags.length === 0) return null;
  return (
    <div className={styles.filters}>
      <h2 className={styles.heading} id="filters-heading">
        Filters
      </h2>
      <ul className={styles.list} aria-labelledby="filters-heading">
        {tags.map((tag) => (
          <li key={tag.key} className={styles.tag}>
            <span className={styles.key}>{tag.label}:</span> {tag.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
