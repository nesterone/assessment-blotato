import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { PaginationQuery, UuidParam, ErrorResponse } from '../schemas/common.js';
import { CommentPage } from '../schemas/comment.js';
import { CreateReplyBody, CreateReplyResponse } from '../schemas/reply.js';
import * as handlers from '../handlers/comments.js';

const commentsRoutes: FastifyPluginAsyncTypebox = async (app) => {
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
      handlers.listReplies(
        { parentCommentId: req.params.id, ...req.query },
        { userId: req.userId },
      ),
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
        { parentCommentId: req.params.id, ...req.body },
        { userId: req.userId },
      );
      reply.code(202);
      return result;
    },
  );
};

export default commentsRoutes;
