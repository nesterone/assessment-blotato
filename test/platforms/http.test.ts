import { describe, it, expect } from 'vitest';
import { requestJson } from '../../src/platforms/http.js';
import { PlatformRetryable } from '../../src/platforms/types.js';
import { startServer } from '../helpers/http-server.js';

describe('requestJson transport', () => {
  it('closed port → PlatformRetryable', async () => {
    const { url, close } = await startServer(() => {});
    await close();
    await expect(requestJson(url)).rejects.toBeInstanceOf(PlatformRetryable);
  });

  it('HTML body instead of JSON → PlatformRetryable', async () => {
    const { url, close } = await startServer((res) => {
      res.writeHead(502, { 'content-type': 'text/html' });
      res.end('<html><body>Bad Gateway</body></html>');
    });
    try {
      await expect(requestJson(url)).rejects.toBeInstanceOf(PlatformRetryable);
    } finally {
      await close();
    }
  });

  it('response slower than timeoutMs → PlatformRetryable', async () => {
    let timer: NodeJS.Timeout;
    const { url, close } = await startServer((res) => {
      timer = setTimeout(() => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      }, 200);
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

  it('body that stalls past timeoutMs → PlatformRetryable', async () => {
    const { url, close } = await startServer((res) => {
      res.writeHead(200, {
        'content-type': 'application/json',
        'content-length': '64',
      });
      res.write('{"partial":');
    });
    try {
      await expect(requestJson(url, {}, 50)).rejects.toBeInstanceOf(
        PlatformRetryable,
      );
    } finally {
      await close();
    }
  });

  it('transport failure message omits the query string', async () => {
    const { url, close } = await startServer(() => {});
    await close();
    const err = await requestJson(
      `${url}/comments?access_token=SECRET_TOKEN`,
    ).catch((e) => e);
    expect(err.message).not.toContain('SECRET_TOKEN');
    expect(err.message).toContain('/comments');
  });

  it('non-JSON failure message omits the query string', async () => {
    const { url, close } = await startServer((res) => {
      res.writeHead(502, { 'content-type': 'text/html' });
      res.end('<html><body>Bad Gateway</body></html>');
    });
    try {
      const err = await requestJson(
        `${url}/comments?access_token=SECRET_TOKEN`,
      ).catch((e) => e);
      expect(err.message).not.toContain('SECRET_TOKEN');
      expect(err.message).toContain('/comments');
    } finally {
      await close();
    }
  });
});
