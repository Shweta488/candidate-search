import { checkAccessibility, signIn, VIEWPORTS } from "../support/helpers";

for (const viewport of VIEWPORTS) {
  describe(`Sign in (${viewport.name})`, () => {
    beforeEach(() => cy.viewport(viewport.width, viewport.height));

    it("sends a signed-out visitor to sign-in, then back to where they were going", () => {
      cy.visit("/search");
      cy.location("pathname").should("eq", "/sign-in");
      cy.location("search").should("eq", "?next=%2Fsearch");

      signIn("recruiter@acme.test");
      cy.location("pathname").should("eq", "/search");
      cy.contains("h1", "Find candidates").should("be.focused");
      cy.title().should("eq", "Search · Candidate Search");
    });

    it("shows a clear error for a wrong password and stays on sign-in", () => {
      cy.visit("/sign-in");
      signIn("recruiter@acme.test", "wrong-password");
      cy.get("[role=alert]").should("have.text", "Email or password is incorrect.");
      cy.location("pathname").should("eq", "/sign-in");
    });

    it("shows the free plan in the header, then signs out", () => {
      cy.visit("/sign-in");
      signIn("recruiter@globex.test");
      cy.location("pathname").should("eq", "/search");

      cy.get("header").contains("Free").should("be.visible");
      if (viewport.name === "desktop") {
        cy.get("header").contains("1 search left").should("be.visible");
      } else {
        cy.get("header").contains("1 left").should("be.visible");
      }

      // On phones, Sign out is in the menu.
      if (viewport.name === "phone") cy.get("button[aria-label=Menu]").click();
      cy.contains("button:visible", "Sign out").click();
      cy.location("pathname").should("eq", "/sign-in");
      cy.visit("/search");
      cy.location("pathname").should("eq", "/sign-in");
    });

    it("has no accessibility violations on sign-in or the app shell", () => {
      cy.visit("/sign-in");
      cy.get("#email").should("be.visible");
      checkAccessibility();

      signIn("recruiter@acme.test");
      cy.contains("h1", "Find candidates").should("be.visible");
      cy.get("header").contains("Free").should("be.visible");
      checkAccessibility();
    });
  });
}
