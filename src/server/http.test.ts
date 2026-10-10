import { z } from "zod";
import { requireRecruiter } from "./auth";
import { AppError } from "./errors";
import { json, parseParams, readJson, readRawBody, withRecruiter, withRequestLog } from "./http";

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

describe("readJson", () => {
  const schema = z.object({ brief: z.string() });
  const post = (body: string) => new Request("http://localhost/api/search", { method: "POST", body });

  it("parses and validates a JSON body", async () => {
    await expect(readJson(post('{"brief":"go engineers"}'), schema)).resolves.toEqual({ brief: "go engineers" });
  });

  it("rejects a body that isn't JSON", async () => {
    await expect(readJson(post("brief=go"), schema)).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("rejects a body over 16 KB", async () => {
    const body = JSON.stringify({ brief: "x".repeat(16 * 1024) });
    await expect(readJson(post(body), schema)).rejects.toMatchObject({ message: expect.stringMatching(/16 KB/) });
  });

  it("lets the schema reject a wrong shape", async () => {
    await expect(readJson(post('{"brief":3}'), schema)).rejects.toBeInstanceOf(z.ZodError);
  });
});

describe("readRawBody", () => {
  it("returns the body text unchanged, spacing included", async () => {
    const body = '{"id": "evt_1",  "x": 1}';
    await expect(readRawBody(new Request("http://localhost/", { method: "POST", body }))).resolves.toBe(body);
  });
});

describe("withRequestLog", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("logs one line with no company", async () => {
    const response = await withRequestLog(async () => json({ outcome: "applied" }))(
      new Request("http://localhost/api/billing/events", { method: "POST" }),
    );
    expect(response.status).toBe(200);
    const line = JSON.parse(jest.mocked(console.log).mock.calls[0][0] as string);
    expect(line).toMatchObject({ route: "/api/billing/events", status: 200, company_id: null });
  });

  it("maps errors the same way as recruiter routes", async () => {
    const response = await withRequestLog(async () => {
      throw new AppError("invalid_signature", "The Stripe signature is not valid.");
    })(new Request("http://localhost/api/billing/events", { method: "POST" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_signature");
  });
});

describe("parseParams", () => {
  it("validates with the schema", () => {
    const schema = z.object({ id: z.string().min(1) });
    expect(parseParams({ id: "s1" }, schema)).toEqual({ id: "s1" });
    expect(() => parseParams({ id: "" }, schema)).toThrow(z.ZodError);
  });
});
