// Small text helpers shared by the result card and the candidate page.

const SENIORITY: Record<string, string> = { junior: "Junior", mid: "Mid-level", senior: "Senior", staff: "Staff" };

export function seniorityLabel(seniority: string): string {
  return SENIORITY[seniority] ?? seniority;
}

export function yearsText(years: number): string {
  return `${years} ${years === 1 ? "year" : "years"}`;
}

// "2023 to present", "2022 to 2023", or "2023" for a job that started and ended that year.
export function yearRange(start: number, end: number | null): string {
  if (end === null) return `${start} to present`;
  return start === end ? String(start) : `${start} to ${end}`;
}

// "Oct 9, 2026", for when a list was created.
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function peopleText(count: number): string {
  return `${count} ${count === 1 ? "person" : "people"}`;
}
