# Database schema

Terms in **bold** are defined in [`../CONTEXT.md`](../CONTEXT.md). Design rationale for the non-obvious choices lives in [`adr/`](./adr/).

```mermaid
erDiagram
    USERS ||--o{ API_KEYS : "has"
    USERS ||--o{ CONNECTED_ACCOUNTS : "has"
    USERS ||--o{ POSTS : "authors"
    USERS |o--o{ COMMENTS : "authors (replies)"
    POSTS ||--o{ PLATFORM_POSTS : "published as"
    CONNECTED_ACCOUNTS ||--o{ PLATFORM_POSTS : "through"
    PLATFORM_POSTS ||--o{ COMMENTS : "receives"

    USERS {
        uuid id PK
        text email
        timestamptz created_at
    }
    API_KEYS {
        uuid id PK
        uuid user_id FK
        text key_hash UK
        text key_prefix
        timestamptz last_used_at
        timestamptz revoked_at
        timestamptz created_at
    }
    CONNECTED_ACCOUNTS {
        uuid id PK
        uuid user_id FK
        text platform
        text platform_account_id
        text access_token
        text refresh_token
        timestamptz token_expires_at
        timestamptz created_at
    }
    POSTS {
        uuid id PK
        uuid user_id FK
        text body
        timestamptz created_at
    }
    PLATFORM_POSTS {
        uuid id PK
        uuid post_id FK
        uuid connected_account_id FK
        text platform_post_id
        timestamptz last_polled_at
        text sync_cursor
    }
    COMMENTS {
        uuid id PK
        uuid platform_post_id FK
        uuid parent_comment_id FK
        text platform_comment_id
        uuid author_user_id FK
        text author_platform_handle
        text body
        timestamptz created_at
        timestamptz synced_at
    }
```

## Notes

**`users` and `posts` already exist in the host scheduling system.** Their fields are shown for context only — out of scope for this design. The comment system references them by `id` and doesn't touch their other columns.

**`platform_posts.last_polled_at` and `sync_cursor`** are the two columns this feature adds to an existing table. `sync_cursor` is the opaque pagination token TikTok hands back on each poll — we store it and echo it on the next call. Both nullable: Instagram platform posts (webhook-driven) never fill them.

**`comments` is one table for both third-party comments and our replies.** `author_user_id` distinguishes: null = scraped from the platform, set = our user wrote it.

**Threading** is a self-reference: `comments.parent_comment_id` → `comments.id`, nullable. Null = top-level comment; set = reply to another comment. No hard-coded depth limit. (Not drawn in the diagram — Mermaid renders self-loops poorly.)

**`comments.platform_comment_id` is nullable** — null means "our reply, not yet accepted by the platform." Sender worker picks up nulls and retries until the POST succeeds and fills it in. Third-party comments always have one at insert.

**Unique constraint** on `(platform_post_id, platform_comment_id)` makes sync idempotent — replaying the same webhook or poll page can't create duplicates. Postgres treats multiple NULLs as distinct, so pending replies coexist fine.
