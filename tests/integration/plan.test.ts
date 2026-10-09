// GET /api/plan through the running app. Assumes the seed state (no searches used yet).
import { api, RECRUITERS, signIn } from "./helpers";

describe("GET /api/plan", () => {
  it("returns 401 without a token", async () => {
    const { status, body } = await api("/api/plan");
    expect(status).toBe(401);
    expect(body).toEqual({ error: { code: "unauthenticated", message: "Sign in to continue." } });
  });

  it("returns 401 for a token Supabase did not issue", async () => {
    const { status } = await api("/api/plan", "not-a-real-token");
    expect(status).toBe(401);
  });

  it.each(Object.values(RECRUITERS))("returns the free plan with 1 search left for %s", async (email) => {
    const { token } = await signIn(email);
    const { status, body } = await api("/api/plan", token);
    expect(status).toBe(200);
    expect(body).toEqual({ plan: "free", searches_remaining: 1 });
  });
});
