# API-key auth, not JWT or OAuth

Callers authenticate with `Authorization: Bearer <api_key>`; the key hashes to a `user_id` via a single indexed DB lookup per request, and all authorization is scoped by that `user_id` at the query layer. Keys are stored as `sha256` hashes (fast — hit every request; the raw key has 256 bits of entropy so no bcrypt-style stretching is needed) with a `key_prefix` for UI identification and a `revoked_at` for instant revocation.

We rejected JWTs because we own the DB and don't need stateless federation, and rejected OAuth because the caller is a server, not a browser-based user acting on behalf of a third party. The DB lookup gives us instant revocation, which JWTs do not.
