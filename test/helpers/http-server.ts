import { createServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export type StubServer = { url: string; close: () => Promise<void> };

/**
 * A raw HTTP server on an ephemeral port, handed the `ServerResponse` so a
 * test can shape answers the platform fakes deliberately never produce — a
 * gateway HTML page, a stalled body, a 2xx missing its payload.
 */
export async function startServer(
  handler: (res: ServerResponse) => void,
): Promise<StubServer> {
  const server = createServer((_req, res) => handler(res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        // A stalled-body test leaves a socket open; close() alone would hang.
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}
