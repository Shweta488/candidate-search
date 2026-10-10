// Unit tests: *.test.ts next to the file they test. Integration tests use jest.integration.config.ts.
import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/scripts/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // server-only throws outside React Server Components; tests run server code directly.
    "^server-only$": "<rootDir>/node_modules/server-only/empty.js",
  },
};

export default createJestConfig(config);
