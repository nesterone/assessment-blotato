import Fastify, { type FastifyInstance } from 'fastify';
import { FakeStore } from './store.js';
import { instagramFake } from './instagram.js';
import { tiktokFake } from './tiktok.js';

export function buildFakeApp(store: FakeStore): FastifyInstance {
  const app = Fastify({ logger: false });
  app.register(instagramFake(store), { prefix: '/ig' });
  app.register(tiktokFake(store), { prefix: '/tiktok' });
  return app;
}
