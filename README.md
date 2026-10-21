# Candidate Search

An AI-powered recruiter search app I built in 72 hours. Recruiters describe who they want in plain English; Claude turns the brief into structured filters; Postgres finds and ranks the people.

It also behaves like a real paid product: two companies fully isolated with row-level security, a free plan with a hard search limit that holds under concurrent requests, and billing driven by signed Stripe webhooks.

![Search results with editable filter tags](docs/screenshots/desktop-03-search-results.png)

**Stack:** Next.js 16 (App Router), TypeScript, React, Supabase (Postgres, Auth, RLS), Claude Haiku, zod, Jest, Cypress, GitHub Actions.

> **Note on data:** the candidate dataset and sample Stripe events are not included in this repo, so `make setup` can't load candidates. The code, tests and docs are complete. See [docs/REVIEWING.md](docs/REVIEWING.md).

## How I built this with AI

I used Claude Code as a pair programmer under a spec-first workflow:

- **Design before code.** I profiled the data, then wrote the [architecture](docs/ARCHITECTURE.md), [low-level design](docs/LLD.md) and [testing strategy](docs/TESTING.md) before any feature work.
- **Rules for the AI.** [CLAUDE.md](CLAUDE.md) points the assistant to [RULES.md](RULES.md): layer boundaries, security rules, and an approval gate where nothing is committed or pushed without my explicit sign-off.
- **One story per PR.** Work was split into 13 stories, each delivering database, API, UI and tests end to end, merged with full history. The plan and commit list are in [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).
- **Measured, not guessed.** Latency, cost per search and search accuracy are measured by scripts, and decisions are recorded with their reasons in [ARCHITECTURE.md section 7](docs/ARCHITECTURE.md#7-decisions).

## How search works

The data is fully structured with closed vocabularies (13 roles, 4 seniority levels, 10 cities, 79 skills, schools, degrees, company types), so search is a translation problem. Claude Haiku receives the brief and a forced tool whose schema lists every allowed value as an enum. The validated filters go to one static SQL statement as typed parameters. Every match is stored with a fixed rank, so paging is a primary-key read and each person appears exactly once.

- **Understanding the brief:** Claude maps phrasing to exact values ("Golang" is Go, "NYC" is New York). "Engineers" or "developers" with no qualifier mean every engineering role.
- **Ranking:** every result matches every requirement. Closer matches come first, then open to work, then most experienced.
- **Why not keyword or embedding search:** headlines and job descriptions are generated from the same structured fields, so they add nothing to match on, and fuzzy matching would add wrong people.
- **Accuracy:** `npm run eval:search` scores 25 briefs (10 examples plus 15 of my own covering synonyms, states, years, umbrella titles and unanswerable asks) at 100% precision and recall.

## Keeping the LLM honest

Four layers: an enum-only tool schema built from the live data; zod re-validation that drops unknown values; an `unsupported` list for anything the data can't answer ("speaks Japanese"); and a strict rule that an unsupported requirement, or no usable filter at all, returns nobody instead of the wrong people. Briefs are treated as data, never as instructions, and never reach SQL as text.

## Security and billing

- **Company isolation:** the company always comes from the database, never the request. Row-level security blocks cross-company access even when calling Supabase directly with a recruiter's token. Everything else lives in a private schema only the server can reach.
- **Secrets:** server-only modules, and a test scans the built bundle for keys.
- **Free plan:** one conditional `UPDATE` in Postgres, so exactly one free search succeeds even with 20 concurrent requests.
- **Stripe webhooks:** signature verified on the raw body, repeats ignored by event id, and an older event can never overwrite a newer state.

## Model, cost and speed

`claude-haiku-5-5`, with the system prompt and tool cached.

- **Cost per search:** about $0.0003 warm and $0.0007 cold, or 1,500 to 3,500 searches per dollar.
- **Speed:** a new search takes 1.6 to 2.2 s warm, almost all of it the Claude call. Paging takes 74 ms at p95.

## Tradeoffs

- Strict matching favours precision; a brief phrased in ways the prompt doesn't anticipate can return nothing.
- Editing filters counts as a new search on the free plan, so filter tags can't be used to dodge the limit.
- Results are stored per search: fast, stable paging at the cost of extra rows.

## With another week

- Free narrowing: adding a filter only narrows results already given, so it could run without using a search once the server can prove it.
- Cache filters per normalised brief, so a repeated brief skips Claude.
- Keyword or embedding search alongside the filters, once profiles carry free text that no field covers.
- "Did you mean" suggestions when results are empty.

## Run it

Needs Docker Desktop, Node 24, and a candidate dataset in `data/`.

```
export ANTHROPIC_API_KEY=sk-ant-...
export STRIPE_WEBHOOK_SECRET=whsec_test_sample
make setup
make dev
```

Open http://localhost:3000 and sign in as `recruiter@acme.test` or `recruiter@globex.test` (password `demo-password`).

More: [docs/REVIEWING.md](docs/REVIEWING.md) (review order, checks, screenshots, troubleshooting) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (design and decisions).