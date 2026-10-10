# Working rules

These rules apply to everyone who changes this repo, human or AI assistant. `CLAUDE.md` points AI tools here.

## 1. Approval workflow

1. Nothing is committed without Shweta's explicit approval of the change ("approved to commit").
2. Nothing is pushed without a **second, separate** approval ("approved to push"). Approval to commit is never approval to push.
3. Before asking for approval, show: what changed, why, how it was checked, and the proposed commit message.
4. One logical change per commit. Follow the plan in [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md); if the plan changes, update it in the same commit.
5. One branch and one pull request per story (see the plan). Never commit directly to `main`. Pull requests are merged by Shweta with a merge commit or rebase, never squash. Each story runs in this order:
   1. Write the story plan and wait for Shweta to review and approve it.
   2. Pull the latest `main` and create the story's branch from it.
   3. Implement the approved plan.
   4. Ask for approval to commit (rule 1), then separately for approval to push (rule 2).
6. Never rewrite pushed history (`push --force`, rebase of pushed commits) without explicit approval.
7. Prefer plain code over clever code, and explain non-obvious code in the review summary and pull request description.

## 2. Commit messages

Conventional Commits, imperative, under 72 characters in the subject:

```
feat(search): validate LLM filters against the vocabulary

Why the change was needed and anything a reviewer should know.
```

Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`, `perf`, `style`. Scopes: `db`, `auth`, `search`, `plan`, `billing`, `api`, `ui`, `setup`, `docs`.

## 3. Architecture boundaries

- **UI** (`app/(app)`, `src/components`, `src/client`) never imports from `src/server`.
- **API** (`app/api/**/route.ts`) stays thin: auth gate, zod parse, call one service, map errors to HTTP.
- **Services** (`src/server`) start with `import 'server-only'` and hold all business logic.
- **Shared types** (`src/shared`) hold TypeScript types only (no code, no secrets) and may be imported by any layer.
- **Data** (`supabase/migrations`, `scripts/seed.ts`) owns schema, RLS, grants and SQL functions. Schema changes only via a new migration file, never by editing an applied one after it is pushed.

## 4. Security rules (non-negotiable)

- The secret Supabase key and the model key are read only in `src/server`. Never prefix them with `NEXT_PUBLIC_`.
- `company_id` always comes from the database lookup of the signed-in user, never from a request body, query or header.
- Every table in `public` has RLS enabled with both a read rule (`USING`) and a write rule (`WITH CHECK`), and a test that tries to cross companies. Every table in `private` has RLS enabled with no policies, so only the server's secret key can use it.
- Every function in the `private` schema has `EXECUTE` revoked from `PUBLIC`, `anon` and `authenticated`.
- No SQL built by string concatenation. Filters reach SQL only as typed parameters.
- The LLM receives the brief only. Never send candidate data to the model.
- Treat the brief as untrusted data in prompts; validate every LLM output with zod before use.
- Webhook signatures are verified on the raw body before any parsing.

## 5. Code style

- TypeScript `strict`. No `any` without a comment explaining why.
- Validate every external input with zod (request bodies, params, LLM output, webhook payloads).
- Small files with one job; name things after the domain (`spendSearchCredit`, not `doQuota`).
- Comments explain *why*, not *what*.
- CSS Modules with variables from `app/globals.css`; no inline style objects except dynamic values.
- Docs and UI copy: plain, human tone. No em dashes.

## 6. Definition of done for a change

Before asking for commit approval, all of these pass locally:

```
npm run typecheck
npm run lint
npm test            # Jest unit tests
```

Plus, when the change touches them: `npm run test:integration` (Jest, against the running stack), `npm run e2e` (Cypress), `npm run eval:search`, `npm run check:secrets` (see [`docs/TESTING.md`](docs/TESTING.md)).

**Claude API calls cost money.** Only call the model when the change needs it:

- Tests that call Claude: `tests/integration/hostile.test.ts`, `tests/integration/latency.test.ts`, `cypress/e2e/search.cy.ts` and `npm run eval:search`. Run them only when the story touches the brief-to-filters path (prompt, `extractFilters`, filter validation of LLM output), ask Shweta before running them, and run them once, after all of the story's changes are done, not after each change.
- Otherwise run the test files the change touches by path instead of the whole suite, because `npm run test:integration` and `npm run e2e` include the files above: `npx jest --config jest.integration.config.ts --runInBand <file>` and `npm run e2e -- --spec <file>`.
- New tests send `filters` with a search (which skips the model) or fake the search response, unless the model itself is under test.

## 7. Files that must never be committed

`.env`, `.env.local`, any real API key, `node_modules`, `.next`, Supabase local volumes. `data/*.json` **is** committed because `make setup` loads it.
