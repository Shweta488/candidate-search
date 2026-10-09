import { requireRecruiter } from "./auth";
import { AppError } from "./errors";
import { serverClient } from "./supabase";

jest.mock("./supabase", () => ({ serverClient: jest.fn() }));

type Row = { company_id: string } | null;

function fakeSupabase(user: { id: string } | null, row: Row, rowError: unknown = null) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: row, error: rowError });
  const query = { select: () => query, eq: () => query, maybeSingle };
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: "bad jwt" } }) },
    from: jest.fn().mockReturnValue(query),
  };
}

function request(authorization?: string): Request {
  return new Request("http://localhost/api/plan", { headers: authorization ? { authorization } : {} });
}

async function expectUnauthenticated(promise: Promise<unknown>) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({ code: "unauthenticated", status: 401 });
}

describe("requireRecruiter", () => {
  const mocked = jest.mocked(serverClient);

  it("rejects a request with no Authorization header", async () => {
    mocked.mockReturnValue(fakeSupabase({ id: "u1" }, { company_id: "c1" }) as never);
    await expectUnauthenticated(requireRecruiter(request()));
  });

  it("rejects a header that is not a Bearer token", async () => {
    mocked.mockReturnValue(fakeSupabase({ id: "u1" }, { company_id: "c1" }) as never);
    await expectUnauthenticated(requireRecruiter(request("Basic abc")));
  });

  it("rejects a token Supabase does not accept", async () => {
    mocked.mockReturnValue(fakeSupabase(null, null) as never);
    await expectUnauthenticated(requireRecruiter(request("Bearer expired")));
  });

  it("rejects a signed-in user who belongs to no company", async () => {
    mocked.mockReturnValue(fakeSupabase({ id: "u1" }, null) as never);
    await expectUnauthenticated(requireRecruiter(request("Bearer good")));
  });

  it("returns the company from the recruiters table", async () => {
    const supabase = fakeSupabase({ id: "u1" }, { company_id: "c1" });
    mocked.mockReturnValue(supabase as never);
    await expect(requireRecruiter(request("Bearer good"))).resolves.toEqual({
      userId: "u1",
      companyId: "c1",
      token: "good",
    });
    expect(supabase.auth.getUser).toHaveBeenCalledWith("good");
    expect(supabase.from).toHaveBeenCalledWith("recruiters");
  });

  it("passes a database failure on instead of treating it as signed out", async () => {
    mocked.mockReturnValue(fakeSupabase({ id: "u1" }, null, { code: "XX000", message: "db down" }) as never);
    await expect(requireRecruiter(request("Bearer good"))).rejects.toMatchObject({ code: "XX000" });
  });
});
