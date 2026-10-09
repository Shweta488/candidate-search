import { serverClient } from "../supabase";
import { getSearchPage, totalPages } from "./getSearchPage";

jest.mock("../supabase", () => ({ serverClient: jest.fn() }));

const SEARCH_ID = "6f1c6a8e-1d1b-4c55-9d8e-0a6b1f1f2c3d";

function fakeRpc(result: { data: unknown; error: unknown }) {
  const rpc = jest.fn().mockResolvedValue(result);
  jest.mocked(serverClient).mockReturnValue({ schema: jest.fn().mockReturnValue({ rpc }) } as never);
  return rpc;
}

describe("totalPages", () => {
  it.each([
    [0, 0],
    [1, 1],
    [20, 1],
    [21, 2],
    [199, 10],
  ])("%i results make %i pages of 20", (total, pages) => {
    expect(totalPages(total)).toBe(pages);
  });
});

describe("getSearchPage", () => {
  it("reads the page for this company and adds the page numbers", async () => {
    const rpc = fakeRpc({
      data: { search_id: SEARCH_ID, brief: "b", filters: {}, unsupported: [], total: 21, results: [] },
      error: null,
    });
    await expect(getSearchPage("c1", SEARCH_ID, 2)).resolves.toMatchObject({
      page: 2,
      page_size: 20,
      total: 21,
      total_pages: 2,
      results: [],
    });
    expect(rpc).toHaveBeenCalledWith("get_search_page", { p_company_id: "c1", p_search_id: SEARCH_ID, p_page: 2 });
  });

  it("is not found when the search isn't this company's", async () => {
    fakeRpc({ data: null, error: null });
    await expect(getSearchPage("c1", SEARCH_ID, 1)).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("is not found for an id that isn't a uuid, without asking the database", async () => {
    const rpc = fakeRpc({ data: null, error: null });
    await expect(getSearchPage("c1", "not-a-uuid", 1)).rejects.toMatchObject({ status: 404 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
