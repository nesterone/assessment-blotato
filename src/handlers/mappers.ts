import type { Comment } from '../schemas/comment.js';
import type { Post } from '../schemas/post.js';
import type { Platform } from '../schemas/common.js';

type PostRow = {
  id: string;
  body: string;
  createdAt: Date;
};

export function toPost(row: PostRow): Post {
  return {
    id: row.id,
    body: row.body,
    created_at: row.createdAt.toISOString(),
  };
}

type CommentRow = {
  id: string;
  platformPostId: string;
  platform: string;
  authorUserId: string | null;
  authorPlatformHandle: string;
  body: string;
  sendStatus: string;
  sendError: string | null;
  createdAt: Date;
};

export function toComment(row: CommentRow): Comment {
  const isMe = row.authorUserId !== null;
  const out: Comment = {
    id: row.id,
    platform_post_id: row.platformPostId,
    platform: row.platform as Platform,
    author: {
      handle: row.authorPlatformHandle,
      is_me: isMe,
    },
    body: row.body,
    created_at: row.createdAt.toISOString(),
  };
  if (isMe) {
    out.send_status = row.sendStatus as Comment['send_status'];
    if (row.sendStatus === 'failed' && row.sendError) {
      out.send_error = row.sendError;
    }
  }
  return out;
}
