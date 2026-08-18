import { describe, it, expect, vi } from 'vitest';
import { ProviderReconciliationService } from '../../src/core/providers/provider-reconciliation.service.js';
import { ITelecomProvider } from '../../src/core/providers/telecom/telecom-provider.interface.js';
import { ProviderStatus, OrderStatus } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Provider Reconciliation Engine', () => {
  it('should detect state discrepancies between local projection and GMPL authority and update projection', async () => {
    const mockProvider = {
      providerName: 'GMPL',
      getOrderStatus: vi.fn().mockImplementation((input: { providerReference: string }) => {
        if (input.providerReference === 'ref_matched') {
          return Promise.resolve({
            providerOrderId: 'gmpl_1',
            providerReference: 'ref_matched',
            providerStatus: ProviderStatus.PROCESSING,
          });
        }
        if (input.providerReference === 'ref_completed_upstream') {
          return Promise.resolve({
            providerOrderId: 'gmpl_2',
            providerReference: 'ref_completed_upstream',
            providerStatus: ProviderStatus.COMPLETED,
            completedAt: new Date().toISOString(),
          });
        }
        return Promise.reject(new Error('Unknown'));
      }),
    } as unknown as ITelecomProvider;

    let updatedOrderStatus: OrderStatus | null = null;

    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('FROM provider_orders po')) {
          return Promise.resolve({
            rows: [
              {
                id: 'po_1',
                orderId: 'ord_1',
                providerName: 'GMPL',
                providerReference: 'ref_matched',
                providerStatus: ProviderStatus.PROCESSING,
                orderStatus: OrderStatus.PROCESSING,
              },
              {
                id: 'po_2',
                orderId: 'ord_2',
                providerName: 'GMPL',
                providerReference: 'ref_completed_upstream',
                providerStatus: ProviderStatus.PROCESSING,
                orderStatus: OrderStatus.PROCESSING,
              },
            ],
          });
        }
        if (q.includes('UPDATE orders')) {
          updatedOrderStatus = params[0] as OrderStatus;
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('UPDATE provider_orders') || q.includes('INSERT INTO order_events')) {
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('INSERT INTO provider_reconciliation_records')) {
          return Promise.resolve({ rows: [{ id: 'rec_audit_1' }] });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const reconciler = new ProviderReconciliationService(mockDb, mockProvider);
    const summary = await reconciler.reconcileStaleOrders('2026-08-14', 15);

    expect(summary.reconciliationId).toBe('rec_audit_1');
    expect(summary.totalChecked).toBe(2);
    expect(summary.matchedCount).toBe(1);
    expect(summary.discrepancyCount).toBe(1);
    expect(summary.discrepancies[0].orderId).toBe('ord_2');
    expect(summary.discrepancies[0].actualProviderStatus).toBe(ProviderStatus.COMPLETED);
    expect(updatedOrderStatus).toBe(OrderStatus.COMPLETED);
  });
});
