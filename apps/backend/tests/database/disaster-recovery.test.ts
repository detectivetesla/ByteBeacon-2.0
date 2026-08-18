import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DisasterRecoveryService } from '../../src/infrastructure/database/disaster-recovery.service.js';
import type pg from 'pg';

describe('Phase 9.4: Backup Verification & Disaster Recovery Suite', () => {
  let mockDb: pg.Pool;
  let drService: DisasterRecoveryService;

  beforeEach(() => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('FROM financial_ledger')) {
          return Promise.resolve({
            rows: [
              {
                id: 'led_1',
                transaction_id: 'txn_1',
                entry_type: 'DEBIT',
                account_id: 'acc_escrow',
                amount_pesewas: '10000',
                created_at: new Date('2026-08-18T10:00:00Z'),
              },
              {
                id: 'led_2',
                transaction_id: 'txn_1',
                entry_type: 'CREDIT',
                account_id: 'usr_1',
                amount_pesewas: '10000',
                created_at: new Date('2026-08-18T10:00:00Z'),
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    drService = new DisasterRecoveryService(mockDb);
  });

  describe('Ledger Cryptographic Checksums', () => {
    it('should compute valid balanced checksum over financial ledger rows', async () => {
      const checksum = await drService.computeLedgerChecksum();

      expect(checksum.totalEntries).toBe(2);
      expect(checksum.totalDebitsPesewas).toBe(10000n);
      expect(checksum.totalCreditsPesewas).toBe(10000n);
      expect(checksum.isBalanced).toBe(true);
      expect(checksum.sha256Checksum).toHaveLength(64);
    });
  });

  describe('Backup Restore Verification', () => {
    it('should verify restored backup when snapshot matches database state exactly', async () => {
      const sourceSnapshot = await drService.computeLedgerChecksum();
      const verification = await drService.verifyRestoredBackup(sourceSnapshot);

      expect(verification.isVerified).toBe(true);
      expect(verification.discrepancies).toHaveLength(0);
    });

    it('should flag verification failure if restored database has missing or tampered entries', async () => {
      const sourceSnapshot = await drService.computeLedgerChecksum();

      // Simulate restored database missing 1 entry
      (mockDb.query as any).mockResolvedValueOnce({
        rows: [
          {
            id: 'led_1',
            transaction_id: 'txn_1',
            entry_type: 'DEBIT',
            account_id: 'acc_escrow',
            amount_pesewas: '10000',
            created_at: new Date('2026-08-18T10:00:00Z'),
          },
        ],
      });

      const verification = await drService.verifyRestoredBackup(sourceSnapshot);

      expect(verification.isVerified).toBe(false);
      expect(verification.discrepancies.length).toBeGreaterThan(0);
      expect(verification.discrepancies.some((d) => d.includes('Entry count mismatch'))).toBe(true);
    });
  });
});
