import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { clientFor } from '../../src/platforms/registry.js';
import { TiktokClient } from '../../src/platforms/tiktok/client.js';
import {
  PlatformRejected,
  PlatformRetryable,
  type ConnectedAccount,
} from '../../src/platforms/types.js';
import { startFakes, type Fakes } from '../helpers/fakes.js';
import { startServer, sendJson } from '../helpers/http-server.js';

const account = (accessToken: string): ConnectedAccount => ({
  accessToken,
  refreshToken: null,
  tokenExpiresAt: null,
  platformAccountId: 'tt_acct',
});

let fakes: Fakes;

beforeAll(async () => {
  fakes = await startFakes();
});

beforeEach(() => {
  fakes.store.reset();
});

afterAll(async () => {
  await fakes.close();
});

describe('TikTok quirks', () => {
  it('reports failure as HTTP 200 with the error in the body', async () => {
    const res = await fetch(
      `${process.env.TIKTOK_BASE_URL}/v2/comment/reply/`,
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer tt_token_primary',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          video_id: 'tt_post_a',
          comment_id: 'tt_missing',
          text: 'hi',
        }),
      },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).error.code).toBe('invalid_params');
  });

  it('client throws on the 200-hidden error instead of reporting success', async () => {
    await expect(
      clientFor('tiktok').postReply(
        {
          platformPostId: 'tt_post_a',
          parentPlatformCommentId: 'tt_missing',
          body: 'hi',
        },
        account('tt_token_primary'),
      ),
    ).rejects.toBeInstanceOf(PlatformRejected);
  });
});

/**
 * TikTok's own failures arrive as 200s, but a proxy or WAF in front of it
 * answers with a real status and a body that has no `error.code`. Reading only
 * the body would score those as a successful empty page.
 */
describe('TikTok non-2xx responses', () => {
  it('4xx without an error code rejects instead of returning an empty page', async () => {
    const { url, close } = await startServer((res) =>
      sendJson(res, 403, { message: 'Forbidden' }),
    );
    try {
      await expect(
        new TiktokClient(url).listComments(
          { platformPostId: 'tt_post_a', cursor: null },
          account('tt_token_primary'),
        ),
      ).rejects.toBeInstanceOf(PlatformRejected);
    } finally {
      await close();
    }
  });

  it('429 without an error code → PlatformRetryable with retryAfterMs', async () => {
    const { url, close } = await startServer((res) => {
      res.writeHead(429, {
        'content-type': 'application/json',
        'retry-after': '2',
      });
      res.end(JSON.stringify({ message: 'slow down' }));
    });
    try {
      const err = await new TiktokClient(url)
        .listComments(
          { platformPostId: 'tt_post_a', cursor: null },
          account('tt_token_primary'),
        )
        .catch((e) => e);
      expect(err).toBeInstanceOf(PlatformRetryable);
      expect(err.retryAfterMs).toBe(2000);
    } finally {
      await close();
    }
  });
});
