# Contributing to AfriScore

Thanks for your interest. This guide covers local setup, the checks a change
should pass, and how to submit a pull request.

By participating you agree to keep reports and discussions of security issues
private as described in [SECURITY.md](./SECURITY.md).

## Prerequisites

- Node.js 22 or 24 (CI runs both; 22 is the baseline)
- npm (the repository is lockfile-driven — use `npm ci`)
- Optional: PostgreSQL 16 for the Postgres test suite
- Optional: Docker for the container build

## Setup

```bash
git clone https://github.com/Sevqo/afriscore.git
cd afriscore
npm ci

# Local configuration (never commit .env). The API loads a local .env at
# startup; these values are required for admin routes to work.
cp .env.example .env
# Generate each secret independently, e.g.:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm run build
npm start
# -> http://localhost:4000/v1/health
```

With no `DATABASE_URL`, the API uses SQLite at `DB_PATH` (see
`.env.example`). Set `DATABASE_URL` to run against PostgreSQL.

For a containerised local stack with PostgreSQL:

```bash
docker compose up --build
curl localhost:4000/v1/health
```

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Run the TypeScript entry point directly with `ts-node` |
| `npm run build` | Compile `src/` to `dist/` with `tsc` |
| `npm start` | Run the compiled server (`node dist/index.js`) |
| `npm test` | Build, clean test databases, and run the full suite against SQLite |
| `npm run test:pg` | Run the same suite against PostgreSQL (`TEST_DATABASE_URL` required) |
| `npm run typecheck` | Type-check without emitting |
| `npm run validate:openapi` | Check `openapi.json` against the routes declared in `src/` |

PostgreSQL test run:

```bash
docker run --rm -d --name afriscore-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=afriscore_test postgres:16

TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/afriscore_test \
  npm run test:pg
```

The suite covers security-critical paths explicitly: API-key and consent
enforcement, revocation, identifier hashing, tamper detection on the trust
ledger (including tail truncation and anchor forgery), reconciliation and the
webhook consent scope model. Add tests for behaviour changes, not just new
endpoints.

Website:

```bash
cd website
npm ci
npm run dev       # local preview on 127.0.0.1:5175
npm run build     # type-check + static production bundle
```

The site's code snippets must match the real API — check them against
`src/routes/` and `openapi.json` when you change request or response shapes.

## Branch and pull request conventions

- Branch from `main`: `feature/<short-topic>`, `fix/<short-topic>`, or
  `improvements/<phase>` for larger workstreams.
- Keep pull requests focused; unrelated refactors belong in a separate PR.
- Use clear imperative commit messages (`add webhook secret rotation`,
  `fix duplicate account 409`).
- Do not commit secrets, `.env` files, local SQLite databases, `dist/`, or
  `node_modules/`.
- If you change routes or request/response shapes, update `openapi.json` and
  the README/website snippets in the same PR. `npm run validate:openapi`
  catches drift against the Express routes.
- Note behaviour changes in the PR description, especially anything that
  alters the consent model, status codes, or ledger format.

Before opening a PR, run:

```bash
npm run typecheck
npm test
npm run validate:openapi
# if PostgreSQL is available:
TEST_DATABASE_URL=... npm run test:pg
# if you touched the website:
cd website && npm run build
```

CI runs the SQLite suite, the PostgreSQL suite, type-checking, the OpenAPI
drift check and the website build on pushes and pull requests targeting
`main`.

## Code layout and conventions

```
src/app.ts        Express app wiring (no port bound; testable in-process)
src/index.ts      configuration validation, migrate(), listen(), shutdown
src/config.ts     environment parsing and validation
src/db/           dual-engine adapter (SQLite/PostgreSQL) and schema guards
src/services/     one file per capability; business logic lives here
src/routes/       one file per resource; validation and HTTP concerns only
src/middleware/   auth, rate limiting, request context
src/__tests__/    unit and route-level integration tests (node:test)
```

- TypeScript is `strict`; keep it that way.
- Go through `src/db/adapter.ts` (`dbGet`/`dbAll`/`dbRun`/`dbTransaction`) or
  the services — never import a database driver in a route or service.
- Keep SQL portable between SQLite and PostgreSQL; branch only where the
  engines genuinely differ (and comment why).
- Validate request bodies with `zod`; return the existing error shape rather
  than inventing a new one.
- Enforce consent with `hasActiveConsentScope` for any partner-reachable
  endpoint that returns subject data.
- Append a `ledger` event for state changes that matter for audit, and emit a
  webhook only through `emitEvent` (which applies consent scoping).
- Schema changes: add both the base schema in `src/db/index.ts` and the
  idempotent migration guard for SQLite and PostgreSQL. The guard approach is
  a stop-gap until a real migration framework exists.

Questions about a change? Open a draft pull request or an issue describing the
intent before investing in a large patch.
