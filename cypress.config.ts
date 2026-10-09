// End-to-end tests against the running app (make setup, then make dev). See docs/TESTING.md.
import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: process.env.APP_URL ?? "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    video: false,
    screenshotOnRunFailure: true,
  },
});
