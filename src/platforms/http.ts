import { PlatformRetryable } from './types.js';

export type JsonResponse<T> = {
  status: number;
  headers: Headers;
  body: T;
  retryAfterMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Transport for both adapters. Owns everything platform-agnostic: a timeout,
 * and the failures that mean "the request never got a usable answer" — a dead
 * socket, a timeout, or a gateway/WAF page in place of JSON. All three become
 * `PlatformRetryable`, because retrying is the honest response to each.
 *
 * Status-code *interpretation* is deliberately NOT here: a non-2xx status is a
 * real answer the adapter must read, and the two platforms read it differently
 * (Instagram by status, TikTok by a body field on a 200).
 */
export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<JsonResponse<T>> {
  let res: Response;
  let text: string;
  try {
    res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    // Inside the same try: the timeout can also fire mid-body, and a stalled
    // read is the same "never got a usable answer" as a dead socket.
    text = await res.text();
  } catch (err) {
    throw new PlatformRetryable(
      `transport failure calling ${withoutQuery(url)}: ${(err as Error).message}`,
    );
  }

  let body: T;
  try {
    body = JSON.parse(text) as T;
  } catch {
    throw new PlatformRetryable(
      `non-JSON response (status ${res.status}) from ${withoutQuery(url)}`,
    );
  }

  const retryAfterMs = parseRetryAfter(res.headers.get('retry-after'));
  return { status: res.status, headers: res.headers, body, retryAfterMs };
}

/**
 * Instagram authenticates with an `access_token` query parameter, and these
 * messages end up in logs and in `comments.send_error`. Only the origin and
 * path may survive into them.
 */
function withoutQuery(url: string): string {
  return url.split('?')[0];
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}
