// The Upgrade dialog (LLD 5, 6.7). /api/plan and /api/search are answered by cy.intercept,
// so this spec never calls the LLM, never spends a search and never changes billing.
import { checkAccessibility, signIn, VIEWPORTS } from "../support/helpers";

const FREE = { plan: "free", searches_remaining: 1, company_name: "Acme" };
const USED_UP = { plan: "free", searches_remaining: 0, company_name: "Acme" };
const PAID = { plan: "paid", searches_remaining: null, company_name: "Acme" };

function visitSearch(plan: object) {
  cy.intercept("GET", "/api/plan", { statusCode: 200, body: plan }).as("plan");
  cy.visit("/sign-in");
  signIn("recruiter@acme.test");
  cy.contains("h1", "Find candidates").should("be.visible");
  cy.wait("@plan");
}

for (const viewport of VIEWPORTS) {
  describe(`Upgrade dialog (${viewport.name})`, () => {
    beforeEach(() => cy.viewport(viewport.width, viewport.height));

    it("opens from the plan pill on the free plan and closes with Escape", () => {
      visitSearch(FREE);
      cy.get('button[aria-label="Free plan, 1 search left. Upgrade"]').as("pill").click();

      cy.get("dialog[open]").should("be.visible");
      cy.contains("h2", "Upgrade to the paid plan").should("have.focus");
      cy.contains("dialog", "The paid plan has unlimited searches.").should("be.visible");
      cy.contains("dialog", "Upgrades are handled through Acme's billing account, not here.").should("be.visible");
      checkAccessibility();

      cy.focused().type("{esc}");
      cy.get("dialog[open]").should("not.exist");
      cy.get("@pill").should("have.focus");
    });

    it("reloads the plan when the dialog closes", () => {
      visitSearch(FREE);
      cy.get('button[aria-label="Free plan, 1 search left. Upgrade"]').click();
      cy.intercept("GET", "/api/plan", { statusCode: 200, body: PAID }).as("planAfter");
      cy.contains("dialog button", "Close").click();

      // On the paid plan the pill is plain text, with nothing to open.
      cy.wait("@planAfter");
      cy.contains("span", "Paid plan").should("be.visible");
      cy.get("button[aria-haspopup=dialog]").should("not.exist");
    });

    it("opens from the limit panel", () => {
      visitSearch(USED_UP);
      cy.intercept("POST", "/api/search", {
        statusCode: 402,
        body: { error: { code: "search_limit_reached", message: "You've used your free search." } },
      });
      cy.get("textarea").type("senior React engineers in New York");
      cy.contains("button", "Search").click();

      cy.contains("h2", "You've used your free search.").should("be.visible");
      cy.contains("button", "Upgrade").click();
      cy.contains("dialog[open] h2", "Upgrade to the paid plan").should("be.visible");
      cy.contains("dialog button", "Close").click();
      cy.contains("button", "Upgrade").should("have.focus");
    });

    it("shows the company name in the header, or in the menu on a phone", () => {
      visitSearch(FREE);
      if (viewport.name === "desktop") {
        cy.get("header").contains("Acme").should("be.visible");
      } else {
        cy.contains("header span", "Acme").should("not.be.visible"); // hidden; shown in the menu instead
        cy.get('button[aria-label="Menu"]').click();
        cy.get("#phone-menu").contains("Acme").should("be.visible");
      }
    });
  });
}
