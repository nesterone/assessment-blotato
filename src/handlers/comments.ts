import { and, desc, eq } from 'drizzle-orm';
import type { PaginationQuery } from '../schemas/common.js';
import type { CommentPage } from '../schemas/comment.js';
import type { CreateReplyBody, CreateReplyResponse } from '../schemas/reply.js';
import { db } from '../db/client.js';
import { comments } from '../db/schema.js';
import {
  DEFAULT_LIMIT,
  afterCursor,
  decodeCursor,
  paginate,
} from '../db/pagination.js';
import {
  commentsWithPlatform,
  getParentComment,
} from '../db/queries/comments.js';
import { NotFoundError } from '../errors.js';
import type { HandlerContext } from './types.js';
import { toComment } from './mappers.js';

type ListRepliesInput = { parentCommentId: string } & PaginationQuery;
type CreateReplyInput = { parentCommentId: string } & CreateReplyBody;

export async function listReplies(
  input: ListRepliesInput,
  ctx: HandlerContext,
): Promise<CommentPage> {
  const parent = await getParentComment(ctx.userId, input.parentCommentId);
  if (!parent) throw new NotFoundError('Comment not found');

  const limit = input.limit ?? DEFAULT_LIMIT;
  const cursor = decodeCursor(input.cursor);

  const rows = await commentsWithPlatform()
    .where(
      and(
        eq(comments.parentCommentId, input.parentCommentId),
        afterCursor(comments.createdAt, comments.id, cursor),
      ),
    )
    .orderBy(desc(comments.createdAt), desc(comments.id))
    .limit(limit + 1);

  const page = paginate(rows, limit);
  return { data: page.rows.map(toComment), next_cursor: page.nextCursor };
}

export async function createReply(
  input: CreateReplyInput,
  ctx: HandlerContext,
): Promise<CreateReplyResponse> {
  const parent = await getParentComment(ctx.userId, input.parentCommentId);
  if (!parent) throw new NotFoundError('Comment not found');

  const [inserted] = await db
    .insert(comments)
    .values({
      platformPostId: parent.platformPostId,
      parentCommentId: input.parentCommentId,
      platformCommentId: null,
      authorUserId: ctx.userId,
      authorPlatformHandle: parent.authorPlatformHandle,
      body: input.body,
      sendStatus: 'pending',
    })
    .returning({ id: comments.id });

  return { id: inserted!.id };
}
