// GET /api/people/:id through the running app, checked against data/candidates.json.
import { readFileSync } from "node:fs";
import type { Candidate } from "@/shared/types";
import { api, RECRUITERS, signIn } from "./helpers";

type SourceCandidate = {
  id: string;
  location: { city: string; country: string };
  experiences: { title: string; start_year: number }[];
  education: { school: string }[];
};
const source = JSON.parse(readFileSync("data/candidates.json", "utf8")) as SourceCandidate[];

describe("GET /api/people/:id", () => {
  let token: string;

  beforeAll(async () => {
    token = (await signIn(RECRUITERS.globex)).token;
  });

  it("returns 401 without a token", async () => {
    expect((await api("/api/people/cand_0001")).status).toBe(401);
  });

  it("returns 404 for an unknown candidate", async () => {
    const { status, body } = await api("/api/people/cand_9999", token);
    expect(status).toBe(404);
    expect(body).toEqual({ error: { code: "not_found", message: "We couldn't find this candidate." } });
  });

  it("returns the candidate with experience newest first and education", async () => {
    // Candidates with 4 jobs show that the order is kept, not left to the database.
    const withFourJobs = source.filter((c) => c.experiences.length === 4).slice(0, 3);
    for (const expected of withFourJobs) {
      const { status, body } = await api<Candidate>(`/api/people/${expected.id}`, token);
      expect(status).toBe(200);
      expect(body).toMatchObject({ id: expected.id, city: expected.location.city, country: expected.location.country });
      expect(body.experiences.map((e) => [e.title, e.start_year])).toEqual(
        expected.experiences.map((e) => [e.title, e.start_year]),
      );
      expect(body.experiences[0]).toHaveProperty("end_year");
      expect(body.education.map((e) => e.school)).toEqual(expected.education.map((e) => e.school));
    }
  });
});
