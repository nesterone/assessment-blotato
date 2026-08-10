import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';
import { fixtures } from '../src/db/fixtures.js';
import { resetDb } from './helpers/db.js';

const API_KEY = process.env.TEST_API_KEY!;
const AUTH = { authorization: `Bearer ${API_KEY}` };
const UNKNOWN_UUID = '99999999-9999-4999-8999-999999999999';

describe('posts routes', () => {
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

  describe('GET /posts', () => {
    it('401 without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/posts' });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({
        error: { code: 'unauthorized', message: expect.any(String) },
      });
    });

    it('returns seeded posts newest-first, no cursor', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/posts',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.next_cursor).toBeNull();
      const ids = body.data.map((p: { id: string }) => p.id);
      expect(ids).toEqual([fixtures.posts.b, fixtures.posts.a]);
    });

    it('does not leak other users posts', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/posts',
        headers: AUTH,
      });
      const ids = res.json().data.map((p: { id: string }) => p.id);
      expect(ids).not.toContain(fixtures.posts.other);
    });

    it('paginates with cursor', async () => {
      const first = await app.inject({
        method: 'GET',
        url: '/posts?limit=1',
        headers: AUTH,
      });
      expect(first.statusCode).toBe(200);
      const firstBody = first.json();
      expect(firstBody.data).toHaveLength(1);
      expect(firstBody.data[0].id).toBe(fixtures.posts.b);
      expect(firstBody.next_cursor).not.toBeNull();

      const second = await app.inject({
        method: 'GET',
        url: `/posts?limit=1&cursor=${encodeURIComponent(firstBody.next_cursor)}`,
        headers: AUTH,
      });
      expect(second.statusCode).toBe(200);
      const secondBody = second.json();
      expect(secondBody.data).toHaveLength(1);
      expect(secondBody.data[0].id).toBe(fixtures.posts.a);
      expect(secondBody.next_cursor).toBeNull();
    });

    it('400 for cursor that is not valid base64url json', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/posts?cursor=not%20a%20cursor%21%21%21',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('bad_request');
    });

    it('400 for cursor whose json has the wrong shape', async () => {
      const bad = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url');
      const res = await app.inject({
        method: 'GET',
        url: `/posts?cursor=${encodeURIComponent(bad)}`,
        headers: AUTH,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('bad_request');
    });

    it('400 for cursor whose createdAt is not a real date', async () => {
      const bad = Buffer.from(
        JSON.stringify({ createdAt: 'garbage', id: fixtures.posts.a }),
      ).toString('base64url');
      const res = await app.inject({
        method: 'GET',
        url: `/posts?cursor=${encodeURIComponent(bad)}`,
        headers: AUTH,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('bad_request');
    });

    it('400 for cursor whose id is not a uuid', async () => {
      const bad = Buffer.from(
        JSON.stringify({ createdAt: new Date().toISOString(), id: 'not-a-uuid' }),
      ).toString('base64url');
      const res = await app.inject({
        method: 'GET',
        url: `/posts?cursor=${encodeURIComponent(bad)}`,
        headers: AUTH,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('bad_request');
    });
  });

  describe('GET /posts/:id', () => {
    it('401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/posts/${fixtures.posts.a}`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('400 when id is not a uuid', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/posts/not-a-uuid',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('validation_error');
    });

    it('200 with Post shape', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/posts/${fixtures.posts.a}`,
        headers: AUTH,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toMatchObject({
        id: fixtures.posts.a,
        body: expect.any(String),
        created_at: expect.any(String),
      });
    });

    it('404 for other user post', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/posts/${fixtures.posts.other}`,
        headers: AUTH,
      });
      expect(res.statusCode).toBe(404);
    });

    it('404 for unknown post', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/posts/${UNKNOWN_UUID}`,
        headers: AUTH,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /posts/:id/comments', () => {
    it('401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/posts/${fixtures.posts.a}/comments`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('400 when id is not a uuid', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/posts/not-a-uuid/comments',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('validation_error');
    });

    it('404 for other user post', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/posts/${fixtures.posts.other}/comments`,
        headers: AUTH,
      });
      expect(res.statusCode).toBe(404);
    });

    it('unified feed across IG + TikTok, excludes nested replies', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/posts/${fixtures.posts.a}/comments`,
        headers: AUTH,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.next_cursor).toBeNull();

      const platforms = new Set(
        body.data.map((c: { platform: string }) => c.platform),
      );
      expect(platforms.has('instagram')).toBe(true);
      expect(platforms.has('tiktok')).toBe(true);

      const ids = body.data.map((c: { id: string }) => c.id);
      // Nested (has parent_comment_id) must be excluded
      expect(ids).not.toContain(fixtures.comments.nestedThirdParty);
      expect(ids).not.toContain(fixtures.comments.ourReplySent);
      expect(ids).not.toContain(fixtures.comments.ourReplyPending);
      // Top-level from both platforms present
      expect(ids).toContain(fixtures.comments.aIg1);
      expect(ids).toContain(fixtures.comments.aTt1);
    });

    it('paginates with cursor', async () => {
      const first = await app.inject({
        method: 'GET',
        url: `/posts/${fixtures.posts.a}/comments?limit=5`,
        headers: AUTH,
      });
      expect(first.statusCode).toBe(200);
      const firstBody = first.json();
      expect(firstBody.data).toHaveLength(5);
      expect(firstBody.next_cursor).not.toBeNull();

      const second = await app.inject({
        method: 'GET',
        url: `/posts/${fixtures.posts.a}/comments?limit=5&cursor=${encodeURIComponent(firstBody.next_cursor)}`,
        headers: AUTH,
      });
      expect(second.statusCode).toBe(200);
      const secondBody = second.json();
      // Post A has 4 IG + 3 TT top-level = 7 total; page 2 has 2 rows
      expect(secondBody.data).toHaveLength(2);
      expect(secondBody.next_cursor).toBeNull();

      const firstIds = firstBody.data.map((c: { id: string }) => c.id);
      const secondIds = secondBody.data.map((c: { id: string }) => c.id);
      // No overlap between pages
      for (const id of secondIds) {
        expect(firstIds).not.toContain(id);
      }
    });
  });
});
