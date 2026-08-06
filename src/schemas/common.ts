import { Type, type Static } from '@sinclair/typebox';

export const Platform = Type.Union([
  Type.Literal('instagram'),
  Type.Literal('youtube'),
  Type.Literal('x'),
  Type.Literal('tiktok'),
  Type.Literal('facebook'),
]);
export type Platform = Static<typeof Platform>;

export const PaginationQuery = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(
    Type.Integer({ minimum: 1, maximum: 100, default: 50 }),
  ),
});
export type PaginationQuery = Static<typeof PaginationQuery>;

export const UuidParam = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type UuidParam = Static<typeof UuidParam>;

export const ErrorResponse = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    fields: Type.Optional(Type.Record(Type.String(), Type.String())),
  }),
});
export type ErrorResponse = Static<typeof ErrorResponse>;
