import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { PaginationQuery, UuidParam, ErrorResponse } from '../schemas/common.js';
import { CommentPage } from '../schemas/comment.js';
import { CreateReplyBody, CreateReplyResponse } from '../schemas/reply.js';
import * as handlers from '../handlers/comments.js';

const commentsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const notFound = (msg: string) => app.httpErrors.notFound(msg);

  app.get(
    '/comments/:id/replies',
    {
      onRequest: [app.authenticate],
      schema: {
        params: UuidParam,
        querystring: PaginationQuery,
        response: {
          200: CommentPage,
          401: ErrorResponse,
          404: ErrorResponse,
        },
      },
    },
    async (req) =>
      handlers.listReplies(req.userId, req.params.id, req.query, notFound),
  );

  app.post(
    '/comments/:id/replies',
    {
      onRequest: [app.authenticate],
      schema: {
        params: UuidParam,
        body: CreateReplyBody,
        response: {
          202: CreateReplyResponse,
          400: ErrorResponse,
          401: ErrorResponse,
          404: ErrorResponse,
        },
      },
    },
    async (req, reply) => {
      const result = await handlers.createReply(
        req.userId,
        req.params.id,
        req.body,
        notFound,
      );
      reply.code(202);
      return result;
    },
  );
};

export default commentsRoutes;
