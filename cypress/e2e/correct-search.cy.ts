// Correcting a search (LLD 6.5): edit, remove and add filter tags, then run them.
// /api/search is answered by cy.intercept, so this spec never calls the LLM or spends a
// search. The filter options come from the real /api/vocabulary.
import { checkAccessibility, signIn, VIEWPORTS } from "../support/helpers";

const SEARCH_ID = "6f1c6a8e-1d1b-4c55-9d8e-0a6b1f1f2c3d";
const NEXT_ID = "7a2d7b9f-2e2c-4d66-8e9f-1b7c2a2a3d4e";
const BRIEF = "senior React engineers in New York who have worked at a startup";
const FILTERS = { seniorities: ["senior"], skills: ["React"], cities: ["New York"] };

function page(overrides: Record<string, unknown> = {}) {
  return {
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
        id: "cand_0001",
        full_name: "Elena Costa",
        headline: "Senior Frontend Engineer",
        avatar_url: "/missing.svg",
        current_title: "Senior Frontend Engineer",
        current_company: "Fernway",
        current_company_logo_url: "/missing.svg",
        city: "New York",
        state: "NY",
        seniority: "senior",
        years_experience: 9,
        open_to_work: true,
        skills: ["React"],
        shortlist_ids: [],
      },
    ],
    searches_remaining: 0,
    ...overrides,
  };
}

// Opens a search as if it had just been run, with the free search still unused.
function openSearch(body = page()) {
  cy.intercept("GET", `/api/search/${SEARCH_ID}?page=1`, { body }).as("load");
  cy.visit(`/search?id=${SEARCH_ID}&page=1`);
  cy.wait("@load");
}

function expectRun(filters: Record<string, unknown>) {
  cy.intercept("POST", "/api/search", { body: page({ search_id: NEXT_ID, filters }) }).as("run");
  cy.contains("button", "Run search").click();
  cy.wait("@run").its("request.body").should("deep.equal", { brief: BRIEF, filters });
  cy.location("search").should("eq", `?id=${NEXT_ID}`);
  cy.contains("You changed the filters").should("not.exist");
}

for (const viewport of VIEWPORTS) {
  describe(`Correct a search (${viewport.name})`, () => {
    beforeEach(() => {
      cy.task("resetSearches", "acme");
      cy.viewport(viewport.width, viewport.height);
      cy.visit("/sign-in");
      signIn("recruiter@acme.test");
      cy.contains("h1", "Find candidates").should("be.visible");
    });

    after(() => cy.task("resetSearches", "acme"));

    it("removes a tag, says it's a new search, and runs the edited filters", () => {
      openSearch();
      cy.contains("You changed the filters").should("not.exist");

      cy.get("button[aria-label='Remove City: New York']").click();
      cy.contains("li", "City: New York").should("not.exist");
      cy.get("[role=status]")
        .should("contain", "You changed the filters. Running them is a new search.")
        .and("contain", "This uses your free search.");
      checkAccessibility();

      expectRun({ seniorities: ["senior"], skills: ["React"] });
    });

    it("adds a filter and changes one", () => {
      openSearch();

      cy.contains("button", "+ Add filter").click();
      cy.get("form[aria-label='Add filter']").within(() => {
        cy.get("select").first().select("City");
        cy.get("select").last().select("Austin");
        cy.contains("button", "Add").click();
      });
      cy.contains("li", "City: Austin").should("be.visible");

      cy.get("button[aria-label='Change Seniority: Senior']").click();
      cy.get("form[aria-label='Change filter']").within(() => {
        cy.contains("Filter on").should("not.exist");
        cy.contains("label", "Seniority").should("be.visible");
        cy.get("select").should("have.length", 1).select("staff");
        cy.contains("button", "Change").click();
      });
      cy.contains("li", "Seniority: Staff").should("be.visible");

      expectRun({ seniorities: ["staff"], skills: ["React"], cities: ["New York", "Austin"] });
    });

    it("adds years and a skill, and refuses a skill that isn't in the data", () => {
      openSearch();

      cy.contains("button", "+ Add filter").click();
      cy.get("form[aria-label='Add filter']").within(() => {
        cy.get("select").first().select("Minimum years of experience");
        cy.get("input").type("5");
        cy.contains("button", "Add").click();
      });
      cy.contains("li", "At least: 5 years").should("be.visible");

      cy.contains("button", "+ Add filter").click();
      cy.get("form[aria-label='Add filter']").within(() => {
        cy.get("select").first().select("Skill");
        cy.get("input").type("Cobol");
        cy.contains("button", "Add").click();
        cy.get("[role=alert]").should("contain", "Choose a skill from the list.");
        cy.get("input").clear().type("TypeScript");
        cy.contains("button", "Add").click();
      });
      cy.contains("li", "Skill: TypeScript").should("be.visible");

      expectRun({ seniorities: ["senior"], skills: ["React", "TypeScript"], cities: ["New York"], min_years: 5 });
    });

    it("undoes changes, and Escape closes the editor back to + Add filter", () => {
      openSearch();
      cy.get("button[aria-label='Remove Skill: React']").click();
      cy.contains("button", "Undo changes").click();
      cy.contains("li", "Skill: React").should("be.visible");
      cy.contains("You changed the filters").should("not.exist");

      cy.contains("button", "+ Add filter").click();
      cy.get("form[aria-label='Add filter'] select").first().should("be.focused");
      checkAccessibility();
      cy.focused().type("{esc}");
      cy.get("form[aria-label='Add filter']").should("not.exist");
      cy.contains("button", "+ Add filter").should("be.focused");
    });

    it("runs an unsupported search again without the part it couldn't filter on", () => {
      openSearch(
        page({ filters: { roles: ["Product Manager"] }, unsupported: ["speaks Japanese"], total: 0, results: [] }),
      );
      cy.contains("h2", "Couldn't filter on: speaks Japanese").should("be.visible");
      cy.contains("This uses your free search.").should("be.visible");

      cy.intercept("POST", "/api/search", { body: page({ search_id: NEXT_ID }) }).as("without");
      cy.contains("button", "Search without these").click();
      cy.wait("@without")
        .its("request.body")
        .should("deep.equal", { brief: BRIEF, filters: { roles: ["Product Manager"] } });
    });

    it("says on the free plan when the free search is already used", () => {
      cy.task("useFreeSearch", "acme");
      cy.reload();
      openSearch();
      cy.get("button[aria-label='Remove City: New York']").click();
      cy.get("[role=status]").should("contain", "You've used your free search, so it can't run on the free plan.");
    });
  });
}
