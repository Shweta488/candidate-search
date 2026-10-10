// Retakes the README's screenshots. Run with npm run screenshots against make dev; files
// land in docs/screenshots/. Not part of npm run e2e. The spec walks every screen at both
// sizes but saves only the shots in README_SHOTS; add a name there to keep another one.
// Real data throughout; the one real search sends filters, so nothing here calls Claude.
// Acme's lists and saved searches are replaced by demo ones.
import { signIn } from "../support/helpers";

const BRIEF = "senior React engineers in New York who have worked at a startup";
const FILTERS = {
  seniorities: ["senior"],
  skills: ["React"],
  cities: ["New York"],
  worked_at_company_types: ["startup"],
};

const SIZES = [
  { name: "desktop", width: 1280, height: 800, capture: "viewport" },
  { name: "phone", width: 390, height: 844, capture: "viewport" },
] as const;

// The recruiter's access token, from the session supabase-js keeps in localStorage.
function accessToken(): Cypress.Chainable<string> {
  return cy.window().then((win) => {
    const key = Object.keys(win.localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
    return JSON.parse(win.localStorage.getItem(key ?? "") ?? "{}").access_token as string;
  });
}

function apiPost(
  path: string,
  body: object,
): Cypress.Chainable<Cypress.Response<{ id?: string; search_id?: string; results?: { id: string }[] }>> {
  return accessToken().then((token) =>
    cy.request({ method: "POST", url: path, body, headers: { authorization: `Bearer ${token}` } }),
  );
}

const README_SHOTS = new Set([
  "desktop-03-search-results",
  "desktop-04-candidate",
  "desktop-06-shortlist",
  "desktop-08-unsupported",
  "desktop-10-upgrade-dialog",
  "phone-03-search-results",
  "phone-04-candidate",
  "phone-07-saved-searches",
  "phone-09-limit",
]);

for (const size of SIZES) {
  describe(`Screens (${size.name})`, () => {
    const shot = (name: string) => {
      if (!README_SHOTS.has(`${size.name}-${name}`)) return;
      cy.wait(300); // let fonts and images settle
      cy.screenshot(`${size.name}-${name}`, { capture: size.capture, overwrite: true });
    };

    before(() => {
      cy.task("deleteShortlists", "acme");
      cy.task("deleteSavedBriefs", "acme");
      cy.task("saveBrief", { company: "acme", brief: BRIEF, filters: FILTERS });
      cy.task("saveBrief", {
        company: "acme",
        brief: "backend engineers in Austin who know Go and Kubernetes",
        filters: { roles: ["Backend Engineer"], cities: ["Austin"], skills: ["Go", "Kubernetes"] },
      });
    });

    after(() => cy.task("resetSearches", "acme"));

    beforeEach(() => {
      cy.viewport(size.width, size.height);
      cy.task("resetSearches", "acme");
    });

    it("sign in", () => {
      cy.visit("/sign-in");
      cy.contains("button", "Sign in").should("be.visible");
      shot("01-sign-in");
    });

    it("search, results, candidate, shortlists", () => {
      cy.visit("/sign-in");
      signIn("recruiter@acme.test");
      cy.contains("h1", "Find candidates").should("be.visible");
      shot("02-search-welcome");

      apiPost("/api/search", { brief: BRIEF, filters: FILTERS }).then(({ body }) => {
        const searchId = body.search_id as string;
        const firstId = body.results?.[0]?.id as string;
        cy.visit(`/search?id=${searchId}`);
        cy.contains("h2", "candidates").should("be.visible");
        shot("03-search-results");

        cy.visit(`/people/${firstId}`);
        cy.get("h1").should("be.visible");
        shot("04-candidate");

        apiPost("/api/shortlists", { name: "Frontend, New York" }).then(({ body: list }) => {
          for (const result of body.results?.slice(0, 3) ?? []) {
            apiPost(`/api/shortlists/${list.id}/people/${result.id}`, {});
          }
          cy.visit("/shortlists");
          cy.contains("Frontend, New York").should("be.visible");
          shot("05-shortlists");
          cy.visit(`/shortlists/${list.id}`);
          cy.contains("h1", "Frontend, New York").should("be.visible");
          shot("06-shortlist");
        });
      });

      cy.visit("/saved-searches");
      cy.contains("h1", "Saved searches").should("be.visible");
      shot("07-saved-searches");
    });

    it("couldn't filter on, and the free limit with the Upgrade dialog", () => {
      cy.task("useFreeSearch", "acme"); // so the plan pill matches the limit panel
      cy.visit("/sign-in");
      signIn("recruiter@acme.test");
      cy.contains("h1", "Find candidates").should("be.visible");

      cy.intercept("POST", "/api/search", {
        body: {
          search_id: "6f1c6a8e-1d1b-4c55-9d8e-0a6b1f1f2c3d",
          brief: "product managers who speak Japanese",
          filters: { roles: ["Product Manager"] },
          unsupported: ["speaks Japanese"],
          page: 1,
          page_size: 20,
          total: 0,
          total_pages: 0,
          results: [],
          searches_remaining: 0,
        },
      });
      cy.get("textarea").type("product managers who speak Japanese");
      cy.contains("button", "Search").click();
      cy.contains("Couldn't filter on").should("be.visible");
      shot("08-unsupported");

      cy.intercept("POST", "/api/search", {
        statusCode: 402,
        body: { error: { code: "search_limit_reached", message: "You've used your free search." } },
      });
      cy.get("textarea").clear().type("data scientists with a PhD");
      cy.contains("button", "Search").click();
      cy.contains("h2", "You've used your free search.").should("be.visible");
      shot("09-limit");
      cy.contains("button", "Upgrade").click();
      cy.contains("dialog[open] h2", "Upgrade to the paid plan").should("be.visible");
      shot("10-upgrade-dialog");
    });
  });
}
