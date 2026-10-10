// Opening a candidate from the results and going back (LLD 1.4, 6.1). The search is faked
// with cy.intercept (no Claude calls); the candidate page reads real data.
import { checkAccessibility, signIn, VIEWPORTS } from "../support/helpers";

const SEARCH_ID = "6f1c6a8e-1d1b-4c55-9d8e-0a6b1f1f2c3d";
const RESULTS = `/search?id=${SEARCH_ID}&page=2`;

// cand_0001 is Amara Cohen, a DevOps Engineer at Copperline with two jobs.
function page2() {
  return {
    search_id: SEARCH_ID,
    brief: "devops engineers in New York",
    filters: { roles: ["DevOps Engineer"], cities: ["New York"] },
    unsupported: [],
    page: 2,
    page_size: 20,
    total: 21,
    total_pages: 2,
    results: [
      {
        id: "cand_0001",
        full_name: "Amara Cohen",
        headline: "DevOps Engineer",
        avatar_url: "/missing.svg",
        current_title: "DevOps Engineer",
        current_company: "Copperline",
        current_company_logo_url: "/missing.svg",
        city: "New York",
        state: "NY",
        seniority: "mid",
        years_experience: 4,
        open_to_work: false,
        skills: ["Ansible", "Docker"],
        shortlist_ids: [],
      },
    ],
  };
}

for (const viewport of VIEWPORTS) {
  describe(`Candidate page (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      cy.visit("/sign-in");
      signIn("recruiter@acme.test");
      cy.contains("h1", "Find candidates").should("be.visible");
    });

    it("opens a candidate from page 2 and goes back to the same results", () => {
      cy.intercept("GET", `/api/search/${SEARCH_ID}?page=2`, { body: page2() }).as("page2");
      cy.visit(RESULTS);
      cy.wait("@page2");

      cy.contains("a", "Amara Cohen").click();
      cy.location("pathname").should("eq", "/people/cand_0001");
      cy.contains("h1", "Amara Cohen").should("be.focused");
      cy.title().should("eq", "Amara Cohen · Candidate Search");
      cy.contains("DevOps Engineer · Copperline").should("be.visible");
      cy.contains("New York, NY · Mid-level · 4 years").should("be.visible");

      cy.get("section[aria-labelledby=skills-heading] li").should("have.length", 6);
      cy.get("section[aria-labelledby=experience-heading] li").should("have.length", 2);
      cy.get("section[aria-labelledby=experience-heading] li")
        .first()
        .should("contain", "DevOps Engineer")
        .and("contain", "2024 to present")
        .and("contain", "Startup");
      cy.get("section[aria-labelledby=education-heading]").should("contain", "University of Texas at Austin");
      checkAccessibility();

      cy.contains("a", "Back to results").click();
      cy.location("pathname").should("eq", "/search");
      cy.location("search").should("eq", `?id=${SEARCH_ID}&page=2`);
      cy.contains("Page 2 of 2").should("be.visible");
    });

    it("opens the candidate from anywhere on the card, but not from Add to list", () => {
      cy.intercept("GET", `/api/search/${SEARCH_ID}?page=2`, { body: page2() }).as("page2");
      cy.visit(RESULTS);
      cy.wait("@page2");

      cy.get("button[aria-label='Add Amara Cohen to a list']").click();
      cy.contains("button", "+ New list").should("be.visible");
      cy.location("pathname").should("eq", "/search");
      cy.focused().type("{esc}");

      // A real click, beside the text: Cypress's own click goes to the card element, not to
      // whatever is on top at that point, so it would miss the stretched link.
      cy.contains("article", "Amara Cohen").realClick({ x: 30, y: 30 }); // on the avatar, not the name
      cy.location("pathname").should("eq", "/people/cand_0001");
    });

    it("goes to the search page when opened directly, and ignores a back link to another site", () => {
      cy.visit("/people/cand_0001?back=%2F%2Fevil.example");
      cy.contains("h1", "Amara Cohen").should("be.visible");
      cy.contains("a", "Back to search").should("have.attr", "href", "/search");
    });

    it("says when a candidate doesn't exist", () => {
      cy.visit("/people/cand_9999");
      cy.contains("h2", "We couldn't find this candidate.").should("be.visible");
      checkAccessibility();
    });
  });
}
