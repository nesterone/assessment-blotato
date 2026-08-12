import { buildApp } from './server.js';

const port = Number(process.env.PORT ?? 3000);

const app = await buildApp();

try {
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`API Docs  http://localhost:${port}/docs`);
  console.log(`API Schema  http://localhost:${port}/docs/json`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
