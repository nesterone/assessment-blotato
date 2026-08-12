import { describe, it, expect } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { requestJson } from '../../src/platforms/http.js';
import { PlatformRetryable } from '../../src/platforms/types.js';

type Responder = (
  respond: (
    status: number,
    headers: Record<string, string>,
    body: string,
  ) => void,
) => void;

async function startServer(
  handler: Responder,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer((_req, res) => {
    handler((status, headers, body) => {
      res.writeHead(status, headers);
      res.end(body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe('requestJson transport', () => {
  it('closed port → PlatformRetryable', async () => {
    const { url, close } = await startServer(() => {});
    await close();
    await expect(requestJson(url)).rejects.toBeInstanceOf(PlatformRetryable);
  });

  it('HTML body instead of JSON → PlatformRetryable', async () => {
    const { url, close } = await startServer((respond) =>
      respond(
        502,
        { 'content-type': 'text/html' },
        '<html><body>Bad Gateway</body></html>',
      ),
    );
    try {
      await expect(requestJson(url)).rejects.toBeInstanceOf(PlatformRetryable);
    } finally {
      await close();
    }
  });

  it('response slower than timeoutMs → PlatformRetryable', async () => {
    let timer: NodeJS.Timeout;
    const { url, close } = await startServer((respond) => {
      timer = setTimeout(
        () => respond(200, { 'content-type': 'application/json' }, '{}'),
        200,
      );
    });
    try {
      await expect(requestJson(url, {}, 50)).rejects.toBeInstanceOf(
        PlatformRetryable,
      );
    } finally {
      clearTimeout(timer!);
      await close();
    }
  });
});
