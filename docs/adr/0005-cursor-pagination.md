# Cursor pagination, not offset

All list endpoints paginate with an opaque `cursor` query param and return `next_cursor` in the response envelope. Internally the cursor keys on `(created_at, id)` with `created_at DESC, id DESC` — newest first. Default `limit` is 50, max 100, clamped silently rather than rejected.

We rejected `offset` / `page` because Comments and Posts constantly grow at the head. Between two `page=2` calls, new rows push everything down, and the caller either sees duplicates or misses rows. Cursor pagination is stable against inserts at the head — the cursor pins a position in the sort order, not an ordinal.

`total_count` is deliberately omitted. Producing it requires a second `COUNT(*)` on the same predicate, doubles DB work per list call, and the number is stale the moment it's returned. Callers that need a total can count as they page.

To know whether the current page is the last one, the server fetches `limit + 1` rows internally: 51 back means "there's more, drop the extra, return a `next_cursor`"; 50 or fewer means "that was everything, `next_cursor: null`." One extra row's worth of DB work saves the caller a round-trip at the end of every list.
