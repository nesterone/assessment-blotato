import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';

describe('server', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 404 with error envelope for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: {
        code: 'not_found',
        message: expect.any(String),
      },
    });
  });

  it('exposes OpenAPI document at /docs/json', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.paths['/posts']).toBeDefined();
    expect(doc.paths['/posts/{id}']).toBeDefined();
    expect(doc.paths['/posts/{id}/comments']).toBeDefined();
    expect(doc.paths['/comments/{id}/replies']).toBeDefined();
    expect(doc.paths['/comments/{id}/replies'].get).toBeDefined();
    expect(doc.paths['/comments/{id}/replies'].post).toBeDefined();
  });
});
