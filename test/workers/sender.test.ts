import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { SenderWorker } from '../../src/workers/sender.js';
import { fixtures } from '../../src/db/fixtures.js';
import { resetDb } from '../helpers/db.js';
import { startFakes, type Fakes } from '../helpers/fakes.js';
import {
  insertParent,
  insertPendingReply,
  insertUnsupportedPlatformPost,
  loadReplyRow,
  rewindNextAttempt,
  setAccessToken,
} from '../helpers/replies.js';

const IG_POST = fixtures.platformPosts.aInstagram;
const TT_POST = fixtures.platformPosts.aTiktok;

let fakes: Fakes;
const sender = new SenderWorker();

beforeAll(async () => {
  fakes = await startFakes();
});

afterAll(async () => {
  await fakes.close();
});

beforeEach(async () => {
  await resetDb();
  fakes.store.reset();
});

describe('SenderWorker', () => {
  it('pending → sent, platform_comment_id stored', async () => {
    fakes.store.seedComment({
      platformCommentId: 'tt_c_a2',
      platformPostId: 'tt_post_a',
      authorHandle: 'u',
      body: 'parent',
    });

    await sender.processOne(fixtures.comments.ourReplyPending);

    const row = await loadReplyRow(fixtures.comments.ourReplyPending);
    expect(row.send_status).toBe('sent');
    expect(row.platform_comment_id).toBeTruthy();
    expect(fakes.store.allReplies('tt_c_a2')).toHaveLength(1);
  });

  it('rate limit → stays pending, attempt_count up, next_attempt_at in the future', async () => {
    const parent = await insertParent(IG_POST, 'ig_c_ratelimit');
    const reply = await insertPendingReply({ platformPostId: IG_POST, parentCommentId: parent });

    await sender.processOne(reply);

    const row = await loadReplyRow(reply);
    expect(row.send_status).toBe('pending');
    expect(row.attempt_count).toBe(1);
    expect(new Date(row.next_attempt_at!).getTime()).toBeGreaterThan(Date.now());
  });

  it('drain after the retry window → sent', async () => {
    fakes.store.seedComment({
      platformCommentId: 'ig_c_flaky',
      platformPostId: 'ig_post_a',
      authorHandle: 'u',
      body: 'parent',
    });
    const parent = await insertParent(IG_POST, 'ig_c_flaky');
    const reply = await insertPendingReply({ platformPostId: IG_POST, parentCommentId: parent });

    await sender.processOne(reply);
    expect((await loadReplyRow(reply)).send_status).toBe('pending');

    await rewindNextAttempt(reply);
    await sender.processOne(reply);
    expect((await loadReplyRow(reply)).send_status).toBe('sent');
  });

  it('PlatformRejected → failed + send_error', async () => {
    const parent = await insertParent(IG_POST, 'ig_c_ghost');
    const reply = await insertPendingReply({ platformPostId: IG_POST, parentCommentId: parent });

    await sender.processOne(reply);

    const row = await loadReplyRow(reply);
    expect(row.send_status).toBe('failed');
    expect(row.send_error).toBeTruthy();
  });

  it('PlatformAuthExpired → stays pending, not failed', async () => {
    await setAccessToken(fixtures.connectedAccounts.instagram, 'ig_token_expired');
    const parent = await insertParent(IG_POST, 'ig_c_auth');
    const reply = await insertPendingReply({ platformPostId: IG_POST, parentCommentId: parent });

    await sender.processOne(reply);

    expect((await loadReplyRow(reply)).send_status).toBe('pending');
  });

  it('attempt cap reached → failed', async () => {
    const parent = await insertParent(IG_POST, 'ig_c_ratelimit');
    const reply = await insertPendingReply({
      platformPostId: IG_POST,
      parentCommentId: parent,
      attemptCount: 4,
    });

    await sender.processOne(reply);

    expect((await loadReplyRow(reply)).send_status).toBe('failed');
  });

  it('processOne twice on a sent row posts exactly once', async () => {
    fakes.store.seedComment({
      platformCommentId: 'tt_c_a2',
      platformPostId: 'tt_post_a',
      authorHandle: 'u',
      body: 'parent',
    });

    await sender.processOne(fixtures.comments.ourReplyPending);
    await sender.processOne(fixtures.comments.ourReplyPending);

    expect(fakes.store.allReplies('tt_c_a2')).toHaveLength(1);
    expect((await loadReplyRow(fixtures.comments.ourReplyPending)).send_status).toBe('sent');
  });

  it('both platforms drain in a single sweep', async () => {
    fakes.store.seedComment({
      platformCommentId: 'ig_c_a1',
      platformPostId: 'ig_post_a',
      authorHandle: 'u',
      body: 'parent',
    });
    fakes.store.seedComment({
      platformCommentId: 'tt_c_a2',
      platformPostId: 'tt_post_a',
      authorHandle: 'u',
      body: 'parent',
    });
    const igReply = await insertPendingReply({
      platformPostId: IG_POST,
      parentCommentId: fixtures.comments.aIg1,
    });

    await sender.drainAll();

    expect((await loadReplyRow(igReply)).send_status).toBe('sent');
    expect((await loadReplyRow(fixtures.comments.ourReplyPending)).send_status).toBe('sent');
  });

  it('a row on an unintegrated platform → failed, and the drain keeps going', async () => {
    fakes.store.seedComment({
      platformCommentId: 'ig_c_a1',
      platformPostId: 'ig_post_a',
      authorHandle: 'u',
      body: 'parent',
    });
    const yt = await insertUnsupportedPlatformPost();
    const ytReply = await insertPendingReply({
      platformPostId: yt.platformPostId,
      parentCommentId: yt.parentCommentId,
    });
    const igReply = await insertPendingReply({
      platformPostId: IG_POST,
      parentCommentId: fixtures.comments.aIg1,
    });

    await sender.drainAll();

    expect((await loadReplyRow(ytReply)).send_status).toBe('failed');
    expect((await loadReplyRow(igReply)).send_status).toBe('sent');
  });
});
