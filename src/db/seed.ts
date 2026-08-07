import { createHash } from 'node:crypto';
import { pool, db } from './client.js';
import { sql } from 'drizzle-orm';
import {
  apiKeys,
  comments,
  connectedAccounts,
  platformPosts,
  posts,
  users,
} from './schema.js';
import { fixtures } from './fixtures.js';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

const iso = (offsetMinutes: number) =>
  new Date(Date.UTC(2025, 0, 15, 10, 0, 0) + offsetMinutes * 60_000);

export async function seed() {
  const apiKeyPlain = process.env.TEST_API_KEY;
  if (!apiKeyPlain) {
    throw new Error('TEST_API_KEY is required for seed.');
  }

  await db.execute(sql`
    TRUNCATE TABLE comments, platform_posts, posts,
                   connected_accounts, api_keys, users
    RESTART IDENTITY CASCADE
  `);

  await db.insert(users).values([
    { id: fixtures.users.primary, email: 'primary@example.com' },
    { id: fixtures.users.other, email: 'other@example.com' },
  ]);

  await db.insert(apiKeys).values([
    {
      id: fixtures.apiKeys.primary,
      userId: fixtures.users.primary,
      keyHash: sha256(apiKeyPlain),
      keyPrefix: apiKeyPlain.slice(0, 8),
    },
    {
      id: fixtures.apiKeys.revoked,
      userId: fixtures.users.primary,
      keyHash: sha256(`${apiKeyPlain}_revoked`),
      keyPrefix: `${apiKeyPlain.slice(0, 8)}r`,
      revokedAt: iso(-60),
    },
    {
      id: fixtures.apiKeys.other,
      userId: fixtures.users.other,
      keyHash: sha256(`${apiKeyPlain}_other`),
      keyPrefix: `${apiKeyPlain.slice(0, 8)}o`,
    },
  ]);

  await db.insert(connectedAccounts).values([
    {
      id: fixtures.connectedAccounts.instagram,
      userId: fixtures.users.primary,
      platform: 'instagram',
      platformAccountId: 'ig_acct_primary',
      accessToken: 'ig_token_primary',
    },
    {
      id: fixtures.connectedAccounts.tiktok,
      userId: fixtures.users.primary,
      platform: 'tiktok',
      platformAccountId: 'tt_acct_primary',
      accessToken: 'tt_token_primary',
    },
    {
      id: fixtures.connectedAccounts.otherInstagram,
      userId: fixtures.users.other,
      platform: 'instagram',
      platformAccountId: 'ig_acct_other',
      accessToken: 'ig_token_other',
    },
  ]);

  await db.insert(posts).values([
    {
      id: fixtures.posts.a,
      userId: fixtures.users.primary,
      body: 'Post A — cross-platform launch',
      createdAt: iso(0),
    },
    {
      id: fixtures.posts.b,
      userId: fixtures.users.primary,
      body: 'Post B — instagram-only teaser',
      createdAt: iso(30),
    },
    {
      id: fixtures.posts.other,
      userId: fixtures.users.other,
      body: 'Other user post',
      createdAt: iso(45),
    },
  ]);

  await db.insert(platformPosts).values([
    {
      id: fixtures.platformPosts.aInstagram,
      postId: fixtures.posts.a,
      connectedAccountId: fixtures.connectedAccounts.instagram,
      platformPostId: 'ig_post_a',
    },
    {
      id: fixtures.platformPosts.aTiktok,
      postId: fixtures.posts.a,
      connectedAccountId: fixtures.connectedAccounts.tiktok,
      platformPostId: 'tt_post_a',
    },
    {
      id: fixtures.platformPosts.bInstagram,
      postId: fixtures.posts.b,
      connectedAccountId: fixtures.connectedAccounts.instagram,
      platformPostId: 'ig_post_b',
    },
    {
      id: fixtures.platformPosts.otherInstagram,
      postId: fixtures.posts.other,
      connectedAccountId: fixtures.connectedAccounts.otherInstagram,
      platformPostId: 'ig_post_other',
    },
  ]);

  await db.insert(comments).values([
    // Post A — Instagram (top-level, third-party)
    {
      id: fixtures.comments.aIg1,
      platformPostId: fixtures.platformPosts.aInstagram,
      platformCommentId: 'ig_c_a1',
      authorPlatformHandle: 'ig_user_1',
      body: 'Love this!',
      sendStatus: 'sent',
      createdAt: iso(5),
    },
    {
      id: fixtures.comments.aIg2,
      platformPostId: fixtures.platformPosts.aInstagram,
      platformCommentId: 'ig_c_a2',
      authorPlatformHandle: 'ig_user_2',
      body: 'When is the next drop?',
      sendStatus: 'sent',
      createdAt: iso(10),
    },
    {
      id: fixtures.comments.aIg3,
      platformPostId: fixtures.platformPosts.aInstagram,
      platformCommentId: 'ig_c_a3',
      authorPlatformHandle: 'ig_user_3',
      body: 'Take my money 💸',
      sendStatus: 'sent',
      createdAt: iso(15),
    },
    {
      id: fixtures.comments.aIg4,
      platformPostId: fixtures.platformPosts.aInstagram,
      platformCommentId: 'ig_c_a4',
      authorPlatformHandle: 'ig_user_4',
      body: 'Shipping to EU?',
      sendStatus: 'sent',
      createdAt: iso(20),
    },
    // Post A — TikTok (top-level, third-party)
    {
      id: fixtures.comments.aTt1,
      platformPostId: fixtures.platformPosts.aTiktok,
      platformCommentId: 'tt_c_a1',
      authorPlatformHandle: 'tt_user_1',
      body: 'FYP moment',
      sendStatus: 'sent',
      createdAt: iso(6),
    },
    {
      id: fixtures.comments.aTt2,
      platformPostId: fixtures.platformPosts.aTiktok,
      platformCommentId: 'tt_c_a2',
      authorPlatformHandle: 'tt_user_2',
      body: 'Where can I buy?',
      sendStatus: 'sent',
      createdAt: iso(12),
    },
    {
      id: fixtures.comments.aTt3,
      platformPostId: fixtures.platformPosts.aTiktok,
      platformCommentId: 'tt_c_a3',
      authorPlatformHandle: 'tt_user_3',
      body: 'Duet incoming',
      sendStatus: 'sent',
      createdAt: iso(18),
    },
    // Post B — Instagram (top-level, third-party)
    {
      id: fixtures.comments.bIg1,
      platformPostId: fixtures.platformPosts.bInstagram,
      platformCommentId: 'ig_c_b1',
      authorPlatformHandle: 'ig_user_5',
      body: 'Sneak peek 👀',
      sendStatus: 'sent',
      createdAt: iso(35),
    },
    {
      id: fixtures.comments.bIg2,
      platformPostId: fixtures.platformPosts.bInstagram,
      platformCommentId: 'ig_c_b2',
      authorPlatformHandle: 'ig_user_6',
      body: 'Countdown started',
      sendStatus: 'sent',
      createdAt: iso(40),
    },
    {
      id: fixtures.comments.bIg3,
      platformPostId: fixtures.platformPosts.bInstagram,
      platformCommentId: 'ig_c_b3',
      authorPlatformHandle: 'ig_user_7',
      body: 'Sign me up',
      sendStatus: 'sent',
      createdAt: iso(45),
    },
    // Our replies
    {
      id: fixtures.comments.ourReplySent,
      platformPostId: fixtures.platformPosts.aInstagram,
      parentCommentId: fixtures.comments.aIg1,
      platformCommentId: 'ig_c_our1',
      authorUserId: fixtures.users.primary,
      authorPlatformHandle: 'primary_handle',
      body: 'Thanks so much!',
      sendStatus: 'sent',
      createdAt: iso(7),
    },
    {
      id: fixtures.comments.ourReplyPending,
      platformPostId: fixtures.platformPosts.aTiktok,
      parentCommentId: fixtures.comments.aTt2,
      platformCommentId: null,
      authorUserId: fixtures.users.primary,
      authorPlatformHandle: 'primary_handle',
      body: 'Link in bio!',
      sendStatus: 'pending',
      createdAt: iso(13),
    },
    // Nested third-party reply (proves parent_comment_id threading)
    {
      id: fixtures.comments.nestedThirdParty,
      platformPostId: fixtures.platformPosts.aInstagram,
      parentCommentId: fixtures.comments.aIg1,
      platformCommentId: 'ig_c_a1_reply',
      authorPlatformHandle: 'ig_user_8',
      body: '+1, agreed',
      sendStatus: 'sent',
      createdAt: iso(8),
    },
    // Other user's comment (ownership test)
    {
      id: fixtures.comments.otherUsersComment,
      platformPostId: fixtures.platformPosts.otherInstagram,
      platformCommentId: 'ig_c_other1',
      authorPlatformHandle: 'ig_user_stranger',
      body: 'not yours',
      sendStatus: 'sent',
      createdAt: iso(46),
    },
  ]);
}

const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('/seed.ts');

if (isDirectRun) {
  try {
    await seed();
    console.log('Seed complete.');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
