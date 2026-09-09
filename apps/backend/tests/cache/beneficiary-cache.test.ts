import { describe, it, expect, vi } from 'vitest';
import {
  BeneficiaryCacheService,
  CachedBeneficiaryVerification,
} from '../../src/core/cache/beneficiary-cache.service.js';

describe('BeneficiaryCacheService', () => {
  it('returns empty map when redis is not initialized', async () => {
    const cacheService = new BeneficiaryCacheService(null);
    const result = await cacheService.getCachedResults('MTN', ['0241234567']);
    expect(result.size).toBe(0);
  });

  it('retrieves cached beneficiary results via mget in single round-trip', async () => {
    const mockCachedItem: CachedBeneficiaryVerification = {
      phoneNumber: '0241234567',
      normalized: '0241234567',
      network: 'MTN',
      status: 'APPROVED',
      isValid: true,
      isKnown: true,
      orderable: true,
      cachedAt: Date.now(),
      ttlSeconds: 86400,
    };

    const mockRedis = {
      mget: vi.fn().mockResolvedValue([JSON.stringify(mockCachedItem), null]),
      pipeline: vi.fn(),
      del: vi.fn(),
    } as any;

    const cacheService = new BeneficiaryCacheService(mockRedis);
    const result = await cacheService.getCachedResults('MTN', ['0241234567', '0249999999']);

    expect(mockRedis.mget).toHaveBeenCalledWith(
      'bb:cache:beneficiary:MTN:0241234567',
      'bb:cache:beneficiary:MTN:0249999999',
    );
    expect(result.size).toBe(1);
    expect(result.get('0241234567')?.status).toBe('APPROVED');
    expect(result.get('0249999999')).toBeUndefined();
  });

  it('stores cached beneficiary results with exact TTL policies via pipelined setex', async () => {
    const setexMock = vi.fn();
    const execMock = vi.fn().mockResolvedValue([]);
    const mockPipeline = {
      setex: setexMock,
      exec: execMock,
    };

    const mockRedis = {
      pipeline: vi.fn().mockReturnValue(mockPipeline),
    } as any;

    const cacheService = new BeneficiaryCacheService(mockRedis);

    const items: CachedBeneficiaryVerification[] = [
      {
        phoneNumber: '0241111111',
        normalized: '0241111111',
        network: 'MTN',
        status: 'APPROVED',
        isValid: true,
        isKnown: true,
        orderable: true,
        cachedAt: Date.now(),
        ttlSeconds: BeneficiaryCacheService.TTL_APPROVED, // 86400s (24h)
      },
      {
        phoneNumber: '0242222222',
        normalized: '0242222222',
        network: 'MTN',
        status: 'UNAPPROVED',
        isValid: true,
        isKnown: false,
        orderable: false,
        cachedAt: Date.now(),
        ttlSeconds: BeneficiaryCacheService.TTL_UNAPPROVED, // 3600s (1h)
      },
      {
        phoneNumber: '0243333333',
        normalized: '0243333333',
        network: 'MTN',
        status: 'REJECTED',
        isValid: false,
        isKnown: false,
        orderable: false,
        cachedAt: Date.now(),
        ttlSeconds: BeneficiaryCacheService.TTL_REJECTED, // 86400s (24h)
      },
    ];

    await cacheService.setCachedResults('MTN', items);

    expect(mockRedis.pipeline).toHaveBeenCalled();
    expect(setexMock).toHaveBeenCalledWith(
      'bb:cache:beneficiary:MTN:0241111111',
      86400,
      expect.stringContaining('"status":"APPROVED"'),
    );
    expect(setexMock).toHaveBeenCalledWith(
      'bb:cache:beneficiary:MTN:0242222222',
      3600,
      expect.stringContaining('"status":"UNAPPROVED"'),
    );
    expect(setexMock).toHaveBeenCalledWith(
      'bb:cache:beneficiary:MTN:0243333333',
      86400,
      expect.stringContaining('"status":"REJECTED"'),
    );
    expect(execMock).toHaveBeenCalled();
  });

  it('degrades gracefully without throwing when Redis fails', async () => {
    const brokenRedis = {
      mget: vi.fn().mockRejectedValue(new Error('Connection lost')),
      pipeline: vi.fn().mockReturnValue({
        setex: vi.fn(),
        exec: vi.fn().mockRejectedValue(new Error('Connection lost')),
      }),
      del: vi.fn().mockRejectedValue(new Error('Connection lost')),
    } as any;

    const cacheService = new BeneficiaryCacheService(brokenRedis);

    // Should return empty map and not throw
    const results = await cacheService.getCachedResults('MTN', ['0241234567']);
    expect(results.size).toBe(0);

    // Should catch and not throw
    await expect(cacheService.setCachedResults('MTN', [])).resolves.not.toThrow();
    await expect(cacheService.deleteCachedResults('MTN', ['0241234567'])).resolves.not.toThrow();
  });
});
