import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderService } from '../../src/core/commerce/order.service.js';
import { ProviderReconciliationService } from '../../src/core/providers/provider-reconciliation.service.js';
import { RefundService } from '../../src/core/payments/refund.service.js';
import { FulfillmentWorker } from '../../src/core/providers/fulfillment-worker.js';
import {
  OrderStatus,
  PaymentStatus,
  ProviderStatus,
  RefundStatus,
  NetworkProvider,
} from '@bytebeacon/shared';
import type pg from 'pg';

describe('Universal Automated Refund Coverage Suite', () => {
  let mockDb: any;
  let mockClient: any;
  let mockCatalogService: any;
  let mockIdempotencyService: any;
  let mockLedgerService: any;
  let mockRefundService: any;
  let mockProvider: any;
  let mockFulfillmentWorker: any;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockDb = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue(mockClient),
    };

    mockCatalogService = {
      getProductById: vi.fn().mockResolvedValue({
        id: 'prod_test_1',
        name: 'MTN 1GB',
        network: NetworkProvider.MTN,
        dataAmountMb: 1024,
        basePricePesewas: 500,
        isActive: true,
      }),
    };

    mockIdempotencyService = {
      computeHash: vi.fn().mockReturnValue('hash_test'),
      getExistingResponse: vi.fn().mockResolvedValue(null),
      saveResponse: vi.fn().mockResolvedValue(undefined),
    };

    mockLedgerService = {
      recordJournalEntries: vi.fn().mockResolvedValue([]),
    };

    mockRefundService = {
      executeAutomatedOrderRefund: vi.fn().mockResolvedValue({
        success: true,
        amountRefundedPesewas: 500,
      }),
    };

    mockProvider = {
      providerName: 'DataHouse',
      getOrderStatus: vi.fn(),
      verifyWebhookSignature: vi.fn().mockReturnValue(true),
    };

    mockFulfillmentWorker = {
      provider: mockProvider,
      executeAutomaticRefund: vi.fn().mockResolvedValue(true),
      processOrderFulfillment: vi.fn().mockResolvedValue({ success: true }),
    };
  });

  describe('1. OrderService live provider query failure triggers automated refund', () => {
    it('should trigger automated refund in getOrderById when live provider status is FAILED', async () => {
      mockProvider.getOrderStatus.mockResolvedValue({
        providerStatus: ProviderStatus.FAILED,
        providerOrderId: 'dh_ord_1',
      });

      mockDb.query.mockImplementation((q: string) => {
        if (q.includes('FROM orders o') || q.includes('FROM orders')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_query_fail_1',
                publicId: 'BB-ORD-991',
                userId: 'usr_cust_1',
                network: NetworkProvider.MTN,
                recipientPhone: '0241112233',
                dataAmountMb: 1024,
                amountPesewas: 500,
                paymentStatus: PaymentStatus.PAID,
                orderStatus: OrderStatus.PROCESSING,
                providerStatus: ProviderStatus.PROCESSING,
                poProviderReference: 'dh_ref_991',
                poLastSyncedAt: new Date(Date.now() - 60000), // Stale
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                pricingSnapshot: {},
                items: [],
                events: [],
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const orderService = new OrderService(
        mockDb as pg.Pool,
        mockCatalogService,
        mockIdempotencyService,
        mockLedgerService,
        undefined,
        mockFulfillmentWorker as unknown as FulfillmentWorker,
        mockRefundService as unknown as RefundService,
      );

      const order = await orderService.getOrderById('ord_query_fail_1', 'usr_cust_1', true);

      expect(order.orderStatus).toBe(OrderStatus.FAILED);
      expect(order.refundStatus).toBe(RefundStatus.COMPLETED);
      expect(order.paymentStatus).toBe(PaymentStatus.REFUNDED);
      expect(mockRefundService.executeAutomatedOrderRefund).toHaveBeenCalledWith(
        'ord_query_fail_1',
        expect.stringContaining('Telecom provider reported status [FAILED]'),
        expect.any(String),
      );
    });

    it('should trigger automated refund in getPublicOrder when live provider status is REJECTED', async () => {
      mockProvider.getOrderStatus.mockResolvedValue({
        providerStatus: ProviderStatus.REJECTED,
      });

      mockDb.query.mockImplementation((q: string) => {
        if (q.includes('FROM orders o') || q.includes('FROM orders')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_track_fail_2',
                publicId: 'BB-ORD-992',
                recipientPhone: '0241112233',
                network: NetworkProvider.MTN,
                dataAmountMb: 2048,
                amountPesewas: 600,
                paymentStatus: PaymentStatus.PAID,
                orderStatus: OrderStatus.SUBMITTED,
                providerStatus: ProviderStatus.SUBMITTED,
                poProviderReference: 'dh_ref_992',
                poLastSyncedAt: new Date(Date.now() - 30000), // Stale
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                pricingSnapshot: {},
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const orderService = new OrderService(
        mockDb as pg.Pool,
        mockCatalogService,
        mockIdempotencyService,
        mockLedgerService,
        undefined,
        mockFulfillmentWorker as unknown as FulfillmentWorker,
        mockRefundService as unknown as RefundService,
      );

      const tracking = await orderService.getPublicOrder('BB-ORD-992');

      expect(tracking).not.toBeNull();
      expect(tracking!.status).toBe('UNABLE_TO_COMPLETE');
      expect(mockRefundService.executeAutomatedOrderRefund).toHaveBeenCalledWith(
        'ord_track_fail_2',
        expect.stringContaining('Telecom provider reported status [REJECTED]'),
        expect.any(String),
      );
    });
  });

  describe('2. OrderService cancelOrder triggers automated refund for paid orders', () => {
    it('should automatically execute refund when cancelling a paid order', async () => {
      mockClient.query.mockImplementation((q: string) => {
        if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      let lookupCall = 0;
      mockDb.query.mockImplementation((q: string) => {
        if (q.includes('FROM orders')) {
          lookupCall++;
          return Promise.resolve({
            rows: [
              {
                id: 'ord_cancel_paid_1',
                publicId: 'BB-ORD-CANCEL',
                userId: 'usr_cust_1',
                network: NetworkProvider.MTN,
                recipientPhone: '0241112233',
                dataAmountMb: 1024,
                amountPesewas: 750,
                paymentStatus: PaymentStatus.PAID,
                orderStatus: lookupCall === 1 ? OrderStatus.READY_FOR_FULFILLMENT : OrderStatus.CANCELLED,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                pricingSnapshot: {},
                items: [],
                events: [],
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const orderService = new OrderService(
        mockDb as pg.Pool,
        mockCatalogService,
        mockIdempotencyService,
        mockLedgerService,
        undefined,
        mockFulfillmentWorker as unknown as FulfillmentWorker,
        mockRefundService as unknown as RefundService,
      );

      const cancelled = await orderService.cancelOrder(
        'ord_cancel_paid_1',
        'usr_cust_1',
        'corr_cancel_1',
        false,
      );

      expect(cancelled.orderStatus).toBe(OrderStatus.CANCELLED);
      expect(mockRefundService.executeAutomatedOrderRefund).toHaveBeenCalledWith(
        'ord_cancel_paid_1',
        'ORDER_CANCELLED_BY_USER',
        'corr_cancel_1',
      );
    });
  });

  describe('3. ProviderReconciliationService automated refund execution', () => {
    it('should delegate to refundService in reconcileStaleOrders when provider returns FAILED', async () => {
      mockProvider.getOrderStatus.mockResolvedValue({
        providerStatus: ProviderStatus.FAILED,
      });

      mockDb.query.mockImplementation((q: string) => {
        if (q.includes('FROM provider_orders po')) {
          return Promise.resolve({
            rows: [
              {
                id: 'po_1',
                orderId: 'ord_recon_fail_1',
                providerReference: 'dh_ref_recon',
                providerStatus: ProviderStatus.PROCESSING,
                orderStatus: OrderStatus.PROCESSING,
                providerName: 'DataHouse',
                orderCreatedAt: new Date(Date.now() - 3600000).toISOString(),
              },
            ],
          });
        }
        if (q.includes('INSERT INTO provider_reconciliation_records')) {
          return Promise.resolve({ rows: [{ id: 'recon_rec_1' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const reconService = new ProviderReconciliationService(
        mockDb as pg.Pool,
        mockProvider,
        mockRefundService as unknown as RefundService,
      );

      const summary = await reconService.reconcileStaleOrders(new Date().toISOString(), 15);

      expect(summary.discrepancyCount).toBe(1);
      expect(mockRefundService.executeAutomatedOrderRefund).toHaveBeenCalledWith(
        'ord_recon_fail_1',
        expect.stringContaining('FAILED'),
        'reconciliation_cron',
      );
    });

    it('should delegate to refundService in reconcileStaleOrders when upstream order is NOT_FOUND and permanently lost', async () => {
      mockProvider.getOrderStatus.mockRejectedValue({
        errorCode: 'NOT_FOUND',
        code: 'NOT_FOUND',
        message: 'Order does not exist upstream',
      });

      mockDb.query.mockImplementation((q: string) => {
        if (q.includes('FROM provider_orders po')) {
          return Promise.resolve({
            rows: [
              {
                id: 'po_stale_1',
                orderId: 'ord_stale_404',
                providerReference: 'dh_stale_ref',
                providerStatus: ProviderStatus.PROCESSING,
                providerName: 'DataHouse',
                orderCreatedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(), // > 24 hours
              },
            ],
          });
        }
        if (q.includes('INSERT INTO provider_reconciliation_records')) {
          return Promise.resolve({ rows: [{ id: 'recon_rec_2' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const reconService = new ProviderReconciliationService(
        mockDb as pg.Pool,
        mockProvider,
        mockRefundService as unknown as RefundService,
      );

      const summary = await reconService.reconcileStaleOrders(new Date().toISOString(), 15);

      expect(summary.discrepancyCount).toBe(1);
      expect(mockRefundService.executeAutomatedOrderRefund).toHaveBeenCalledWith(
        'ord_stale_404',
        expect.stringContaining('Order not found at upstream provider'),
        'reconciliation_stale',
      );
    });
  });
});
