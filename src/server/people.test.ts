import { getCandidate } from "./people";
import { serverClient } from "./supabase";

jest.mock("./supabase", () => ({ serverClient: jest.fn() }));

function fakeQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  const from = jest.fn().mockReturnValue(query);
  jest.mocked(serverClient).mockReturnValue({ schema: jest.fn().mockReturnValue({ from }) } as never);
  return { from, query };
}

describe("getCandidate", () => {
  it("reads the candidate with experiences newest first and renames educations to education", async () => {
    const education = [{ school: "MIT", degree: "BS", field: "Physics", graduation_year: 2017 }];
    const row = { id: "cand_0001", experiences: [], educations: education };
    const { from, query } = fakeQuery({ data: row, error: null });

    await expect(getCandidate("cand_0001")).resolves.toEqual({ id: "cand_0001", experiences: [], education });
    expect(from).toHaveBeenCalledWith("candidates");
    expect(query.eq).toHaveBeenCalledWith("id", "cand_0001");
    expect(query.order).toHaveBeenCalledWith("position", { referencedTable: "experiences" });
  });

  it("is not found for an unknown id", async () => {
    fakeQuery({ data: null, error: null });
    await expect(getCandidate("cand_9999")).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("is not found for an absurdly long id, without asking the database", async () => {
    const { from } = fakeQuery({ data: null, error: null });
    await expect(getCandidate("x".repeat(65))).rejects.toMatchObject({ status: 404 });
    expect(from).not.toHaveBeenCalled();
  });

  it("passes database errors on", async () => {
    fakeQuery({ data: null, error: { code: "XX000" } });
    await expect(getCandidate("cand_0001")).rejects.toMatchObject({ code: "XX000" });
  });
});
