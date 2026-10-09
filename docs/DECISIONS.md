# Decision log

Decisions made while designing this project, with the reason for each. Reasons are expanded in [ARCHITECTURE.md](ARCHITECTURE.md).

| Date | Area | Decision | Why |
|---|---|---|---|
| Oct 8 | Stack | Next.js 16 App Router, TypeScript strict, Node 24, Supabase CLI 2.119.0 pinned as an npm devDependency | Required by the brief; pinning the CLI in npm means `npm ci` installs the exact version |
| Oct 8 | UI | React with Context + hooks, CSS Modules | Only two pieces of global state (session, plan); plain CSS keeps styling simple to read and change |
| Oct 8 | UI | Pages call our own `/api/*` routes with the recruiter's Bearer token | The browser and API clients exercise one code path, with one place to enforce rules |
| Oct 8 | UI | Visual direction "graphite and blue": near-black buttons, one blue accent, soft blue wash behind the page, Geist fonts; light theme only. Chosen from a mockup of two directions and four backgrounds | Modern and calm, keeps attention on the results, every text pair meets WCAG AA |
| Oct 8 | Validation | zod | One schema validates request bodies and LLM output and provides the TypeScript types |
| Oct 8 | Testing | Jest (unit and integration), Cypress with `cypress-axe` (end-to-end and accessibility), GitHub Actions CI on every PR | Tools I use in production; CI gates every merge |
| Oct 8 | Model | Anthropic `claude-haiku-5-5` | Fastest Claude model, built for extraction; well under $0.001 per search |
| Oct 8 | Search | Enum-constrained filters built from the live data, results stored per search for paging | All 10 sample briefs are exact AND matches over structured fields |
| Oct 8 | Search | An unsupported requirement returns nobody, with the reason shown | Returning nothing beats returning the wrong people |
| Oct 8 | Free plan | Editing filters or re-running a saved search counts as a new search | Otherwise a free user could search without limit by editing filters |
| Oct 8 | Billing | HMAC always checked on the raw body; timestamp age check off by default (`STRIPE_WEBHOOK_TOLERANCE_SECONDS` enables it); dedupe by event id; order by `event.created` | Pre-signed events may be replayed days later; replays are already blocked by event id |
| Oct 8 | Billing | Paid means a subscription with status `active` or `trialing` | `past_due`, `incomplete`, `unpaid` and `canceled` stay on the free plan |
| Oct 8 | Security | Candidates readable only through the server, not directly through Supabase | Prevents bypassing the free-plan limit |
| Oct 8 | Database | Two schemas: `public` holds only the tables a recruiter uses with their own token (recruiters, shortlists, shortlist members, saved searches), all under RLS; everything else (candidates, companies, searches, billing, SQL functions) lives in `private`, reachable only by the server | Keeps the RLS surface to four tables, and data a recruiter must never read has no access path at all, instead of sitting in `public` behind a deny-all policy that one later grant could undo |
| Oct 8 | Workflow | One branch and pull request per milestone, merged with a merge commit or rebase (never squash) | Keeps a readable, incremental history |

## Facts from the data that shaped these decisions

- 5,000 candidates, all US: 10 cities, 13 roles, 4 seniority levels (junior 0 to 2 years, mid 3 to 5, senior 6 to 9, staff 10 to 15), 79 skills, 13 schools, 5 degrees, 14 fields of study, 28 companies, 2 company types.
- Experience 0 is always the current job; each candidate has exactly one education entry.
- In `data/queries.json`, "senior" is exact (not staff), "worked at a startup" means any experience at a `startup` company, "enterprise sales experience" is the skill `Enterprise Sales`, and "speaks Japanese" has no data, so the expected answer is nobody.
- "React engineers" in the first sample is the skill React with no role: adding the role Frontend Engineer returns 6 people instead of the expected 21.
- `data/stripe-events.json` signatures verify with the secret `whsec_test_sample` used as-is. Expected final plans: acme free, globex paid.
