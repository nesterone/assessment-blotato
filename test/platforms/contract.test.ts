import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { clientFor } from '../../src/platforms/registry.js';
import {
  PlatformAuthExpired,
  PlatformRejected,
  PlatformRetryable,
  type ConnectedAccount,
  type PlatformClient,
} from '../../src/platforms/types.js';
import { startFakes, type Fakes } from '../helpers/fakes.js';
import { FAKE_PAGE_SIZE } from '../fakes/store.js';

const account = (accessToken: string): ConnectedAccount => ({
  accessToken,
  refreshToken: null,
  tokenExpiresAt: null,
  platformAccountId: 'acct',
});

type Scenario = {
  platform: string;
  token: string;
  expiredToken: string;
  postId: string;
  parentId: string;
  rateLimitParent: string;
  missingParent: string;
};

const scenarios: Scenario[] = [
  {
    platform: 'instagram',
    token: 'ig_token_primary',
    expiredToken: 'ig_token_expired',
    postId: 'ig_post_a',
    parentId: 'ig_c_a1',
    rateLimitParent: 'ig_c_ratelimit',
    missingParent: 'ig_c_missing',
  },
  {
    platform: 'tiktok',
    token: 'tt_token_primary',
    expiredToken: 'tt_token_expired',
    postId: 'tt_post_a',
    parentId: 'tt_c_a1',
    rateLimitParent: 'tt_c_ratelimit',
    missingParent: 'tt_c_missing',
  },
];

let fakes: Fakes;

beforeAll(async () => {
  fakes = await startFakes();
});

afterAll(async () => {
  await fakes.close();
});

describe.each(scenarios)('PlatformClient contract — $platform', (s) => {
  let client: PlatformClient;

  beforeEach(() => {
    fakes.store.reset();
    client = clientFor(s.platform);
    fakes.store.seedComment({
      platformCommentId: s.parentId,
      platformPostId: s.postId,
      authorHandle: 'a_user',
      body: 'parent comment',
    });
  });

  it('postReply returns a platformCommentId', async () => {
    const result = await client.postReply(
      {
        platformPostId: s.postId,
        parentPlatformCommentId: s.parentId,
        body: 'hi',
      },
      account(s.token),
    );
    expect(result.platformCommentId).toBeTruthy();
    expect(fakes.store.has(result.platformCommentId)).toBe(true);
  });

  it('rate limit → PlatformRetryable with retryAfterMs', async () => {
    const err = await client
      .postReply(
        {
          platformPostId: s.postId,
          parentPlatformCommentId: s.rateLimitParent,
          body: 'hi',
        },
        account(s.token),
      )
      .catch((e) => e);
    expect(err).toBeInstanceOf(PlatformRetryable);
    expect(err.retryAfterMs).toBe(1000);
  });

  it('expired token → PlatformAuthExpired', async () => {
    await expect(
      client.postReply(
        {
          platformPostId: s.postId,
          parentPlatformCommentId: s.parentId,
          body: 'hi',
        },
        account(s.expiredToken),
      ),
    ).rejects.toBeInstanceOf(PlatformAuthExpired);
  });

  it('unknown parent → PlatformRejected', async () => {
    await expect(
      client.postReply(
        {
          platformPostId: s.postId,
          parentPlatformCommentId: s.missingParent,
          body: 'hi',
        },
        account(s.token),
      ),
    ).rejects.toBeInstanceOf(PlatformRejected);
  });

  it('listComments returns normalized PlatformComment[]', async () => {
    const { comments } = await client.listComments(
      { platformPostId: s.postId, cursor: null },
      account(s.token),
    );
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({
      platformCommentId: s.parentId,
      parentPlatformCommentId: null,
      authorHandle: 'a_user',
      body: 'parent comment',
    });
    expect(comments[0].createdAt).toBeInstanceOf(Date);
  });

  it('pagination walks pages and terminates with nextCursor null', async () => {
    for (let i = 0; i < FAKE_PAGE_SIZE + 1; i += 1) {
      fakes.store.seedComment({
        platformCommentId: `${s.postId}_extra_${i}`,
        platformPostId: s.postId,
        authorHandle: 'u',
        body: `c${i}`,
      });
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await client.listComments(
        { platformPostId: s.postId, cursor },
        account(s.token),
      );
      seen.push(...page.comments.map((c) => c.platformCommentId));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);

    expect(cursor).toBeNull();
    expect(pages).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(FAKE_PAGE_SIZE + 2);
  });

  it('listReplies returns a parent’s replies', async () => {
    fakes.store.seedComment({
      platformCommentId: `${s.parentId}_r1`,
      platformPostId: s.postId,
      parentPlatformCommentId: s.parentId,
      authorHandle: 'u1',
      body: 'reply one',
    });
    fakes.store.seedComment({
      platformCommentId: `${s.parentId}_r2`,
      platformPostId: s.postId,
      parentPlatformCommentId: s.parentId,
      authorHandle: 'u2',
      body: 'reply two',
    });

    const { comments } = await client.listReplies(
      { platformPostId: s.postId, parentPlatformCommentId: s.parentId, cursor: null },
      account(s.token),
    );
    expect(comments.map((c) => c.body).sort()).toEqual([
      'reply one',
      'reply two',
    ]);
    for (const c of comments) {
      expect(c.parentPlatformCommentId).toBe(s.parentId);
    }
  });
});
