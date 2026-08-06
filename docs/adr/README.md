# Architecture Decision Records

Decisions with meaningful cost-to-reverse. Smaller/reversible design choices live in [`PRD-detailed.md`](../../PRD-detailed.md).

| #    | Decision                                                                    |
| ---- | --------------------------------------------------------------------------- |
| 0001 | [Comments are stored, not proxied](./0001-comments-as-system-of-record.md)  |
| 0002 | [Threading exposed as two endpoints, not a nested tree](./0002-threading-via-separate-endpoints.md) |
| 0003 | [API-key auth, not JWT or OAuth](./0003-api-key-auth.md)                    |
| 0004 | [Async reply writes, returning 202 with the local id](./0004-async-reply-write.md) |
| 0005 | [Cursor pagination, not offset](./0005-cursor-pagination.md)                |
