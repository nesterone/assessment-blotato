import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const AUTH = { authorization: 'Bearer test-key' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('comments routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /comments/:id/replies', () => {
    it('401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/comments/${VALID_UUID}/replies`,
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

    it('200 with page envelope', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/comments/${VALID_UUID}/replies`,
        headers: AUTH,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ data: [], next_cursor: null });
    });
  });

  describe('POST /comments/:id/replies', () => {
    it('401 without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/comments/${VALID_UUID}/replies`,
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
        url: `/comments/${VALID_UUID}/replies`,
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
        url: `/comments/${VALID_UUID}/replies`,
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

    it('202 with new reply id on happy path', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/comments/${VALID_UUID}/replies`,
        headers: AUTH,
        payload: { body: 'thanks!' },
      });
      expect(res.statusCode).toBe(202);
      const body = res.json();
      expect(body.id).toMatch(UUID_RE);
    });
  });
});
