# Async reply writes, returning 202 with the local id

`POST /comments/{id}/replies` inserts a Comment row locally with `send_status = "pending"` and returns `202 Accepted` with `{ "id": "..." }`. A background sender worker forwards the reply to the platform, then flips `send_status` to `sent` (filling `platform_comment_id`) or `failed` (filling `send_error`). The caller observes the outcome on the next `GET /comments/{id}/replies` for the parent.

We rejected the synchronous variant (block on the platform round-trip, return `201`) because our p99 would then equal the worst platform's p99 on any given day, and outages upstream would surface as our API being down. Async decouples user-facing latency from platform reliability and gives us retries for free — the worker just tries pending rows again. The schema already anticipated this: `platform_comment_id` is nullable specifically so we can insert first and reconcile later.

The response body is deliberately minimal — just `id`. Returning the full row would enable optimistic UI without a second fetch, but the caller can construct the optimistic row from what they just sent, and if they want the canonical shape they can `GET` the parent's replies. Keeping the write endpoint one-purpose beats bundling read data into it.
