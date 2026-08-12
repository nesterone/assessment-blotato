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
  type IgComment,
  type IgCommentList,
} from './normalize.js';

const AUTH_EXPIRED_CODE = 190;
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);
const COMMENT_FIELDS = 'id,text,username,timestamp,parent_id';

type IgError = {
  error?: { message?: string; type?: string; code?: number };
};

type IgReplyCreated = { id: string };

export class InstagramClient implements PlatformClient {
  constructor(private readonly baseUrl: string) {}

  async postReply(
    target: ReplyTarget,
    account: ConnectedAccount,
  ): Promise<{ platformCommentId: string }> {
    const url = this.url(
      `/${target.parentPlatformCommentId}/replies`,
      account,
      {
        message: target.body,
      },
    );
    const res = await requestJson<IgReplyCreated & IgError>(url, {
      method: 'POST',
    });
    this.throwOnError(res);
    return { platformCommentId: res.body.id };
  }

  async listComments(
    input: { platformPostId: string; cursor: string | null },
    account: ConnectedAccount,
  ): Promise<CommentPage> {
    return this.list(
      `/${input.platformPostId}/comments`,
      input.cursor,
      account,
    );
  }

  async listReplies(
    input: { parentPlatformCommentId: string; cursor: string | null },
    account: ConnectedAccount,
  ): Promise<CommentPage> {
    const page = await this.list(
      `/${input.parentPlatformCommentId}/replies`,
      input.cursor,
      account,
    );
    return {
      ...page,
      comments: page.comments.map((c) => ({
        ...c,
        parentPlatformCommentId:
          c.parentPlatformCommentId ?? input.parentPlatformCommentId,
      })),
    };
  }

  private async list(
    path: string,
    cursor: string | null,
    account: ConnectedAccount,
  ): Promise<CommentPage> {
    const url = this.url(path, account, {
      fields: COMMENT_FIELDS,
      ...(cursor ? { after: cursor } : {}),
    });
    const res = await requestJson<IgCommentList & IgError>(url);
    this.throwOnError(res);
    return {
      comments: (res.body.data ?? []).map(normalizeComment),
      nextCursor: nextCursor(res.body),
    };
  }

  private url(
    path: string,
    account: ConnectedAccount,
    params: Record<string, string>,
  ): string {
    const url = new URL(this.baseUrl + path);
    url.searchParams.set('access_token', account.accessToken);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url.toString();
  }

  /**
   * Instagram reports failure with an HTTP error status and a numeric `code` in
   * the body. Code drives the branch; status is the fallback (429 → retry,
   * 5xx → retry, other 4xx → reject).
   */
  private throwOnError(res: JsonResponse<IgError>): void {
    if (res.status >= 200 && res.status < 300) return;

    const code = res.body.error?.code;
    const codeStr = code != null ? String(code) : undefined;
    const message = res.body.error?.message ?? `Instagram error ${res.status}`;

    if (code === AUTH_EXPIRED_CODE) {
      throw new PlatformAuthExpired(message, codeStr);
    }
    if (
      res.status === 429 ||
      res.status >= 500 ||
      (code != null && RATE_LIMIT_CODES.has(code))
    ) {
      const err = new PlatformRetryable(message, codeStr);
      err.retryAfterMs = res.retryAfterMs;
      throw err;
    }
    throw new PlatformRejected(message, codeStr);
  }
}

export type { IgComment };
