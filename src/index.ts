import { buildApp } from './server.js';
import { SenderWorker } from './workers/sender.js';
import { SyncWorker } from './workers/sync.js';
import { logger } from './logger.js';

const port = Number(process.env.PORT ?? 3000);
const SENDER_INTERVAL_MS = 5_000;
const TIKTOK_SYNC_INTERVAL_MS = 5 * 60_000;
const INSTAGRAM_SYNC_INTERVAL_MS = 60 * 60_000;

const app = await buildApp();

try {
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`API Docs  http://localhost:${port}/docs`);
  console.log(`API Schema  http://localhost:${port}/docs/json`);

  const sender = new SenderWorker();
  setInterval(() => {
    sender
      .drainAll()
      .catch((err) => logger.error('sender drain failed', { err: String(err) }));
  }, SENDER_INTERVAL_MS).unref();

  const sync = new SyncWorker();
  const poll = (platform: string) => () => {
    sync
      .tick(platform)
      .catch((err) => logger.error('sync tick failed', { platform, err: String(err) }));
  };
  setInterval(poll('tiktok'), TIKTOK_SYNC_INTERVAL_MS).unref();
  setInterval(poll('instagram'), INSTAGRAM_SYNC_INTERVAL_MS).unref();
} catch (err) {
  console.error(err);
  process.exit(1);
}
