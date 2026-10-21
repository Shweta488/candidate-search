# Implementation plan

The work is split into **stories**: each one delivers a feature end to end (database, API, UI and tests), so every merged story works. The design each story builds on is in [LLD.md](LLD.md).

Every story below is merged. How a story moves from plan to merge (plan review, branch, commit approval, push approval) is in [RULES.md](../RULES.md) section 1. Before S0, the architecture, the low-level design and a visual mockup of the key screens were written and reviewed.

## Stories

Each story lists what a recruiter can do when it is merged, how we know it works, and its commits.

### S0 Project skeleton and reproducible setup
Branch `s0-setup`. Enabler, no feature. LLD 7, 8, 9.

- **Done when:** `make setup && make dev` on a fresh clone shows a placeholder page; CI runs on the PR.
- **Tests:** CI green (typecheck, lint, an empty Jest suite).
- **Commits:**
  - `chore(setup): scaffold Next.js 16 app with TypeScript strict`
  - `chore(setup): pin Node 24 and Supabase CLI 2.119.0`
  - `chore(setup): add Makefile, Supabase config and env script`
  - `chore(setup): add lint, typecheck and Jest config`
  - `ci: run typecheck, lint and unit tests on pull requests`

### S1 Sign in and see my plan
Branch `s1-sign-in-plan`. FR6. LLD 2 (companies, recruiters), 4, 6.1 to 6.4, 6.7.

- **Done when:** each recruiter can sign in, sees the app layout and a plan pill showing "1 search left"; a wrong password shows a clear error; signed-out visits go to sign-in.
- **Tests:** unit tests for the auth gate and error mapping; integration test that a recruiter can't read `private` tables or another company's recruiter row; Cypress sign-in spec.
- **Commits:**
  - `feat(db): add schemas, default grants, companies and recruiters`
  - `feat(db): seed companies and recruiters`
  - `feat(auth): verify bearer tokens and resolve the company`
  - `feat(plan): add plan functions and GET /api/plan`
  - `feat(ui): add sign-in, app layout and plan pill`
  - `test(e2e): add Cypress sign-in spec`

### S2 Search by brief
Branch `s2-search`. FR1. LLD 3, 4.6, 6.5 to 6.7. The largest story; if it runs long, it is split into "search API" and "search page" PRs.

- **Done when:** a recruiter types a brief and sees the filters understood, ranked results and paging; the free plan allows exactly one search, then shows the limit panel; an unsupported ask shows "Couldn't filter on".
- **Tests:** unit tests for the filter schema, validation and page math; `eval:search` at 100% on the 10 samples plus extra briefs; integration tests for the free-plan race (1 of 20 succeeds) and hostile briefs; Cypress search and UI-states specs.
- **Commits:**
  - `feat(db): add candidate tables and seed 5,000 candidates`
  - `feat(plan): spend and give back search credits atomically`
  - `feat(search): load vocabulary and build the filter schema`
  - `feat(search): extract filters from the brief with Claude Haiku`
  - `feat(db): add run_search with ranking and stored results`
  - `feat(api): add POST /api/search and paging route`
  - `feat(ui): add search page with results, paging and states`
  - `test(search): add eval script and extra briefs`
  - `test(search): add free-plan race and hostile brief tests`

### S3 Correct a search
Branch `s3-correct-search`. FR2. LLD 1.7 (vocabulary), 3.4, 6.5.

- **Done when:** a recruiter can edit, remove or add filter tags and re-run the search; on the free plan the UI warns that it uses a search.
- **Tests:** unit test that invalid client filters return 400 before a credit is spent; Cypress spec: remove a tag, results change.
- **Commits:**
  - `feat(api): add GET /api/vocabulary`
  - `feat(ui): add editable filter tags`

### S4 View a candidate
Branch `s4-candidate`. FR3. LLD 1.4.

- **Done when:** a result opens the candidate page with experience, education and skills, and back returns to the same results.
- **Tests:** integration test for `GET /api/people/:id` (found, 404); Cypress spec opening a candidate.
- **Commits:**
  - `feat(api): add GET /api/people/:id`
  - `feat(ui): add candidate page`

### S5 Shortlists
Branch `s5-shortlists`. FR4. LLD 1.5, 2.4.

- **Done when:** a recruiter can create, rename and delete lists, add and remove candidates from results and the candidate page, and nobody can see or change another company's lists.
- **Tests:** tenancy integration test for shortlists, through our API and directly through Supabase; Cypress shortlist spec.
- **Commits:**
  - `feat(db): add shortlists with RLS`
  - `feat(api): add shortlist routes`
  - `feat(ui): add shortlist actions and pages`
  - `test(api): add shortlist tenancy tests`

### S6 Saved searches
Branch `s6-saved-searches`. FR5. LLD 1.6.

- **Done when:** a recruiter can save a search, see their saved searches, re-run one (counts as a search) and delete one; isolated per company.
- **Tests:** tenancy integration test for saved searches; Cypress save and re-run spec.
- **Commits:**
  - `feat(db): add saved searches with RLS`
  - `feat(api): add saved search routes`
  - `feat(ui): add saved searches page`
  - `test(api): add saved search tenancy tests`

### S7 Billing
Branch `s7-billing`. FR7. LLD 5.

- **Done when:** replaying `data/stripe-events.json` ends with acme free and globex paid; a paid company has unlimited searches; the Upgrade dialog explains how plans change.
- **Tests:** unit tests for signature parsing and HMAC; integration test replaying the samples plus bad signature, repeat, out of order, same-second tie, unknown company and unrelated type.
- **Commits:**
  - `feat(billing): verify Stripe signatures on the raw body`
  - `feat(billing): apply subscription events idempotently and in order` (+ `npm run replay:stripe`)
  - `feat(ui): add upgrade dialog`
  - `test(billing): replay sample events and edge cases`

### S8 Hardening and docs
Branch `s8-hardening`.

- **Done when:** latency targets are met, the bundle scan passes, every screen passes the accessibility check, and the README is final, with screenshots of the app and a setup troubleshooting note (for example Docker out of disk space).
- **Tests:** latency integration test; `check:secrets`; `cy.checkA11y()` on every screen at desktop and phone width.
- **Commits:**
  - `feat(search): map umbrella job titles to engineering roles` (+ extra eval briefs)
  - `feat(search): rank closer matches first`
  - `perf(search): tune prompt and timeouts against latency budget`
  - `test(perf): add latency integration test`
  - `test(security): add built-bundle secret scan`
  - `feat(ui): show the company name in the header and Upgrade dialog`
  - `style(ui): polish mobile layout and accessibility`
  - `docs: finalise README with screenshots, cost, tradeoffs and next steps`

### S9 Faster search (no change)
No branch merged. Thinking off and effort `low` were measured on the Claude request; neither made a search faster, so nothing changed. Result in ARCHITECTURE 7.2.

### S10 Cleanup
Branch `s10-cleanup`. No behaviour change.

- **Done when:** docs are merged into fewer files with no stale text, comments say why, repeated tests and unused fonts, tokens, exports and screenshots are gone, and every check still passes.
- **Commits:**
  - `docs: move diagrams and decisions into the architecture doc`
  - `docs: remove stale text from the plan, LLD and testing docs`
  - `style(ui): remove unused font and tokens, use tokens for fixed values`
  - `refactor: remove unused exports and tidy comments`
  - `test: remove tests that repeat other tests`
  - `docs: tidy README and delete unused screenshots`

### S11 UI polish
Branch `s11-ui-polish`. FR1, FR2, FR4, FR5. LLD 1.3, 3.7, 6.2, 6.5, 6.7. From a review of the running app.

- **Done when:** results show which lists a candidate is on; filter values read the same way everywhere; the whole result card opens the candidate; the search start page shows the 2 newest saved searches and shortlists as tiles; the search box has an icon button inside; signing out and in again opens Search; the replay and eval scripts say when the app isn't running.
- **Decided not to build:** adding a filter without using a search (ARCHITECTURE 7.2; README next steps).
- **Tests:** unit (list ids per result, value labels), integration (list ids on results, and never another company's), Cypress for each change, paging still under 300 ms.
- **Commits:**
  - `feat(search): return which lists each result is on`
  - `feat(ui): show lists on result cards and polish the search page`
  - `style(ui): restyle the search box`
  - `docs: retake README screenshots and record the UI decisions`

### S12 Submission fixes
Branch `s12-submission-fixes`. NFR5, NFR6, FR4, FR5. LLD 1.1, 1.5, 1.6, 3.3, 5.3. 

- **Done when:** a slow Claude call answers instead of failing the search; the webhook returns 400 only for a bad signature; two shortlists can have the same name; saving a search accepts any filters object; the README is one page.
- **Tests:** unit and integration for each change; Cypress for shortlists and saved searches; `eval:search` still 100%.
- **Commits:**
  - `perf(search): allow slow Claude calls instead of failing the search`
  - `fix(billing): answer 200 for any correctly signed event`
  - `fix(api): allow shortlists with the same name`
  - `fix(api): ignore unknown keys when saving a search`
  - `docs: cut README to one page and move review notes to docs/REVIEWING.md`
  - `docs: align the LLD, architecture and testing docs with the code`
  - `test: remove tests that repeat other tests`
  - `fix(ui): keep a way back to results when the limit is reached`
  - `style(ui): open a shortlist from anywhere on its tile`

## Risks

| Risk | Mitigation |
|---|---|
| Setup fails on a clean Mac | `make setup` checks prerequisites first; fresh-clone run before the final merge |
| LLM latency over 3 s | Haiku, prompt caching, short output, timeout + credit given back |
| Private briefs phrased differently | Extra eval briefs covering vague, unsupported and synonym cases |
