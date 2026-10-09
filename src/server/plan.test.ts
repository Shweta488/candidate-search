import { getPlan } from "./plan";
import { serverClient } from "./supabase";

jest.mock("./supabase", () => ({ serverClient: jest.fn() }));

function fakeRpc(result: { data: unknown; error: unknown }) {
  const rpc = jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue(result) });
  const schema = jest.fn().mockReturnValue({ rpc });
  jest.mocked(serverClient).mockReturnValue({ schema } as never);
  return { schema, rpc };
}

describe("getPlan", () => {
  it("calls private.get_plan for the company and returns its row", async () => {
    const { schema, rpc } = fakeRpc({ data: { plan: "free", searches_remaining: 1 }, error: null });
    await expect(getPlan("c1")).resolves.toEqual({ plan: "free", searches_remaining: 1 });
    expect(schema).toHaveBeenCalledWith("private");
    expect(rpc).toHaveBeenCalledWith("get_plan", { p_company_id: "c1" });
  });

  it("passes database errors on", async () => {
    fakeRpc({ data: null, error: { code: "XX000", message: "down" } });
    await expect(getPlan("c1")).rejects.toMatchObject({ code: "XX000" });
  });
});
