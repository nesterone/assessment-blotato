import { buildFakeApp } from './app.js';
import { FakeStore } from './store.js';

/**
 * Runs the fakes as a standalone server so the base URLs in `.env` point at
 * something real. Tests boot this same app on an ephemeral port.
 *
 * Seeded with the two comments src/db/seed.ts uses as reply targets, so a send
 * against the dev database resolves instead of 404ing.
 */
const store = new FakeStore();

store.seedComment({
  platformCommentId: 'ig_c_a1',
  platformPostId: 'ig_post_a',
  authorHandle: 'ig_user_1',
  body: 'Love this!',
});

store.seedComment({
  platformCommentId: 'tt_c_a2',
  platformPostId: 'tt_post_a',
  authorHandle: 'tt_user_2',
  body: 'Where can I buy?',
});

const port = Number(process.env.FAKES_PORT ?? 4000);
if (!Number.isInteger(port)) {
  throw new Error(`FAKES_PORT is not a number: ${process.env.FAKES_PORT}`);
}

const app = buildFakeApp(store);
await app.listen({ port, host: '127.0.0.1' });
console.log(
  `Fakes on http://127.0.0.1:${port} — /ig (instagram), /tiktok (tiktok)`,
);
