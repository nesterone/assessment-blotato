import { and, desc, eq, lt, or } from 'drizzle-orm';
import type { PaginationQuery } from '../schemas/common.js';
import type { CommentPage } from '../schemas/comment.js';
import type { CreateReplyBody, CreateReplyResponse } from '../schemas/reply.js';
import { db } from '../db/client.js';
import {
  comments,
  connectedAccounts,
  platformPosts,
} from '../db/schema.js';
import { decodeCursor, paginate } from '../db/pagination.js';
import { toComment } from './mappers.js';

const DEFAULT_LIMIT = 50;

async function loadOwnedComment(userId: string, commentId: string) {
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
    .where(and(eq(comments.id, commentId), eq(connectedAccounts.userId, userId)))
    .limit(1);
  return row;
}

export async function listReplies(
  userId: string,
  commentId: string,
  query: PaginationQuery,
  notFound: (msg: string) => Error,
): Promise<CommentPage> {
  const parent = await loadOwnedComment(userId, commentId);
  if (!parent) throw notFound('Comment not found');

  const limit = query.limit ?? DEFAULT_LIMIT;
  const cursor = decodeCursor(query.cursor);

  const rows = await db
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
    )
    .where(
      and(
        eq(comments.parentCommentId, commentId),
        cursor
          ? or(
              lt(comments.createdAt, new Date(cursor.createdAt)),
              and(
                eq(comments.createdAt, new Date(cursor.createdAt)),
                lt(comments.id, cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(comments.createdAt), desc(comments.id))
    .limit(limit + 1);

  const page = paginate(rows, limit);
  return { data: page.rows.map(toComment), next_cursor: page.nextCursor };
}

export async function createReply(
  userId: string,
  commentId: string,
  body: CreateReplyBody,
  notFound: (msg: string) => Error,
): Promise<CreateReplyResponse> {
  const parent = await loadOwnedComment(userId, commentId);
  if (!parent) throw notFound('Comment not found');

  const [inserted] = await db
    .insert(comments)
    .values({
      platformPostId: parent.platformPostId,
      parentCommentId: commentId,
      platformCommentId: null,
      authorUserId: userId,
      authorPlatformHandle: parent.authorPlatformHandle,
      body: body.body,
      sendStatus: 'pending',
    })
    .returning({ id: comments.id });

  return { id: inserted!.id };
}
