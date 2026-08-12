import { buildApp } from './server.js';
import { SenderWorker } from './workers/sender.js';

const port = Number(process.env.PORT ?? 3000);
const SENDER_INTERVAL_MS = 5_000;

const app = await buildApp();

try {
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`API Docs  http://localhost:${port}/docs`);
  console.log(`API Schema  http://localhost:${port}/docs/json`);

  const sender = new SenderWorker();
  setInterval(() => {
    sender.drainAll().catch((err) => console.error('sender drain failed', err));
  }, SENDER_INTERVAL_MS).unref();
} catch (err) {
  console.error(err);
  process.exit(1);
}
