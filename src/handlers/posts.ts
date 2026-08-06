import type { Post, PostPage } from '../schemas/post.js';
import type { CommentPage } from '../schemas/comment.js';

const HARDCODED_POST_ID = '00000000-0000-4000-8000-000000000001';
const HARDCODED_PLATFORM_POST_ID = '00000000-0000-4000-8000-000000000002';

export async function list(_userId: string): Promise<PostPage> {
  return { data: [], next_cursor: null };
}

export async function get(_userId: string, id: string): Promise<Post> {
  return {
    id,
    body: 'hardcoded stub post',
    created_at: '2025-01-15T10:00:00Z',
  };
}

export async function listComments(
  _userId: string,
  _postId: string,
): Promise<CommentPage> {
  return { data: [], next_cursor: null };
}

export const stubIds = {
  postId: HARDCODED_POST_ID,
  platformPostId: HARDCODED_PLATFORM_POST_ID,
};
