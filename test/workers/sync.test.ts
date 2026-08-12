import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SyncWorker } from '../../src/workers/sync.js';
import { buildApp } from '../../src/server.js';
import { pool } from '../../src/db/client.js';
import { fixtures } from '../../src/db/fixtures.js';
import { resetDb } from '../helpers/db.js';
import { startFakes, type Fakes } from '../helpers/fakes.js';

const AUTH = { authorization: `Bearer ${process.env.TEST_API_KEY!}` };
const IG_POST = fixtures.platformPosts.aInstagram;
const IG_NATIVE = 'ig_post_a';

let fakes: Fakes;
let app: FastifyInstance;
const sync = new SyncWorker();

beforeAll(async () => {
  fakes = await startFakes();
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await fakes.close();
});

beforeEach(async () => {
  await resetDb();
  fakes.store.reset();
});

const seedTopLevel = (platformCommentId: string, body: string) =>
  fakes.store.seedComment({
    platformCommentId,
    platformPostId: IG_NATIVE,
    authorHandle: 'ig_user',
    body,
  });

async function countOn(platformPostId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM comments WHERE platform_post_id = $1`,
    [platformPostId],
  );
  return rows[0].n;
}

async function syncCursor(platformPostId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT sync_cursor FROM platform_posts WHERE id = $1`,
    [platformPostId],
  );
  return rows[0].sync_cursor;
}

describe('SyncWorker', () => {
  it('a comment in the fake becomes visible via GET /posts/:id/comments', async () => {
    seedTopLevel('ig_c_new', 'hello from fake');

    await sync.tick('instagram');

    const res = await app.inject({
      method: 'GET',
      url: `/posts/${fixtures.posts.a}/comments`,
      headers: AUTH,
    });
    const bodies = res.json().data.map((c: { body: string }) => c.body);
    expect(bodies).toContain('hello from fake');
  });

  it('ticking twice does not duplicate rows', async () => {
    seedTopLevel('ig_c_x1', 'one');
    seedTopLevel('ig_c_x2', 'two');
    seedTopLevel('ig_c_x3', 'three');

    await sync.tick('instagram');
    const afterFirst = await countOn(IG_POST);
    await sync.tick('instagram');
    const afterSecond = await countOn(IG_POST);

    expect(afterSecond).toBe(afterFirst);
  });

  it('cursor advances so the second tick only fetches new comments', async () => {
    seedTopLevel('ig_c_c1', 'one');
    seedTopLevel('ig_c_c2', 'two');

    await sync.tick('instagram');
    expect(await syncCursor(IG_POST)).toBe('2');

    seedTopLevel('ig_c_c3', 'three');
    await sync.tick('instagram');

    expect(await syncCursor(IG_POST)).toBe('3');
    const { rows } = await pool.query(
      `SELECT 1 FROM comments WHERE platform_comment_id = 'ig_c_c3'`,
    );
    expect(rows).toHaveLength(1);
  });

  it('rate limit mid-tick leaves the cursor unadvanced; the next tick recovers', async () => {
    await pool.query(
      `UPDATE platform_posts SET platform_post_id = 'ig_post_flaky' WHERE id = $1`,
      [IG_POST],
    );
    fakes.store.seedComment({
      platformCommentId: 'ig_c_f1',
      platformPostId: 'ig_post_flaky',
      authorHandle: 'ig_user',
      body: 'one',
    });

    await sync.tick('instagram');
    expect(await syncCursor(IG_POST)).toBeNull();

    await sync.tick('instagram');
    expect(await syncCursor(IG_POST)).toBe('1');
    const { rows } = await pool.query(
      `SELECT 1 FROM comments WHERE platform_comment_id = 'ig_c_f1'`,
    );
    expect(rows).toHaveLength(1);
  });

  it('replies land under the correct parent', async () => {
    seedTopLevel('ig_c_p1', 'parent');
    fakes.store.seedComment({
      platformCommentId: 'ig_c_r1',
      platformPostId: IG_NATIVE,
      parentPlatformCommentId: 'ig_c_p1',
      authorHandle: 'ig_user',
      body: 'a reply',
    });

    await sync.tick('instagram');

    const { rows } = await pool.query(
      `SELECT parent.platform_comment_id AS parent_pid
         FROM comments child
         JOIN comments parent ON parent.id = child.parent_comment_id
        WHERE child.platform_comment_id = 'ig_c_r1'`,
    );
    expect(rows[0].parent_pid).toBe('ig_c_p1');
  });

  it('our own sent reply polled back is matched, not duplicated', async () => {
    // aIg1 (ig_c_a1) and our sent reply (ig_c_our1) already exist from the seed.
    fakes.store.seedComment({
      platformCommentId: 'ig_c_a1',
      platformPostId: IG_NATIVE,
      authorHandle: 'ig_user_1',
      body: 'Love this!',
    });
    fakes.store.seedComment({
      platformCommentId: 'ig_c_our1',
      platformPostId: IG_NATIVE,
      parentPlatformCommentId: 'ig_c_a1',
      authorHandle: 'primary_handle',
      body: 'Thanks so much!',
    });

    await sync.tick('instagram');

    const { rows } = await pool.query(
      `SELECT author_user_id, send_status FROM comments
        WHERE platform_comment_id = 'ig_c_our1'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].author_user_id).toBe(fixtures.users.primary);
    expect(rows[0].send_status).toBe('sent');
  });
});
