import { requireRecruiter } from "./auth";
import { AppError } from "./errors";
import { json, withRecruiter } from "./http";

jest.mock("./auth", () => ({ requireRecruiter: jest.fn() }));

const route = { params: Promise.resolve({}) };
const recruiter = { userId: "u1", companyId: "c1", token: "t" };

describe("withRecruiter", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("passes the recruiter to the handler and logs one line", async () => {
    jest.mocked(requireRecruiter).mockResolvedValue(recruiter);
    const handler = jest.fn(async () => json({ ok: true }));
    const response = await withRecruiter(handler)(new Request("http://localhost/api/plan"), route);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(expect.any(Request), expect.objectContaining({ recruiter, params: {} }));
    const line = JSON.parse(jest.mocked(console.log).mock.calls[0][0] as string);
    expect(line).toMatchObject({ type: "request", method: "GET", route: "/api/plan", status: 200, company_id: "c1" });
    expect(line).not.toHaveProperty("token");
  });

  it("turns a failed auth check into 401 without calling the handler", async () => {
    jest.mocked(requireRecruiter).mockRejectedValue(new AppError("unauthenticated", "Sign in to continue."));
    const handler = jest.fn();
    const response = await withRecruiter(handler)(new Request("http://localhost/api/plan"), route);

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("turns a handler crash into a 500 with a request id", async () => {
    jest.mocked(requireRecruiter).mockResolvedValue(recruiter);
    const response = await withRecruiter(async () => {
      throw new Error("boom");
    })(new Request("http://localhost/api/plan"), route);

    expect(response.status).toBe(500);
    expect((await response.json()).error.message).toMatch(/^Something went wrong\. Reference: /);
  });
});
