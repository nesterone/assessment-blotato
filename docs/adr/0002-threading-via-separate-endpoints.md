# Threading exposed as two endpoints, not a nested tree

`GET /posts/:id/comments` returns only top-level Comments; `GET /comments/:id/replies` returns replies to a specific Comment. Both paginate independently. Storage stays flat with a nullable `parent_comment_id`, so the schema isn't locked to two levels even though both in-scope platforms cap there.

We rejected server-assembled nested trees (pagination gets weird, payloads blow up on popular posts) and flat lists with `parent_comment_id` on the client (pushes stitching work to every caller). Two endpoints match how the underlying platforms model comments themselves and mirror how real UIs load ("show 12 more replies").
