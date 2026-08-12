import { AppError } from '../errors.js';

export type ReplyTarget = {
  platformPostId: string;
  parentPlatformCommentId: string;
  body: string;
};

export type ConnectedAccount = {
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  platformAccountId: string;
};

export type PlatformComment = {
  platformCommentId: string;
  parentPlatformCommentId: string | null;
  authorHandle: string;
  body: string;
  createdAt: Date;
};

export type CommentPage = {
  comments: PlatformComment[];
  nextCursor: string | null;
};

export interface PlatformClient {
  postReply(
    target: ReplyTarget,
    account: ConnectedAccount,
  ): Promise<{ platformCommentId: string }>;

  listComments(
    input: { platformPostId: string; cursor: string | null },
    account: ConnectedAccount,
  ): Promise<CommentPage>;

  listReplies(
    input: { parentPlatformCommentId: string; cursor: string | null },
    account: ConnectedAccount,
  ): Promise<CommentPage>;
}

/**
 * `platformCode` preserves the platform's own error code (Instagram's numeric
 * `code`, TikTok's string `error.code`) after we collapse it into one of three
 * worker branches. Metrics group on it since the class name no longer splits
 * rate-limiting from 5xx.
 */
export class PlatformError extends AppError {
  constructor(
    message: string,
    readonly platformCode?: string,
  ) {
    super(message);
  }
}

export class PlatformRetryable extends PlatformError {
  retryAfterMs?: number;
}

export class PlatformAuthExpired extends PlatformError {}

export class PlatformRejected extends PlatformError {}
