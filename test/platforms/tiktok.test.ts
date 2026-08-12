import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { clientFor } from '../../src/platforms/registry.js';
import {
  PlatformRejected,
  type ConnectedAccount,
} from '../../src/platforms/types.js';
import { startFakes, type Fakes } from '../helpers/fakes.js';

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
