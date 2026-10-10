import { getAnthropicApiKey, getStripeWebhookEnv, getSupabaseEnv } from "./env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  SUPABASE_SECRET_KEY: "sb_secret_x",
};

describe("getSupabaseEnv", () => {
  it("returns the values when all are present", () => {
    expect(getSupabaseEnv(valid)).toEqual({
      url: "http://127.0.0.1:54321",
      publishableKey: "sb_publishable_x",
      secretKey: "sb_secret_x",
    });
  });

  it("names every missing variable", () => {
    expect(() => getSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "not a url" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY/,
    );
  });
});

describe("getAnthropicApiKey", () => {
  it("returns the key from the shell", () => {
    expect(getAnthropicApiKey({ ANTHROPIC_API_KEY: "sk-ant-x" })).toBe("sk-ant-x");
  });

  it("names the variable when it is missing or blank", () => {
    expect(() => getAnthropicApiKey({})).toThrow(/ANTHROPIC_API_KEY/);
    expect(() => getAnthropicApiKey({ ANTHROPIC_API_KEY: " " })).toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("getStripeWebhookEnv", () => {
  it("returns the secret as-is and no age check by default", () => {
    expect(getStripeWebhookEnv({ STRIPE_WEBHOOK_SECRET: "whsec_x" })).toEqual({
      secret: "whsec_x",
      toleranceSeconds: undefined,
    });
  });

  it("reads the optional tolerance", () => {
    const env = getStripeWebhookEnv({ STRIPE_WEBHOOK_SECRET: "whsec_x", STRIPE_WEBHOOK_TOLERANCE_SECONDS: "300" });
    expect(env.toleranceSeconds).toBe(300);
  });

  it("names the variable when the secret is missing or the tolerance is not a whole number", () => {
    expect(() => getStripeWebhookEnv({})).toThrow(/STRIPE_WEBHOOK_SECRET/);
    expect(() =>
      getStripeWebhookEnv({ STRIPE_WEBHOOK_SECRET: "whsec_x", STRIPE_WEBHOOK_TOLERANCE_SECONDS: "5m" }),
    ).toThrow(/STRIPE_WEBHOOK_TOLERANCE_SECONDS/);
  });
});
