import type { PlatformComment } from '../types.js';

export type IgComment = {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  parent_id?: string;
};

export type IgCommentList = {
  data: IgComment[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
  };
};

export function normalizeComment(dto: IgComment): PlatformComment {
  return {
    platformCommentId: dto.id,
    parentPlatformCommentId: dto.parent_id ?? null,
    authorHandle: dto.username,
    body: dto.text,
    createdAt: new Date(dto.timestamp),
  };
}

/** Instagram signals "there is a next page" by the presence of `paging.next`. */
export function nextCursor(list: IgCommentList): string | null {
  return list.paging?.next ? (list.paging.cursors?.after ?? null) : null;
}
