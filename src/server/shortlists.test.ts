import {
  addMember,
  createShortlist,
  deleteShortlist,
  getShortlist,
  listShortlists,
  shortlistIdsByCandidate,
  ShortlistName,
} from "./shortlists";
import { getCandidateSummaries } from "./people";
import { recruiterClient } from "./supabase";

jest.mock("./supabase", () => ({ recruiterClient: jest.fn() }));
jest.mock("./people", () => ({ getCandidateSummaries: jest.fn() }));

const recruiter = { userId: "u1", companyId: "c1", token: "t1" };
const LIST = "6f1c6a8e-1d1b-4c55-9d8e-0a6b1f1f2c3d";

// A chainable query, like Supabase's: each awaited query gets the next queued result.
function fakeDb(...results: { data: unknown; error: unknown }[]) {
  const query: Record<string, unknown> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "upsert",
    "eq",
    "in",
    "order",
    "returns",
    "single",
    "maybeSingle",
  ];
  for (const method of methods) query[method] = jest.fn(() => query);
  query.then = (resolve: (value: unknown) => void) => resolve(results.shift());
  const from = jest.fn(() => query);
  jest.mocked(recruiterClient).mockReturnValue({ from } as never);
  return { from, query: query as Record<string, jest.Mock> };
}

describe("ShortlistName", () => {
  it("trims and needs 1 to 80 characters", () => {
    expect(ShortlistName.parse({ name: "  Frontend  " })).toEqual({ name: "Frontend" });
    expect(ShortlistName.safeParse({ name: " " }).success).toBe(false);
    expect(ShortlistName.safeParse({ name: "x".repeat(81) }).success).toBe(false);
  });
});

describe("shortlists", () => {
  it("lists with member counts, as the recruiter", async () => {
    fakeDb({ data: [{ id: "l1", name: "A", created_at: "t", shortlist_members: [{ count: 3 }] }], error: null });
    await expect(listShortlists(recruiter)).resolves.toEqual([
      { id: "l1", name: "A", created_at: "t", member_count: 3 },
    ]);
    expect(recruiterClient).toHaveBeenCalledWith("t1");
  });

  it("creates a list for the recruiter's company", async () => {
    const { query } = fakeDb({ data: { id: "l1", name: "A" }, error: null });
    await createShortlist(recruiter, "A");
    expect(query.insert).toHaveBeenCalledWith({ company_id: "c1", name: "A" });
  });

  it("is not found for an id that isn't a uuid, without asking the database", async () => {
    const { from } = fakeDb();
    await expect(getShortlist(recruiter, "nope")).rejects.toMatchObject({ status: 404 });
    await expect(deleteShortlist(recruiter, "nope")).rejects.toMatchObject({ status: 404 });
    expect(from).not.toHaveBeenCalled();
  });

  it("is not found when the delete matched nothing (missing or another company's)", async () => {
    fakeDb({ data: [], error: null });
    await expect(deleteShortlist(recruiter, LIST)).rejects.toMatchObject({ status: 404 });
  });

  it("opens a list with its members' summaries in order", async () => {
    fakeDb({
      data: {
        id: LIST,
        name: "A",
        created_at: "t",
        shortlist_members: [
          { candidate_id: "b", added_at: "2" },
          { candidate_id: "a", added_at: "1" },
        ],
      },
      error: null,
    });
    jest.mocked(getCandidateSummaries).mockResolvedValue([{ id: "a" }, { id: "b" }] as never);
    const list = await getShortlist(recruiter, LIST);
    expect(list.members.map((m) => [m.candidate.id, m.added_at])).toEqual([
      ["b", "2"],
      ["a", "1"],
    ]);
  });

  it.each([
    ["a new person", [{ candidate_id: "cand_0001" }], true],
    ["someone already on the list", [], false],
  ])("says whether %s was added", async (_case, rows, added) => {
    fakeDb({ data: { id: LIST }, error: null }, { data: rows, error: null });
    await expect(addMember(recruiter, LIST, "cand_0001")).resolves.toEqual({ added });
  });

  it("is not found when the person doesn't exist", async () => {
    fakeDb({ data: { id: LIST }, error: null }, { data: null, error: { code: "23503" } });
    await expect(addMember(recruiter, LIST, "cand_9999")).rejects.toMatchObject({
      status: 404,
      message: "We couldn't find this candidate.",
    });
  });

  it("is not found when adding to a list that isn't the recruiter's", async () => {
    const { query } = fakeDb({ data: null, error: null });
    await expect(addMember(recruiter, LIST, "cand_0001")).rejects.toMatchObject({ status: 404 });
    expect(query.upsert).not.toHaveBeenCalled();
  });
});

describe("shortlistIdsByCandidate", () => {
  it("groups the recruiter's list ids by candidate", async () => {
    const { from, query } = fakeDb({
      data: [
        { candidate_id: "cand_0001", shortlist_id: "l1" },
        { candidate_id: "cand_0002", shortlist_id: "l1" },
        { candidate_id: "cand_0001", shortlist_id: "l2" },
      ],
      error: null,
    });
    const lists = await shortlistIdsByCandidate(recruiter, ["cand_0001", "cand_0002", "cand_0003"]);

    expect(lists.get("cand_0001")).toEqual(["l1", "l2"]);
    expect(lists.get("cand_0002")).toEqual(["l1"]);
    expect(lists.has("cand_0003")).toBe(false);
    // Read as the recruiter, so RLS keeps it to their company's lists.
    expect(recruiterClient).toHaveBeenCalledWith("t1");
    expect(from).toHaveBeenCalledWith("shortlist_members");
    expect(query.in).toHaveBeenCalledWith("candidate_id", ["cand_0001", "cand_0002", "cand_0003"]);
  });

  it("asks nothing for no candidates", async () => {
    const { from } = fakeDb();
    await expect(shortlistIdsByCandidate(recruiter, [])).resolves.toEqual(new Map());
    expect(from).not.toHaveBeenCalled();
  });
});
