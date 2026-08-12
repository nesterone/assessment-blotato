import { randomUUID } from 'node:crypto';
import { pool } from '../../src/db/client.js';
import { fixtures } from '../../src/db/fixtures.js';

/** A sent top-level comment the reply can point its `parent_comment_id` at. */
export async function insertParent(
  platformPostId: string,
  platformCommentId: string,
): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO comments
       (id, platform_post_id, platform_comment_id, author_platform_handle, body, send_status)
     VALUES ($1, $2, $3, 'someone', 'parent', 'sent')`,
    [id, platformPostId, platformCommentId],
  );
  return id;
}

export async function insertPendingReply(input: {
  platformPostId: string;
  parentCommentId: string;
  attemptCount?: number;
}): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO comments
       (id, platform_post_id, parent_comment_id, platform_comment_id,
        author_user_id, author_platform_handle, body, send_status, attempt_count)
     VALUES ($1, $2, $3, NULL, $4, 'primary_handle', 'my reply', 'pending', $5)`,
    [
      id,
      input.platformPostId,
      input.parentCommentId,
      fixtures.users.primary,
      input.attemptCount ?? 0,
    ],
  );
  return id;
}

/** A platform post on a platform we haven't integrated (YouTube). */
export async function insertUnsupportedPlatformPost(): Promise<{
  platformPostId: string;
  parentCommentId: string;
}> {
  const accountId = randomUUID();
  const platformPostId = randomUUID();
  await pool.query(
    `INSERT INTO connected_accounts
       (id, user_id, platform, platform_account_id, handle, access_token)
     VALUES ($1, $2, 'youtube', 'yt_acct', 'yt_handle', 'yt_token')`,
    [accountId, fixtures.users.primary],
  );
  await pool.query(
    `INSERT INTO platform_posts (id, post_id, connected_account_id, platform_post_id)
     VALUES ($1, $2, $3, 'yt_post_a')`,
    [platformPostId, fixtures.posts.a, accountId],
  );
  const parentCommentId = await insertParent(platformPostId, 'yt_c_a1');
  return { platformPostId, parentCommentId };
}

export async function loadReplyRow(id: string): Promise<{
  send_status: string;
  send_error: string | null;
  platform_comment_id: string | null;
  attempt_count: number;
  next_attempt_at: Date | null;
}> {
  const { rows } = await pool.query(
    `SELECT send_status, send_error, platform_comment_id, attempt_count, next_attempt_at
     FROM comments WHERE id = $1`,
    [id],
  );
  return rows[0];
}

export async function rewindNextAttempt(id: string): Promise<void> {
  await pool.query(
    `UPDATE comments SET next_attempt_at = now() - interval '1 minute' WHERE id = $1`,
    [id],
  );
}

export async function setAccessToken(
  connectedAccountId: string,
  token: string,
): Promise<void> {
  await pool.query(
    `UPDATE connected_accounts SET access_token = $2 WHERE id = $1`,
    [connectedAccountId, token],
  );
}
