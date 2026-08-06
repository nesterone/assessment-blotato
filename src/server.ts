import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(sensible);

  return app;
}
