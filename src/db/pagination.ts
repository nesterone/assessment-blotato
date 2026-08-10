export type Cursor = { createdAt: string; id: string };

export class InvalidCursorError extends Error {
  readonly statusCode = 400;
  constructor(message = 'Invalid cursor') {
    super(message);
    this.name = 'InvalidCursorError';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  let decoded: unknown;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    decoded = JSON.parse(json);
  } catch {
    throw new InvalidCursorError();
  }
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof (decoded as Cursor).createdAt !== 'string' ||
    typeof (decoded as Cursor).id !== 'string'
  ) {
    throw new InvalidCursorError();
  }
  const { createdAt, id } = decoded as Cursor;
  if (Number.isNaN(new Date(createdAt).getTime()) || !UUID_RE.test(id)) {
    throw new InvalidCursorError();
  }
  return { createdAt, id };
}

export function encodeCursor(row: { createdAt: Date | string; id: string }): string {
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt;
  return Buffer.from(JSON.stringify({ createdAt, id: row.id })).toString('base64url');
}

/**
 * Given a query result of `limit + 1` rows, returns the page + optional cursor.
 * The caller is responsible for issuing `LIMIT limit + 1` and applying the
 * keyset predicate; this helper just handles the "did we get an extra row?"
 * bookkeeping so every list endpoint doesn't repeat it.
 */
export function paginate<T extends { createdAt: Date | string; id: string }>(
  rows: T[],
  limit: number,
): { rows: T[]; nextCursor: string | null } {
  if (rows.length <= limit) {
    return { rows, nextCursor: null };
  }
  const page = rows.slice(0, limit);
  const last = page[page.length - 1]!;
  return { rows: page, nextCursor: encodeCursor(last) };
}
