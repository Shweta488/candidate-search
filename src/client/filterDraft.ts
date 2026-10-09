import type { Filters, Vocabulary } from "@/shared/types";

// The filters a recruiter is editing before running them again (LLD 6.5).
// Plain functions that return new objects, so the page can keep the draft in state.

export type ListField = Exclude<keyof Filters, "open_to_work" | "min_years" | "max_years">;
export type FilterField = keyof Filters;

type FieldInfo = { label: string; list?: Exclude<keyof Vocabulary, "years_experience"> };

// Every field, in the order tags and the editor show them.
export const FIELDS: Record<FilterField, FieldInfo> = {
  roles: { label: "Role", list: "roles" },
  seniorities: { label: "Seniority", list: "seniorities" },
  skills: { label: "Skill", list: "skills" },
  cities: { label: "City", list: "cities" },
  states: { label: "State", list: "states" },
  worked_at_companies: { label: "Worked at", list: "companies" },
  worked_at_company_types: { label: "Worked at", list: "company_types" },
  schools: { label: "School", list: "schools" },
  degrees: { label: "Degree", list: "degrees" },
  fields_of_study: { label: "Studied", list: "fields_of_study" },
  open_to_work: { label: "Open to work" },
  min_years: { label: "At least" },
  max_years: { label: "At most" },
};

export const FIELD_ORDER = Object.keys(FIELDS) as FilterField[];

// What the editor's "what to filter on" menu calls each field.
export const EDITOR_LABELS: Record<FilterField, string> = {
  roles: "Role",
  seniorities: "Seniority",
  skills: "Skill",
  cities: "City",
  states: "State",
  worked_at_companies: "Past company",
  worked_at_company_types: "Past company type",
  schools: "School",
  degrees: "Degree",
  fields_of_study: "Field of study",
  open_to_work: "Open to work",
  min_years: "Minimum years of experience",
  max_years: "Maximum years of experience",
};

export type FilterValue = string | number | boolean;
export type Tag = { field: FilterField; value: FilterValue; label: string; text: string };

export function isListField(field: FilterField): field is ListField {
  return FIELDS[field].list !== undefined;
}

// One tag per value, in field order.
export function tagsFor(filters: Filters): Tag[] {
  return FIELD_ORDER.flatMap((field): Tag[] => {
    const value = filters[field];
    if (value === undefined) return [];
    const label = FIELDS[field].label;
    if (Array.isArray(value)) return value.map((v) => ({ field, value: v, label, text: v }));
    if (typeof value === "boolean") return [{ field, value, label, text: value ? "yes" : "no" }];
    return [{ field, value, label, text: `${value} ${value === 1 ? "year" : "years"}` }];
  });
}

// Adds a value. A list keeps every value once; open to work and years hold one value.
export function addValue(filters: Filters, field: FilterField, value: FilterValue): Filters {
  if (isListField(field)) {
    const current = filters[field] ?? [];
    const text = String(value);
    return current.includes(text) ? filters : { ...filters, [field]: [...current, text] };
  }
  return { ...filters, [field]: value };
}

export function removeValue(filters: Filters, field: FilterField, value: FilterValue): Filters {
  const next = { ...filters };
  if (isListField(field)) {
    const remaining = (filters[field] ?? []).filter((v) => v !== value);
    if (remaining.length > 0) next[field] = remaining;
    else delete next[field];
  } else {
    delete next[field];
  }
  return next;
}

// Changes one value of a field, keeping its place in the list.
export function replaceValue(filters: Filters, field: FilterField, from: FilterValue, to: FilterValue): Filters {
  if (!isListField(field)) return { ...filters, [field]: to };
  const current = filters[field] ?? [];
  if (current.includes(String(to))) return removeValue(filters, field, from);
  return { ...filters, [field]: current.map((v) => (v === from ? String(to) : v)) };
}

// Same constraints, ignoring the order of values in a list.
export function sameFilters(a: Filters, b: Filters): boolean {
  const normal = (f: Filters) =>
    JSON.stringify(
      FIELD_ORDER.map((field) => {
        const value = f[field];
        return Array.isArray(value) ? [...value].sort() : (value ?? null);
      }),
    );
  return normal(a) === normal(b);
}
