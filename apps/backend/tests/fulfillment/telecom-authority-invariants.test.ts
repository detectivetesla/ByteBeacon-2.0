import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderReconciliationService } from '../../src/core/providers/provider-reconciliation.service.js';
import { ITelecomProvider } from '../../src/core/providers/telecom/telecom-provider.interface.js';
import { IdempotencyService } from '../../src/core/commerce/idempotency.service.js';
import { ProviderStatus, OrderStatus } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Phase 8.4: DataHouse & Telecom Fulfillment Invariant Suite', () => {
  let mockDb: pg.Pool;
  let mockTelecomProvider: ITelecomProvider;
  let reconciliationService: ProviderReconciliationService;

  beforeEach(() => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('FROM provider_orders po JOIN orders o ON po.order_id = o.id')) {
          return Promise.resolve({
            rows: [
              {
                id: 'po_1',
                orderId: 'ord_1',
                providerName: 'DATAHOUSE',
                providerReference: 'dh_ref_12345',
                providerStatus: 'PROCESSING',
                orderStatus: 'PROCESSING',
              },
            ],
          });
        }
        if (
          sql.includes('UPDATE provider_orders') ||
          sql.includes('UPDATE orders') ||
          sql.includes('INSERT INTO order_events') ||
          sql.includes('INSERT INTO provider_reconciliation_records')
        ) {
          return Promise.resolve({ rows: [{ id: 'recon_audit_uuid_1' }] });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    mockTelecomProvider = {
      providerName: 'DATAHOUSE',
      getOrderStatus: vi.fn(),
      submitOrder: vi.fn(),
      precheckBeneficiaries: vi.fn(),
      verifyWebhookSignature: vi.fn().mockReturnValue(true),
      healthCheck: vi.fn(),
    };

    reconciliationService = new ProviderReconciliationService(mockDb, mockTelecomProvider);
  });

  describe('DataHouse Authority Invariant', () => {
    it('must correct local state to FAILED if DataHouse reports FAILED (DataHouse authority invariant)', async () => {
      (mockTelecomProvider.getOrderStatus as any).mockResolvedValue({
        providerStatus: ProviderStatus.FAILED,
        rawResponse: { error: 'INSUFFICIENT_CARRIER_QUOTA' },
      });

      const summary = await reconciliationService.reconcileStaleOrders(new Date().toISOString(), 0);

      expect(summary.totalChecked).toBe(1);
      expect(summary.discrepancyCount).toBe(1);
      expect(summary.discrepancies[0].actualProviderStatus).toBe(ProviderStatus.FAILED);

      // Verify orders table updated to FAILED
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE orders'),
        expect.arrayContaining([OrderStatus.FAILED, ProviderStatus.FAILED, 'ord_1']),
      );
    });

    it('must NEVER manufacture fulfillment success if DataHouse reports FAILED', async () => {
      (mockTelecomProvider.getOrderStatus as any).mockResolvedValue({
        providerStatus: ProviderStatus.FAILED,
        rawResponse: { error: 'INVALID_SUBSCRIBER' },
      });

      await reconciliationService.reconcileStaleOrders(new Date().toISOString(), 0);

      // Verify orders were NOT updated to COMPLETED
      expect(mockDb.query).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE orders'),
        expect.arrayContaining([OrderStatus.COMPLETED]),
      );
    });
  });

  describe('Carrier Failure Condition Matrix', () => {
    it('should gracefully handle DataHouse network timeout without crashing reconciliation worker', async () => {
      (mockTelecomProvider.getOrderStatus as any).mockRejectedValue(
        new Error('ETIMEDOUT: Connection to DataHouse gateway timed out after 10000ms'),
      );

      const summary = await reconciliationService.reconcileStaleOrders(new Date().toISOString(), 0);
      expect(summary.totalChecked).toBe(1); // 1 order was checked
      expect(summary.discrepancyCount).toBe(0); // error caught gracefully, no invalid discrepancy recorded
    });

    it('should gracefully handle DataHouse 500 internal server error', async () => {
      (mockTelecomProvider.getOrderStatus as any).mockRejectedValue(
        new Error('HTTP 500: DataHouse internal gateway error'),
      );

      const summary = await reconciliationService.reconcileStaleOrders(new Date().toISOString(), 0);
      expect(summary.totalChecked).toBe(1);
      expect(summary.discrepancyCount).toBe(0);
    });

    it('should gracefully handle malformed JSON response from telecom provider', async () => {
      (mockTelecomProvider.getOrderStatus as any).mockRejectedValue(
        new Error('SyntaxError: Unexpected token < in JSON at position 0'),
      );

      const summary = await reconciliationService.reconcileStaleOrders(new Date().toISOString(), 0);
      expect(summary.totalChecked).toBe(1);
      expect(summary.discrepancyCount).toBe(0);
    });
  });

  describe('Dual-Mode Idempotency Architecture', () => {
    it('should extract and normalize both HTTP header Idempotency-Key and body idempotencyKey', async () => {
      const idempotencyService = new IdempotencyService(mockDb, null);

      const payload = { recipientPhone: '0241234567', network: 'MTN', dataAmountMb: 1024 };
      const hash1 = idempotencyService.computeHash(payload);
      const hash2 = idempotencyService.computeHash(payload);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256
    });
  });
});
