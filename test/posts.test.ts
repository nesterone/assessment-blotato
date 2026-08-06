import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const AUTH = { authorization: 'Bearer test-key' };

describe('posts routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
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

    it('200 with page envelope', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/posts',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ data: [], next_cursor: null });
    });
  });

  describe('GET /posts/:id', () => {
    it('401 without auth', async () => {
      const res = await app.inject({ method: 'GET', url: `/posts/${VALID_UUID}` });
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
        url: `/posts/${VALID_UUID}`,
        headers: AUTH,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toMatchObject({
        id: VALID_UUID,
        body: expect.any(String),
        created_at: expect.any(String),
      });
    });
  });

  describe('GET /posts/:id/comments', () => {
    it('401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/posts/${VALID_UUID}/comments`,
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

    it('200 with page envelope', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/posts/${VALID_UUID}/comments`,
        headers: AUTH,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ data: [], next_cursor: null });
    });
  });
});
