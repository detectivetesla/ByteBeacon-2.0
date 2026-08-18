import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinancialLedgerService } from '../../src/core/payments/financial-ledger.service.js';
import { LedgerEntryType, LedgerAccountType, Currency } from '@bytebeacon/shared';
import { BadRequestError } from '../../src/core/errors/app-error.js';
import type pg from 'pg';

describe('Phase 8.3: Financial & Double-Entry Ledger Integrity Suite', () => {
  let ledgerService: FinancialLedgerService;
  let mockDb: pg.Pool;

  beforeEach(() => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string, params?: any[]) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('INSERT INTO financial_ledger')) {
          return Promise.resolve({
            rows: [
              {
                id: 'led_entry_uuid',
                entryType: params?.[1],
                accountType: params?.[2],
                accountId: params?.[3],
                amountPesewas: params?.[4],
                currency: params?.[5] || Currency.GHS,
                referenceType: params?.[6],
                referenceId: params?.[7],
                description: params?.[8],
                createdAt: new Date().toISOString(),
              },
            ],
          });
        }
        if (sql.includes('SELECT entry_type as "entryType"')) {
          return Promise.resolve({
            rows: [
              {
                entryType: LedgerEntryType.DEBIT,
                accountType: LedgerAccountType.PLATFORM_ESCROW,
                accountId: 'acc_escrow',
                amountPesewas: 10000,
                currency: Currency.GHS,
                referenceType: 'TOPUP',
                referenceId: 'ref_topup_1',
              },
              {
                entryType: LedgerEntryType.CREDIT,
                accountType: LedgerAccountType.CUSTOMER_WALLET,
                accountId: 'usr_agt_1',
                amountPesewas: 10000,
                currency: Currency.GHS,
                referenceType: 'TOPUP',
                referenceId: 'ref_topup_1',
              },
            ],
          });
        }
        if (sql.includes('SELECT transaction_id') && sql.includes('HAVING SUM')) {
          return Promise.resolve({ rows: [] }); // No unbalanced transactions
        }
        if (sql.includes('SELECT account_id') && sql.includes('HAVING (SUM')) {
          return Promise.resolve({ rows: [] }); // No negative wallets
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    ledgerService = new FinancialLedgerService(mockDb);
  });

  describe('Balanced Journal Entry Constraints', () => {
    it('should successfully post balanced journal entries (Total Debits === Total Credits)', async () => {
      const items = [
        {
          entryType: LedgerEntryType.DEBIT,
          accountType: LedgerAccountType.PLATFORM_ESCROW,
          accountId: 'acc_escrow',
          amountPesewas: 50025, // GH₵ 500.25
          referenceType: 'TOPUP',
          referenceId: 'ref_1',
          description: 'Topup deposit',
        },
        {
          entryType: LedgerEntryType.CREDIT,
          accountType: LedgerAccountType.CUSTOMER_WALLET,
          accountId: 'usr_1',
          amountPesewas: 50025, // GH₵ 500.25
          referenceType: 'TOPUP',
          referenceId: 'ref_1',
          description: 'Wallet credited',
        },
      ];

      const entries = await ledgerService.recordJournalEntries(mockDb, items);
      expect(entries).toHaveLength(2);
      expect(entries[0].amountPesewas).toBe(50025);
    });

    it('should throw BadRequestError if journal entry is unbalanced (Total Debits !== Total Credits)', async () => {
      const unbalancedItems = [
        {
          entryType: LedgerEntryType.DEBIT,
          accountType: LedgerAccountType.PLATFORM_ESCROW,
          accountId: 'acc_escrow',
          amountPesewas: 5000,
          referenceType: 'TOPUP',
          referenceId: 'ref_1',
          description: 'Topup deposit',
        },
        {
          entryType: LedgerEntryType.CREDIT,
          accountType: LedgerAccountType.CUSTOMER_WALLET,
          accountId: 'usr_1',
          amountPesewas: 4000, // 1000 pesewas discrepancy
          referenceType: 'TOPUP',
          referenceId: 'ref_1',
          description: 'Wallet credited',
        },
      ];

      await expect(ledgerService.recordJournalEntries(mockDb, unbalancedItems)).rejects.toThrow(
        BadRequestError,
      );
    });

    it('should reject non-integer or floating-point monetary values', async () => {
      const floatingPointItems = [
        {
          entryType: LedgerEntryType.DEBIT,
          accountType: LedgerAccountType.PLATFORM_ESCROW,
          accountId: 'acc_escrow',
          amountPesewas: 500.25 as any, // Invalid floating-point amount
          referenceType: 'TOPUP',
          referenceId: 'ref_1',
          description: 'Invalid float',
        },
        {
          entryType: LedgerEntryType.CREDIT,
          accountType: LedgerAccountType.CUSTOMER_WALLET,
          accountId: 'usr_1',
          amountPesewas: 500.25 as any,
          referenceType: 'TOPUP',
          referenceId: 'ref_1',
          description: 'Invalid float',
        },
      ];

      await expect(ledgerService.recordJournalEntries(mockDb, floatingPointItems)).rejects.toThrow(
        BadRequestError,
      );
    });
  });

  describe('Append-Only Reversal Transactions', () => {
    it('should post equal-and-opposite balanced entries for transaction reversals', async () => {
      const reversals = await ledgerService.recordReversalTransaction(
        mockDb,
        'txn_orig_123',
        'Duplicate payment refund correction',
      );

      expect(reversals).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO financial_ledger'),
        expect.any(Array),
      );
    });
  });

  describe('Financial Anomaly Detection', () => {
    it('should detect zero anomalies on clean balanced ledger state', async () => {
      const report = await ledgerService.detectAnomalies();
      expect(report.hasAnomalies).toBe(false);
      expect(report.unbalancedTransactionsCount).toBe(0);
      expect(report.negativeWalletsCount).toBe(0);
    });

    it('should report anomalies when unbalanced entries or negative balances exist', async () => {
      (mockDb.query as any).mockImplementation((query: string) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('SELECT transaction_id') && sql.includes('HAVING SUM')) {
          return Promise.resolve({
            rows: [{ transaction_id: 'txn_bad_1', totalDebits: 500, totalCredits: 400 }],
          });
        }
        if (sql.includes('SELECT account_id') && sql.includes('HAVING (SUM')) {
          return Promise.resolve({
            rows: [{ account_id: 'usr_neg_1', balance: -2500 }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const report = await ledgerService.detectAnomalies();
      expect(report.hasAnomalies).toBe(true);
      expect(report.unbalancedTransactionsCount).toBe(1);
      expect(report.negativeWalletsCount).toBe(1);
      expect(report.anomalies).toHaveLength(2);
    });
  });
});
