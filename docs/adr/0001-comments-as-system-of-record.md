# Comments are stored, not proxied

The comment feature exists to give users a unified inbox across every platform they publish to. Serving reads by fanning out live to each platform's API per request would be slow, rate-limit-bound, and would fail the moment any single platform degraded — so we keep our own copy of comments in our database and serve reads from it, with background sync (webhooks for Instagram, polling for TikTok) keeping the copy fresh.

Trade-off accepted: our copy can go stale (author edits, deletions on the platform); sync eventually reconciles.
