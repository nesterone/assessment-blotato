import type { AddressInfo } from 'node:net';
import { buildFakeApp } from '../fakes/app.js';
import { FakeStore } from '../fakes/store.js';

export type Fakes = {
  store: FakeStore;
  close: () => Promise<void>;
};

/**
 * Boots the fake platforms on an ephemeral port and points the real adapters
 * at them via the same env vars production uses. `clientFor` reads these per
 * call, so setting them here is all the wiring the tests need.
 */
export async function startFakes(): Promise<Fakes> {
  const store = new FakeStore();
  const app = buildFakeApp(store);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const { port } = app.server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  process.env.INSTAGRAM_BASE_URL = `${base}/ig`;
  process.env.TIKTOK_BASE_URL = `${base}/tiktok`;
  return { store, close: () => app.close() };
}
