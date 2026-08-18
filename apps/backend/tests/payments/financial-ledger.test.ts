import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinancialLedgerService } from '../../src/core/payments/financial-ledger.service.js';
import { LedgerEntryType, LedgerAccountType, Currency } from '@bytebeacon/shared';
import type pg from 'pg';

describe('FinancialLedgerService Double-Entry Invariants', () => {
  let mockDb: pg.Pool;
  let ledgerService: FinancialLedgerService;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as pg.Pool;

    ledgerService = new FinancialLedgerService(mockDb);
  });

  describe('Balanced Journal Entry Invariant (Debits === Credits)', () => {
    it('should record balanced journal entries atomically and return entries with UUID', async () => {
      (mockDb.query as any)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'led_1',
              entryType: 'DEBIT',
              accountType: 'PLATFORM_ESCROW',
              accountId: '00000000-0000-0000-0000-000000000000',
              amountPesewas: '10000',
              currency: 'GHS',
              referenceType: 'PAYMENT',
              referenceId: 'pay_123',
              description: 'Customer payment received',
              createdAt: new Date().toISOString(),
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'led_2',
              entryType: 'CREDIT',
              accountType: 'CUSTOMER_WALLET',
              accountId: 'usr_agent_1',
              amountPesewas: '10000',
              currency: 'GHS',
              referenceType: 'PAYMENT',
              referenceId: 'pay_123',
              description: 'Agent wallet credit',
              createdAt: new Date().toISOString(),
            },
          ],
        });

      const entries = await ledgerService.recordJournalEntries(mockDb, [
        {
          entryType: LedgerEntryType.DEBIT,
          accountType: LedgerAccountType.PLATFORM_ESCROW,
          accountId: '00000000-0000-0000-0000-000000000000',
          amountPesewas: 10000,
          currency: Currency.GHS,
          referenceType: 'PAYMENT',
          referenceId: 'pay_123',
          description: 'Customer payment received',
        },
        {
          entryType: LedgerEntryType.CREDIT,
          accountType: LedgerAccountType.CUSTOMER_WALLET,
          accountId: 'usr_agent_1',
          amountPesewas: 10000,
          currency: Currency.GHS,
          referenceType: 'PAYMENT',
          referenceId: 'pay_123',
          description: 'Agent wallet credit',
        },
      ]);

      expect(entries).toHaveLength(2);
      expect(entries[0].entryType).toBe(LedgerEntryType.DEBIT);
      expect(entries[1].entryType).toBe(LedgerEntryType.CREDIT);
      expect(entries[0].amountPesewas).toBe(10000);
      expect(entries[1].amountPesewas).toBe(10000);
    });

    it('should reject unbalanced journal entry where Debits !== Credits', async () => {
      await expect(
        ledgerService.recordJournalEntries(mockDb, [
          {
            entryType: LedgerEntryType.DEBIT,
            accountType: LedgerAccountType.PLATFORM_ESCROW,
            accountId: '00000000-0000-0000-0000-000000000000',
            amountPesewas: 10000, // 10000 != 8000
            referenceType: 'PAYMENT',
            referenceId: 'pay_unbal',
            description: 'Unbalanced debit',
          },
          {
            entryType: LedgerEntryType.CREDIT,
            accountType: LedgerAccountType.CUSTOMER_WALLET,
            accountId: 'usr_agent_1',
            amountPesewas: 8000,
            referenceType: 'PAYMENT',
            referenceId: 'pay_unbal',
            description: 'Unbalanced credit',
          },
        ]),
      ).rejects.toThrow('Unbalanced financial ledger entry');
    });

    it('should reject invalid non-integer or negative pesewas amounts', async () => {
      await expect(
        ledgerService.recordJournalEntries(mockDb, [
          {
            entryType: LedgerEntryType.DEBIT,
            accountType: LedgerAccountType.PLATFORM_ESCROW,
            accountId: '00000000-0000-0000-0000-000000000000',
            amountPesewas: 10.5, // Floating point disallowed!
            referenceType: 'PAYMENT',
            referenceId: 'pay_float',
            description: 'Float amount',
          },
          {
            entryType: LedgerEntryType.CREDIT,
            accountType: LedgerAccountType.CUSTOMER_WALLET,
            accountId: 'usr_agent_1',
            amountPesewas: 10.5,
            referenceType: 'PAYMENT',
            referenceId: 'pay_float',
            description: 'Float amount',
          },
        ]),
      ).rejects.toThrow('Must be a positive integer in pesewas');
    });
  });

  describe('Authoritative Balance Aggregation', () => {
    it('should calculate net balance in integer pesewas from immutable ledger records', async () => {
      (mockDb.query as any).mockResolvedValueOnce({
        rows: [
          {
            totalDebits: '25000', // 250 GHS
            totalCredits: '100000', // 1000 GHS
          },
        ],
      });

      const balance = await ledgerService.getAccountBalance(
        LedgerAccountType.CUSTOMER_WALLET,
        'usr_agent_1',
      );

      // Credits (100,000) - Debits (25,000) = 75,000 pesewas (GH₵ 750.00)
      expect(balance.balancePesewas).toBe(75000);
      expect(balance.totalCredits).toBe(100000);
      expect(balance.totalDebits).toBe(25000);
    });
  });
});
