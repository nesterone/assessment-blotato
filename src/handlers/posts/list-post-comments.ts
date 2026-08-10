import { and, desc, eq, isNull } from 'drizzle-orm';
import type { PaginationQuery } from '../../schemas/common.js';
import type { CommentPage } from '../../schemas/comment.js';
import { db } from '../../db/client.js';
import { comments, platformPosts, posts } from '../../db/schema.js';
import {
  DEFAULT_LIMIT,
  afterCursor,
  decodeCursor,
  paginate,
} from '../../db/pagination.js';
import { commentsWithPlatform } from '../../db/queries/comments.js';
import { NotFoundError } from '../../errors.js';
import type { HandlerContext } from '../types.js';
import { toComment } from '../mappers.js';

type ListPostCommentsInput = { postId: string } & PaginationQuery;

export async function listPostComments(
  input: ListPostCommentsInput,
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

  const rows = await commentsWithPlatform()
    .where(
      and(
        eq(platformPosts.postId, input.postId),
        isNull(comments.parentCommentId),
        afterCursor(comments.createdAt, comments.id, cursor),
      ),
    )
    .orderBy(desc(comments.createdAt), desc(comments.id))
    .limit(limit + 1);

  const page = paginate(rows, limit);
  return { data: page.rows.map(toComment), next_cursor: page.nextCursor };
}
