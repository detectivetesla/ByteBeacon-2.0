export interface CursorPayload {
  createdAt: string;
  id: string;
}

export interface KeysetPaginationResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

/**
 * High-Performance Keyset / Cursor Pagination Utility.
 * Replaces expensive OFFSET scans on 100k+ / 1M+ record tables with sub-10ms indexed (created_at, id) seek queries.
 */
export class CursorPaginationHelper {
  /**
   * Encodes a cursor from a date and unique ID into an opaque Base64 URL-safe token.
   */
  public static encodeCursor(createdAt: Date | string, id: string): string {
    const dateStr = createdAt instanceof Date ? createdAt.toISOString() : createdAt;
    const payload: CursorPayload = { createdAt: dateStr, id };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  /**
   * Decodes an opaque Base64 cursor token into date and ID components.
   */
  public static decodeCursor(cursor?: string): CursorPayload | null {
    if (!cursor || typeof cursor !== 'string') return null;
    try {
      const json = Buffer.from(cursor, 'base64url').toString('utf-8');
      const parsed = JSON.parse(json) as CursorPayload;
      if (parsed.createdAt && parsed.id) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Builds the WHERE clause and parameter array for keyset pagination.
   * Clause: `(created_at, id) < ($N, $N+1)` for descending sort.
   */
  public static buildKeysetClause(
    cursor: string | undefined,
    startParamIndex = 1,
  ): { clause: string; params: any[]; nextParamIndex: number } {
    const decoded = this.decodeCursor(cursor);
    if (!decoded) {
      return { clause: '', params: [], nextParamIndex: startParamIndex };
    }

    const p1 = `$${startParamIndex}`;
    const p2 = `$${startParamIndex + 1}`;
    const clause = `(created_at, id) < (${p1}, ${p2})`;

    return {
      clause,
      params: [decoded.createdAt, decoded.id],
      nextParamIndex: startParamIndex + 2,
    };
  }

  /**
   * Evaluates query results against limit to calculate nextCursor and hasMore.
   */
  public static formatResult<T extends { createdAt: Date | string; id: string }>(
    rows: T[],
    requestedLimit = 20,
  ): KeysetPaginationResult<T> {
    const hasMore = rows.length > requestedLimit;
    const data = hasMore ? rows.slice(0, requestedLimit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const lastItem = data[data.length - 1];
      nextCursor = this.encodeCursor(lastItem.createdAt, lastItem.id);
    }

    return {
      data,
      nextCursor,
      hasMore,
      limit: requestedLimit,
    };
  }
}
