import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import errors from './plugins/errors.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(sensible);
  await app.register(errors);

  return app;
}
