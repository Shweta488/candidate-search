// Nothing secret reaches the browser (NFR2, LLD 9). Scans what next build ships to the
// browser: every file under .next/static, plus the prerendered HTML and RSC payloads.
// Run with npm run check:secrets after next build.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function filesUnder(dir: string, keep: (file: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path, keep);
    return keep(path) ? [path] : [];
  });
}

function envLocal(name: string): string | undefined {
  if (!existsSync(".env.local")) return undefined;
  const line = readFileSync(".env.local", "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim() || undefined;
}

const shipped = [
  ...filesUnder(".next/static", () => true),
  ...filesUnder(".next/server/app", (file) => file.endsWith(".html") || file.endsWith(".rsc")),
];

// Key-shaped strings, not bare prefixes: supabase-js ships the literal "sb_secret_" to
// check which kind of key it was given, and that is fine.
const KEY_SHAPES: [string, RegExp][] = [
  ["a Supabase secret key", /sb_secret_[A-Za-z0-9_-]{16,}/],
  ["an Anthropic API key", /sk-ant-[A-Za-z0-9_-]{16,}/],
  ["a Stripe webhook secret", /whsec_[A-Za-z0-9_]{8,}/],
];

// Server-only code that must never be bundled for the browser.
const SERVER_ONLY_TEXT: [string, string][] = [
  ["the Anthropic API host", "api.anthropic.com"],
  ["the search system prompt", "You turn a recruiter's search brief into filters"],
  ["the webhook signature check", "STRIPE_WEBHOOK_SECRET"],
];

const SECRET_VALUES: [string, string | undefined][] = [
  ["SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY ?? envLocal("SUPABASE_SECRET_KEY")],
  ["ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY],
  ["STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET],
];

describe("built bundle", () => {
  it("exists (run next build first)", () => {
    expect(shipped.length).toBeGreaterThan(0);
  });

  it.each(KEY_SHAPES)("contains no %s", (_name, shape) => {
    const found = shipped.filter((file) => shape.test(readFileSync(file, "utf8")));
    expect(found).toEqual([]);
  });

  it.each(SERVER_ONLY_TEXT)("contains no server-only code: %s", (_name, text) => {
    const found = shipped.filter((file) => readFileSync(file, "utf8").includes(text));
    expect(found).toEqual([]);
  });

  // In CI none of these is set, so only the key shapes above apply there.
  it("contains the value of no secret that is set here", () => {
    const leaks = SECRET_VALUES.flatMap(([name, value]) =>
      value
        ? shipped.filter((file) => readFileSync(file, "utf8").includes(value)).map((file) => `${name} in ${file}`)
        : [],
    );
    expect(leaks).toEqual([]);
  });
});
