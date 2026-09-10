import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FulfillmentWorker } from '../../src/core/providers/fulfillment-worker.js';
import { CircuitBreaker } from '../../src/core/providers/circuit-breaker.js';
import { RetryPolicy } from '../../src/core/providers/retry-policy.js';
import { FulfillmentQueueService } from '../../src/core/providers/fulfillment-queue.service.js';
import { RefundService } from '../../src/core/payments/refund.service.js';
import {
  OrderStatus,
  PaymentStatus,
  ProviderStatus,
  RefundStatus,
  NetworkProvider,
} from '@bytebeacon/shared';
import type pg from 'pg';

describe('Order Failure Classification & Immediate Automated Refund Suite', () => {
  let mockDb: any;
  let mockProvider: any;
  let circuitBreaker: CircuitBreaker;
  let retryPolicy: RetryPolicy;
  let queueService: FulfillmentQueueService;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      cooldownPeriodMs: 30000,
      providerName: 'DataHouse',
    });
    retryPolicy = new RetryPolicy({ maxAttempts: 3 });

    mockDb = {
      query: vi.fn(),
      connect: vi.fn(),
    };

    queueService = new FulfillmentQueueService(mockDb as pg.Pool, null);
  });

  describe('1. Error Classification (classifyUserFacingFailure)', () => {
    it('should map telecom gateway balance errors into user-facing refund explanations', () => {
      const worker = new FulfillmentWorker(
        mockDb as pg.Pool,
        mockProvider,
        circuitBreaker,
        retryPolicy,
        queueService,
      );

      const res1 = worker.classifyUserFacingFailure({ errorCode: 'INSUFFICIENT_BALANCE', message: 'Insufficient agent wallet balance' });
      expect(res1).toContain('insufficient balance');
      expect(res1).toContain('refunded to your wallet');

      const res2 = worker.classifyUserFacingFailure(new Error('Gateway error: insufficient balance on telco account'));
      expect(res2).toContain('insufficient balance');
      expect(res2).toContain('refunded to your wallet');
    });

    it('should map bundle unavailability errors into user-facing refund explanations', () => {
      const worker = new FulfillmentWorker(
        mockDb as pg.Pool,
        mockProvider,
        circuitBreaker,
        retryPolicy,
        queueService,
      );

      const res = worker.classifyUserFacingFailure({ errorCode: 'BUNDLE_NOT_FOUND', message: 'Requested package ID was not found' });
      expect(res).toContain('unavailable from the network provider');
      expect(res).toContain('refunded to your wallet');
    });

    it('should map beneficiary validation errors into actionable explanations', () => {
      const worker = new FulfillmentWorker(
        mockDb as pg.Pool,
        mockProvider,
        circuitBreaker,
        retryPolicy,
        queueService,
      );

      const res = worker.classifyUserFacingFailure({ errorCode: 'BENEFICIARY_NOT_VALIDATED', message: 'Phone number not whitelisted' });
      expect(res).toContain('prior MTN beneficiary validation');
      expect(res).toContain('refunded to your wallet');
    });

    it('should map network timeout/connection errors', () => {
      const worker = new FulfillmentWorker(
        mockDb as pg.Pool,
        mockProvider,
        circuitBreaker,
        retryPolicy,
        queueService,
      );

      const res = worker.classifyUserFacingFailure(new Error('connect ECONNREFUSED 127.0.0.1:443'));
      expect(res).toContain('network timed out');
      expect(res).toContain('refunded to your wallet');
    });
  });

  describe('2. Automated Wallet Refund Execution & Resilient Fallback', () => {
    it('should delegate to refundService when injected and report success', async () => {
      const mockRefundService = {
        executeAutomatedOrderRefund: vi.fn().mockResolvedValue({
          success: true,
          amountRefundedPesewas: 1000,
        }),
      } as unknown as RefundService;

      const worker = new FulfillmentWorker(
        mockDb as pg.Pool,
        mockProvider,
        circuitBreaker,
        retryPolicy,
        queueService,
        undefined,
        mockRefundService,
      );

      const success = await worker.executeAutomaticRefund(
        'ord_test_1',
        'corr_test_1',
        'Fulfillment gateway balance exhausted',
      );

      expect(success).toBe(true);
      expect(mockRefundService.executeAutomatedOrderRefund).toHaveBeenCalledWith(
        'ord_test_1',
        'Fulfillment gateway balance exhausted',
        'corr_test_1',
      );
    });

    it('should fall back to direct atomic double-entry wallet refund if refundService fails or throws', async () => {
      let walletBalancePesewas = 2000;
      let orderRefundStatus = 'NONE';
      let orderPaymentStatus = 'PAID';
      let orderFulfillmentStatus = 'READY_FOR_FULFILLMENT';
      const postedLedgerLines: any[] = [];

      // Mock client for transaction
      const mockClient = {
        query: vi.fn().mockImplementation((q: string, params?: any[]) => {
          if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') {
            return Promise.resolve({ rows: [] });
          }
          if (q.includes('FROM orders WHERE id = $1 FOR UPDATE')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'ord_fail_fallback_1',
                  user_id: 'usr_user_1',
                  agent_id: null,
                  amount_pesewas: 1500,
                  currency: 'GHS',
                  public_id: 'ord_pub_123',
                  payment_status: orderPaymentStatus,
                  order_status: orderFulfillmentStatus,
                  refund_status: orderRefundStatus,
                },
              ],
            });
          }
          if (q.includes('FROM payments WHERE order_id = $1')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'pay_123',
                  status: 'PAID',
                },
              ],
            });
          }
          if (q.includes('INSERT INTO refunds')) {
            return Promise.resolve({
              rows: [{ id: 'ref_fallback_123' }],
            });
          }
          if (q.includes('UPDATE payments SET status =')) {
            orderPaymentStatus = 'REFUNDED';
            return Promise.resolve({ rows: [] });
          }
          if (q.includes('UPDATE orders SET refund_status =')) {
            orderRefundStatus = 'COMPLETED';
            orderFulfillmentStatus = 'FAILED';
            return Promise.resolve({ rows: [] });
          }
          if (q.includes('UPDATE users')) {
            walletBalancePesewas += params![0];
            return Promise.resolve({ rows: [] });
          }
          if (q.includes('INSERT INTO financial_ledger')) {
            postedLedgerLines.push(params);
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      };

      mockDb.connect = vi.fn().mockResolvedValue(mockClient);
      mockDb.query = vi.fn().mockImplementation((q: string) => {
        if (q.includes('SELECT wallet_balance_pesewas')) {
          return Promise.resolve({
            rows: [{ wallet_balance_pesewas: walletBalancePesewas, wallet_balance: (walletBalancePesewas / 100).toFixed(2) }],
          });
        }
        if (q.includes('FROM orders WHERE id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_fail_fallback_1',
                user_id: 'usr_user_1',
                amount_pesewas: 1500,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      // refundService that throws an error to simulate database schema difference
      const failingRefundService = {
        executeAutomatedOrderRefund: vi.fn().mockRejectedValue(new Error('column "public_id" does not exist on refunds')),
      } as unknown as RefundService;

      const worker = new FulfillmentWorker(
        mockDb as pg.Pool,
        mockProvider,
        circuitBreaker,
        retryPolicy,
        queueService,
        undefined,
        failingRefundService,
      );

      const refundSuccess = await worker.executeAutomaticRefund(
        'ord_fail_fallback_1',
        'corr_fallback_1',
        'Provider rejected order: Insufficient balance',
      );

      expect(refundSuccess).toBe(true);
      // User wallet balance was credited by 1500 pesewas
      expect(walletBalancePesewas).toBe(3500);
      expect(orderRefundStatus).toBe('COMPLETED');
      expect(orderFulfillmentStatus).toBe('FAILED');
      // Double-entry ledger was recorded
      expect(postedLedgerLines.length).toBeGreaterThan(0);
    });

    it('should be idempotent and not double-refund if order is already COMPLETED refund', async () => {
      let walletCredited = false;
      const mockClient = {
        query: vi.fn().mockImplementation((q: string) => {
          if (q === 'BEGIN' || q === 'COMMIT') return Promise.resolve({ rows: [] });
          if (q.includes('FROM orders WHERE id = $1 FOR UPDATE')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'ord_already_refunded',
                  user_id: 'usr_user_1',
                  amount_pesewas: 1000,
                  refund_status: 'COMPLETED',
                  payment_status: 'REFUNDED',
                },
              ],
            });
          }
          if (q.includes('UPDATE users')) {
            walletCredited = true;
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      };

      mockDb.connect = vi.fn().mockResolvedValue(mockClient);

      const worker = new FulfillmentWorker(
        mockDb as pg.Pool,
        mockProvider,
        circuitBreaker,
        retryPolicy,
        queueService,
      );

      const result = await worker.executeAutomaticRefund(
        'ord_already_refunded',
        'corr_idem_1',
        'Retry refund',
      );

      expect(result).toBe(true);
      expect(walletCredited).toBe(false);
    });
  });

  describe('3. Permanent Order Failure Lifecycle in processOrderFulfillment', () => {
    it('should record failure_reason, fail order, and execute automatic refund when provider fails with non-retryable error', async () => {
      let orderStatus = OrderStatus.READY_FOR_FULFILLMENT;
      let failureReasonRecorded = '';
      let refundExecuted = false;

      const permanentErrorProvider = {
        providerName: 'DataHouse',
        submitOrder: vi.fn().mockRejectedValue({
          errorCode: 'INSUFFICIENT_BALANCE',
          message: 'Insufficient agent wallet balance',
        }),
        getOrderStatus: vi.fn(),
      };

      const mockDbInstance = {
        query: vi.fn().mockImplementation((q: string, params?: any[]) => {
          if (q.includes('FROM orders o')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'ord_test_fail_999',
                  public_id: 'ord_pub_999',
                  user_id: 'usr_user_999',
                  agent_id: null,
                  network: NetworkProvider.MTN,
                  recipient_phone: '0241112233',
                  data_amount_mb: 1024,
                  amount_pesewas: 500,
                  payment_status: PaymentStatus.PAID,
                  order_status: orderStatus,
                },
              ],
            });
          }
          if (q.includes('UPDATE orders') && q.includes('failure_reason = $2')) {
            orderStatus = OrderStatus.FAILED;
            failureReasonRecorded = params![1];
            return Promise.resolve({ rows: [] });
          }
          if (q.includes('UPDATE orders SET order_status = $1')) {
            orderStatus = params![0];
            return Promise.resolve({ rows: [] });
          }
          if (q.includes('FROM orders WHERE id = $1 FOR UPDATE')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'ord_test_fail_999',
                  user_id: 'usr_user_999',
                  amount_pesewas: 500,
                  payment_status: 'PAID',
                  refund_status: 'NONE',
                  currency: 'GHS',
                },
              ],
            });
          }
          if (q.includes('UPDATE users')) {
            refundExecuted = true;
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      const worker = new FulfillmentWorker(
        mockDbInstance as unknown as pg.Pool,
        permanentErrorProvider as any,
        circuitBreaker,
        retryPolicy,
        queueService,
      );

      const result = await worker.processOrderFulfillment('ord_test_fail_999', 'corr_perm_fail');

      expect(result.success).toBe(false);
      expect(result.orderStatus).toBe(OrderStatus.FAILED);
      expect(failureReasonRecorded).toContain('insufficient balance');
      expect(failureReasonRecorded).toContain('refunded to your wallet');
      expect(refundExecuted).toBe(true);
    });
  });
});
