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
   *
   * The status still has to be read, because anything in front of the API — a
   * proxy, a WAF, a load balancer — answers with a real status and a body that
   * has no `error.code` at all. Reading only the body scores those as success.
   */
  private throwOnError(res: JsonResponse<TtEnvelope>): void {
    const code = res.body.error?.code;
    const message = res.body.error?.message;

    if (res.status >= 500) {
      throw retryable(
        message || `TikTok error ${res.status}`,
        code,
        res.retryAfterMs,
      );
    }

    if (code && code !== OK) {
      const text = message || `TikTok error ${code}`;
      if (AUTH_CODES.has(code)) throw new PlatformAuthExpired(text, code);
      if (RATE_CODES.has(code) || RETRYABLE_CODES.has(code)) {
        throw retryable(text, code, res.retryAfterMs);
      }
      throw new PlatformRejected(text, code);
    }

    if (res.status >= 200 && res.status < 300) return;

    const text = message || `TikTok error ${res.status}`;
    if (res.status === 429) throw retryable(text, code, res.retryAfterMs);
    throw new PlatformRejected(text, code);
  }
}

function retryable(
  message: string,
  code: string | undefined,
  retryAfterMs: number | undefined,
): PlatformRetryable {
  const err = new PlatformRetryable(message, code);
  err.retryAfterMs = retryAfterMs;
  return err;
}
