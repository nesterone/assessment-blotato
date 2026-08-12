import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { comments } from '../db/schema.js';
import {
  claimPendingReplies,
  loadSendable,
  type SendableReply,
} from '../db/queries/comments.js';
import { clientFor } from '../platforms/registry.js';
import {
  PlatformAuthExpired,
  PlatformRejected,
  PlatformRetryable,
} from '../platforms/types.js';

const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 60_000;
const BATCH_SIZE = 20;

/**
 * Forwards pending replies to the platforms. Plain object with `.processOne()` /
 * `.drainAll()`; scheduling is a deployment concern wired in `src/index.ts`.
 */
export class SenderWorker {
  async drainAll(): Promise<void> {
    const ids = await claimPendingReplies(BATCH_SIZE);
    for (const id of ids) {
      await this.processOne(id);
    }
  }

  async processOne(id: string): Promise<void> {
    const row = await loadSendable(id);
    if (!row || row.sendStatus !== 'pending') return;

    try {
      const client = clientFor(row.platform);
      const { platformCommentId } = await client.postReply(
        {
          platformPostId: row.platformPostId,
          parentPlatformCommentId: this.replyParent(row),
          body: row.body,
        },
        {
          accessToken: row.accessToken,
          refreshToken: row.refreshToken,
          tokenExpiresAt: row.tokenExpiresAt,
          platformAccountId: row.platformAccountId,
        },
      );
      await this.markSent(id, platformCommentId);
    } catch (err) {
      await this.handleFailure(row, err);
    }
  }

  /** TikTok only accepts a top-level parent, so it attaches to the thread root. */
  private replyParent(row: SendableReply): string {
    const parent =
      row.platform === 'tiktok'
        ? row.rootPlatformCommentId
        : row.parentPlatformCommentId;
    if (!parent) {
      throw new PlatformRejected('parent comment has no platform id yet');
    }
    return parent;
  }

  private async handleFailure(row: SendableReply, err: unknown): Promise<void> {
    if (err instanceof PlatformRejected) {
      return this.markFailed(row.id, err.message);
    }
    if (err instanceof PlatformAuthExpired) {
      // Waiting won't fix a dead token, but the reply isn't at fault either:
      // hold it pending for a reconnect rather than burning it to `failed`.
      return this.hold(row.id, err.message);
    }

    const attempts = row.attemptCount + 1;
    const message = err instanceof Error ? err.message : String(err);
    if (attempts >= MAX_ATTEMPTS) {
      return this.markFailed(row.id, message);
    }
    const backoff =
      err instanceof PlatformRetryable && err.retryAfterMs
        ? err.retryAfterMs
        : RETRY_BASE_MS * attempts;
    await db
      .update(comments)
      .set({
        attemptCount: attempts,
        sendError: message,
        nextAttemptAt: new Date(Date.now() + backoff),
      })
      .where(eq(comments.id, row.id));
  }

  private async markSent(id: string, platformCommentId: string): Promise<void> {
    await db
      .update(comments)
      .set({
        sendStatus: 'sent',
        platformCommentId,
        sendError: null,
        nextAttemptAt: null,
      })
      .where(eq(comments.id, id));
  }

  private async markFailed(id: string, message: string): Promise<void> {
    await db
      .update(comments)
      .set({ sendStatus: 'failed', sendError: message, nextAttemptAt: null })
      .where(eq(comments.id, id));
  }

  private async hold(id: string, message: string): Promise<void> {
    await db
      .update(comments)
      .set({
        sendError: message,
        nextAttemptAt: new Date(Date.now() + RETRY_BASE_MS),
      })
      .where(eq(comments.id, id));
  }
}
