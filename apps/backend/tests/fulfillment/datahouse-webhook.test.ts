import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataHouseWebhookService } from '../../src/core/providers/datahouse-webhook.service.js';
import { ITelecomProvider } from '../../src/core/providers/telecom/telecom-provider.interface.js';
import { ProviderStatus, OrderStatus } from '@bytebeacon/shared';
import type pg from 'pg';

describe('DataHouseWebhookService', () => {
  let mockDb: pg.Pool;
  let mockClient: any;
  let mockProvider: ITelecomProvider;
  let webhookService: DataHouseWebhookService;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockDb = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
    } as unknown as pg.Pool;

    mockProvider = {
      providerName: 'DATAHOUSE',
      submitOrder: vi.fn(),
      getOrderStatus: vi.fn(),
      healthCheck: vi.fn(),
      verifyWebhookSignature: vi.fn().mockReturnValue(true),
    };

    webhookService = new DataHouseWebhookService(mockDb, null, mockProvider);
  });

  it('should reject webhook if signature verification fails', async () => {
    vi.spyOn(mockProvider, 'verifyWebhookSignature').mockReturnValueOnce(false);

    await expect(
      webhookService.handleWebhook('{"test": true}', 'invalid_signature', 'req_1'),
    ).rejects.toThrow('Invalid DataHouse webhook signature');
  });

  it('should drop duplicate webhook if already recorded in database', async () => {
    const payload = {
      id: 'dh_evt_100',
      type: 'ORDER_STATUS_UPDATE',
      data: { id: 'ord_1', referenceCode: 'TXN-1', status: 'COMPLETED' },
    };

    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (sql.includes('SELECT id FROM provider_events')) {
        return { rows: [{ id: 'existing_evt_id' }] };
      }
      return { rows: [] };
    });

    const res = await webhookService.handleWebhook(JSON.stringify(payload), 'valid_sig', 'req_2');

    expect(res.status).toBe('DUPLICATE');
  });

  it('should apply COMPLETED status update to order and provider projection', async () => {
    const payload = {
      id: 'dh_evt_101',
      type: 'ORDER_STATUS_UPDATE',
      data: {
        id: 'dh_order_999',
        referenceCode: 'TXN-999',
        status: 'COMPLETED',
      },
    };

    mockClient.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (sql.includes('SELECT id FROM provider_events')) {
        return { rows: [] };
      }
      if (sql.includes('SELECT po.id, po.order_id')) {
        return {
          rows: [
            {
              id: 'po_uuid_1',
              orderId: 'order_uuid_1',
              currentStatus: ProviderStatus.PROCESSING,
              lastSyncedAt: new Date(Date.now() - 60000).toISOString(),
              syncVersion: 1,
              orderStatus: OrderStatus.PROCESSING,
              paymentStatus: 'PAID',
              amountPesewas: 1000,
            },
          ],
        };
      }
      if (sql.includes('UPDATE provider_orders')) {
        expect(params[0]).toBe(ProviderStatus.COMPLETED);
        return { rowCount: 1 };
      }
      if (sql.includes('UPDATE orders')) {
        expect(params[0]).toBe(ProviderStatus.COMPLETED);
        expect(params[1]).toBe(OrderStatus.COMPLETED);
        return { rowCount: 1 };
      }
      if (sql.includes('INSERT INTO provider_events')) {
        return { rowCount: 1 };
      }
      if (sql.includes('INSERT INTO order_events')) {
        return { rowCount: 1 };
      }
      return { rows: [] };
    });

    const res = await webhookService.handleWebhook(JSON.stringify(payload), 'valid_sig', 'req_3');

    expect(res.status).toBe('PROCESSED');
  });

  it('should mark refund_status as PENDING when a PAID order fails at provider', async () => {
    const payload = {
      id: 'dh_evt_102',
      type: 'ORDER_STATUS_UPDATE',
      data: {
        id: 'dh_order_888',
        referenceCode: 'TXN-888',
        status: 'FAILED',
      },
    };

    mockClient.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (sql.includes('SELECT id FROM provider_events')) return { rows: [] };
      if (sql.includes('SELECT po.id, po.order_id')) {
        return {
          rows: [
            {
              id: 'po_uuid_2',
              orderId: 'order_uuid_2',
              currentStatus: ProviderStatus.PROCESSING,
              lastSyncedAt: new Date(Date.now() - 60000).toISOString(),
              syncVersion: 1,
              orderStatus: OrderStatus.PROCESSING,
              paymentStatus: 'PAID',
              amountPesewas: 500,
            },
          ],
        };
      }
      if (sql.includes('UPDATE orders')) {
        expect(params[0]).toBe(ProviderStatus.FAILED);
        expect(params[1]).toBe(OrderStatus.FAILED);
        expect(params[2]).toBe('PENDING'); // Refund pending trigger
        return { rowCount: 1 };
      }
      return { rows: [] };
    });

    const res = await webhookService.handleWebhook(JSON.stringify(payload), 'valid_sig', 'req_4');

    expect(res.status).toBe('PROCESSED');
  });

  it('should process purchase.success event and mark order as COMPLETED', async () => {
    const payload = {
      id: 'ord_uuid_auto_1',
      type: 'purchase.success',
      created_at: '2026-07-07T12:00:05.000Z',
      data: {
        order_id: 'ord_uuid_auto_1',
        reference_code: 'TXN-7GH2K9',
        amount: '21.00',
        network: 'MTN',
        bundle_type: 'DATA',
        phone_number: '0241234567',
        provider_reference: 'MTN-PRV-123',
        status: 'fulfilled',
      },
    };

    mockClient.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (sql.includes('SELECT id FROM provider_events')) return { rows: [] };
      if (sql.includes('SELECT po.id, po.order_id')) {
        return {
          rows: [
            {
              id: 'po_uuid_10',
              orderId: 'ord_uuid_auto_1',
              currentStatus: ProviderStatus.PROCESSING,
              lastSyncedAt: new Date(Date.now() - 60000).toISOString(),
              syncVersion: 1,
              orderStatus: OrderStatus.PROCESSING,
              paymentStatus: 'PAID',
              amountPesewas: 2100,
            },
          ],
        };
      }
      if (sql.includes('UPDATE orders')) {
        expect(params[0]).toBe(ProviderStatus.COMPLETED);
        expect(params[1]).toBe(OrderStatus.COMPLETED);
        return { rowCount: 1 };
      }
      return { rows: [] };
    });

    const res = await webhookService.handleWebhook(JSON.stringify(payload), 'valid_sig', 'req_purchase_success');
    expect(res.status).toBe('PROCESSED');
  });

  it('should process purchase.failed event and mark order as FAILED with refund PENDING', async () => {
    const payload = {
      id: 'ord_uuid_fail_1',
      type: 'purchase.failed',
      created_at: '2026-07-07T12:00:05.000Z',
      data: {
        order_id: 'ord_uuid_fail_1',
        reference_code: 'TXN-FAIL-001',
        amount: '21.00',
        network: 'MTN',
        bundle_type: 'DATA',
        phone_number: '0241234567',
        error_message: 'Subscriber barred',
        status: 'refunded',
        refunded: true,
      },
    };

    mockClient.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (sql.includes('SELECT id FROM provider_events')) return { rows: [] };
      if (sql.includes('SELECT po.id, po.order_id')) {
        return {
          rows: [
            {
              id: 'po_uuid_11',
              orderId: 'ord_uuid_fail_1',
              currentStatus: ProviderStatus.PROCESSING,
              lastSyncedAt: new Date(Date.now() - 60000).toISOString(),
              syncVersion: 1,
              orderStatus: OrderStatus.PROCESSING,
              paymentStatus: 'PAID',
              amountPesewas: 2100,
            },
          ],
        };
      }
      if (sql.includes('UPDATE orders')) {
        expect(params[0]).toBe(ProviderStatus.REJECTED);
        expect(params[1]).toBe(OrderStatus.FAILED);
        expect(params[2]).toBe('PENDING');
        return { rowCount: 1 };
      }
      return { rows: [] };
    });

    const res = await webhookService.handleWebhook(JSON.stringify(payload), 'valid_sig', 'req_purchase_failed');
    expect(res.status).toBe('PROCESSED');
  });

  it('should process wallet.updated event and record event without requiring order match', async () => {
    const payload = {
      id: 'le_01J8',
      type: 'wallet.updated',
      created_at: '2026-07-07T11:00:00.000Z',
      data: {
        wallet_id: 'w_01J',
        ledger_entry_id: 'le_01J8',
        direction: 'credit',
        amount: '500.00',
        balance_after: '2040.75',
        category: 'deposit',
        reference_type: 'Deposit',
        reference_id: 'dep_01J',
        description: 'Wallet top-up',
        occurred_at: '2026-07-07T11:00:00.000Z',
      },
    };

    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (sql.includes('SELECT id FROM provider_events')) return { rows: [] };
      if (sql.includes('INSERT INTO provider_events')) return { rowCount: 1 };
      return { rows: [] };
    });

    const res = await webhookService.handleWebhook(JSON.stringify(payload), 'valid_sig', 'req_wallet_update');
    expect(res.status).toBe('PROCESSED');
  });

  it('should reject stale out-of-order event when incoming timestamp is older than current', async () => {
    const olderTime = new Date(Date.now() - 100000);
    const newerTime = new Date(Date.now() - 20000);

    const payload = {
      id: 'dh_evt_103',
      type: 'ORDER_STATUS_UPDATE',
      timestamp: Math.floor(olderTime.getTime() / 1000),
      data: {
        id: 'dh_order_777',
        referenceCode: 'TXN-777',
        status: 'PROCESSING',
      },
    };

    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (sql.includes('SELECT id FROM provider_events')) return { rows: [] };
      if (sql.includes('SELECT po.id, po.order_id')) {
        return {
          rows: [
            {
              id: 'po_uuid_3',
              orderId: 'order_uuid_3',
              currentStatus: ProviderStatus.COMPLETED,
              lastSyncedAt: newerTime.toISOString(),
              syncVersion: 2,
              orderStatus: OrderStatus.COMPLETED,
              paymentStatus: 'PAID',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const res = await webhookService.handleWebhook(JSON.stringify(payload), 'valid_sig', 'req_5');

    expect(res.status).toBe('STALE');
  });
});
