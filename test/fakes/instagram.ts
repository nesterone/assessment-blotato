import type { FastifyInstance, FastifyReply } from 'fastify';
import type { FakeStore, StoredComment } from './store.js';

/**
 * Answers the way the Instagram Graph API answers: failure is an HTTP error
 * status with a numeric `code` in the body. Trigger words in the target id
 * (`ratelimit`) and access token (`expired`) drive the error branches so the
 * contract suite can reach each one deterministically.
 */
export function instagramFake(store: FakeStore) {
  return async (app: FastifyInstance) => {
    app.post<{ Params: { commentId: string }; Querystring: Query }>(
      '/:commentId/replies',
      async (req, reply) => {
        if (authExpired(req.query.access_token)) return oauthExpired(reply);
        const parentId = req.params.commentId;
        if (parentId.includes('ratelimit')) return rateLimited(reply);
        if (parentId.includes('flaky') && store.recordAttempt(parentId) === 1) {
          return rateLimited(reply);
        }
        const parent = store.get(parentId);
        if (!parent) {
          return reject(reply, 'does not resolve to a valid comment');
        }
        const created = store.addReply({
          platformPostId: parent.platformPostId,
          parentPlatformCommentId: parentId,
          authorHandle: 'primary_handle',
          body: req.query.message ?? '',
          idPrefix: 'ig',
        });
        return { id: created.platformCommentId };
      },
    );

    app.get<{ Params: { mediaId: string }; Querystring: Query }>(
      '/:mediaId/comments',
      async (req, reply) => {
        if (authExpired(req.query.access_token)) return oauthExpired(reply);
        const mediaId = req.params.mediaId;
        if (mediaId.includes('ratelimit')) return rateLimited(reply);
        if (mediaId.includes('flaky') && store.recordAttempt(mediaId) === 1) {
          return rateLimited(reply);
        }
        return list(store.topLevel(mediaId, req.query.after ?? null));
      },
    );

    app.get<{ Params: { commentId: string }; Querystring: Query }>(
      '/:commentId/replies',
      async (req, reply) => {
        if (authExpired(req.query.access_token)) return oauthExpired(reply);
        if (req.params.commentId.includes('ratelimit')) {
          return rateLimited(reply);
        }
        return list(
          store.replies(req.params.commentId, req.query.after ?? null),
        );
      },
    );
  };
}

type Query = {
  access_token?: string;
  message?: string;
  after?: string;
  fields?: string;
};

const authExpired = (token?: string) => !!token && token.includes('expired');

function dto(c: StoredComment) {
  return {
    id: c.platformCommentId,
    text: c.body,
    username: c.authorHandle,
    timestamp: c.createdAt.toISOString(),
    ...(c.parentPlatformCommentId
      ? { parent_id: c.parentPlatformCommentId }
      : {}),
  };
}

function list(page: { items: StoredComment[]; nextCursor: string | null }) {
  return {
    data: page.items.map(dto),
    paging: page.nextCursor
      ? {
          cursors: { after: page.nextCursor },
          next: `?after=${page.nextCursor}`,
        }
      : { cursors: {} },
  };
}

function oauthExpired(reply: FastifyReply) {
  return reply.code(401).send({
    error: {
      message: 'Error validating access token: session has expired',
      type: 'OAuthException',
      code: 190,
    },
  });
}

function rateLimited(reply: FastifyReply) {
  return reply
    .code(429)
    .header('retry-after', '1')
    .send({
      error: {
        message: 'Application request limit reached',
        type: 'OAuthException',
        code: 4,
      },
    });
}

function reject(reply: FastifyReply, message: string) {
  return reply.code(400).send({
    error: { message, type: 'GraphMethodException', code: 100 },
  });
}
