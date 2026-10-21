# Candidate Search recruiter search

Recruiters describe who they want in plain English; Claude turns the brief into structured filters; Postgres finds and ranks the people.

![Search results with editable filter tags](docs/screenshots/desktop-03-search-results.png)

## Run it

Needs Docker Desktop running and Node 24.

```
export ANTHROPIC_API_KEY=sk-ant-...
export STRIPE_WEBHOOK_SECRET=whsec_test_sample
make setup
make dev
```

Open http://localhost:3000 and sign in as `recruiter@acme.test` or `recruiter@globex.test` (password `demo-password`).

## How search works

The data is fully structured with closed vocabularies (13 roles, 4 seniority levels, 10 cities, 79 skills, schools, degrees, company types), and the 10 example briefs are reproduced exactly by AND-ing those fields, so search is a translation problem. Claude Haiku receives the brief and a forced tool whose schema lists every allowed value as an enum. The validated filters go to one static SQL statement as typed parameters. Every match is stored with a fixed rank, so paging is a primary-key read and each person appears exactly once.

- **Understanding the brief:** Claude maps phrasing to exact values ("Golang" is Go, "NYC" is New York). "Engineers" or "developers" with no qualifier mean every engineering role, so "software engineers in California" finds all 831.
- **Ranking:** every result matches every requirement. Closer matches come first (more of the brief's companies, schools or degrees), then open to work, then most experienced.
- **Why not keyword or embedding search:** headlines and job descriptions are generated from the same structured fields, so they add nothing to match on, and fuzzy matching would add wrong people.
- **Accuracy:** `npm run eval:search` scores the 10 example briefs and 15 of my own (synonyms, states, years, umbrella titles, unanswerable asks): precision and recall are 100% on all 25.

## Keeping the LLM honest

Four layers: an enum-only tool schema built from the live data; zod re-validation that drops unknown values; an `unsupported` list for anything the data cannot answer ("speaks Japanese"); and a strict rule that an unsupported requirement, or no usable filter at all, returns nobody instead of the wrong people. Briefs are treated as data, never as instructions, and never reach SQL as text.

## Model, cost and speed

`claude-haiku-5-5`: the fastest Claude model, and accurate enough because the schema does the heavy lifting. The system prompt and tool are cached.

- **Cost per search:** about $0.0003 with a warm prompt cache and $0.0007 on the first search after 5 quiet minutes, or 1,500 to 3,500 searches per dollar. Measured from the search log: about 220 input and 430 output tokens, plus a 3,900-token cached prompt.
- **Speed (on `make dev`):** a new search takes 1.6 to 2.2 s with a warm cache and about 2.7 s cold, almost all of it the Claude call (target under 3 s). The Claude timeout is 8 s with one retry, because a slow answer is better than a failed search. Paging takes 74 ms at p95 (target under 300 ms).

## Tradeoffs

- Strict matching favours precision; a brief phrased in ways the prompt does not anticipate can return nothing.
- Editing filters counts as a new search on the free plan, so filter tags cannot be used to dodge the limit.
- Results are stored per search: fast, stable paging at the cost of extra rows.
- Webhook signatures are always checked, but the age check is off by default; replays are blocked by event id instead.

## With another week

- Free narrowing: adding a filter only narrows results already given, so it could run without using a search once the server can prove it.
- Cache filters per normalised brief, so a repeated brief skips Claude.
- Keyword or embedding search alongside the filters, once profiles carry free text that no field covers.
- "Did you mean" suggestions when results are empty.
- A regression set of a few hundred labelled briefs.

More: [docs/REVIEWING.md](docs/REVIEWING.md) (review order, checks, screenshots, billing replay, troubleshooting) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (design and decisions).
