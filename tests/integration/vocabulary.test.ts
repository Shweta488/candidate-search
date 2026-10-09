// GET /api/vocabulary through the running app.
import type { Vocabulary } from "@/shared/types";
import { api, RECRUITERS, signIn } from "./helpers";

describe("GET /api/vocabulary", () => {
  it("returns 401 without a token", async () => {
    expect((await api("/api/vocabulary")).status).toBe(401);
  });

  it("returns every filter's allowed values, sorted, and the years range", async () => {
    const { token } = await signIn(RECRUITERS.acme);
    const { status, body } = await api<Vocabulary>("/api/vocabulary", token);
    expect(status).toBe(200);

    const lists = [
      "roles",
      "seniorities",
      "cities",
      "states",
      "skills",
      "companies",
      "company_types",
      "schools",
      "degrees",
      "fields_of_study",
    ] as const;
    // Alphabetical ignoring case, the way Postgres sorts text: "Accessibility" before "AWS".
    const alphabetical = (values: string[]) => [...values].sort((a, b) => a.localeCompare(b, "en"));
    for (const list of lists) {
      expect(body[list].length).toBeGreaterThan(0);
      expect(body[list]).toEqual(alphabetical(body[list]));
    }
    expect(body.roles).toHaveLength(13);
    expect(body.seniorities).toEqual(["junior", "mid", "senior", "staff"]);
    expect(body.years_experience).toEqual({ min: 0, max: 15 });
  });
});
