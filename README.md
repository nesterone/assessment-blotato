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

### Out of scope

Integration with real platforms is out of scope for this assessments, for more details look at ([`docs/PRD.md`](./docs/PRD.md))


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

### Run against the fake platforms

To check the full cycle — post a reply, then let the sender worker forward it to the platform:

```bash
npm run fakes   # serves /ig and /tiktok on http://127.0.0.1:4000
```

The fakes are seeded with two parent comments, so a reply only sends
successfully when its parent is one of these:

| Comment `:id` (POST target) | Platform / Post | Body |
| --- | --- | --- |
| `dddd0000-0000-4000-8000-00000000a101` | Instagram / Post A | "Love this!" |
| `dddd0000-0000-4000-8000-00000000a202` | TikTok / Post A | "Where can I buy?" |

```bash
curl -X POST -H "Authorization: Bearer $(grep TEST_API_KEY .env | cut -d= -f2)" \
  -H 'Content-Type: application/json' -d '{"body":"Thanks!"}' \
  http://localhost:3000/comments/dddd0000-0000-4000-8000-00000000a101/replies
```

Replying to any other comment is rejected by the fake as an unknown parent.


## Test it

```bash
npm run db:start && npm test
```

The test suite boots its own copy of the fakes on an ephemeral port, so
`npm run fakes` is only needed for the dev server above — not for tests.
</content>
