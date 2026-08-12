import Fastify, { type FastifyInstance } from 'fastify';
import { logger } from '../../src/logger.js';
import { FakeStore } from './store.js';
import { instagramFake } from './instagram.js';
import { tiktokFake } from './tiktok.js';

export function buildFakeApp(store: FakeStore): FastifyInstance {
  const app = Fastify({ logger: false });

  // Logs each simulated call — visible under `npm run fakes`, silent in tests
  // (they run with LOG_LEVEL=silent).
  const log = logger.child({ fake: true });
  app.addHook('onResponse', (req, reply, done) => {
    log.info('fake call', {
      method: req.method,
      url: req.url,
      status: reply.statusCode,
    });
    done();
  });

  app.register(instagramFake(store), { prefix: '/ig' });
  app.register(tiktokFake(store), { prefix: '/tiktok' });
  return app;
}
