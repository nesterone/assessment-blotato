import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import addFormatsImport from 'ajv-formats';
import type { Ajv } from 'ajv';
import errors from './plugins/errors.js';
import auth from './plugins/auth.js';
import posts from './routes/posts.js';
import comments from './routes/comments.js';

export async function buildApp() {
  const app = Fastify({
    logger: false,
    ajv: {
      plugins: [addFormats],
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(sensible);
  await app.register(errors);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Chatterbox API',
        description: 'Comment system for social media posts',
        version: '0.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(auth);
  await app.register(posts);
  await app.register(comments);

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;

const addFormats =
  (addFormatsImport as unknown as { default?: (ajv: Ajv) => Ajv }).default ??
  (addFormatsImport as unknown as (ajv: Ajv) => Ajv);
