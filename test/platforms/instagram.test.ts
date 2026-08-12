import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { clientFor } from '../../src/platforms/registry.js';
import { InstagramClient } from '../../src/platforms/instagram/client.js';
import {
  PlatformAuthExpired,
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
  platformAccountId: 'ig_acct',
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

describe('Instagram quirks', () => {
  it('code 190 maps to PlatformAuthExpired, not PlatformRetryable', async () => {
    const err = await clientFor('instagram')
      .listComments(
        { platformPostId: 'ig_post_a', cursor: null },
        account('ig_token_expired'),
      )
      .catch((e) => e);

    expect(err).toBeInstanceOf(PlatformAuthExpired);
    expect(err).not.toBeInstanceOf(PlatformRetryable);
    expect(err.platformCode).toBe('190');
  });

  it('2xx without an id rejects instead of reporting an undefined comment id', async () => {
    const { url, close } = await startServer((res) => sendJson(res, 200, {}));
    try {
      await expect(
        new InstagramClient(url).postReply(
          {
            platformPostId: 'ig_post_a',
            parentPlatformCommentId: 'ig_c_a1',
            body: 'hi',
          },
          account('ig_token_primary'),
        ),
      ).rejects.toBeInstanceOf(PlatformRejected);
    } finally {
      await close();
    }
  });
});
