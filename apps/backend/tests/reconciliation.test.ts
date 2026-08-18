import { describe, it, expect, vi } from 'vitest';
import { ReconciliationService } from '../src/core/payments/reconciliation.service.js';
import { ReconciliationStatus } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Financial Reconciliation Engine', () => {
  it('should detect matched settlements when internal and provider records agree', async () => {
    const mockDb = {
      query: vi.fn().mockImplementation((q: string) => {
        if (q.includes('SELECT id, provider_reference')) {
          return Promise.resolve({
            rows: [
              {
                id: 'pay_1',
                providerReference: 'pst_ref_100',
                amountPesewas: 2500,
                currency: 'GHS',
                status: 'PAID',
              },
            ],
          });
        }
        if (q.includes('INSERT INTO payment_reconciliations')) {
          return Promise.resolve({
            rows: [{ id: 'rec_1', created_at: new Date() }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const service = new ReconciliationService(mockDb);

    const report = await service.reconcileTransactions('2026-08-14', 'PAYSTACK', [
      {
        reference: 'pst_ref_100',
        amountPesewas: 2500,
        currency: 'GHS',
        status: 'SUCCESS',
        paidAt: new Date().toISOString(),
      },
    ]);

    expect(report.status).toBe(ReconciliationStatus.MATCHED);
    expect(report.discrepancyPesewas).toBe(0);
    expect(report.unmatchedCount).toBe(0);
  });

  it('should detect discrepancies when amounts differ or internal records are missing', async () => {
    let capturedDiscrepancies: any[] = [];
    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('SELECT id, provider_reference')) {
          return Promise.resolve({
            rows: [
              {
                id: 'pay_1',
                providerReference: 'pst_ref_200',
                amountPesewas: 2000, // Internal is 2000 pesewas
                status: 'PAID',
              },
            ],
          });
        }
        if (q.includes('INSERT INTO payment_reconciliations')) {
          capturedDiscrepancies = JSON.parse(params[6] as string);
          return Promise.resolve({
            rows: [{ id: 'rec_2', created_at: new Date() }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const service = new ReconciliationService(mockDb);

    const report = await service.reconcileTransactions('2026-08-14', 'PAYSTACK', [
      {
        reference: 'pst_ref_200',
        amountPesewas: 2500, // Provider is 2500 pesewas (AMOUNT_MISMATCH)
        currency: 'GHS',
        status: 'SUCCESS',
        paidAt: new Date().toISOString(),
      },
      {
        reference: 'pst_ref_missing_300', // Missing internally (MISSING_INTERNAL)
        amountPesewas: 1000,
        currency: 'GHS',
        status: 'SUCCESS',
        paidAt: new Date().toISOString(),
      },
    ]);

    expect(report.status).toBe(ReconciliationStatus.DISCREPANCY);
    expect(report.unmatchedCount).toBe(2);
    expect(capturedDiscrepancies[0].type).toBe('AMOUNT_MISMATCH');
    expect(capturedDiscrepancies[1].type).toBe('MISSING_INTERNAL');
  });
});
