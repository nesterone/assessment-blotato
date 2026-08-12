import { and, eq, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { comments, connectedAccounts, platformPosts } from '../schema.js';

export function commentsWithPlatform() {
  return db
    .select({
      id: comments.id,
      platformPostId: comments.platformPostId,
      platform: connectedAccounts.platform,
      authorUserId: comments.authorUserId,
      authorPlatformHandle: comments.authorPlatformHandle,
      body: comments.body,
      sendStatus: comments.sendStatus,
      sendError: comments.sendError,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .innerJoin(platformPosts, eq(comments.platformPostId, platformPosts.id))
    .innerJoin(
      connectedAccounts,
      eq(platformPosts.connectedAccountId, connectedAccounts.id),
    );
}

export async function getParentComment(userId: string, commentId: string) {
  const [row] = await db
    .select({
      id: comments.id,
      platformPostId: comments.platformPostId,
      authorPlatformHandle: connectedAccounts.handle,
    })
    .from(comments)
    .innerJoin(platformPosts, eq(comments.platformPostId, platformPosts.id))
    .innerJoin(
      connectedAccounts,
      eq(platformPosts.connectedAccountId, connectedAccounts.id),
    )
    .where(
      and(eq(connectedAccounts.userId, userId), eq(comments.id, commentId)),
    )
    .limit(1);
  return row;
}

export type SendableReply = {
  id: string;
  body: string;
  sendStatus: string;
  attemptCount: number;
  platform: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  platformAccountId: string;
  platformPostId: string;
  parentPlatformCommentId: string | null;
  rootPlatformCommentId: string | null;
};

/**
 * Leases a batch of due pending replies: `SKIP LOCKED` so parallel sweeps never
 * grab the same row, and pushing `next_attempt_at` forward so a crash between
 * claim and write-back frees the row again once the lease lapses. The network
 * call happens outside this lock — `processOne` reloads by id.
 */
export async function claimPendingReplies(limit: number): Promise<string[]> {
  const claimed = await db.execute<{ id: string }>(sql`
    UPDATE comments SET next_attempt_at = now() + interval '30 seconds'
    WHERE id IN (
      SELECT id FROM comments
      WHERE send_status = 'pending'
        AND (next_attempt_at IS NULL OR next_attempt_at <= now())
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING id
  `);
  return claimed.rows.map((r) => r.id);
}

/**
 * Everything the sender needs for one reply. `rootPlatformCommentId` climbs one
 * level past the direct parent (threading tops out at two levels), so TikTok —
 * which only accepts a top-level comment as a reply parent — can attach to the
 * thread root while Instagram uses the direct parent.
 */
export async function loadSendable(id: string): Promise<SendableReply | null> {
  const result = await db.execute<SendableReply>(sql`
    SELECT
      c.id,
      c.body,
      c.send_status AS "sendStatus",
      c.attempt_count AS "attemptCount",
      ca.platform,
      ca.access_token AS "accessToken",
      ca.refresh_token AS "refreshToken",
      ca.token_expires_at AS "tokenExpiresAt",
      ca.platform_account_id AS "platformAccountId",
      pp.platform_post_id AS "platformPostId",
      parent.platform_comment_id AS "parentPlatformCommentId",
      COALESCE(grandparent.platform_comment_id, parent.platform_comment_id)
        AS "rootPlatformCommentId"
    FROM comments c
    JOIN platform_posts pp ON pp.id = c.platform_post_id
    JOIN connected_accounts ca ON ca.id = pp.connected_account_id
    LEFT JOIN comments parent ON parent.id = c.parent_comment_id
    LEFT JOIN comments grandparent ON grandparent.id = parent.parent_comment_id
    WHERE c.id = ${id}
    LIMIT 1
  `);
  return result.rows[0] ?? null;
}

export type SyncTarget = {
  id: string;
  platformPostId: string;
  syncCursor: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  platformAccountId: string;
};

/** Every platform post on `platform`, across all accounts, with its cursor. */
export async function platformPostsToSync(
  platform: string,
): Promise<SyncTarget[]> {
  const result = await db.execute<SyncTarget>(sql`
    SELECT
      pp.id,
      pp.platform_post_id AS "platformPostId",
      pp.sync_cursor AS "syncCursor",
      ca.access_token AS "accessToken",
      ca.refresh_token AS "refreshToken",
      ca.token_expires_at AS "tokenExpiresAt",
      ca.platform_account_id AS "platformAccountId"
    FROM platform_posts pp
    JOIN connected_accounts ca ON ca.id = pp.connected_account_id
    WHERE ca.platform = ${platform}
    ORDER BY pp.id
  `);
  return result.rows;
}

/**
 * `DO NOTHING` on the `(platform_post_id, platform_comment_id)` unique index is
 * what makes re-polling safe: a comment already stored — including our own sent
 * reply polled back — is left untouched rather than duplicated or clobbered.
 */
export async function upsertPlatformComment(input: {
  platformPostId: string;
  parentCommentId: string | null;
  platformCommentId: string;
  authorPlatformHandle: string;
  body: string;
  createdAt: Date;
}): Promise<void> {
  await db.execute(sql`
    INSERT INTO comments
      (platform_post_id, parent_comment_id, platform_comment_id,
       author_platform_handle, body, send_status, created_at, synced_at)
    VALUES
      (${input.platformPostId}, ${input.parentCommentId},
       ${input.platformCommentId}, ${input.authorPlatformHandle},
       ${input.body}, 'sent', ${input.createdAt}, now())
    ON CONFLICT (platform_post_id, platform_comment_id) DO NOTHING
  `);
}

export async function commentUuidByPlatformId(
  platformPostId: string,
  platformCommentId: string,
): Promise<string | null> {
  const result = await db.execute<{ id: string }>(sql`
    SELECT id FROM comments
    WHERE platform_post_id = ${platformPostId}
      AND platform_comment_id = ${platformCommentId}
    LIMIT 1
  `);
  return result.rows[0]?.id ?? null;
}

export async function advanceSyncCursor(
  platformPostId: string,
  cursor: string,
): Promise<void> {
  await db.execute(sql`
    UPDATE platform_posts
    SET sync_cursor = ${cursor}, last_polled_at = now()
    WHERE id = ${platformPostId}
  `);
}
