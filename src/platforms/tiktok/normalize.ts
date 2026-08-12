import type { PlatformComment } from '../types.js';

export type TtComment = {
  comment_id: string;
  text: string;
  username: string;
  create_time: number;
  parent_comment_id?: string;
};

export type TtCommentList = {
  data?: {
    comments?: TtComment[];
    cursor?: number;
    has_more?: boolean;
  };
};

export function normalizeComment(dto: TtComment): PlatformComment {
  return {
    platformCommentId: dto.comment_id,
    parentPlatformCommentId: dto.parent_comment_id ?? null,
    authorHandle: dto.username,
    body: dto.text,
    createdAt: new Date(dto.create_time * 1000),
  };
}

/** TikTok pages on a numeric offset, valid only while `has_more` is true. */
export function nextCursor(list: TtCommentList): string | null {
  const data = list.data;
  return data?.has_more && data.cursor != null ? String(data.cursor) : null;
}
