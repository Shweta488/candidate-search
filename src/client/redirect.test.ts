import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it.each([
    ["/search", "/search"],
    ["/search?id=abc&page=2", "/search?id=abc&page=2"],
    ["/people/cand_0001", "/people/cand_0001"],
  ])("follows a path on this site: %s", (next, expected) => {
    expect(safeNextPath(next)).toBe(expected);
  });

  it.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "search"])(
    "falls back to /search for %p",
    (next) => {
      expect(safeNextPath(next)).toBe("/search");
    },
  );
});
