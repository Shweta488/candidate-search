import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Layer rule (RULES.md section 3): UI code never imports server code.
    files: ["app/**/*.{ts,tsx}", "src/client/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: ["app/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server", "@/server/*", "**/src/server", "**/src/server/*"],
              message: "UI code must not import from src/server (RULES.md section 3). Put shared types in src/shared.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "supabase/**"]),
]);

export default eslintConfig;
