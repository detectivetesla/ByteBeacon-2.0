import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderService } from '../../src/core/commerce/order.service.js';
import { CatalogService } from '../../src/core/commerce/catalog.service.js';
import { IdempotencyService } from '../../src/core/commerce/idempotency.service.js';
import { NetworkProvider, OrderStatus, PaymentStatus, ProviderStatus } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Order Lifecycle & Two-Way DataHouse Sync Suite', () => {
  let mockDb: pg.Pool;
  let mockClient: any;
  let mockCatalog: CatalogService;
  let mockIdempotency: IdempotencyService;
  let orderService: OrderService;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockDb = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
    } as unknown as pg.Pool;

    mockCatalog = {
      getProductById: vi.fn().mockResolvedValue({
        id: 'prod_123',
        sku: 'MTN-10GB',
        name: 'MTN 10 GB Data',
        network: NetworkProvider.MTN,
        dataAmountMb: 10240,
        basePricePesewas: 4800,
        agentPricePesewas: 4500,
        isActive: true,
      }),
    } as unknown as CatalogService;

    mockIdempotency = {
      computeHash: vi.fn().mockReturnValue('hash_123'),
      getExistingResponse: vi.fn().mockResolvedValue({ exists: false }),
      saveResponse: vi.fn().mockResolvedValue(undefined),
    } as unknown as IdempotencyService;

    orderService = new OrderService(mockDb, mockCatalog, mockIdempotency);
  });

  describe('Order Creation Flow', () => {
    it('should create order in CREATED state with PENDING payment and record audit log', async () => {
      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'ord_uuid_1',
              publicId: 'ord_pub_123',
              userId: 'usr_cust_1',
              agentId: null,
              productId: 'prod_123',
              recipientPhone: '0241234567',
              network: NetworkProvider.MTN,
              dataAmountMb: 10240,
              amountPesewas: '4800',
              currency: 'GHS',
              pricingSnapshot: {
                productId: 'prod_123',
                sku: 'MTN-10GB',
                productName: 'MTN 10 GB Data',
                network: NetworkProvider.MTN,
                dataAmountMb: 10240,
                unitPricePesewas: 4800,
                currency: 'GHS',
                snapshotTimestamp: new Date().toISOString(),
              },
              paymentStatus: PaymentStatus.PENDING,
              orderStatus: OrderStatus.CREATED,
              providerStatus: ProviderStatus.UNKNOWN,
              refundStatus: 'NONE',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }) // INSERT order
        .mockResolvedValueOnce({ rows: [] }) // INSERT order_item
        .mockResolvedValueOnce({ rows: [] }) // INSERT provider_order
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'evt_1',
              eventType: 'ORDER_CREATED',
              correlationId: 'req_ord_1',
              actorId: 'usr_cust_1',
              actorType: 'CUSTOMER',
              previousState: null,
              newState: { orderStatus: OrderStatus.CREATED },
              metadata: {},
              occurredAt: new Date().toISOString(),
            },
          ],
        }) // INSERT order_event
        .mockResolvedValueOnce({ command: 'COMMIT' });

      const result = await orderService.createOrder(
        {
          productId: 'prod_123',
          recipientPhone: '0241234567',
          idempotencyKey: 'idemp_ord_test',
        },
        {
          userId: 'usr_cust_1',
          correlationId: 'req_ord_1',
          actorType: 'CUSTOMER',
          ipAddress: '127.0.0.1',
        },
      );

      expect(result.order.publicId).toBe('ord_pub_123');
      expect(result.order.orderStatus).toBe(OrderStatus.CREATED);
      expect(result.order.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(result.order.events).toHaveLength(1);
      expect(result.order.events[0].eventType).toBe('ORDER_CREATED');
      expect(result.isIdempotentReplay).toBe(false);
    });
  });

  describe('Public Safe Tracking', () => {
    it('should return customer-safe order projection omitting internal telecom credentials', async () => {
      (mockDb.query as any).mockResolvedValueOnce({
        rows: [
          {
            id: 'ord_uuid_1',
            publicId: 'BB-102938',
            userId: 'usr_cust_1',
            agentId: null,
            productId: 'prod_123',
            recipientPhone: '0241234567',
            network: NetworkProvider.MTN,
            dataAmountMb: 10240,
            amountPesewas: '4800',
            currency: 'GHS',
            pricingSnapshot: {},
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.COMPLETED,
            providerStatus: ProviderStatus.COMPLETED,
            refundStatus: 'NONE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            providerName: 'DATAHOUSE',
            providerReference: 'DH_TXN_SECRET_123',
            lastSyncedAt: new Date().toISOString(),
          },
        ],
      });

      const publicOrder = await orderService.getPublicOrder('BB-102938');

      expect(publicOrder).toBeDefined();
      expect(publicOrder?.orderId).toBe('BB-102938');
      expect(publicOrder?.paymentStatus).toBe('PAID');
      expect(publicOrder?.product.name).toBe('MTN 10 GB Data Bundle');
      // Verify internal providerReference is not exposed on public order
      expect((publicOrder as any).providerReference).toBeUndefined();
    });
  });
});
