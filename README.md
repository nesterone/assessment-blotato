# Chatterbox

Fastify + TypeBox + Drizzle/Postgres implementation of a cross-platform comment management API. See [`PRD.md`](./PRD.md), [`CONTEXT.md`](./CONTEXT.md), [`docs/api.md`](./docs/api.md), and [`docs/schema.md`](./docs/schema.md) for the domain, wire contract, and data model.

## Running locally

Requires Node 22 (pinned in `.nvmrc`) and Docker (for Postgres 16).

```bash
nvm use
npm install
cp .env.example .env    # override any values you don't like

npm run db:start        # docker compose up -d postgres
npm run db:reset        # push schema + seed fixtures
npm run dev             # tsx watch, boots on PORT (default 3000)
```

Explorer UI: <http://localhost:3000/docs> · OpenAPI JSON: <http://localhost:3000/docs/json>

### Environment variables

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. |
| `PORT` | HTTP port (default `3000`). |
| `INSTAGRAM_BASE_URL` / `TIKTOK_BASE_URL` | Platform API roots. No real app for this assessment, so they point at the fakes in `test/fakes`; the real values are in `.env.example` comments. |
| `TEST_API_KEY` | Plaintext API key seeded into `api_keys`. sha256 of this value is what the DB stores; requests send `Authorization: Bearer <TEST_API_KEY>`. |

`.env` is gitignored (dev writes their own). `.env.example` and `.env.test` are committed templates.

### Auth

Every endpoint requires `Authorization: Bearer <api_key>`. The auth plugin sha256s the bearer token and looks it up in `api_keys` where `revoked_at IS NULL`.

```bash
curl -H "Authorization: Bearer $(grep TEST_API_KEY .env | cut -d= -f2)" \
  http://localhost:3000/posts
```

## Tests

Tests use a separate `chatterbox_test` database (created by `docker/postgres-init/`) and reseed themselves in `beforeEach`. Requires docker up.

```bash
npm run db:start        # once
npm test                # pushes schema to chatterbox_test, then vitest
npm run test:watch
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start API in watch mode. |
| `npm run fakes` | Serve the fake Instagram + TikTok on `:4000` (`FAKES_PORT` to override). |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run format` / `format:check` | Prettier over code; markdown is ignored. |
| `npm run build` / `start` | Compile to `dist/` / run compiled server. |
| `npm run db:start` / `db:stop` | Docker compose up/down. |
| `npm run db:push` | Sync `src/db/schema.ts` to the dev DB. |
| `npm run db:seed` | Truncate + seed dev DB from `src/db/seed.ts`. |
| `npm run db:reset` | `db:push && db:seed`. |
| `npm test` | Push schema to test DB, run vitest once. |

## Scope

Handlers run real Drizzle queries against Postgres; auth is real (sha256 API keys). The sender worker is out of scope: `POST /comments/:id/replies` inserts a `pending` row and returns 202 — nothing forwards to the platform yet.
