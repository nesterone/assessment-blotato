import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { PaginationQuery, UuidParam, ErrorResponse } from '../schemas/common.js';
import { Post, PostPage } from '../schemas/post.js';
import { CommentPage } from '../schemas/comment.js';
import * as handlers from '../handlers/posts.js';

const postsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    '/posts',
    {
      onRequest: [app.authenticate],
      schema: {
        querystring: PaginationQuery,
        response: {
          200: PostPage,
          401: ErrorResponse,
        },
      },
    },
    async (req) => handlers.list(req.userId),
  );

  app.get(
    '/posts/:id',
    {
      onRequest: [app.authenticate],
      schema: {
        params: UuidParam,
        response: {
          200: Post,
          401: ErrorResponse,
          404: ErrorResponse,
        },
      },
    },
    async (req) => handlers.get(req.userId, req.params.id),
  );

  app.get(
    '/posts/:id/comments',
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
    async (req) => handlers.listComments(req.userId, req.params.id),
  );
};

export default postsRoutes;
