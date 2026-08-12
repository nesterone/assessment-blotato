/**
 * In-memory state shared by both fake platforms. Holding real state (not
 * canned responses) is what lets the contract suite exercise the round trip
 * that matters most: a reply posted through the sender is polled back by the
 * sync worker and must be recognized as already-seen, not duplicated.
 */

export type StoredComment = {
  platformCommentId: string;
  platformPostId: string;
  parentPlatformCommentId: string | null;
  authorHandle: string;
  body: string;
  createdAt: Date;
};

export const FAKE_PAGE_SIZE = 2;

const EPOCH = Date.UTC(2025, 0, 15, 10, 0, 0);

export type Page = { items: StoredComment[]; nextCursor: string | null };

export class FakeStore {
  private comments: StoredComment[] = [];
  private seq = 0;

  reset(): void {
    this.comments = [];
    this.seq = 0;
  }

  seedComment(input: {
    platformCommentId: string;
    platformPostId: string;
    authorHandle: string;
    body: string;
    parentPlatformCommentId?: string | null;
    createdAt?: Date;
  }): StoredComment {
    const comment: StoredComment = {
      parentPlatformCommentId: null,
      createdAt: new Date(EPOCH + this.seq * 1000),
      ...input,
    };
    this.seq += 1;
    this.comments.push(comment);
    return comment;
  }

  addReply(input: {
    platformPostId: string;
    parentPlatformCommentId: string;
    authorHandle: string;
    body: string;
    idPrefix: string;
  }): StoredComment {
    this.seq += 1;
    return this.seedComment({
      platformCommentId: `${input.idPrefix}_reply_${this.seq}`,
      platformPostId: input.platformPostId,
      parentPlatformCommentId: input.parentPlatformCommentId,
      authorHandle: input.authorHandle,
      body: input.body,
    });
  }

  get(platformCommentId: string): StoredComment | undefined {
    return this.comments.find((c) => c.platformCommentId === platformCommentId);
  }

  has(platformCommentId: string): boolean {
    return this.comments.some((c) => c.platformCommentId === platformCommentId);
  }

  topLevel(platformPostId: string, cursor: string | null): Page {
    return this.paginate(
      this.comments.filter(
        (c) =>
          c.platformPostId === platformPostId &&
          c.parentPlatformCommentId === null,
      ),
      cursor,
    );
  }

  replies(parentPlatformCommentId: string, cursor: string | null): Page {
    return this.paginate(
      this.comments.filter(
        (c) => c.parentPlatformCommentId === parentPlatformCommentId,
      ),
      cursor,
    );
  }

  private paginate(matches: StoredComment[], cursor: string | null): Page {
    const sorted = matches.sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.platformCommentId.localeCompare(b.platformCommentId),
    );
    const offset = Number(cursor ?? 0);
    const items = sorted.slice(offset, offset + FAKE_PAGE_SIZE);
    const nextOffset = offset + items.length;
    const nextCursor = nextOffset < sorted.length ? String(nextOffset) : null;
    return { items, nextCursor };
  }
}
