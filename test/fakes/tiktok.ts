import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { FakeStore, StoredComment } from './store.js';

/**
 * Answers the way the TikTok API answers: `200 OK` for everything, with the
 * real outcome in `error.code` (`"ok"` on success). This is the quirk the
 * whole HTTP-fake decision exists to cover — an in-memory fake could not force
 * an adapter to read a body field instead of the status.
 */
export function tiktokFake(store: FakeStore) {
  return async (app: FastifyInstance) => {
    app.post<{ Body: ReplyBody }>('/v2/comment/reply/', async (req, reply) => {
      if (authExpired(req)) return authError(reply);
      const parentId = req.body.comment_id;
      if (parentId.includes('ratelimit')) return rateLimited(reply);
      if (parentId.includes('flaky') && store.recordAttempt(parentId) === 1) {
        return rateLimited(reply);
      }
      if (!store.has(parentId)) {
        return rejected(reply, 'comment_id not found');
      }
      const created = store.addReply({
        platformPostId: req.body.video_id,
        parentPlatformCommentId: parentId,
        authorHandle: 'primary_handle',
        body: req.body.text,
        idPrefix: 'tt',
      });
      return ok({ comment_id: created.platformCommentId });
    });

    app.post<{ Body: ListBody }>(
      '/v2/video/comment/list/',
      async (req, reply) => {
        if (authExpired(req)) return authError(reply);
        if (req.body.video_id.includes('ratelimit')) return rateLimited(reply);
        return ok(page(store.topLevel(req.body.video_id, cursor(req.body))));
      },
    );

    app.post<{ Body: ListBody }>(
      '/v2/video/comment/reply/list/',
      async (req, reply) => {
        if (authExpired(req)) return authError(reply);
        if (req.body.comment_id!.includes('ratelimit')) {
          return rateLimited(reply);
        }
        return ok(page(store.replies(req.body.comment_id!, cursor(req.body))));
      },
    );
  };
}

type ReplyBody = { video_id: string; comment_id: string; text: string };
type ListBody = { video_id: string; comment_id?: string; cursor?: number };

const cursor = (body: ListBody) => (body.cursor ? String(body.cursor) : null);

function authExpired(req: FastifyRequest): boolean {
  const token = (req.headers.authorization ?? '').replace(/^Bearer /i, '');
  return token.includes('expired');
}

function dto(c: StoredComment) {
  return {
    comment_id: c.platformCommentId,
    text: c.body,
    username: c.authorHandle,
    create_time: Math.floor(c.createdAt.getTime() / 1000),
    ...(c.parentPlatformCommentId
      ? { parent_comment_id: c.parentPlatformCommentId }
      : {}),
  };
}

function page(p: { items: StoredComment[]; nextCursor: string | null }) {
  return {
    comments: p.items.map(dto),
    cursor: Number(p.nextCursor ?? 0),
    has_more: p.nextCursor !== null,
  };
}

function ok(data: Record<string, unknown>) {
  return { data, error: { code: 'ok', message: '', log_id: 'fake' } };
}

function authError(reply: FastifyReply) {
  return reply.code(200).send({
    data: {},
    error: {
      code: 'access_token_expired',
      message: 'The access token has expired',
      log_id: 'fake',
    },
  });
}

function rateLimited(reply: FastifyReply) {
  return reply
    .code(200)
    .header('retry-after', '1')
    .send({
      data: {},
      error: {
        code: 'rate_limit_exceeded',
        message: 'Too many requests',
        log_id: 'fake',
      },
    });
}

function rejected(reply: FastifyReply, message: string) {
  return reply.code(200).send({
    data: {},
    error: { code: 'invalid_params', message, log_id: 'fake' },
  });
}
