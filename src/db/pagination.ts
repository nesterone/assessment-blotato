import { and, eq, lt, or } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { InvalidCursorError } from '../errors.js';

export type Cursor = { createdAt: string; id: string };

export const DEFAULT_LIMIT = 50;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/**
 * Keyset predicate for a `createdAt DESC, id DESC` page: strictly older rows,
 * falling back to the id to break ties between identical timestamps.
 */
export function afterCursor(
  createdAt: AnyPgColumn,
  id: AnyPgColumn,
  cursor: Cursor | null,
) {
  if (!cursor) return undefined;
  const at = new Date(cursor.createdAt);
  return or(lt(createdAt, at), and(eq(createdAt, at), lt(id, cursor.id)));
}

export function encodeCursor(row: {
  createdAt: Date | string;
  id: string;
}): string {
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt;
  return Buffer.from(JSON.stringify({ createdAt, id: row.id })).toString(
    'base64url',
  );
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
