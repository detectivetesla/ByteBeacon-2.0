import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeneficiaryService } from '../../src/core/commerce/beneficiary.service.js';
import { BeneficiaryCacheService } from '../../src/core/cache/beneficiary-cache.service.js';
import { NetworkProvider } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Beneficiary Bulk Verification Performance & Zero N+1 Queries', () => {
  let mockDb: any;
  let queryCount: number;
  let executedQueries: string[];
  let mockTelecomProvider: any;
  let mockCacheService: any;
  let beneficiaryService: BeneficiaryService;

  beforeEach(() => {
    queryCount = 0;
    executedQueries = [];

    mockDb = {
      query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
        queryCount++;
        executedQueries.push(sql.trim());

        // Return empty rows or simulated known approvals
        if (sql.includes('FROM beneficiary_validation') && sql.includes('UNION')) {
          // Simulate that numbers ending in '00' are already approved in DB
          const phones: string[] = params?.[0] || [];
          const knownRows = phones
            .filter((p) => p.endsWith('00'))
            .map((p) => ({ phoneNumber: p }));
          return { rows: knownRows };
        }

        if (sql.includes('FROM pending_beneficiary_approvals') && sql.includes('PENDING')) {
          return { rows: [] };
        }

        return { rows: [] };
      }),
    } as unknown as pg.Pool;

    mockTelecomProvider = {
      providerName: 'DATAHOUSE',
      precheckBeneficiaries: vi.fn().mockImplementation(async ({ phoneNumbers }) => {
        return {
          network: NetworkProvider.MTN,
          enforced: true,
          results: phoneNumbers.map((phone: string) => {
            // Numbers ending in '10' or '20' are live telecom approved
            const isApproved = phone.endsWith('10') || phone.endsWith('20');
            return {
              phoneNumber: phone,
              isValid: true,
              isKnown: isApproved,
              orderable: isApproved,
              status: isApproved ? 'APPROVED' : 'UNAPPROVED',
            };
          }),
        };
      }),
    };

    mockCacheService = {
      getCachedResults: vi.fn().mockResolvedValue(new Map()),
      setCachedResults: vi.fn().mockResolvedValue(undefined),
    };

    beneficiaryService = new BeneficiaryService(
      mockDb,
      mockTelecomProvider,
      mockCacheService as BeneficiaryCacheService,
    );
  });

  it('processes 500 beneficiaries with flat O(1) bulk queries and ZERO N+1 loops', async () => {
    // Generate 500 valid MTN Ghanaian mobile numbers: 0240000000 -> 0240000499
    const testNumbers: string[] = [];
    for (let i = 0; i < 500; i++) {
      testNumbers.push(`024${String(i).padStart(7, '0')}`);
    }

    expect(testNumbers.length).toBe(500);

    const result = await beneficiaryService.precheckAgentBeneficiaries({
      network: NetworkProvider.MTN,
      phoneNumbers: testNumbers,
      record: true,
      userId: 'usr_perf_test',
    });

    // 1. Authoritative verification invariants
    expect(result.summary.requested).toBe(500);
    expect(result.summary.unique).toBe(500);
    expect(result.summary.valid).toBe(500);
    expect(result.summary.invalid).toBe(0);
    expect(result.results.length).toBe(500);

    // 2. Strict N+1 avoidance:
    // With 500 rows, a naive implementation would execute 500 to 1,500 individual queries.
    // Our batch implementation executes under 10 total queries regardless of batch size!
    expect(queryCount).toBeLessThanOrEqual(10);

    // 3. Verify that queries utilize Postgres array ANY($1) or unnest($1)
    const usesBulkSql = executedQueries.some(
      (q) => q.includes('ANY($1)') || q.includes('unnest($1') || q.includes('unnest('),
    );
    expect(usesBulkSql).toBe(true);

    // 4. Cache integration check: bulk lookup called once with all unique valid numbers
    expect(mockCacheService.getCachedResults).toHaveBeenCalledTimes(1);
    expect(mockCacheService.getCachedResults).toHaveBeenCalledWith(
      'MTN',
      expect.arrayContaining(['0240000000', '0240000499']),
    );

    // 5. Cache write-back check: results written back to cache
    expect(mockCacheService.setCachedResults).toHaveBeenCalledTimes(1);
    const networkArg = mockCacheService.setCachedResults.mock.calls[0][0];
    const cachedItems = mockCacheService.setCachedResults.mock.calls[0][1];
    expect(networkArg).toBe('MTN');
    expect(cachedItems.length).toBe(500);
  });

  it('leverages multi-tier cache hits and bypasses upstream telecom provider calls', async () => {
    const testNumbers = ['0241000001', '0241000002', '0241000003'];

    // Mock cache hit for all 3 numbers
    const cachedMap = new Map();
    cachedMap.set('0241000001', {
      phoneNumber: '0241000001',
      normalized: '0241000001',
      network: 'MTN',
      status: 'APPROVED',
      isValid: true,
      isKnown: true,
      orderable: true,
    });
    cachedMap.set('0241000002', {
      phoneNumber: '0241000002',
      normalized: '0241000002',
      network: 'MTN',
      status: 'APPROVED',
      isValid: true,
      isKnown: true,
      orderable: true,
    });
    cachedMap.set('0241000003', {
      phoneNumber: '0241000003',
      normalized: '0241000003',
      network: 'MTN',
      status: 'UNAPPROVED',
      isValid: true,
      isKnown: false,
      orderable: false,
    });

    mockCacheService.getCachedResults.mockResolvedValueOnce(cachedMap);

    const result = await beneficiaryService.precheckAgentBeneficiaries({
      network: NetworkProvider.MTN,
      phoneNumbers: testNumbers,
    });

    // Telecom provider should NOT have been called because all numbers were cached
    expect(mockTelecomProvider.precheckBeneficiaries).not.toHaveBeenCalled();

    // Verification outcomes match cache values
    expect(result.summary.known).toBe(2);
    expect(result.summary.unknown).toBe(1);
    const approved = result.results.filter((r) => r.status === 'APPROVED');
    const unapproved = result.results.filter((r) => r.status === 'UNAPPROVED');
    expect(approved.length).toBe(2);
    expect(unapproved.length).toBe(1);
  });
});
