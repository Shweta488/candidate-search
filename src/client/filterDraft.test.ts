import { addValue, removeValue, replaceValue, sameFilters, tagsFor } from "./filterDraft";

describe("tagsFor", () => {
  it("makes one tag per value, in field order", () => {
    const filters = { cities: ["New York"], skills: ["React", "Go"], open_to_work: true, min_years: 5, max_years: 1 };
    expect(tagsFor(filters).map((tag) => `${tag.label}: ${tag.text}`)).toEqual([
      "Skill: React",
      "Skill: Go",
      "City: New York",
      "Open to work: yes",
      "At least: 5 years",
      "At most: 1 year",
    ]);
  });
});

describe("addValue", () => {
  it("adds a value to a list once", () => {
    const once = addValue({ skills: ["React"] }, "skills", "Go");
    expect(once).toEqual({ skills: ["React", "Go"] });
    expect(addValue(once, "skills", "Go")).toBe(once);
  });

  it("starts a new list, and sets single values", () => {
    expect(addValue({}, "cities", "Austin")).toEqual({ cities: ["Austin"] });
    expect(addValue({ min_years: 2 }, "min_years", 5)).toEqual({ min_years: 5 });
    expect(addValue({}, "open_to_work", false)).toEqual({ open_to_work: false });
  });
});

describe("removeValue", () => {
  it("removes one value and drops an empty list", () => {
    expect(removeValue({ skills: ["React", "Go"] }, "skills", "React")).toEqual({ skills: ["Go"] });
    expect(removeValue({ skills: ["Go"], cities: ["Austin"] }, "skills", "Go")).toEqual({ cities: ["Austin"] });
  });

  it("removes single values", () => {
    expect(removeValue({ open_to_work: true, min_years: 3 }, "open_to_work", true)).toEqual({ min_years: 3 });
  });

  it("does not change the filters it was given", () => {
    const filters = { skills: ["React"] };
    removeValue(filters, "skills", "React");
    expect(filters).toEqual({ skills: ["React"] });
  });
});

describe("replaceValue", () => {
  it("changes a value in place", () => {
    expect(replaceValue({ cities: ["Austin", "Boston"] }, "cities", "Austin", "Denver")).toEqual({
      cities: ["Denver", "Boston"],
    });
    expect(replaceValue({ min_years: 2 }, "min_years", 2, 4)).toEqual({ min_years: 4 });
  });

  it("does not repeat a value that is already there", () => {
    expect(replaceValue({ cities: ["Austin", "Boston"] }, "cities", "Austin", "Boston")).toEqual({
      cities: ["Boston"],
    });
  });
});

describe("sameFilters", () => {
  it("ignores the order of values", () => {
    expect(sameFilters({ skills: ["Go", "React"] }, { skills: ["React", "Go"] })).toBe(true);
  });

  it("sees any added, removed or changed value", () => {
    expect(sameFilters({ skills: ["Go"] }, { skills: ["Go"], cities: ["Austin"] })).toBe(false);
    expect(sameFilters({ min_years: 2 }, { min_years: 3 })).toBe(false);
    expect(sameFilters({ open_to_work: false }, {})).toBe(false);
  });
});
