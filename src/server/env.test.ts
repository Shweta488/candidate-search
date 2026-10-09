import { getAnthropicApiKey, getSupabaseEnv } from "./env";

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
