import type {
  CreateReplyBody,
  CreateReplyResponse,
} from '../../schemas/reply.js';
import { db } from '../../db/client.js';
import { comments } from '../../db/schema.js';
import { getParentComment } from '../../db/queries/comments.js';
import { NotFoundError } from '../../errors.js';
import type { HandlerContext } from '../types.js';

type CreateReplyInput = { parentCommentId: string } & CreateReplyBody;

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
