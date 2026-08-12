# Chatterbox

A cross-platform comment system for a social-media scheduling API: read the **Comments** on your published **Posts** and **Reply** to them, across Instagram and TikTok, through one REST API.


## What was asked, and where it lives

The brief ([`docs/BRIEF.md`](./docs/BRIEF.md)) asked for four things, delivered in four forms.

**Requirements**

- **Retrieve comments for a post** — `GET /posts/:id/comments` and `GET /comments/:id/replies`.
- **Reply to a comment** — `POST /comments/:id/replies`.
- **Support multiple platforms** — [`src/platforms/`](./src/platforms): one `PlatformClient`, with adapters for Instagram and TikTok.
- **Expose it as a REST API** — [`src/routes/`](./src/routes) and [`src/handlers/`](./src/handlers).

**Deliverables**

- **Database schema** — [`src/db/schema.ts`](./src/db/schema.ts), explained in [`docs/schema.md`](./docs/schema.md).
- **API design** — [`docs/api.md`](./docs/api.md), live at <http://localhost:3000/docs>.
- **TypeScript code** — the [`src/`](./src) tree.
- **Design decisions** — [`docs/adr/`](./docs/adr).


## Stack

 * Fastify
 * TypeBox 
 * Drizzle/Postgres 
 * Node 22
 * Docker
 * Postgres 16 

## Run it

```bash
nvm use && npm install
cp .env.example .env
npm run db:start && npm run db:reset && npm run dev
```

API on `:3000`, live docs at <http://localhost:3000/docs>. Every request needs `Authorization: Bearer <api_key>`:

```bash
curl -H "Authorization: Bearer $(grep TEST_API_KEY .env | cut -d= -f2)" \
  http://localhost:3000/posts
```

## Test it

```bash
npm run db:start && npm test
```
</content>
