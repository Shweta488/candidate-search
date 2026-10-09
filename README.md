# Candidate Search recruiter search

Recruiters describe who they want in plain English; Claude turns the brief into structured filters; Postgres finds and ranks the people.

**Run it:** Docker Desktop running, Node 24, then `export ANTHROPIC_API_KEY=... STRIPE_WEBHOOK_SECRET=...`, `make setup`, `make dev`, open http://localhost:3000. Sign in as `recruiter@acme.test` or `recruiter@globex.test` (password `demo-password`).

## How to review (about 15 minutes)

1. This page, then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (requirements, API, high-level design, deep dives) and the diagrams in [docs/DIAGRAMS.md](docs/DIAGRAMS.md) (the request map shows every route).
2. Core code, in this order: `supabase/migrations` (schema, RLS), `src/server/search` (LLM and SQL), `src/server/plan.ts` (free plan), `src/server/billing` (webhook), `app/api` (thin routes).
3. Run the checks with the app running: `npm test` (unit), `npm run test:integration` (tenancy, free plan, billing, hostile briefs), `npm run e2e` (Cypress), `npm run eval:search` (accuracy report). Details in [docs/TESTING.md](docs/TESTING.md).
4. Decisions and their reasons are in [docs/DECISIONS.md](docs/DECISIONS.md); the commit history follows [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md); working rules are in [RULES.md](RULES.md).

## How search works

The data is fully structured with closed vocabularies (13 roles, 4 seniority levels, 10 cities, 79 skills, schools, degrees, company types). The 10 sample briefs are reproduced exactly by AND-ing those fields, so search is a translation problem. Claude Haiku receives the brief and a forced tool whose schema lists every allowed value as an enum. The validated filters go to one static SQL statement as typed parameters. Every match is stored with a fixed rank, so paging is a primary-key read and each person appears exactly once.

## Keeping the LLM honest

Four layers: enum-only tool schema built from the live data; zod re-validation that drops unknown values; an `unsupported` list for anything the data cannot answer ("speaks Japanese"); and a strict rule that an unsupported requirement, or no usable filter at all, returns nobody instead of the wrong people. Briefs are treated as data, never as instructions, and never reach SQL as text.

## Model and cost

`claude-haiku-5-5`: the fastest Claude model, made for extraction, accurate enough because the schema does the heavy lifting. Cost per search: *to be measured* (estimated well under $0.001 at $0.10 / $0.50 per million tokens, cheaper with prompt caching).

## Tradeoffs

- Strict matching favours precision; a brief phrased in ways the prompt does not anticipate can return nothing.
- Editing filters counts as a new search on the free plan, so editing filter tags cannot be used to dodge the limit.
- Results are stored per search: fast, stable paging at the cost of extra rows.
- Webhook signatures are always checked, but the age check is off by default; replays are blocked by event id instead.
- Candidates are readable only through the server, so the free limit cannot be bypassed through Supabase directly.

## With another week

Soft preferences and "did you mean" suggestions when results are empty; a regression set of a few hundred labelled briefs; streaming the filter tags while results load; audit log for billing events.
