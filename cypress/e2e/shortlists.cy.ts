// Shortlists end to end (LLD 1.5, 6.5): add from results and the candidate page, then
// manage lists. Search results are faked (no Claude calls); lists use the real API and
// start empty for acme in every test.
import { checkAccessibility, signIn, VIEWPORTS } from "../support/helpers";

const SEARCH_ID = "6f1c6a8e-1d1b-4c55-9d8e-0a6b1f1f2c3d";

function summary(id: string, name: string) {
  return {
    id,
    full_name: name,
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
    shortlist_ids: [],
  };
}

function openResults(onLists: Record<string, string[]> = {}) {
  cy.intercept("GET", `/api/search/${SEARCH_ID}?page=1`, {
    body: {
      search_id: SEARCH_ID,
      brief: "react engineers",
      filters: { skills: ["React"] },
      unsupported: [],
      page: 1,
      page_size: 20,
      total: 2,
      total_pages: 1,
      results: [summary("cand_0629", "Mei Haddad"), summary("cand_0001", "Amara Cohen")].map((result) => ({
        ...result,
        shortlist_ids: onLists[result.id] ?? [],
      })),
    },
  });
  cy.visit(`/search?id=${SEARCH_ID}&page=1`);
  cy.contains("h2", "2 candidates").should("be.visible");
}

// The id of one of the signed-in recruiter's lists, read from the real API.
function listId(name: string): Cypress.Chainable<string> {
  return cy.window().then((win) => {
    const key = Object.keys(win.localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
    const token = JSON.parse(win.localStorage.getItem(key ?? "") ?? "{}").access_token as string;
    return cy
      .request({ url: "/api/shortlists", headers: { authorization: `Bearer ${token}` } })
      .then(({ body }) => (body.shortlists as { id: string; name: string }[]).find((l) => l.name === name)?.id ?? "");
  });
}

function createList(name: string) {
  cy.visit("/shortlists");
  cy.get("input").first().type(name);
  cy.contains("button", "Create list").click();
  cy.get("[role=status]").should("contain", `Created ${name}`);
}

for (const viewport of VIEWPORTS) {
  describe(`Shortlists (${viewport.name})`, () => {
    beforeEach(() => {
      cy.task("deleteShortlists", "acme");
      cy.viewport(viewport.width, viewport.height);
      cy.visit("/sign-in");
      signIn("recruiter@acme.test");
      cy.contains("h1", "Find candidates").should("be.visible");
    });

    after(() => cy.task("deleteShortlists", "acme"));

    it("adds a candidate from the results to a new list, then says they're already on it", () => {
      openResults();
      cy.get("button[aria-label='Add Mei Haddad to a list']").click();
      cy.contains("You have no lists yet.").should("be.visible");
      cy.contains("button", "+ New list").click();
      cy.focused().type("Frontend");
      cy.contains("button", "Create and add").click();
      cy.contains("[role=status]", "Added to Frontend").should("be.visible");

      // The card now shows the list, the panel ticks it, and the other card is unchanged.
      cy.get("button[aria-label='Mei Haddad is on Frontend. Add to another list']")
        .should("have.text", "✓ On Frontend ▾")
        .click();
      cy.get("ul[aria-label='Your lists']").contains("button", "Already on Frontend").click();
      cy.contains("[role=status]", "Already on Frontend").should("be.visible");
      cy.get("button[aria-label='Mei Haddad is on Frontend. Add to another list']").should("be.focused");
      cy.get("button[aria-label='Add Amara Cohen to a list']").should("have.text", "Add to list ▾");
    });

    it("shows on the results which lists a candidate was already on, and counts more than one", () => {
      createList("Frontend");
      createList("Design");
      cy.visit("/people/cand_0629");
      cy.get("button[aria-label='Add Mei Haddad to a list']").click();
      cy.get("ul[aria-label='Your lists']").contains("button", "Frontend").click();
      cy.contains("[role=status]", "Added to Frontend").should("be.visible");

      // Results arrive with the ids of the lists each candidate is on (faked here with
      // the real list's id); the name comes from the recruiter's lists.
      listId("Frontend").then((frontend) => openResults({ cand_0629: [frontend] }));
      cy.get("button[aria-label='Mei Haddad is on Frontend. Add to another list']")
        .should("have.text", "✓ On Frontend ▾")
        .click();
      cy.get("ul[aria-label='Your lists']").contains("button", "Design").click();
      cy.contains("[role=status]", "Added to Design").should("be.visible");
      cy.get("button[aria-label='Mei Haddad is on 2 lists. Add to another list']").should(
        "have.text",
        "✓ On 2 lists ▾",
      );
    });

    it("asks for a name and closes on Escape", () => {
      openResults();
      cy.get("button[aria-label='Add Amara Cohen to a list']").click();
      cy.contains("button", "+ New list").click();
      cy.contains("button", "Create and add").click();
      cy.get("[role=alert]").should("contain", "Give the list a name.");
      checkAccessibility();
      cy.focused().type("{esc}");
      cy.contains("button", "+ New list").should("not.exist");
      cy.get("button[aria-label='Add Amara Cohen to a list']").should("be.focused");
    });

    it("adds to a new list with the keyboard only", () => {
      openResults();
      cy.get("button[aria-label='Add Mei Haddad to a list']").focus();
      cy.realPress("Enter");
      cy.contains("You have no lists yet.").should("be.visible");
      cy.realPress("Tab"); // the only item in the panel
      cy.focused().should("have.text", "+ New list");
      cy.realPress("Enter");
      cy.focused()
        .should("have.attr", "id")
        .and("match", /-name$/); // the name field takes focus
      cy.realType("Keyboard");
      cy.realPress("Enter");
      cy.contains("[role=status]", "Added to Keyboard").should("be.visible");
      cy.focused().should("have.attr", "aria-label", "Mei Haddad is on Keyboard. Add to another list");
    });

    it("shows the newest lists at a glance on the search start page", () => {
      createList("Backend");
      createList("Design");
      createList("Frontend");
      cy.visit("/search");

      cy.contains("h2", "Shortlists").should("be.visible");
      cy.get("ul[aria-labelledby=lists-glance] a").should("have.length", 2).first().should("contain", "Frontend");
      cy.contains("a", "View all (3) shortlists").should("have.attr", "href", "/shortlists");
      checkAccessibility();

      cy.contains("ul[aria-labelledby=lists-glance] a", "Design").click();
      cy.contains("h1", "Design").should("be.visible");
    });

    it("says when a list doesn't exist", () => {
      cy.visit("/shortlists/6f1c6a8e-1d1b-4c55-9d8e-0a6b1f1f2c3d");
      cy.contains("h2", "We couldn't find this list.").should("be.visible");
      checkAccessibility();
    });

    it("adds from the candidate page and shows On your lists", () => {
      createList("Backend");
      cy.visit("/people/cand_0001");
      cy.contains("h1", "Amara Cohen").should("be.visible");
      cy.contains("On your lists").should("not.exist");
      cy.get("button[aria-label='Add Amara Cohen to a list']").click();
      cy.get("ul[aria-label='Your lists']").contains("button", "Backend").click();
      cy.contains("On your lists:").find("a").should("have.text", "Backend").click();
      cy.location("pathname").should("match", /^\/shortlists\/[0-9a-f-]{36}$/);
      cy.contains("h1", "Backend").should("be.visible");
    });

    it("opens a list, removes someone, renames it and deletes it", () => {
      createList("Design");
      createList("Backend");
      cy.visit("/people/cand_0629");
      cy.get("button[aria-label='Add Mei Haddad to a list']").click();
      cy.get("ul[aria-label='Your lists']").contains("button", "Backend").click();
      cy.contains("[role=status]", "Added to Backend").should("be.visible");

      cy.visit("/shortlists");
      // The whole tile opens the list, also a click in its padding, left of the name.
      cy.contains("li", "Backend").should("contain", "1 person").click(8, 30);
      cy.title().should("eq", "Backend · Candidate Search");
      cy.get("article").should("have.length", 1).and("contain", "Mei Haddad");
      checkAccessibility();

      // The candidate's Back link returns to this list.
      cy.contains("article a", "Mei Haddad").click();
      cy.contains("a", "Back to list").click();
      cy.contains("h1", "Backend").should("be.visible");

      cy.get("button[aria-label='Remove Mei Haddad from this list']").click();
      cy.contains("[role=status]", "Removed Mei Haddad").should("be.visible");
      cy.contains("No one on this list yet.").should("be.visible");

      cy.contains("button", "Rename").click();
      cy.get("input").clear().type("Backend team");
      cy.contains("button", "Save").click();
      cy.contains("h1", "Backend team").should("be.visible");

      cy.contains("button", "Delete list").click();
      cy.contains("Delete “Backend team”? This removes the list, but not the candidates on it.").should("be.visible");
      cy.focused().should("contain", "Cancel");
      cy.contains("[role=group] button", "Delete list").click();
      cy.location("pathname").should("eq", "/shortlists");
      cy.contains("li", "Backend team").should("not.exist");
      cy.contains("li", "Design").should("be.visible");
    });

    if (viewport.name === "phone") {
      it("moves the links into a menu on phones", () => {
        cy.contains("header a", "Shortlists").should("not.be.visible");
        cy.get("button[aria-label=Menu]").should("have.attr", "aria-expanded", "false").click();
        cy.get("#phone-menu").contains("a", "Shortlists").click();
        cy.location("pathname").should("eq", "/shortlists");
        cy.get("#phone-menu").should("not.exist");

        cy.get("button[aria-label=Menu]").click();
        cy.focused().type("{esc}");
        cy.get("#phone-menu").should("not.exist");
        cy.get("button[aria-label=Menu]").should("be.focused");
      });
    }
  });
}
