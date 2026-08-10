import { and, desc, eq, isNull, lt, or } from 'drizzle-orm';
import type { PaginationQuery } from '../schemas/common.js';
import type { Post, PostPage } from '../schemas/post.js';
import type { CommentPage } from '../schemas/comment.js';
import { db } from '../db/client.js';
import {
  comments,
  connectedAccounts,
  platformPosts,
  posts,
} from '../db/schema.js';
import { decodeCursor, paginate } from '../db/pagination.js';
import { NotFoundError } from '../errors.js';
import type { HandlerContext } from './types.js';
import { toPost, toComment } from './mappers.js';

const DEFAULT_LIMIT = 50;

type GetPostInput = { postId: string };
type ListCommentsInput = { postId: string } & PaginationQuery;

export async function list(
  input: PaginationQuery,
  ctx: HandlerContext,
): Promise<PostPage> {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const cursor = decodeCursor(input.cursor);

  const rows = await db
    .select({
      id: posts.id,
      body: posts.body,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(
      and(
        eq(posts.userId, ctx.userId),
        cursor
          ? or(
              lt(posts.createdAt, new Date(cursor.createdAt)),
              and(
                eq(posts.createdAt, new Date(cursor.createdAt)),
                lt(posts.id, cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit + 1);

  const page = paginate(rows, limit);
  return { data: page.rows.map(toPost), next_cursor: page.nextCursor };
}

export async function get(
  input: GetPostInput,
  ctx: HandlerContext,
): Promise<Post> {
  const [row] = await db
    .select({ id: posts.id, body: posts.body, createdAt: posts.createdAt })
    .from(posts)
    .where(and(eq(posts.id, input.postId), eq(posts.userId, ctx.userId)))
    .limit(1);

  if (!row) throw new NotFoundError('Post not found');
  return toPost(row);
}

export async function listComments(
  input: ListCommentsInput,
  ctx: HandlerContext,
): Promise<CommentPage> {
  const [owner] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, input.postId), eq(posts.userId, ctx.userId)))
    .limit(1);

  if (!owner) throw new NotFoundError('Post not found');

  const limit = input.limit ?? DEFAULT_LIMIT;
  const cursor = decodeCursor(input.cursor);

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
        eq(platformPosts.postId, input.postId),
        isNull(comments.parentCommentId),
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
