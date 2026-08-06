# API design

REST endpoints for the comment system. Terms in **bold** are defined in [`../CONTEXT.md`](../CONTEXT.md). Rationale for non-obvious choices lives in [`adr/`](./adr/).

## Endpoints

```
GET  /posts                      list caller's Posts
GET  /posts/{id}                 single Post
GET  /posts/{id}/comments        top-level Comments on a Post
GET  /comments/{id}/replies      Replies to a Comment
POST /comments/{id}/replies      write a Reply
```

`GET /posts` and `GET /posts/{id}` are convenience endpoints for testing — the PRD only requires the comment endpoints, but without a way to list Posts a caller can't discover the IDs the other endpoints need.

## Auth

Every request:

```
Authorization: Bearer <api_key>
```

Middleware sha256s the key, looks it up in `api_keys`, and resolves to a `user_id`. All queries scope by that `user_id`. See [ADR-0003](./adr/0003-api-key-auth.md).

## Pagination

All list endpoints use the same scheme.

**Request:**
```
?cursor=<opaque>&limit=50
```

- `cursor` — opaque string from the previous response's `next_cursor`. Omit on the first page.
- `limit` — default 50, max 100. Clamped silently.

**Response envelope:**
```json
{
  "data": [ ... ],
  "next_cursor": "opaque-string-or-null"
}
```

Sort is **newest first** (`created_at DESC, id DESC`). No override. `next_cursor: null` means "no more pages" — server fetches `limit + 1` internally to know for sure without forcing the client into an extra round-trip. See [ADR-0005](./adr/0005-cursor-pagination.md).

## Resource shapes

### Post

```json
{
  "id": "uuid",
  "body": "check out my new video",
  "created_at": "2025-01-15T10:00:00Z"
}
```

No `user_id` — always the caller.

### Comment

Variable shape. Third-party comments omit `send_status`; the caller's own replies include it, and `send_error` only appears when `send_status = "failed"`.

Third-party comment:
```json
{
  "id": "uuid",
  "platform_post_id": "uuid",
  "platform": "instagram",
  "author": { "handle": "jane_doe", "is_me": false },
  "body": "great post!",
  "created_at": "2025-01-15T10:30:00Z"
}
```

Caller's reply (pending send):
```json
{
  "id": "uuid",
  "platform_post_id": "uuid",
  "platform": "instagram",
  "author": { "handle": "our_user_handle", "is_me": true },
  "body": "thanks!",
  "created_at": "2025-01-15T10:32:00Z",
  "send_status": "pending"
}
```

Caller's reply (failed send):
```json
{
  ...,
  "send_status": "failed",
  "send_error": "rate limit exceeded"
}
```

`parent_comment_id` is omitted — the endpoint the caller hit already tells them whether they're looking at top-level comments or replies to a specific one.

## Endpoint details

### `GET /posts`

Lists the caller's Posts, paginated.

```
GET /posts?cursor=<opaque>&limit=50
→ 200 { "data": [Post, ...], "next_cursor": "..." | null }
```

### `GET /posts/{id}`

```
GET /posts/{id}
→ 200 Post
→ 404 if not the caller's Post
```

### `GET /posts/{id}/comments`

Top-level Comments (no parent) on all Platform Posts belonging to the given Post, paginated.

```
GET /posts/{id}/comments?cursor=<opaque>&limit=50
→ 200 { "data": [Comment, ...], "next_cursor": "..." | null }
→ 404 if not the caller's Post
```

Returns a unified feed across every platform the Post was published to. Each Comment carries its own `platform` and `platform_post_id` so the client can tell them apart.

### `GET /comments/{id}/replies`

Replies to a specific Comment, paginated.

```
GET /comments/{id}/replies?cursor=<opaque>&limit=50
→ 200 { "data": [Comment, ...], "next_cursor": "..." | null }
→ 404 if not on one of the caller's Platform Posts
```

### `POST /comments/{id}/replies`

Write a Reply to a Comment. The row is inserted locally with `send_status = "pending"`; a background sender worker forwards it to the platform. See [ADR-0004](./adr/0004-async-reply-write.md).

```
POST /comments/{id}/replies
Body: { "body": "thanks!" }

→ 202 { "id": "uuid-of-the-new-row" }
→ 400 validation_error (empty or missing body)
→ 404 if the parent Comment isn't on one of the caller's Platform Posts
```

`202` — not `201` — because the reply doesn't exist on the platform yet. The response includes only the new row's `id`; the client observes the reply appearing (with `send_status`) on the next `GET /comments/{id}/replies` for the same parent.

## Errors

Shape:

```json
{
  "error": {
    "code": "not_found",
    "message": "No comment with id abc-123"
  }
}
```

Validation errors add `fields`:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid request body",
    "fields": { "body": "required" }
  }
}
```

`fields` reasons are short machine-readable strings (`required`, `too_long`, `invalid_format`).

| HTTP | `code`             | When                                                      |
| ---- | ------------------ | --------------------------------------------------------- |
| 400  | `validation_error` | Malformed request body                                    |
| 401  | `unauthorized`     | Missing, invalid, or revoked API key                      |
| 404  | `not_found`        | Resource doesn't exist, or belongs to a different user    |

404 is used for both "doesn't exist" and "not yours" — deliberately, so the API doesn't leak whether an ID exists.
