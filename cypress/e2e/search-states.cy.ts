// Every state of the search page, with /api/search answered by cy.intercept, so this
// spec never calls the LLM and never spends a search (docs/TESTING.md, LLD 6.7).
import { checkAccessibility, signIn, VIEWPORTS } from "../support/helpers";

const SEARCH_ID = "6f1c6a8e-1d1b-4c55-9d8e-0a6b1f1f2c3d";
const BRIEF = "senior React engineers in New York who have worked at a startup";

function candidate(n: number) {
  return {
    id: `cand_${String(n).padStart(4, "0")}`,
    full_name: `Candidate ${n}`,
    headline: "Senior Frontend Engineer · React",
    avatar_url: "/missing-avatar.svg", // fails to load, so the initials show
    current_title: "Senior Frontend Engineer",
    current_company: "Copperline",
    current_company_logo_url: "/missing-logo.svg",
    city: "New York",
    state: "NY",
    seniority: "senior",
    years_experience: 7,
    open_to_work: n === 1,
    skills: ["React", "TypeScript"],
    shortlist_ids: [],
  };
}

function searchPage(overrides: Record<string, unknown> = {}) {
  return {
    search_id: SEARCH_ID,
    brief: BRIEF,
    filters: { seniorities: ["senior"], skills: ["React"], cities: ["New York"], worked_at_company_types: ["startup"] },
    unsupported: [],
    page: 1,
    page_size: 20,
    total: 21,
    total_pages: 2,
    results: Array.from({ length: 20 }, (_, i) => candidate(i + 1)),
    searches_remaining: 0,
    ...overrides,
  };
}

function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

function runSearch() {
  cy.get("textarea").clear().type(BRIEF);
  cy.contains("button", "Search").click();
}

for (const viewport of VIEWPORTS) {
  describe(`Search page states (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      // The start page for someone with nothing saved, whatever acme has in the database.
      cy.intercept("GET", "/api/saved-briefs", { body: { saved_briefs: [] } });
      cy.intercept("GET", "/api/shortlists", { body: { shortlists: [] } });
      cy.visit("/sign-in");
      signIn("recruiter@acme.test");
      cy.contains("h1", "Find candidates").should("be.visible");
    });

    it("shows a skeleton while searching, then filters, results and paging", () => {
      cy.intercept("POST", "/api/search", { statusCode: 200, body: searchPage(), delay: 500 }).as("search");
      runSearch();
      cy.contains("button", "Searching…").should("be.disabled");
      cy.contains("h2", "Searching…").should("be.visible");
      cy.wait("@search").its("request.body").should("deep.equal", { brief: BRIEF });

      cy.location("search").should("eq", `?id=${SEARCH_ID}`);
      cy.contains("li", "Skill: React").should("be.visible");
      cy.contains("li", "City: New York").should("be.visible");
      cy.contains("h2", "21 candidates").should("be.visible");
      cy.get("article").should("have.length", 20);
      cy.get("article").first().should("contain", "Candidate 1").and("contain", "Open to work");
      cy.get("article").first().find("li").contains("React").should("contain", "matches your search");
      checkAccessibility();

      cy.intercept("GET", `/api/search/${SEARCH_ID}?page=2`, {
        body: searchPage({ page: 2, results: [candidate(21)] }),
      }).as("page2");
      cy.contains("a", "Next ›").click();
      cy.wait("@page2");
      cy.location("search").should("eq", `?id=${SEARCH_ID}&page=2`);
      cy.get("article").should("have.length", 1);
      cy.contains("Page 2 of 2").should("be.visible");
      cy.get("nav[aria-label=Pages]").contains("Next ›").should("have.attr", "aria-disabled", "true");
    });

    it("keeps the results on refresh, reading them without spending a search", () => {
      cy.intercept("GET", `/api/search/${SEARCH_ID}?page=1`, { body: searchPage() }).as("load");
      cy.visit(`/search?id=${SEARCH_ID}&page=1`);
      cy.wait("@load");
      cy.get("textarea").should("have.value", BRIEF);
      cy.contains("h2", "21 candidates").should("be.visible");
    });

    it("explains when part of the brief couldn't be filtered on", () => {
      cy.intercept("POST", "/api/search", {
        body: searchPage({
          filters: { roles: ["Product Manager"] },
          unsupported: ["speaks Japanese"],
          total: 0,
          total_pages: 0,
          results: [],
        }),
      });
      runSearch();
      cy.contains("h2", "Couldn't filter on: speaks Japanese").should("be.visible");
      cy.contains("We're showing nobody rather than the wrong people.").should("be.visible");
      cy.contains("li", "Role: Product Manager").should("be.visible");
      checkAccessibility();
    });

    it("explains when no requirement was found", () => {
      cy.intercept("POST", "/api/search", { body: searchPage({ filters: {}, total: 0, total_pages: 0, results: [] }) });
      runSearch();
      cy.contains("h2", "We couldn't find any requirement in that brief.").should("be.visible");
    });

    it("says when nobody matches", () => {
      cy.intercept("POST", "/api/search", { body: searchPage({ total: 0, total_pages: 0, results: [] }) });
      runSearch();
      cy.contains("h2", "No candidates match all of these filters.").should("be.visible");
      cy.contains("Try removing a filter.").should("be.visible");
    });

    it("shows the limit message on 402", () => {
      cy.intercept("POST", "/api/search", {
        statusCode: 402,
        body: errorBody("search_limit_reached", "You've used your free search."),
      });
      runSearch();
      cy.contains("h2", "You've used your free search.").should("be.visible");
      checkAccessibility();
    });

    it("offers Try again when search is unavailable, and it searches again", () => {
      cy.intercept("POST", "/api/search", {
        statusCode: 503,
        body: errorBody("search_unavailable", "Search is unavailable right now."),
      }).as("unavailable");
      runSearch();
      cy.contains("h2", "Search is unavailable right now.").should("be.visible");
      cy.contains("Your search wasn't used.").should("be.visible");
      checkAccessibility();

      cy.intercept("POST", "/api/search", { body: searchPage() }).as("retry");
      cy.contains("button", "Try again").click();
      cy.wait("@retry").its("request.body").should("deep.equal", { brief: BRIEF });
      cy.contains("h2", "21 candidates").should("be.visible");
    });

    it("shows Something went wrong on a server or network error", () => {
      cy.intercept("POST", "/api/search", { statusCode: 500, body: errorBody("internal_error", "Reference: r1") });
      runSearch();
      cy.contains("h2", "Something went wrong.").should("be.visible");

      cy.intercept("POST", "/api/search", { forceNetworkError: true });
      cy.contains("button", "Try again").click();
      cy.contains("h2", "Something went wrong.").should("be.visible");
    });

    it("shows a 400 message next to the brief", () => {
      cy.intercept("POST", "/api/search", {
        statusCode: 400,
        body: errorBody("invalid_request", "brief: Too big: expected string to have <=500 characters"),
      });
      runSearch();
      cy.get("[role=alert]").should("contain", "brief: Too big");
      cy.get("textarea").should("have.attr", "aria-invalid", "true");
    });

    it("welcomes the recruiter with examples, and an example fills the box without searching", () => {
      cy.intercept("POST", "/api/search", cy.spy().as("search"));
      cy.contains("h2", "Find the right people by describing them").should("be.visible");
      cy.contains("On the free plan you have 1 search.").should("be.visible");
      checkAccessibility();

      cy.contains("button", "data scientists with a PhD").click();
      cy.get("textarea").should("have.value", "data scientists with a PhD").and("be.focused");
      cy.get("@search").should("not.have.been.called");
    });

    it("opens the same welcome, without an error, when the search in the URL doesn't exist", () => {
      cy.visit("/search?id=00000000-0000-4000-8000-000000000000&page=2");
      cy.contains("h2", "Find the right people by describing them").should("be.visible");
      cy.get("textarea").should("have.value", "");
      cy.contains("not found").should("not.exist");
      cy.contains("Something went wrong").should("not.exist");
    });
  });
}
