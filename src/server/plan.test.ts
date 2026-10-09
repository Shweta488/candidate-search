import { getPlan, refundSearchCredit, spendSearchCredit } from "./plan";
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

function fakeListRpc(result: { data: unknown; error: unknown }) {
  const rpc = jest.fn().mockResolvedValue(result);
  jest.mocked(serverClient).mockReturnValue({ schema: jest.fn().mockReturnValue({ rpc }) } as never);
  return rpc;
}

describe("spendSearchCredit", () => {
  it("returns the searches left after spending one", async () => {
    const rpc = fakeListRpc({ data: [{ searches_remaining: 0 }], error: null });
    await expect(spendSearchCredit("c1")).resolves.toBe(0);
    expect(rpc).toHaveBeenCalledWith("spend_search_credit", { p_company_id: "c1" });
  });

  it("returns null on the paid plan", async () => {
    fakeListRpc({ data: [{ searches_remaining: null }], error: null });
    await expect(spendSearchCredit("c1")).resolves.toBeNull();
  });

  it("throws search_limit_reached when no row comes back", async () => {
    fakeListRpc({ data: [], error: null });
    await expect(spendSearchCredit("c1")).rejects.toMatchObject({ code: "search_limit_reached", status: 402 });
  });
});

describe("refundSearchCredit", () => {
  it("calls private.refund_search_credit for the company", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    jest.mocked(serverClient).mockReturnValue({ schema: jest.fn().mockReturnValue({ rpc }) } as never);
    await refundSearchCredit("c1");
    expect(rpc).toHaveBeenCalledWith("refund_search_credit", { p_company_id: "c1" });
  });
});
