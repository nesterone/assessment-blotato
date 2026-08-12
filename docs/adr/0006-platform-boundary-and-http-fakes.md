# The platform boundary lives behind the workers, tested with HTTP fakes

Everything that talks to Instagram or TikTok sits behind one `PlatformClient` interface in `src/platforms/`, called only by the sender and sync workers — never by an HTTP handler. Handlers read our database; comments are stored, not proxied ([ADR-0001](./0001-comments-as-system-of-record.md)). The public API surface does not change: no new routes, no schema fields the caller can see. The `send_status` union stays `pending | sent | failed`; retry bookkeeping (`attempt_count`, `next_attempt_at`) is internal. If work behind this boundary had forced a contract change, the boundary would be in the wrong place.

Adapters normalize. Platform DTOs never escape `src/platforms/` — callers see domain types (`PlatformComment`, `ReplyTarget`). `ConnectedAccount` is a separate argument rather than baked into the client, so clients stay stateless across tenants and credentials arrive per call. The two clients share the interface but no base class: authentication, failure detection, and response shapes have nothing in common. Instagram authenticates with an `access_token` query param and signals failure with an HTTP error status; TikTok uses a Bearer header and answers `200 OK` with the outcome hidden in `error.code`. The one genuine overlap — transport (timeout, connection and non-JSON failures, `Retry-After`) — lives in `requestJson` as a free function, with status *interpretation* left to each adapter because that is exactly where the platforms diverge.

Failures collapse to three typed errors extending `AppError`, one per worker branch: `PlatformRetryable` (rate limit, 5xx, network — stays pending, retried after `next_attempt_at`), `PlatformAuthExpired` (dead token — held pending; time won't fix it, a reconnect will), and `PlatformRejected` (deleted target, unintegrated platform — sent to `failed`). Finer detail survives on `platformCode`, carried on the error for logging, so metrics can still separate rate-limiting from 5xx even though the class name no longer does. There is deliberately no `PlatformNotFound`: it would sit one `instanceof` from the caller-facing `NotFoundError` while meaning the opposite, and the miscatch is a matter of time.

## Why the fakes speak HTTP

The clients are tested against two small Fastify apps that answer the way the real APIs answer, wired in through `INSTAGRAM_BASE_URL` / `TIKTOK_BASE_URL`. An in-memory `FakeInstagram` implementing `PlatformClient` would satisfy the interface without ever running the adapter — the one piece that shapes requests and reads responses would be dead code under test, and the suite would prove only that two objects we wrote agree with each other.

The concrete bug the HTTP fakes catch: TikTok returns `200 OK` on failure and puts the error in the body. An adapter that trusted `res.ok` would mark every failed TikTok reply as `sent`. An in-memory fake cannot surface that; a fake that actually serves a `200` with an error body can, and does.

Honest limit: a fake we wrote will never surprise us the way production will. It proves the seam is real and the adapters are exercised — not that we match the live API byte for byte.

## Instagram webhooks: additive, not built

TikTok is poll-only and Instagram supports webhooks, but both platforms poll in this design and webhooks are out of scope. This is a deliberate omission, not a gap: adding them is purely additive and changes nothing already built.

When we add them, Instagram gains one route, `POST /webhooks/instagram`, and the platform interface gains one method, `getComment(platformCommentId, account)` — a webhook carries an id, not the comment body, so we fetch the changed comment and run it through the same `upsertPlatformComment` the sync worker already uses. The hourly Instagram poll ([per PRD-detailed](../../PRD-detailed.md)) stays as the reconcile safety net for dropped deliveries. Signature verification belongs with that route and lands with it. Because the write path (`upsertPlatformComment`, dedup on `comments_platform_uk`) is shared, a webhook delivery and a poll of the same comment converge on one row — the same idempotency that already lets re-polling run safely.

This is the one piece that *would* move the API surface, which is why it is scoped out rather than quietly deferred.
