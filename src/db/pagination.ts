export type Cursor = { createdAt: string; id: string };

export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  let decoded: unknown;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    decoded = JSON.parse(json);
  } catch {
    return null;
  }
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof (decoded as Cursor).createdAt !== 'string' ||
    typeof (decoded as Cursor).id !== 'string'
  ) {
    return null;
  }
  return decoded as Cursor;
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
