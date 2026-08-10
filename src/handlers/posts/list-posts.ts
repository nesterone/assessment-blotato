import { and, desc, eq } from 'drizzle-orm';
import type { PaginationQuery } from '../../schemas/common.js';
import type { PostPage } from '../../schemas/post.js';
import { db } from '../../db/client.js';
import { posts } from '../../db/schema.js';
import {
  DEFAULT_LIMIT,
  afterCursor,
  decodeCursor,
  paginate,
} from '../../db/pagination.js';
import type { HandlerContext } from '../types.js';
import { toPost } from '../mappers.js';

export async function listPosts(
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
        afterCursor(posts.createdAt, posts.id, cursor),
      ),
    )
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit + 1);

  const page = paginate(rows, limit);
  return { data: page.rows.map(toPost), next_cursor: page.nextCursor };
}
