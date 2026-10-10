// Built-bundle secret scan: tests/security/*.test.ts, run by npm run check:secrets after next build.
import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/security/**/*.test.ts"],
};

export default createJestConfig(config);
