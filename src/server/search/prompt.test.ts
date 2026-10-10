import { readFileSync } from "node:fs";
import { SYSTEM_PROMPT } from "./prompt";

const ENGINEERING_ROLES = [
  "Backend Engineer",
  "Frontend Engineer",
  "Full Stack Engineer",
  "Mobile Engineer",
  "Machine Learning Engineer",
  "DevOps Engineer",
  "Data Engineer",
];

describe("SYSTEM_PROMPT", () => {
  it("maps umbrella job titles to the engineering roles (LLD 3.3)", () => {
    expect(SYSTEM_PROMPT).toMatch(/"engineer", "software engineer", "developer" or "programmer" with no qualifier/);
    for (const role of ENGINEERING_ROLES) expect(SYSTEM_PROMPT).toContain(role);
  });

  it("names only roles that exist in the data, and every role ending in Engineer", () => {
    const candidates = JSON.parse(readFileSync("data/candidates.json", "utf8")) as { role: string }[];
    const engineeringRolesInData = [...new Set(candidates.map((c) => c.role))].filter((role) =>
      role.endsWith("Engineer"),
    );
    expect(engineeringRolesInData.sort()).toEqual([...ENGINEERING_ROLES].sort());
  });
});
