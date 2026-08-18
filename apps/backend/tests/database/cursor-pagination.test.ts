import { describe, it, expect } from 'vitest';
import { CursorPaginationHelper } from '../../src/infrastructure/database/cursor-pagination.helper.js';

describe('Phase 9.1: High-Performance Keyset Cursor Pagination Suite', () => {
  it('should encode and decode cursor tokens into date and id components accurately', () => {
    const originalDate = new Date('2026-08-18T12:00:00.000Z');
    const originalId = 'ord_12345_uuid';

    const token = CursorPaginationHelper.encodeCursor(originalDate, originalId);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);

    const decoded = CursorPaginationHelper.decodeCursor(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.createdAt).toBe('2026-08-18T12:00:00.000Z');
    expect(decoded?.id).toBe(originalId);
  });

  it('should return null for malformed or corrupted cursor tokens', () => {
    expect(CursorPaginationHelper.decodeCursor('invalid-base64')).toBeNull();
    expect(CursorPaginationHelper.decodeCursor('')).toBeNull();
    expect(CursorPaginationHelper.decodeCursor(undefined)).toBeNull();
  });

  it('should build parameterized keyset WHERE clause for indexed seek queries', () => {
    const cursor = CursorPaginationHelper.encodeCursor('2026-08-18T10:00:00.000Z', 'ord_seek_target');
    const result = CursorPaginationHelper.buildKeysetClause(cursor, 3);

    expect(result.clause).toBe('(created_at, id) < ($3, $4)');
    expect(result.params).toEqual(['2026-08-18T10:00:00.000Z', 'ord_seek_target']);
    expect(result.nextParamIndex).toBe(5);
  });

  it('should correctly calculate hasMore and nextCursor when dataset exceeds limit', () => {
    const rows = [
      { id: '1', createdAt: '2026-08-18T10:00:00.000Z', amount: 100 },
      { id: '2', createdAt: '2026-08-18T09:00:00.000Z', amount: 200 },
      { id: '3', createdAt: '2026-08-18T08:00:00.000Z', amount: 300 }, // Extra item indicating hasMore
    ];

    const result = CursorPaginationHelper.formatResult(rows, 2);

    expect(result.hasMore).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.limit).toBe(2);
    expect(result.nextCursor).not.toBeNull();

    const decodedNext = CursorPaginationHelper.decodeCursor(result.nextCursor!);
    expect(decodedNext?.id).toBe('2');
  });

  it('should return hasMore: false and nextCursor: null when page reaches end of dataset', () => {
    const rows = [{ id: '1', createdAt: '2026-08-18T10:00:00.000Z', amount: 100 }];

    const result = CursorPaginationHelper.formatResult(rows, 10);

    expect(result.hasMore).toBe(false);
    expect(result.data).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });
});
