import { seed } from '../../src/db/seed.js';

// seed() truncates + inserts, so a bare call is enough to reset the test DB.
export async function resetDb() {
  await seed();
}
