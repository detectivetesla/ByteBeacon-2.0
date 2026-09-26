import { describe, it, expect, vi } from 'vitest';
import { BulkOrderService } from '../src/core/commerce/bulk-order.service.js';
import { CatalogService } from '../src/core/commerce/catalog.service.js';
import { BulkSubmissionStatus, NetworkProvider } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Bulk Order Engine & Batch Chunking', () => {
  it('should create bulk submission and compute total amount across items correctly', async () => {
    let insertedSubmission: Record<string, unknown> = {};
    const insertedItems: Array<Record<string, unknown>> = [];

    const mockClient = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q === 'BEGIN' || q === 'COMMIT') return Promise.resolve({});
        if (q.includes('INSERT INTO bulk_submissions')) {
          insertedSubmission = {
            id: 'sub_999',
            userId: params[0],
            name: params[1],
            totalCount: params[2],
            processedCount: 0,
            successCount: 0,
            failedCount: 0,
            totalAmountPesewas: params[3],
            status: 'PENDING',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          return Promise.resolve({ rows: [insertedSubmission] });
        }
        if (q.includes('INSERT INTO bulk_submission_items')) {
          const hasOrderIdCol = q.includes('order_id');
          const recipientPhone = hasOrderIdCol ? params[2] : params[1];
          const productId = hasOrderIdCol ? params[3] : params[2];
          const amountPesewas = hasOrderIdCol ? params[4] : params[3];
          const item = {
            id: `item_${insertedItems.length + 1}`,
            submissionId: params[0],
            orderId: hasOrderIdCol ? params[1] : null,
            recipientPhone,
            productId,
            amountPesewas,
            status: 'CREATED',
            errorMessage: null,
            createdAt: new Date(),
          };
          insertedItems.push(item);
          return Promise.resolve({ rows: [item] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };

    const mockDb = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as pg.Pool;

    const catalogService = {
      getProductById: vi.fn().mockImplementation((id: string) => {
        if (id === 'prod_1') {
          return Promise.resolve({
            id: 'prod_1',
            sku: 'MTN-1GB',
            network: NetworkProvider.MTN,
            name: 'MTN 1GB Bundle',
            basePricePesewas: 1000, // 1000 pesewas (GHS 10.00)
          });
        }
        return Promise.resolve({
          id: 'prod_2',
          sku: 'MTN-2GB',
          network: NetworkProvider.MTN,
          name: 'MTN 2GB Bundle',
          basePricePesewas: 2000, // 2000 pesewas (GHS 20.00)
        });
      }),
    } as unknown as CatalogService;

    const bulkOrderService = new BulkOrderService(mockDb, catalogService);

    const submission = await bulkOrderService.createBulkSubmission(
      {
        name: 'Corporate Monthly Data Dispatch',
        items: [
          { recipientPhone: '0241111111', productId: 'prod_1' },
          { recipientPhone: '0242222222', productId: 'prod_2' },
        ],
      },
      'usr_corp_1',
    );

    expect(submission.id).toBe('sub_999');
    expect(submission.totalCount).toBe(2);
    expect(submission.totalAmountPesewas).toBe(3000); // 1000 + 2000 pesewas
    expect(submission.status).toBe(BulkSubmissionStatus.PENDING);
    expect(submission.items).toHaveLength(2);
    expect(submission.items[0].recipientPhone).toBe('0241111111');
    expect(submission.items[1].recipientPhone).toBe('0242222222');
  });

  it('should create bulk submission with wallet payment and insert child orders with exact prepared statement parameter count', async () => {
    let orderInserts: Array<{ sql: string; params: unknown[] }> = [];

    const mockClient = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q === 'BEGIN' || q === 'COMMIT') return Promise.resolve({});
        if (q.includes('SELECT wallet_balance_pesewas')) {
          return Promise.resolve({
            rows: [{ wallet_balance_pesewas: 50000, wallet_balance: '500.00' }],
          });
        }
        if (q.includes('UPDATE users')) {
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('INSERT INTO bulk_submissions')) {
          return Promise.resolve({
            rows: [
              {
                id: 'sub_wallet_1',
                userId: params[0],
                name: params[1],
                totalCount: params[2],
                processedCount: 0,
                successCount: 0,
                failedCount: 0,
                totalAmountPesewas: params[3],
                status: params[4],
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          });
        }
        if (q.includes('INSERT INTO orders')) {
          const placeholders = q.match(/\$\d+/g) || [];
          const maxParam = Math.max(...placeholders.map((p) => parseInt(p.substring(1), 10)));
          if (params.length !== maxParam) {
            throw new Error(`bind message supplies ${params.length} parameters, but prepared statement requires ${maxParam}`);
          }
          orderInserts.push({ sql: q, params });
          return Promise.resolve({ rows: [{ id: `ord_child_${orderInserts.length}` }] });
        }
        if (q.includes('INSERT INTO order_items')) {
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('INSERT INTO provider_orders')) {
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('INSERT INTO bulk_submission_items')) {
          return Promise.resolve({
            rows: [
              {
                id: 'item_1',
                submissionId: params[0],
                orderId: params[1],
                recipientPhone: params[2],
                productId: params[3],
                amountPesewas: params[4],
                status: 'CREATED',
                errorMessage: null,
                createdAt: new Date(),
              },
            ],
          });
        }
        if (q.includes('INSERT INTO financial_ledger')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };

    const mockDb = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn().mockResolvedValue({ rows: [{ is_active: false }] }),
    } as unknown as pg.Pool;

    const catalogService = {
      getProductById: vi.fn().mockResolvedValue({
        id: 'prod_1',
        sku: 'MTN-1GB',
        network: NetworkProvider.MTN,
        name: 'MTN 1GB Bundle',
        basePricePesewas: 1000,
        dataAmountMb: 1024,
      }),
    } as unknown as CatalogService;

    const bulkOrderService = new BulkOrderService(mockDb, catalogService);

    const submission = await bulkOrderService.createBulkSubmission(
      {
        name: 'Wallet Bulk Dispatch',
        paymentMethod: 'WALLET',
        items: [{ recipientPhone: '0241111111', productId: 'prod_1' }],
      },
      'usr_corp_1',
    );

    expect(submission.id).toBe('sub_wallet_1');
    expect(orderInserts).toHaveLength(1);
    expect(orderInserts[0].params).toHaveLength(13);
    // $9 should be READY_FOR_FULFILLMENT
    expect(orderInserts[0].params[8]).toBe('READY_FOR_FULFILLMENT');
    // $10 should be idempotency key
    expect(typeof orderInserts[0].params[9]).toBe('string');
    // $11 should be isPaused (false)
    expect(orderInserts[0].params[10]).toBe(false);
  });
});
