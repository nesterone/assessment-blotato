import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

/**
 * `users` and `posts` are owned by the host scheduling system in production.
 * They are declared here so the take-home is runnable end-to-end.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    keyHash: text('key_hash').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('api_keys_key_hash_uk').on(t.keyHash)],
);

export const connectedAccounts = pgTable('connected_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  platformAccountId: text('platform_account_id').notNull(),
  handle: text('handle').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const platformPosts = pgTable('platform_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  connectedAccountId: uuid('connected_account_id')
    .notNull()
    .references(() => connectedAccounts.id, { onDelete: 'cascade' }),
  platformPostId: text('platform_post_id').notNull(),
  lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
  syncCursor: text('sync_cursor'),
});

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformPostId: uuid('platform_post_id')
      .notNull()
      .references(() => platformPosts.id, { onDelete: 'cascade' }),
    parentCommentId: uuid('parent_comment_id').references(
      (): AnyPgColumn => comments.id,
      { onDelete: 'cascade' },
    ),
    platformCommentId: text('platform_comment_id'),
    authorUserId: uuid('author_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    authorPlatformHandle: text('author_platform_handle').notNull(),
    body: text('body').notNull(),
    sendStatus: text('send_status').notNull().default('sent'),
    sendError: text('send_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('comments_platform_uk').on(t.platformPostId, t.platformCommentId),
    index('comments_platform_post_created_idx').on(
      t.platformPostId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    index('comments_parent_created_idx').on(
      t.parentCommentId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
  ],
);
