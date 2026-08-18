import { describe, it, expect, vi } from 'vitest';
import { FinancialLedgerService } from '../src/core/payments/financial-ledger.service.js';
import { LedgerEntryType, LedgerAccountType, Currency } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Financial Ledger & Double-Entry Invariants', () => {
  it('should post balanced journal entries where Total Debits == Total Credits', async () => {
    const insertedRows: Record<string, unknown>[] = [];
    const mockDb = {
      query: vi.fn().mockImplementation((_q: string, params: unknown[]) => {
        const row = {
          id: `led_${params[0]}`,
          entryType: params[1],
          accountType: params[2],
          accountId: params[3],
          amountPesewas: params[4],
          currency: params[5],
          referenceType: params[6],
          referenceId: params[7],
          description: params[8],
          createdAt: new Date(),
        };
        insertedRows.push(row);
        return Promise.resolve({ rows: [row] });
      }),
    } as unknown as pg.Pool;

    const ledgerService = new FinancialLedgerService(mockDb);

    const customerId = 'usr_cust_123';
    const escrowId = '00000000-0000-0000-0000-000000000000';
    const amountPesewas = 1000; // 10.00 GHS in integer minor units

    const result = await ledgerService.recordJournalEntries(mockDb, [
      {
        entryType: LedgerEntryType.DEBIT,
        accountType: LedgerAccountType.CUSTOMER_WALLET,
        accountId: customerId,
        amountPesewas,
        currency: Currency.GHS,
        referenceType: 'PAYMENT',
        referenceId: 'pay_123',
        description: 'Customer payment debited',
      },
      {
        entryType: LedgerEntryType.CREDIT,
        accountType: LedgerAccountType.PLATFORM_ESCROW,
        accountId: escrowId,
        amountPesewas,
        currency: Currency.GHS,
        referenceType: 'PAYMENT',
        referenceId: 'pay_123',
        description: 'Platform escrow credited',
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].amountPesewas).toBe(1000);
    expect(result[1].amountPesewas).toBe(1000);
    expect(result[0].entryType).toBe(LedgerEntryType.DEBIT);
    expect(result[1].entryType).toBe(LedgerEntryType.CREDIT);
  });

  it('should reject unbalanced journal entries with BadRequestError', async () => {
    const mockDb = { query: vi.fn() } as unknown as pg.Pool;
    const ledgerService = new FinancialLedgerService(mockDb);

    await expect(
      ledgerService.recordJournalEntries(mockDb, [
        {
          entryType: LedgerEntryType.DEBIT,
          accountType: LedgerAccountType.CUSTOMER_WALLET,
          accountId: 'usr_1',
          amountPesewas: 1000,
          referenceType: 'PAYMENT',
          referenceId: 'pay_1',
          description: 'Debit',
        },
        {
          entryType: LedgerEntryType.CREDIT,
          accountType: LedgerAccountType.PLATFORM_ESCROW,
          accountId: 'escrow',
          amountPesewas: 800, // Unbalanced!
          referenceType: 'PAYMENT',
          referenceId: 'pay_1',
          description: 'Credit',
        },
      ]),
    ).rejects.toThrow(/Unbalanced financial ledger entry/);
  });

  it('should reject floating-point or non-positive currency amounts', async () => {
    const mockDb = { query: vi.fn() } as unknown as pg.Pool;
    const ledgerService = new FinancialLedgerService(mockDb);

    await expect(
      ledgerService.recordJournalEntries(mockDb, [
        {
          entryType: LedgerEntryType.DEBIT,
          accountType: LedgerAccountType.CUSTOMER_WALLET,
          accountId: 'usr_1',
          amountPesewas: 10.5, // Float invalid
          referenceType: 'PAYMENT',
          referenceId: 'pay_1',
          description: 'Debit',
        },
        {
          entryType: LedgerEntryType.CREDIT,
          accountType: LedgerAccountType.PLATFORM_ESCROW,
          accountId: 'escrow',
          amountPesewas: 10.5,
          referenceType: 'PAYMENT',
          referenceId: 'pay_1',
          description: 'Credit',
        },
      ]),
    ).rejects.toThrow(/Must be a positive integer in pesewas/);
  });

  it('should calculate authoritative account balances directly from immutable ledger lines', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            totalDebits: 500,
            totalCredits: 2000,
          },
        ],
      }),
    } as unknown as pg.Pool;

    const ledgerService = new FinancialLedgerService(mockDb);
    const balance = await ledgerService.getAccountBalance(LedgerAccountType.CUSTOMER_WALLET, 'usr_cust_1');

    expect(balance.totalCredits).toBe(2000);
    expect(balance.totalDebits).toBe(500);
    expect(balance.balancePesewas).toBe(1500); // 2000 - 500
  });
});
