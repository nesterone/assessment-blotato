import { Type, type Static } from '@sinclair/typebox';

export const Post = Type.Object({
  id: Type.String({ format: 'uuid' }),
  body: Type.String(),
  created_at: Type.String({ format: 'date-time' }),
});
export type Post = Static<typeof Post>;

export const PostPage = Type.Object({
  data: Type.Array(Post),
  next_cursor: Type.Union([Type.String(), Type.Null()]),
});
export type PostPage = Static<typeof PostPage>;
