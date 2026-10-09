import { ZodError } from "zod";
import type { Vocabulary } from "@/shared/types";
import { AppError } from "../errors";
import { refundSearchCredit, spendSearchCredit } from "../plan";
import { serverClient } from "../supabase";
import { extractFilters } from "./extractFilters";
import { getSearchPage } from "./getSearchPage";
import { runSearch, SearchBody, toRunSearchParams } from "./runSearch";
import { getVocabulary } from "./vocabulary";

jest.mock("../plan", () => ({ spendSearchCredit: jest.fn(), refundSearchCredit: jest.fn() }));
jest.mock("../supabase", () => ({ serverClient: jest.fn() }));
jest.mock("./extractFilters", () => ({ extractFilters: jest.fn() }));
jest.mock("./getSearchPage", () => ({ getSearchPage: jest.fn() }));
jest.mock("./vocabulary", () => ({ getVocabulary: jest.fn() }));

const vocabulary: Vocabulary = {
  roles: ["Backend Engineer"],
  seniorities: ["senior"],
  cities: ["Austin"],
  states: ["TX"],
  skills: ["Go"],
  companies: [],
  company_types: [],
  schools: [],
  degrees: [],
  fields_of_study: [],
  years_experience: { min: 0, max: 15 },
};

const page = {
  search_id: "s1",
  brief: "go engineers",
  filters: { skills: ["Go"] },
  unsupported: [],
  page: 1,
  page_size: 20,
  total: 1,
  total_pages: 1,
  results: [],
};

let rpc: jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.mocked(getVocabulary).mockResolvedValue(vocabulary);
  jest.mocked(spendSearchCredit).mockResolvedValue(0);
  jest.mocked(refundSearchCredit).mockResolvedValue();
  jest.mocked(getSearchPage).mockResolvedValue(page);
  jest.mocked(extractFilters).mockResolvedValue({ filters: { skills: ["Go"] }, unsupported: [], cacheReadTokens: 0 });
  const single = jest.fn().mockResolvedValue({ data: { search_id: "s1", total: 1 }, error: null });
  rpc = jest.fn().mockReturnValue({ single });
  jest.mocked(serverClient).mockReturnValue({ schema: jest.fn().mockReturnValue({ rpc }) } as never);
});

afterAll(() => jest.restoreAllMocks());

const runParams = () => rpc.mock.calls[0][1];

describe("runSearch", () => {
  it("spends a search, extracts filters, runs and returns page 1 with the searches left", async () => {
    await expect(runSearch("c1", { brief: "go engineers" }, "r1")).resolves.toEqual({ ...page, searches_remaining: 0 });
    expect(spendSearchCredit).toHaveBeenCalledWith("c1");
    expect(rpc).toHaveBeenCalledWith("run_search", expect.objectContaining({ p_company_id: "c1", p_skills: ["Go"] }));
    expect(runParams().p_return_nobody).toBe(false);
    expect(getSearchPage).toHaveBeenCalledWith("c1", "s1", 1);
  });

  it("logs one search line without the brief", async () => {
    await runSearch("c1", { brief: "go engineers" }, "r1");
    const line = jest.mocked(console.log).mock.calls.map((call) => String(call[0])).find((l) => l.includes('"search"'));
    expect(JSON.parse(line ?? "{}")).toMatchObject({ type: "search", search_id: "s1", company_id: "c1", total: 1 });
    expect(line).not.toContain("go engineers");
  });

  it("uses filters sent by the client without calling the LLM", async () => {
    await runSearch("c1", { brief: "go engineers", filters: { cities: ["Austin"] } }, "r1");
    expect(extractFilters).not.toHaveBeenCalled();
    expect(runParams()).toMatchObject({ p_cities: ["Austin"], p_skills: null, p_unsupported: [] });
  });

  it("rejects unknown client filters with a 400 before spending a search", async () => {
    const error = await runSearch("c1", { brief: "x", filters: { skills: ["Rust"] } }, "r1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ZodError);
    expect((error as ZodError).issues[0]?.path).toEqual(["filters", "skills", 0]);
    expect(spendSearchCredit).not.toHaveBeenCalled();
  });

  it("does not call the LLM when the free search is used up", async () => {
    jest.mocked(spendSearchCredit).mockRejectedValue(new AppError("search_limit_reached", "Used."));
    await expect(runSearch("c1", { brief: "go engineers" }, "r1")).rejects.toMatchObject({ status: 402 });
    expect(extractFilters).not.toHaveBeenCalled();
  });

  it("gives the search back when the LLM fails", async () => {
    jest.mocked(extractFilters).mockRejectedValue(new AppError("search_unavailable", "Unavailable."));
    await expect(runSearch("c1", { brief: "go engineers" }, "r1")).rejects.toMatchObject({ status: 503 });
    expect(refundSearchCredit).toHaveBeenCalledWith("c1");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("gives the search back when the database fails", async () => {
    rpc.mockReturnValue({ single: jest.fn().mockResolvedValue({ data: null, error: { code: "XX000" } }) });
    await expect(runSearch("c1", { brief: "go engineers" }, "r1")).rejects.toMatchObject({ code: "XX000" });
    expect(refundSearchCredit).toHaveBeenCalledWith("c1");
  });

  it("returns nobody when part of the brief is unsupported", async () => {
    jest.mocked(extractFilters).mockResolvedValue({
      filters: { roles: ["Backend Engineer"] },
      unsupported: ["speaks Japanese"],
      cacheReadTokens: 0,
    });
    await runSearch("c1", { brief: "backend engineers who speak Japanese" }, "r1");
    expect(runParams()).toMatchObject({ p_return_nobody: true, p_unsupported: ["speaks Japanese"] });
  });

  it("returns nobody when no filter was understood", async () => {
    jest.mocked(extractFilters).mockResolvedValue({ filters: {}, unsupported: [], cacheReadTokens: 0 });
    await runSearch("c1", { brief: "find me someone great" }, "r1");
    expect(runParams().p_return_nobody).toBe(true);
  });
});

describe("SearchBody", () => {
  it("trims the brief and requires 1 to 500 characters", () => {
    expect(SearchBody.parse({ brief: "  go engineers  " })).toEqual({ brief: "go engineers" });
    expect(SearchBody.safeParse({ brief: "   " }).success).toBe(false);
    expect(SearchBody.safeParse({ brief: "x".repeat(501) }).success).toBe(false);
    expect(SearchBody.safeParse({}).success).toBe(false);
    expect(SearchBody.parse({ brief: "go\u0000 engineers" })).toEqual({ brief: "go engineers" });
  });
});

describe("toRunSearchParams", () => {
  it("maps every filter to its SQL parameter and the rest to null", () => {
    expect(
      toRunSearchParams({
        worked_at_companies: ["Copperline"],
        worked_at_company_types: ["startup"],
        fields_of_study: ["Physics"],
        open_to_work: false,
        min_years: 0,
      }),
    ).toEqual({
      p_roles: null,
      p_seniorities: null,
      p_cities: null,
      p_states: null,
      p_skills: null,
      p_companies: ["Copperline"],
      p_company_types: ["startup"],
      p_schools: null,
      p_degrees: null,
      p_fields: ["Physics"],
      p_open_to_work: false,
      p_min_years: 0,
      p_max_years: null,
    });
  });
});
