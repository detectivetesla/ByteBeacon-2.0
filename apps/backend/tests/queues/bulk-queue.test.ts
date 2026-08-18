import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulkQueueService } from '../../src/core/queues/bulk-queue.service.js';
import { ITelecomProvider } from '../../src/core/providers/telecom/telecom-provider.interface.js';
import { NetworkProvider } from '@bytebeacon/shared';
import type pg from 'pg';

describe('BulkQueueService', () => {
  let mockDb: pg.Pool;
  let mockProvider: ITelecomProvider;
  let bulkQueueService: BulkQueueService;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as pg.Pool;

    mockProvider = {
      providerName: 'DATAHOUSE',
      submitOrder: vi.fn(),
      submitBulkOrder: vi.fn(),
      getOrderStatus: vi.fn(),
      healthCheck: vi.fn(),
      verifyWebhookSignature: vi.fn(),
    };

    bulkQueueService = new BulkQueueService(mockDb, mockProvider, null);
  });

  describe('Bulk Slicing & Chunk Calculation', () => {
    it('should calculate correct number of chunks for 120 recipients', async () => {
      const recipients = Array.from({ length: 120 }, (_, i) => ({
        phoneNumber: `02410000${String(i).padStart(2, '0')}`,
        dataSizeGb: 1,
      }));

      const res = await bulkQueueService.enqueueBulkOrder({
        batchId: 'batch_test_120',
        network: NetworkProvider.MTN,
        recipients,
        correlationId: 'req_bulk_120',
        idempotencyKey: 'idemp_bulk_120',
      });

      expect(res.totalRecipients).toBe(120);
      expect(res.totalChunks).toBe(3); // 50 + 50 + 20 = 3 chunks
      expect(res.chunkSize).toBe(50);
      expect(res.status).toBe('QUEUED');
    });
  });

  describe('Chunk Execution & Provider Delegation', () => {
    it('should delegate chunk to DataHouse submitBulkOrder and return metrics', async () => {
      (mockProvider.submitBulkOrder as any).mockResolvedValueOnce({
        batchId: 'dh_batch_chunk_0',
        network: 'MTN',
        status: 'SUBMITTED',
        totalRecipients: 50,
        acceptedRecipients: 48,
        queuedRecipients: 48,
        rejectedRecipients: 2,
      });

      const chunkData = {
        batchId: 'batch_test_1',
        chunkIndex: 0,
        totalChunks: 2,
        network: NetworkProvider.MTN,
        recipients: Array.from({ length: 50 }, (_, i) => ({
          phoneNumber: `02410000${String(i).padStart(2, '0')}`,
          dataSizeGb: 2,
          recipientIndex: i,
        })),
        correlationId: 'req_chunk_0',
        idempotencyKey: 'idemp_chunk_0',
        onUnvalidated: 'set_aside' as const,
      };

      const result = await bulkQueueService.processChunk(chunkData);

      expect(result.success).toBe(true);
      expect(result.acceptedCount).toBe(48);
      expect(result.rejectedCount).toBe(2);
      expect(mockProvider.submitBulkOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          network: NetworkProvider.MTN,
          onUnvalidated: 'set_aside',
        }),
      );
    });

    it('should isolate error when provider rejects chunk', async () => {
      (mockProvider.submitBulkOrder as any).mockRejectedValueOnce(
        new Error('DataHouse carrier gateway offline'),
      );

      const chunkData = {
        batchId: 'batch_test_err',
        chunkIndex: 1,
        totalChunks: 2,
        network: NetworkProvider.MTN,
        recipients: [{ phoneNumber: '0241111111', recipientIndex: 0 }],
        correlationId: 'req_chunk_err',
        idempotencyKey: 'idemp_chunk_err',
      };

      const result = await bulkQueueService.processChunk(chunkData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('DataHouse carrier gateway offline');
      expect(result.rejectedCount).toBe(1);
    });
  });
});
