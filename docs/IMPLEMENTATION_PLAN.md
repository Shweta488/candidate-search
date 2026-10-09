# Implementation plan

Deadline: **Sunday, October 11, 2026, 12:22 PM Pacific** (3:22 PM Eastern). Commits pushed after it are ignored, so the target is **code freeze Sunday 9:00 AM Pacific**, leaving time for the Loom and a clean-clone check.

## How work flows

Each milestone is one branch and one pull request:

1. I create the milestone branch from the latest `main` (for example `m2-data-layer`), build the milestone and run its checks.
2. I show you the diff summary, check results and proposed commit messages. **Approval 1: commit.**
3. I commit on the branch (several small commits, in the order below).
4. You review the commits locally. **Approval 2: push.**
5. I push the branch and open a pull request with a description, how to test, and the check results.
6. You review the PR on GitHub and merge it with **"Create a merge commit"** or **"Rebase and merge"**, never "Squash", so the individual commits stay in `main`'s history.
7. The next milestone branches from the updated `main`.

Branch names: `m0-design-docs`, `m1-setup`, `m2-data-layer`, `m3-auth-plan`, `m4-search`, `m5-billing`, `m6-lists-api`, `m7-ui`, `m8-hardening`.

Only what is merged into `main` before the deadline is graded, so every PR must be merged, not just open.

## Milestones and commits

### M0 Design docs (this round)
- `chore: add gitignore and recommended editor extensions`
- `chore(data): add assessment data files`
- `docs: add architecture, diagrams, rules and plans`

### M1 Project skeleton and reproducible setup
- `chore(setup): scaffold Next.js 16 app with TypeScript strict`
- `chore(setup): pin Node 24 and Supabase CLI 2.119.0`
- `chore(setup): add Makefile with setup and dev targets`
- `chore(setup): add lint, typecheck and Jest config`
- `ci: run typecheck, lint and unit tests on pull requests`

Check: `make setup && make dev` from a fresh clone shows a placeholder page.

### M2 Data layer
- `feat(db): add candidate tables with derived filter columns`
- `feat(db): add companies, recruiters and tenant tables`
- `feat(db): enable RLS and grants for tenant isolation`
- `feat(db): seed companies, recruiters and 5,000 candidates`
- `test(db): add cross-company access tests against Supabase`

Check: the tenancy integration test passes for direct Supabase access.

### M3 Auth gate, people and plan
- `feat(auth): verify bearer tokens and resolve the company`
- `feat(api): add GET /api/people/:id`
- `feat(plan): spend and give back search credits atomically`
- `feat(api): add GET /api/plan`

### M4 Search
- `feat(search): load vocabulary and build the filter schema`
- `feat(search): extract filters from the brief with Claude Haiku`
- `feat(db): add run_search with ranking and stored results`
- `feat(api): add POST /api/search and paging route`
- `test(search): add eval script for queries.json`
- `test(plan): add concurrent free-plan integration test`
- `test(search): add hostile brief integration tests`

Check: `eval:search` at 100% on the 10 samples plus my extra briefs; the quota test gives exactly one success out of 20 parallel requests.

### M5 Billing
- `feat(billing): verify Stripe signatures on the raw body`
- `feat(billing): apply subscription events idempotently and in order`
- `test(billing): replay sample events and edge cases`

Check: the billing integration test reproduces `expected_plans_after`, plus bad signature, repeat, out-of-order and same-second cases.

### M6 Shortlists and saved searches API
- `feat(api): add shortlist routes`
- `feat(api): add saved search routes`
- `test(api): extend tenancy tests to API routes`

### M7 UI
- `feat(ui): add design tokens, layout and sign-in`
- `feat(ui): add search page with results and paging`
- `feat(ui): add editable filter tags`
- `feat(ui): add candidate page`
- `feat(ui): add shortlist actions and pages`
- `feat(ui): add saved searches`
- `feat(ui): add plan pill, limit state and upgrade dialog`
- `style(ui): polish mobile layout and states`
- `test(e2e): add Cypress specs for search, states, lists and accessibility`

Check: Cypress specs pass at desktop and phone width, plus the manual checklist in TESTING.md.

### M8 Hardening and docs
- `perf(search): tune prompt and timeouts against latency budget`
- `test(perf): add latency integration test`
- `test(security): add built-bundle secret scan`
- `docs: finalise README with cost, tradeoffs and next steps`

## Schedule (Pacific time)

| When | Milestones |
|---|---|
| Thu afternoon / evening | M0 review and push, M1, M2 |
| Fri | M3, M4, M5 |
| Sat | M6, M7 |
| Sun before 9:00 AM | M8, clean-clone run, record Loom, share repo with `gibbsdylan`, submit |

## Risks

| Risk | Mitigation |
|---|---|
| Review rounds slow the schedule | Milestone-sized reviews, not per file; small diffs |
| Setup fails on the grader's clean Mac | Fresh-clone rehearsal on your Mac Saturday night and Sunday morning |
| LLM latency over 3 s | Haiku, prompt caching, short output, timeout + credit given back |
| Private briefs phrased differently | Extra eval briefs covering vague, unsupported and synonym cases |
