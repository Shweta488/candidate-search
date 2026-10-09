import { z } from "zod";
import { AppError, toErrorResponse } from "./errors";

async function read(response: Response) {
  return { status: response.status, body: await response.json() };
}

describe("toErrorResponse", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("maps a zod error to 400 naming the field", async () => {
    const result = z.object({ brief: z.string() }).safeParse({ brief: 3 });
    const { status, body } = await read(toErrorResponse(result.error, "r1"));
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_request");
    expect(body.error.message).toMatch(/^brief: /);
  });

  it.each([
    ["unauthenticated", 401],
    ["search_limit_reached", 402],
    ["not_found", 404],
    ["name_taken", 409],
    ["search_unavailable", 503],
  ] as const)("maps AppError %s to %i", async (code, expected) => {
    const { status, body } = await read(toErrorResponse(new AppError(code, "message"), "r1"));
    expect(status).toBe(expected);
    expect(body).toEqual({ error: { code, message: "message" } });
  });

  it.each([
    ["23505", 409, "name_taken"],
    ["23503", 404, "not_found"],
    ["42501", 404, "not_found"],
  ])("maps Postgres code %s to %i", async (pgCode, expected, code) => {
    const { status, body } = await read(toErrorResponse({ code: pgCode, message: "raw detail" }, "r1"));
    expect(status).toBe(expected);
    expect(body.error.code).toBe(code);
    expect(JSON.stringify(body)).not.toContain("raw detail");
  });

  it("hides unexpected errors behind the request id and logs them", async () => {
    const { status, body } = await read(toErrorResponse(new Error("select * from private.companies failed"), "r42"));
    expect(status).toBe(500);
    expect(body).toEqual({ error: { code: "internal_error", message: "Something went wrong. Reference: r42" } });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("r42"));
  });
});
