import { Type, type Static } from '@sinclair/typebox';
import { Platform } from './common.js';

export const SendStatus = Type.Union([
  Type.Literal('pending'),
  Type.Literal('sent'),
  Type.Literal('failed'),
]);
export type SendStatus = Static<typeof SendStatus>;

export const Comment = Type.Object({
  id: Type.String({ format: 'uuid' }),
  platform_post_id: Type.String({ format: 'uuid' }),
  platform: Platform,
  author: Type.Object({
    handle: Type.String(),
    is_me: Type.Boolean(),
  }),
  body: Type.String(),
  created_at: Type.String({ format: 'date-time' }),
  send_status: Type.Optional(SendStatus),
  send_error: Type.Optional(Type.String()),
});
export type Comment = Static<typeof Comment>;

export const CommentPage = Type.Object({
  data: Type.Array(Comment),
  next_cursor: Type.Union([Type.String(), Type.Null()]),
});
export type CommentPage = Static<typeof CommentPage>;
