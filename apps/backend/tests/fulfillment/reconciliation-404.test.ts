import { describe, it, expect, vi } from 'vitest';
import { DataHouseAdapter } from '../../src/core/providers/datahouse/datahouse.adapter.js';
import { DataHouseClient } from '../../src/core/providers/datahouse/datahouse.client.js';
import { DataHouseError } from '../../src/core/providers/datahouse/datahouse.errors.js';
import { ProviderStatus } from '@bytebeacon/shared';
import { ProviderReconciliationService } from '../../src/core/providers/provider-reconciliation.service.js';

describe('Reconciliation 404 Graceful Handling Suite', () => {
  it('DataHouseAdapter.getOrderStatus catches 404 and returns FAILED ProviderOrderStatus', async () => {
    const mockClient = {
      getOrderStatus: vi.fn().mockRejectedValue(new DataHouseError('Order not found', 404, 'NOT_FOUND')),
    } as unknown as DataHouseClient;

    const adapter = new DataHouseAdapter(mockClient);
    const result = await adapter.getOrderStatus({
      providerReference: '1e8c1767-e1d6-4b52-8c17-7262061518a8',
      orderId: '1e8c1767-e1d6-4b52-8c17-7262061518a8',
    });

    expect(result.providerStatus).toBe(ProviderStatus.FAILED);
    expect(result.errorMessage).toBe('Order not found at upstream provider');
    expect(result.providerReference).toBe('1e8c1767-e1d6-4b52-8c17-7262061518a8');
  });

  it('ProviderReconciliationService resolves stale orders that throw 404 gracefully without crashing', async () => {
    const mockDb = {
      query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('SELECT po.id, po.order_id')) {
          return Promise.resolve({
            rows: [
              {
                id: 'po_123',
                orderId: 'ord_123',
                providerName: 'DATAHOUSE',
                providerReference: 'dh_missing_ref',
                providerStatus: 'PROCESSING',
                orderStatus: 'PROCESSING',
              },
            ],
          });
        }
        if (sql.includes('SELECT user_id, amount_pesewas')) {
          return Promise.resolve({
            rows: [
              {
                user_id: 'usr_abc',
                amount_pesewas: 100,
                payment_status: 'PAID',
                refund_status: 'NONE',
              },
            ],
          });
        }
        if (sql.includes('INSERT INTO provider_reconciliation_records')) {
          return Promise.resolve({ rows: [{ id: 'rec_audit_404' }] });
        }
        return Promise.resolve({ rows: [] });
      }),
    };

    const mockProvider = {
      providerName: 'DATAHOUSE',
      getOrderStatus: vi.fn().mockRejectedValue(new DataHouseError('Order not found', 404, 'NOT_FOUND')),
    };

    const service = new ProviderReconciliationService(mockDb as any, mockProvider as any);
    const summary = await service.reconcileStaleOrders('2026-09-12');

    expect(summary.discrepancyCount).toBe(1);
    expect(summary.discrepancies[0].actualProviderStatus).toBe(ProviderStatus.FAILED);
    expect(summary.discrepancies[0].actionTaken).toContain('Order not found on upstream provider');

    // Verify wallet refund and ledger insertion occurred
    const updateUsers = mockDb.query.mock.calls.find((call) => call[0].includes('UPDATE users'));
    expect(updateUsers).toBeDefined();
    expect(updateUsers[1]).toEqual([100, 'usr_abc']);

    const updateOrders = mockDb.query.mock.calls.find((call) => call[0].includes('UPDATE orders'));
    expect(updateOrders).toBeDefined();
  });
});
