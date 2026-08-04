# Context

Domain glossary for the comment system.

## Glossary

### Post
Content the user authored inside the system and scheduled for publication. Owned by us; exists in our database independent of any platform.

### Platform Post
The per-platform published instance of a Post. When one Post is published to Instagram, YouTube, and X, three Platform Posts exist — each with its own platform-native ID. Comments hang off Platform Posts, not Posts.

### Comment
A message written by a third party (usually not our user) on a Platform Post. We do not author these; the platform is the source of truth.

### Reply
A Comment authored by our user in response to another Comment. We *do* author these and send them to the platform on the user's behalf.

### Connected Account
The user's OAuth link to a specific platform account (e.g. their YouTube channel). A Post is published *through* Connected Accounts.
