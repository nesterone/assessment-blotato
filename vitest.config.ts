import { defineConfig } from 'vitest/config';

// Tests share one database and reset it in beforeEach — parallel files would race.
export default defineConfig({
  test: {
    fileParallelism: false,
  },
});
