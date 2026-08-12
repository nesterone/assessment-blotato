import {
  advanceSyncCursor,
  commentUuidByPlatformId,
  platformPostsToSync,
  upsertPlatformComment,
  type SyncTarget,
} from '../db/queries/comments.js';
import { clientFor } from '../platforms/registry.js';
import { PlatformRetryable, type PlatformClient } from '../platforms/types.js';
import type { ConnectedAccount, PlatformComment } from '../platforms/types.js';

/**
 * Pulls comments in from the platforms. Both platforms poll here; Instagram
 * would also receive webhooks (out of scope, ADR-0006), with this poll as the
 * safety net for dropped deliveries.
 */
export class SyncWorker {
  async tick(platform: string): Promise<void> {
    const targets = await platformPostsToSync(platform);
    const client = clientFor(platform);
    for (const target of targets) {
      try {
        await this.syncPost(client, target);
      } catch (err) {
        // A retryable failure leaves the cursor where it was, so the next tick
        // refetches from the same point. Anything else is isolated to this post.
        if (!(err instanceof PlatformRetryable)) throw err;
      }
    }
  }

  private async syncPost(
    client: PlatformClient,
    target: SyncTarget,
  ): Promise<void> {
    const account = toAccount(target);
    let cursor = target.syncCursor;
    let fetched = 0;

    for (;;) {
      const page = await client.listComments(
        { platformPostId: target.platformPostId, cursor },
        account,
      );
      for (const comment of page.comments) {
        await upsertPlatformComment(row(target.id, null, comment));
        fetched += 1;
        await this.syncReplies(client, target, account, comment.platformCommentId);
      }
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }

    // The cursor is a high-water mark over the fake's offset paging: advance it
    // by the count consumed so the next tick starts past what we've seen.
    const advanced = String(Number(target.syncCursor ?? 0) + fetched);
    await advanceSyncCursor(target.id, advanced);
  }

  private async syncReplies(
    client: PlatformClient,
    target: SyncTarget,
    account: ConnectedAccount,
    parentPlatformCommentId: string,
  ): Promise<void> {
    const parentCommentId = await commentUuidByPlatformId(
      target.id,
      parentPlatformCommentId,
    );
    if (!parentCommentId) return;

    let cursor: string | null = null;
    for (;;) {
      const page = await client.listReplies(
        { platformPostId: target.platformPostId, parentPlatformCommentId, cursor },
        account,
      );
      for (const reply of page.comments) {
        await upsertPlatformComment(row(target.id, parentCommentId, reply));
      }
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
  }
}

function row(
  platformPostId: string,
  parentCommentId: string | null,
  comment: PlatformComment,
) {
  return {
    platformPostId,
    parentCommentId,
    platformCommentId: comment.platformCommentId,
    authorPlatformHandle: comment.authorHandle,
    body: comment.body,
    createdAt: comment.createdAt,
  };
}

function toAccount(target: SyncTarget): ConnectedAccount {
  return {
    accessToken: target.accessToken,
    refreshToken: target.refreshToken,
    tokenExpiresAt: target.tokenExpiresAt,
    platformAccountId: target.platformAccountId,
  };
}
