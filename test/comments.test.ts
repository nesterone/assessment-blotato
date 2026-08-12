import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';
import { pool } from '../src/db/client.js';
import { fixtures } from '../src/db/fixtures.js';
import { resetDb } from './helpers/db.js';
import { startFakes, type Fakes } from './helpers/fakes.js';
import { SenderWorker } from '../src/workers/sender.js';

const API_KEY = process.env.TEST_API_KEY!;
const AUTH = { authorization: `Bearer ${API_KEY}` };
const OTHER_USERS_COMMENT = fixtures.comments.otherUsersComment;
const NESTED_PARENT = fixtures.comments.aIg1;
const UNKNOWN_UUID = '99999999-9999-4999-8999-999999999999';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('comments routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('reply round-trip through the sender', () => {
    let fakes: Fakes;
    const sender = new SenderWorker();

    beforeAll(async () => {
      fakes = await startFakes();
    });

    afterAll(async () => {
      await fakes.close();
    });

    beforeEach(() => {
      fakes.store.reset();
    });

    it('POST reply → drainAll → GET shows send_status "sent"', async () => {
      fakes.store.seedComment({
        platformCommentId: 'ig_c_a1',
        platformPostId: 'ig_post_a',
        authorHandle: 'u',
        body: 'parent',
      });

      const posted = await app.inject({
        method: 'POST',
        url: `/comments/${NESTED_PARENT}/replies`,
        headers: AUTH,
        payload: { body: 'thanks!' },
      });
      const replyId = posted.json().id;

      await sender.drainAll();

      const res = await app.inject({
        method: 'GET',
        url: `/comments/${NESTED_PARENT}/replies`,
        headers: AUTH,
      });
      const reply = res
        .json()
        .data.find((c: { id: string }) => c.id === replyId);
      expect(reply.send_status).toBe('sent');
    });

    it('POST reply the platform rejects → GET shows "failed" + send_error', async () => {
      const posted = await app.inject({
        method: 'POST',
        url: `/comments/${NESTED_PARENT}/replies`,
        headers: AUTH,
        payload: { body: 'nope' },
      });
      const replyId = posted.json().id;

      await sender.drainAll();

      const res = await app.inject({
        method: 'GET',
        url: `/comments/${NESTED_PARENT}/replies`,
        headers: AUTH,
      });
      const reply = res
        .json()
        .data.find((c: { id: string }) => c.id === replyId);
      expect(reply.send_status).toBe('failed');
      expect(reply.send_error).toBeTruthy();
    });
  });

  describe('GET /comments/:id/replies', () => {
    it('401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/comments/${NESTED_PARENT}/replies`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('401 for revoked api key', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/comments/${NESTED_PARENT}/replies`,
        headers: { authorization: `Bearer ${API_KEY}_revoked` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('400 when id is not a uuid', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/comments/not-a-uuid/replies',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('validation_error');
    });

    it('404 for other user comment', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/comments/${OTHER_USERS_COMMENT}/replies`,
        headers: AUTH,
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('not_found');
    });

    it('404 for unknown comment', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/comments/${UNKNOWN_UUID}/replies`,
        headers: AUTH,
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns replies (our sent reply + third-party nested reply)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/comments/${NESTED_PARENT}/replies`,
        headers: AUTH,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.next_cursor).toBeNull();
      expect(body.data).toHaveLength(2);
      const ids = body.data.map((c: { id: string }) => c.id);
      expect(ids).toContain(fixtures.comments.ourReplySent);
      expect(ids).toContain(fixtures.comments.nestedThirdParty);

      const ours = body.data.find(
        (c: { id: string }) => c.id === fixtures.comments.ourReplySent,
      );
      expect(ours.author.is_me).toBe(true);
      expect(ours.author.handle).toBe('primary_handle');
      expect(ours.send_status).toBe('sent');
      expect(ours.send_error).toBeUndefined();

      const third = body.data.find(
        (c: { id: string }) => c.id === fixtures.comments.nestedThirdParty,
      );
      expect(third.author.is_me).toBe(false);
      expect(third.send_status).toBeUndefined();
    });
  });

  describe('POST /comments/:id/replies', () => {
    it('401 without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/comments/${NESTED_PARENT}/replies`,
        payload: { body: 'hi' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('400 when id is not a uuid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/comments/not-a-uuid/replies',
        headers: AUTH,
        payload: { body: 'hi' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('validation_error');
    });

    it('400 with body missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/comments/${NESTED_PARENT}/replies`,
        headers: AUTH,
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({
        error: {
          code: 'validation_error',
          message: expect.any(String),
          fields: { body: 'required' },
        },
      });
    });

    it('400 when body is empty string', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/comments/${NESTED_PARENT}/replies`,
        headers: AUTH,
        payload: { body: '' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({
        error: {
          code: 'validation_error',
          message: expect.any(String),
          fields: { body: 'too_short' },
        },
      });
    });

    it('404 for other user comment', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/comments/${OTHER_USERS_COMMENT}/replies`,
        headers: AUTH,
        payload: { body: 'stay out' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('202 inserts pending row on happy path', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/comments/${NESTED_PARENT}/replies`,
        headers: AUTH,
        payload: { body: 'thanks!' },
      });
      expect(res.statusCode).toBe(202);
      const body = res.json();
      expect(body.id).toMatch(UUID_RE);

      const { rows } = await pool.query(
        `SELECT id, send_status, platform_comment_id, parent_comment_id, body,
                author_user_id, author_platform_handle
         FROM comments WHERE id = $1`,
        [body.id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].send_status).toBe('pending');
      expect(rows[0].platform_comment_id).toBeNull();
      expect(rows[0].parent_comment_id).toBe(NESTED_PARENT);
      expect(rows[0].body).toBe('thanks!');
      expect(rows[0].author_user_id).toBe(fixtures.users.primary);
      // The parent (aIg1) is on the primary user's Instagram account,
      // so the reply should be authored under that account's handle.
      expect(rows[0].author_platform_handle).toBe('primary_handle');
    });
  });
});
