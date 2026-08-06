import { randomUUID } from 'node:crypto';
import type { CommentPage } from '../schemas/comment.js';
import type { CreateReplyBody, CreateReplyResponse } from '../schemas/reply.js';

export async function listReplies(
  _userId: string,
  _commentId: string,
): Promise<CommentPage> {
  return { data: [], next_cursor: null };
}

export async function createReply(
  _userId: string,
  _commentId: string,
  _body: CreateReplyBody,
): Promise<CreateReplyResponse> {
  return { id: randomUUID() };
}
