import { and, eq } from 'drizzle-orm';
import type { Post } from '../../schemas/post.js';
import { db } from '../../db/client.js';
import { posts } from '../../db/schema.js';
import { NotFoundError } from '../../errors.js';
import type { HandlerContext } from '../types.js';
import { toPost } from '../mappers.js';

type GetPostInput = { postId: string };

export async function getPost(
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
