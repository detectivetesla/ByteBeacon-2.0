import { describe, it, expect, vi } from 'vitest';
import { DataHouseAdapter } from '../../src/core/providers/datahouse/datahouse.adapter.js';
import { DataHouseClient } from '../../src/core/providers/datahouse/datahouse.client.js';
import { DataHouseError } from '../../src/core/providers/datahouse/datahouse.errors.js';
import { ProviderStatus } from '@bytebeacon/shared';
import { ProviderReconciliationService } from '../../src/core/providers/provider-reconciliation.service.js';

describe('Reconciliation 404 Graceful Handling Suite', () => {
  it('DataHouseAdapter.getOrderStatus catches 404 and returns UNKNOWN ProviderOrderStatus (never false-fails)', async () => {
    const mockClient = {
      getOrderStatus: vi.fn().mockRejectedValue(new DataHouseError('Order not found', 404, 'NOT_FOUND')),
      listOrders: vi.fn().mockResolvedValue({ data: [] }),
    } as unknown as DataHouseClient;

    const adapter = new DataHouseAdapter(mockClient);
    const result = await adapter.getOrderStatus({
      providerReference: '1e8c1767-e1d6-4b52-8c17-7262061518a8',
      orderId: '1e8c1767-e1d6-4b52-8c17-7262061518a8',
    });

    expect(result.providerStatus).toBe(ProviderStatus.UNKNOWN);
    expect(result.completedAt).toBeNull();
    expect(result.errorMessage).toContain('pending or not yet indexed');
    expect(result.providerReference).toBe('1e8c1767-e1d6-4b52-8c17-7262061518a8');
  });

  it('ProviderReconciliationService preserves in-flight orders under 24h when upstream throws 404', async () => {
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
                orderCreatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes old
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

    expect(summary.discrepancyCount).toBe(0);
    expect(summary.matchedCount).toBe(1);

    // Verify wallet refund and order failure did NOT occur
    const updateUsers = mockDb.query.mock.calls.find((call) => call[0].includes('UPDATE users'));
    expect(updateUsers).toBeUndefined();

    const updateOrders = mockDb.query.mock.calls.find((call) => call[0].includes('UPDATE orders SET order_status = \'FAILED\''));
    expect(updateOrders).toBeUndefined();

    // Verify last_synced_at was updated to preserve in-flight status
    const updatePo = mockDb.query.mock.calls.find((call) => call[0].includes('UPDATE provider_orders SET last_synced_at = CURRENT_TIMESTAMP'));
    expect(updatePo).toBeDefined();
  });

  it('ProviderReconciliationService resolves stale orders older than 24h that throw 404 as FAILED with refund', async () => {
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
                orderCreatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours old (> 24h)
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

    // Verify wallet refund and ledger insertion occurred for genuinely lost order
    const updateUsers = mockDb.query.mock.calls.find((call) => call[0].includes('UPDATE users'));
    expect(updateUsers).toBeDefined();
    expect(updateUsers[1]).toEqual([100, 'usr_abc']);

    const updateOrders = mockDb.query.mock.calls.find((call) => call[0].includes('UPDATE orders'));
    expect(updateOrders).toBeDefined();
  });
});
