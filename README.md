# Chatterbox

Stub-phase Fastify + TypeBox scaffold for a cross-platform comment management system. See [`PRD.md`](./PRD.md), [`CONTEXT.md`](./CONTEXT.md), and [`docs/api.md`](./docs/api.md) for the domain and wire contract.

## Running locally

Requires Node 22 (pinned in `.nvmrc`).

```bash
nvm use
npm install
npm test         # vitest
npm run typecheck
npm run dev      # tsx watch, boots on PORT (default 3000)
```

### Endpoints

Once running:

- Explorer UI: <http://localhost:3000/docs>
- OpenAPI JSON: <http://localhost:3000/docs/json>

All endpoints require `Authorization: Bearer <api_key>`. Any non-empty key works in the stub phase.

```bash
curl -H 'Authorization: Bearer test' http://localhost:3000/posts
# → { "data": [], "next_cursor": null }
```

## Status

Stub phase — routes return hardcoded/empty data. No DB, no platform integration, no real auth. Follow-up phases add persistence, real API-key hashing, and the sender worker for `POST /replies`.
