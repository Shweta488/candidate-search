// Saved searches end to end (LLD 1.6, 6.5): save from the results, then run and delete
// from /saved-searches. Searches are faked (no Claude calls); saved searches use the real
// API and start empty for acme in every test.
import { checkAccessibility, signIn, VIEWPORTS } from "../support/helpers";

const SEARCH_ID = "6f1c6a8e-1d1b-4c55-9d8e-0a6b1f1f2c3d";
const BRIEF = "react engineers in new york";
const FILTERS = { skills: ["React"], cities: ["New York"] };

const page = {
  search_id: SEARCH_ID,
  brief: BRIEF,
  filters: FILTERS,
  unsupported: [],
  page: 1,
  page_size: 20,
  total: 1,
  total_pages: 1,
  results: [
    {
      id: "cand_0629",
      full_name: "Mei Haddad",
      headline: "Engineer",
      avatar_url: "/missing.svg",
      current_title: "Engineer",
      current_company: "Copperline",
      current_company_logo_url: "/missing.svg",
      city: "New York",
      state: "NY",
      seniority: "senior",
      years_experience: 8,
      open_to_work: true,
      skills: ["React"],
    },
  ],
};

function fakeSearch() {
  cy.intercept("GET", `/api/search/${SEARCH_ID}?page=1`, { body: page });
  cy.intercept("POST", "/api/search", { body: { ...page, searches_remaining: 0 } }).as("runSearch");
}

for (const viewport of VIEWPORTS) {
  describe(`Saved searches (${viewport.name})`, () => {
    beforeEach(() => {
      cy.task("deleteSavedBriefs", "acme");
      cy.task("resetSearches", "acme");
      cy.viewport(viewport.width, viewport.height);
      cy.visit("/sign-in");
      signIn("recruiter@acme.test");
      cy.contains("h1", "Find candidates").should("be.visible");
    });

    after(() => {
      cy.task("deleteSavedBriefs", "acme");
      cy.task("resetSearches", "acme");
    });

    it("saves a search from its results", () => {
      fakeSearch();
      cy.visit(`/search?id=${SEARCH_ID}&page=1`);
      cy.contains("h2", "1 candidate").should("be.visible");
      cy.contains("button", "Save search").click();
      cy.contains("[role=status]", "Search saved").should("exist");
      cy.focused().should("have.text", "Saved · View saved searches").click();

      cy.location("pathname").should("eq", "/saved-searches");
      cy.title().should("eq", "Saved searches · Candidate Search");
      cy.contains("li", BRIEF).within(() => {
        cy.contains("Skill: React").should("be.visible");
        cy.contains("City: New York").should("be.visible");
      });
      checkAccessibility();
    });

    it("on the free plan, says running uses the free search, then runs it", () => {
      cy.task("saveBrief", { company: "acme", brief: BRIEF, filters: FILTERS });
      fakeSearch();
      cy.visit("/saved-searches");
      cy.contains("li", BRIEF).contains("button", "Run search").click();
      cy.contains("Running this is a new search. It uses your free search.").should("be.visible");
      cy.focused().should("have.text", "Cancel");
      checkAccessibility();

      cy.focused().type("{esc}");
      cy.contains("It uses your free search.").should("not.exist");

      cy.contains("li", BRIEF).contains("button", "Run search").click();
      cy.get("[role=group]").contains("button", "Run search").click();
      cy.wait("@runSearch").its("request.body").should("deep.equal", { brief: BRIEF, filters: FILTERS });
      cy.location("search").should("eq", `?id=${SEARCH_ID}`);
      cy.contains("h2", "1 candidate").should("be.visible");
    });

    it("doesn't run once the free search is used", () => {
      cy.task("useFreeSearch", "acme");
      cy.task("saveBrief", { company: "acme", brief: BRIEF, filters: FILTERS });
      fakeSearch();
      cy.visit("/saved-searches");
      cy.contains("li", BRIEF).contains("button", "Run search").click();
      cy.contains("You've used your free search, so this can't run on the free plan.").should("be.visible");
      cy.get("[role=group]").contains("button", "Run search").should("not.exist");
      cy.get("@runSearch.all").should("have.length", 0);
    });

    it("deletes a saved search after asking", () => {
      cy.task("saveBrief", { company: "acme", brief: BRIEF, filters: FILTERS });
      cy.visit("/saved-searches");
      cy.contains("li", BRIEF).contains("button", "Delete").click();
      cy.contains("Delete this saved search?").should("be.visible");
      cy.focused().should("have.text", "Cancel");
      cy.get("[role=group]").contains("button", "Delete").click();

      cy.contains("[role=status]", "Saved search deleted").should("be.visible");
      cy.contains("You have no saved searches yet.").should("be.visible");
      cy.focused().should("have.prop", "tagName", "H1");
      checkAccessibility();
    });

    if (viewport.name === "phone") {
      it("is in the phone menu", () => {
        cy.get("button[aria-label=Menu]").click();
        cy.get("#phone-menu").contains("a", "Saved searches").click();
        cy.location("pathname").should("eq", "/saved-searches");
      });
    } else {
      it("is in the header", () => {
        cy.contains("header a", "Saved searches").click();
        cy.contains("h1", "Saved searches").should("be.visible");
        cy.contains("header a", "Saved searches").should("have.attr", "aria-current", "page");
      });
    }
  });
}
