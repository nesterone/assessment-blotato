import { createHash } from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { apiKeys } from '../db/schema.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export default fp(async (app) => {
  app.decorateRequest('userId', '');

  app.decorate(
    'authenticate',
    async (req: FastifyRequest, _reply: FastifyReply) => {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        throw app.httpErrors.unauthorized('Missing or malformed Authorization header');
      }
      const key = header.slice('Bearer '.length).trim();
      if (!key) {
        throw app.httpErrors.unauthorized('Missing API key');
      }

      const [row] = await db
        .select({ userId: apiKeys.userId })
        .from(apiKeys)
        .where(and(eq(apiKeys.keyHash, sha256(key)), isNull(apiKeys.revokedAt)))
        .limit(1);

      if (!row) {
        throw app.httpErrors.unauthorized('Invalid API key');
      }
      req.userId = row.userId;
    },
  );
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
