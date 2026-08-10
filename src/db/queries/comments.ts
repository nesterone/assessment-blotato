import { and, eq } from 'drizzle-orm';
import { db } from '../client.js';
import { comments, connectedAccounts, platformPosts } from '../schema.js';

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
