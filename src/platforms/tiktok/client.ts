import { requestJson, type JsonResponse } from '../http.js';
import {
  PlatformAuthExpired,
  PlatformRejected,
  PlatformRetryable,
  type CommentPage,
  type ConnectedAccount,
  type PlatformClient,
  type ReplyTarget,
} from '../types.js';
import {
  nextCursor,
  normalizeComment,
  type TtCommentList,
} from './normalize.js';

const OK = 'ok';
const AUTH_CODES = new Set([
  'access_token_invalid',
  'access_token_expired',
  'scope_not_authorized',
]);
const RATE_CODES = new Set([
  'rate_limit_exceeded',
  'spam_risk_too_many_requests',
]);
const RETRYABLE_CODES = new Set(['internal_error']);
const PAGE_SIZE = 50;

type TtEnvelope = {
  error?: { code?: string; message?: string; log_id?: string };
};

type TtReplyCreated = TtEnvelope & { data?: { comment_id?: string } };

export class TiktokClient implements PlatformClient {
  constructor(private readonly baseUrl: string) {}

  async postReply(
    target: ReplyTarget,
    account: ConnectedAccount,
  ): Promise<{ platformCommentId: string }> {
    const res = await this.post<TtReplyCreated>('/v2/comment/reply/', account, {
      video_id: target.platformPostId,
      comment_id: target.parentPlatformCommentId,
      text: target.body,
    });
    this.throwOnError(res);
    const id = res.body.data?.comment_id;
    if (!id) {
      throw new PlatformRejected('TikTok returned no comment_id');
    }
    return { platformCommentId: id };
  }

  async listComments(
    input: { platformPostId: string; cursor: string | null },
    account: ConnectedAccount,
  ): Promise<CommentPage> {
    const res = await this.post<TtCommentList & TtEnvelope>(
      '/v2/video/comment/list/',
      account,
      {
        video_id: input.platformPostId,
        cursor: Number(input.cursor ?? 0),
        count: PAGE_SIZE,
      },
    );
    this.throwOnError(res);
    return this.page(res.body);
  }

  async listReplies(
    input: { parentPlatformCommentId: string; cursor: string | null },
    account: ConnectedAccount,
  ): Promise<CommentPage> {
    const res = await this.post<TtCommentList & TtEnvelope>(
      '/v2/video/comment/reply/list/',
      account,
      {
        comment_id: input.parentPlatformCommentId,
        cursor: Number(input.cursor ?? 0),
        count: PAGE_SIZE,
      },
    );
    this.throwOnError(res);
    const page = this.page(res.body);
    return {
      ...page,
      comments: page.comments.map((c) => ({
        ...c,
        parentPlatformCommentId:
          c.parentPlatformCommentId ?? input.parentPlatformCommentId,
      })),
    };
  }

  private page(body: TtCommentList): CommentPage {
    return {
      comments: (body.data?.comments ?? []).map(normalizeComment),
      nextCursor: nextCursor(body),
    };
  }

  private post<T>(
    path: string,
    account: ConnectedAccount,
    payload: Record<string, unknown>,
  ): Promise<JsonResponse<T>> {
    return requestJson<T>(this.baseUrl + path, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${account.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  /**
   * TikTok answers `200 OK` even on failure and hides the outcome in
   * `error.code` — `"ok"` is success, anything else is the error. An adapter
   * that trusted the HTTP status would mark every failed call as sent.
   */
  private throwOnError(res: JsonResponse<TtEnvelope>): void {
    if (res.status >= 500) {
      const err = new PlatformRetryable(`TikTok error ${res.status}`);
      err.retryAfterMs = res.retryAfterMs;
      throw err;
    }

    const code = res.body.error?.code;
    if (!code || code === OK) return;

    const message = res.body.error?.message || `TikTok error ${code}`;
    if (AUTH_CODES.has(code)) throw new PlatformAuthExpired(message, code);
    if (RATE_CODES.has(code) || RETRYABLE_CODES.has(code)) {
      const err = new PlatformRetryable(message, code);
      err.retryAfterMs = res.retryAfterMs;
      throw err;
    }
    throw new PlatformRejected(message, code);
  }
}
