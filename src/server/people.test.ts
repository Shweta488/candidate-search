import { getCandidate, getCandidateSummaries } from "./people";
import { recruiterClient, serverClient } from "./supabase";

jest.mock("./supabase", () => ({ serverClient: jest.fn(), recruiterClient: jest.fn() }));

const recruiter = { userId: "u1", companyId: "c1", token: "t1" };

// A query builder whose last call resolves to `result`.
function builder(result: { data: unknown; error: unknown }, last: string) {
  const query: Record<string, jest.Mock> = {};
  for (const method of ["select", "eq", "in", "order", "returns", "maybeSingle"]) {
    query[method] = method === last ? jest.fn().mockResolvedValue(result) : jest.fn().mockReturnThis();
  }
  return query;
}

function fakeCandidate(result: { data: unknown; error: unknown }) {
  const query = builder(result, "maybeSingle");
  const from = jest.fn().mockReturnValue(query);
  jest.mocked(serverClient).mockReturnValue({ schema: jest.fn().mockReturnValue({ from }) } as never);
  return { from, query };
}

function fakeLists(result: { data: unknown; error: unknown }) {
  const query = builder(result, "eq");
  const from = jest.fn().mockReturnValue(query);
  jest.mocked(recruiterClient).mockReturnValue({ from } as never);
  return { from, query };
}

describe("getCandidate", () => {
  beforeEach(() => fakeLists({ data: [{ shortlist_id: "s1" }], error: null }));

  it("reads the candidate with experiences newest first, and the recruiter's lists they're on", async () => {
    const education = [{ school: "MIT", degree: "BS", field: "Physics", graduation_year: 2017 }];
    const row = { id: "cand_0001", experiences: [], educations: education };
    const { from, query } = fakeCandidate({ data: row, error: null });
    const lists = fakeLists({ data: [{ shortlist_id: "s1" }], error: null });

    await expect(getCandidate(recruiter, "cand_0001")).resolves.toEqual({
      id: "cand_0001",
      experiences: [],
      education,
      shortlist_ids: ["s1"],
    });
    expect(from).toHaveBeenCalledWith("candidates");
    expect(query.eq).toHaveBeenCalledWith("id", "cand_0001");
    expect(query.order).toHaveBeenCalledWith("position", { referencedTable: "experiences" });
    // The lists are read as the recruiter, so RLS keeps them to the recruiter's company.
    expect(recruiterClient).toHaveBeenCalledWith("t1");
    expect(lists.from).toHaveBeenCalledWith("shortlist_members");
  });

  it("is not found for an unknown id", async () => {
    fakeCandidate({ data: null, error: null });
    await expect(getCandidate(recruiter, "cand_9999")).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("is not found for an absurdly long id, without asking the database", async () => {
    const { from } = fakeCandidate({ data: null, error: null });
    await expect(getCandidate(recruiter, "x".repeat(65))).rejects.toMatchObject({ status: 404 });
    expect(from).not.toHaveBeenCalled();
  });

  it("passes database errors on", async () => {
    fakeCandidate({ data: null, error: { code: "XX000" } });
    await expect(getCandidate(recruiter, "cand_0001")).rejects.toMatchObject({ code: "XX000" });
  });
});

describe("getCandidateSummaries", () => {
  it("returns summaries in the order asked, leaving out unknown ids", async () => {
    const query = builder({ data: [{ id: "b" }, { id: "a" }], error: null }, "returns");
    jest
      .mocked(serverClient)
      .mockReturnValue({ schema: jest.fn().mockReturnValue({ from: jest.fn().mockReturnValue(query) }) } as never);
    await expect(getCandidateSummaries(["a", "missing", "b"])).resolves.toEqual([{ id: "a" }, { id: "b" }]);
    expect(query.in).toHaveBeenCalledWith("id", ["a", "missing", "b"]);
  });

  it("asks nothing for no ids", async () => {
    jest.mocked(serverClient).mockClear();
    await expect(getCandidateSummaries([])).resolves.toEqual([]);
    expect(serverClient).not.toHaveBeenCalled();
  });
});
