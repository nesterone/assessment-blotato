import { Type, type Static } from '@sinclair/typebox';

export const CreateReplyBody = Type.Object({
  body: Type.String({ minLength: 1, maxLength: 2000 }),
});
export type CreateReplyBody = Static<typeof CreateReplyBody>;

export const CreateReplyResponse = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type CreateReplyResponse = Static<typeof CreateReplyResponse>;
