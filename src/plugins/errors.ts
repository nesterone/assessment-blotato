import fp from 'fastify-plugin';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

const validationReason = (keyword: string): string => {
  switch (keyword) {
    case 'required':
      return 'required';
    case 'minLength':
      return 'too_short';
    case 'maxLength':
      return 'too_long';
    case 'format':
    case 'pattern':
    case 'type':
    case 'enum':
      return 'invalid_format';
    default:
      return 'invalid_format';
  }
};

const fieldPath = (err: {
  instancePath?: string;
  params?: Record<string, unknown>;
}): string => {
  if (err.params && typeof err.params.missingProperty === 'string') {
    return err.params.missingProperty;
  }
  const path = err.instancePath ?? '';
  return path.replace(/^\//, '').replace(/\//g, '.') || '_';
};

type ValidationError = FastifyError & {
  validation?: Array<{
    keyword: string;
    instancePath?: string;
    params?: Record<string, unknown>;
  }>;
};

export default fp(async (app) => {
  app.setNotFoundHandler((_req: FastifyRequest, reply: FastifyReply) => {
    reply.code(404).send({
      error: {
        code: 'not_found',
        message: 'Route not found',
      },
    });
  });

  app.setErrorHandler(
    (err: ValidationError, req: FastifyRequest, reply: FastifyReply) => {
      if (err.validation && err.validation.length > 0) {
        const fields: Record<string, string> = {};
        for (const v of err.validation) {
          fields[fieldPath(v)] = validationReason(v.keyword);
        }
        reply.code(400).send({
          error: {
            code: 'validation_error',
            message: 'Invalid request',
            fields,
          },
        });
        return;
      }

      const status = err.statusCode ?? 500;

      if (status === 401) {
        reply.code(401).send({
          error: {
            code: 'unauthorized',
            message: err.message || 'Unauthorized',
          },
        });
        return;
      }

      if (status === 404) {
        reply.code(404).send({
          error: { code: 'not_found', message: err.message || 'Not found' },
        });
        return;
      }

      if (status >= 400 && status < 500) {
        reply.code(status).send({
          error: { code: 'bad_request', message: err.message || 'Bad request' },
        });
        return;
      }

      req.log.error({ err }, 'unhandled error');
      reply.code(500).send({
        error: { code: 'internal_error', message: 'Internal server error' },
      });
    },
  );
});
