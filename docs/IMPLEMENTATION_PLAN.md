# Implementation plan

The work is split into **stories**: each one delivers a feature end to end (database, API, UI and tests), so every merged story works. The design each story builds on is in [LLD.md](LLD.md).

## How work flows

Each story is one branch and one pull request:

1. **Story plan.** Before any code, I post a short plan for the story: files, tests, and anything that differs from the LLD. **Review: plan.**
2. I create the story branch from the latest `main` (for example `s2-search`), build it and run its checks.
3. I show you the diff summary, check results and proposed commit messages. **Approval 1: commit.**
4. I commit on the branch, in the order listed below.
5. You review the commits locally. **Approval 2: push.**
6. I push the branch and open a pull request with a description, how to test, and the check results.
7. You review the PR on GitHub and merge it with **"Create a merge commit"** or **"Rebase and merge"**, never "Squash".
8. The next story branches from the updated `main`.

## Design (before any code)

### M0 Architecture and data (merged)
- `chore: add gitignore and recommended editor extensions`
- `chore(data): add assessment data files`
- `docs: add architecture, diagrams, rules and plans`

### M0b Low-level design (branch `m0b-lld-ui-design`)
- `docs: add low-level design`
- `docs: align architecture, rules and diagrams with the LLD`
- `docs: plan the work as stories with a UI design step`

**UI design step.** Before S1, a visual mockup of the key screens (search with results and filter tags, its states, the candidate page, phone width), built with the tokens in LLD 6.7, is reviewed and approved. Stories with screens build to the approved mockup, and S1 turns the tokens into `app/globals.css`.

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
  - `perf(search): tune prompt and timeouts against latency budget`
  - `test(perf): add latency integration test`
  - `test(security): add built-bundle secret scan`
  - `style(ui): polish mobile layout and accessibility`
  - `docs: finalise README with screenshots, cost, tradeoffs and next steps`

## Risks

| Risk | Mitigation |
|---|---|
| Setup fails on a clean Mac | `make setup` checks prerequisites first; fresh-clone run before the final merge |
| LLM latency over 3 s | Haiku, prompt caching, short output, timeout + credit given back |
| Private briefs phrased differently | Extra eval briefs covering vague, unsupported and synonym cases |
