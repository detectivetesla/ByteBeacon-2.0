import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdempotencyService } from '../../src/core/commerce/idempotency.service.js';
import type pg from 'pg';

describe('Dual-Mode Idempotency Extraction & Collision Protection', () => {
  let mockDb: pg.Pool;
  let idempotencyService: IdempotencyService;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as pg.Pool;

    idempotencyService = new IdempotencyService(mockDb, null);
  });

  describe('Key Extraction Across API Standards', () => {
    it('should extract key from ByteBeacon standard Idempotency-Key header', () => {
      const req = {
        headers: {
          'idempotency-key': 'bb_header_key_123',
        },
        body: {
          amount: 500,
        },
      };

      const key = idempotencyService.extractKey(req);
      expect(key).toBe('bb_header_key_123');
    });

    it('should extract key from x-idempotency-key header fallback', () => {
      const req = {
        headers: {
          'x-idempotency-key': 'x_header_key_456',
        },
      };

      const key = idempotencyService.extractKey(req);
      expect(key).toBe('x_header_key_456');
    });

    it('should extract key from DataHouse Agent API body property idempotencyKey', () => {
      const req = {
        headers: {},
        body: {
          bundleId: 'bdl_123',
          phoneNumber: '0241234567',
          idempotencyKey: 'dh_body_key_789',
        },
      };

      const key = idempotencyService.extractKey(req);
      expect(key).toBe('dh_body_key_789');
    });

    it('should prioritize HTTP header over body idempotencyKey if both present', () => {
      const req = {
        headers: {
          'idempotency-key': 'header_priority_key',
        },
        body: {
          idempotencyKey: 'body_secondary_key',
        },
      };

      const key = idempotencyService.extractKey(req);
      expect(key).toBe('header_priority_key');
    });

    it('should return undefined if no key is present in header or body', () => {
      const req = {
        headers: {},
        body: {
          someField: 'value',
        },
      };

      const key = idempotencyService.extractKey(req);
      expect(key).toBeUndefined();
    });
  });

  describe('Payload Hash Computation & Replay Protection', () => {
    it('should compute identical hash for identical payloads', () => {
      const payload1 = { network: 'MTN', phone: '0241234567', amount: 500 };
      const payload2 = { network: 'MTN', phone: '0241234567', amount: 500 };

      const hash1 = idempotencyService.computeHash(payload1);
      const hash2 = idempotencyService.computeHash(payload2);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256
    });

    it('should throw ConflictError on key collision with mismatched payload', async () => {
      (mockDb.query as any).mockResolvedValueOnce({
        rows: [
          {
            responseStatus: 200,
            responseBody: { success: true },
            requestHash: 'original_hash_123',
          },
        ],
      });

      await expect(
        idempotencyService.getExistingResponse('key_1', 'user_1', 'different_hash_456'),
      ).rejects.toThrow('Idempotency key collision');
    });
  });
});
