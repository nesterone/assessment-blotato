import type { Config } from 'drizzle-kit';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL is required (run via `node --env-file=.env …`)',
  );
}

export default {
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url },
} satisfies Config;
