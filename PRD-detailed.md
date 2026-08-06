# PRD — Detailed

Expansion of [`PRD.md`](./PRD.md) with the framing, scope, and design decisions worked out during grilling. Terms in **bold** are defined in [`CONTEXT.md`](./CONTEXT.md).

## Product framing

The host system is a social media scheduling API: users author a **Post** once, pick a time, and the system publishes it to multiple social platforms on their behalf. The comment system extends this into a **unified inbox** so users can read and reply to engagement on all their **Platform Posts** from one place, without opening a separate app per platform.

## Scope

Two platforms in scope for this design: **Instagram** and **TikTok**. Chosen for contrast:

- **Instagram** — Graph API, supports webhooks, 2-level threading (comment + replies). Represents the "push-friendly, well-behaved" case.
- **TikTok** — limited comments API, **no webhooks** (polling only), roughly flat threading. Represents the "poll-only, constrained" case.

The abstraction must accommodate both push and pull sync without leaking platform quirks into the API.

Functional scope is limited to what `PRD.md` calls out:

- Retrieve **Comments** for a published **Post**
- **Reply** to a **Comment**

Out of scope: moderation (hide/delete), editing our own **Replies**, likes/reactions, sentiment/analytics, multi-tenancy / workspaces / team sharing (one user owns their **Connected Accounts** and **Posts**, full stop).

## Design decisions

### Comments are stored, not proxied

We keep our own copy of **Comments** in our database and serve reads from it. Background sync (webhooks for Instagram, polling for TikTok) keeps our copy fresh.

Rationale: the unified-inbox product experience is not viable via live fan-out to N platform APIs per request — it would be slow, rate-limit-bound, and fail whenever any single platform is degraded. A local store also enables cross-platform queries (e.g. "all comments across all my Platform Posts, newest first").

Trade-off accepted: our copy can go stale (author edits, deletions on the platform). Sync eventually reconciles.

### Sync cadence

- **TikTok** — poll every 5 minutes, flat (all Platform Posts with sync enabled). No hot/cold tiering; can be added later if quota hurts.
- **Instagram** — webhook-driven (near real-time), with an hourly reconcile poll as a safety net for dropped webhooks. Reconcile is infra, not user-facing — no manual refresh endpoint.

### Threading in the API

Top-level and replies are fetched separately:

- `GET /posts/:id/comments` — returns only top-level **Comments** (those with no parent), paginated.
- `GET /comments/:id/replies` — returns replies to a specific **Comment**, paginated.

Storage stays flat: every **Comment** row has a nullable `parent_comment_id`. Two levels is the practical ceiling on both platforms, but the schema doesn't hard-code that — nesting deeper would work if a future platform allowed it.

Rationale: matches how the underlying platforms model comments; each list paginates cleanly; avoids over-fetching replies for threads the user never expands.

### Pagination

Cursor-based, opaque `next_cursor` in the response, keyed internally on `(created_at, id)`. Default sort **newest first**. No offset/limit and no total count — both are wrong for a feed that constantly grows at the head.

Same scheme for both `GET /posts/:id/comments` and `GET /comments/:id/replies`.

### Caller auth

API-key per user. Caller sends `Authorization: Bearer <api_key>`; middleware hashes it (`sha256`), looks it up in `api_keys`, and resolves to a `user_id`. All queries scope by that `user_id` at the DB layer — a user can only read/reply to Comments on Platform Posts belonging to their own Connected Accounts.

Key storage: `key_hash` (sha256, not bcrypt — hit on every request; 256-bit random keys don't need stretching), `key_prefix` (first 8 chars, for UI identification), `last_used_at`, `revoked_at`. Revocation is instant (row update; no cache to invalidate).

Deliberately excluded: scoped/permissioned keys, forced rotation, JWTs. Rate limiting lives at the gateway, keyed on `user_id`.

See [ADR-0003](./docs/adr/0003-api-key-auth.md).

## Open questions

(none blocking design; ready for schema + code) Flat list with `parent_comment_id`, server-assembled tree, or top-level + on-demand replies?
- **Pagination model.** Cursor vs. offset; how we hide per-platform cursor quirks.
- **Caller auth.** How the REST caller authenticates to us, and how that maps to **Connected Accounts**.
- **Multi-tenancy.** Workspaces / teams — in scope or ignore for the take-home?
