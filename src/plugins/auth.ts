import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

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
      req.userId = 'stub-user';
    },
  );
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
