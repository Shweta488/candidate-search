// A real search, brief to results, through the LLM (about 4 Claude calls per run), then a
// correction that removes a filter and runs again.
// UI states with faked responses are in search-states.cy.ts.
import { checkAccessibility, signIn, VIEWPORTS } from "../support/helpers";

for (const viewport of VIEWPORTS) {
  describe(`Search (${viewport.name})`, () => {
    beforeEach(() => {
      cy.task("resetSearches", "acme");
      cy.viewport(viewport.width, viewport.height);
      cy.visit("/sign-in");
      signIn("recruiter@acme.test");
      cy.contains("h1", "Find candidates").should("be.visible");
    });

    after(() => cy.task("resetSearches", "acme"));

    it("turns a brief into filters and ranked results, then pages", () => {
      cy.get("textarea").type("senior React engineers in New York who have worked at a startup");
      cy.contains("button", "Search").click();

      cy.contains("h2", "21 candidates", { timeout: 10_000 }).should("be.visible");
      cy.contains("li", "Seniority: senior").should("be.visible");
      cy.contains("li", "Skill: React").should("be.visible");
      cy.contains("li", "City: New York").should("be.visible");
      cy.contains("li", "Worked at: startup").should("be.visible");
      cy.get("article").should("have.length", 20);
      cy.get("header")
        .contains(viewport.name === "desktop" ? "0 searches left" : "0 left")
        .should("be.visible");
      checkAccessibility();

      cy.contains("a", "Next ›").click();
      cy.contains("Page 2 of 2").should("be.visible");
      cy.get("article").should("have.length", 1);

      // Correct it: drop the city and run again. Edited filters skip the LLM.
      cy.task("resetSearches", "acme");
      cy.get("button[aria-label='Remove City: New York']").click();
      cy.contains("button", "Run search").click();
      cy.contains("h2", "95 candidates").should("be.visible");
      cy.contains("li", "City: New York").should("not.exist");
    });

    it("shows what it couldn't filter on instead of the wrong people", () => {
      cy.get("textarea").type("product managers who speak Japanese");
      cy.contains("button", "Search").click();

      cy.contains("h2", "Couldn't filter on:", { timeout: 10_000 }).should("contain", "Japanese");
      cy.contains("li", "Role: Product Manager").should("be.visible");
      cy.get("article").should("not.exist");
    });
  });
}
