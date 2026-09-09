import crypto from 'node:crypto';
import type pg from 'pg';
import {
  OrderStatus,
  ProviderStatus,
  OrderEventType,
  PaymentStatus,
  SubmitOrderResult,
  ProviderOrderStatus,
} from '@bytebeacon/shared';
import { ITelecomProvider } from './telecom/telecom-provider.interface.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { RetryPolicy } from './retry-policy.js';
import { FulfillmentQueueService } from './fulfillment-queue.service.js';
import { QueueManager } from '../../infrastructure/queues/queue.manager.js';
import { logger } from '../logging/logger.js';
import { AgentWebhookDispatcherService } from '../webhooks/agent-webhook-dispatcher.service.js';
import type { RefundService } from '../payments/refund.service.js';

export interface ProcessOrderResult {
  orderId: string;
  success: boolean;
  providerStatus: ProviderStatus;
  orderStatus: OrderStatus;
  reconciledBeforeRetry?: boolean;
  error?: string;
}

export class FulfillmentWorker {
  private readonly db: pg.Pool;
  private readonly provider: ITelecomProvider;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly retryPolicy: RetryPolicy;
  private readonly queueService: FulfillmentQueueService;
  private readonly webhookDispatcher?: AgentWebhookDispatcherService;
  private readonly refundService?: RefundService;

  constructor(
    db: pg.Pool,
    provider: ITelecomProvider,
    circuitBreaker: CircuitBreaker,
    retryPolicy: RetryPolicy,
    queueService: FulfillmentQueueService,
    webhookDispatcher?: AgentWebhookDispatcherService,
    refundService?: RefundService,
  ) {
    this.db = db;
    this.provider = provider;
    this.circuitBreaker = circuitBreaker;
    this.retryPolicy = retryPolicy;
    this.queueService = queueService;
    this.webhookDispatcher = webhookDispatcher || new AgentWebhookDispatcherService(db);
    this.refundService = refundService;
  }

  /**
   * Resolves the authoritative or network-routed provider for an order.
   * Enforces historical order provider immutability only when the order was previously submitted.
   */
  private resolveProviderForOrder(order: {
    providerName?: string;
    providerStatus?: string;
    submissionAttempts?: number;
    providerReference?: string;
    network: any;
  }): ITelecomProvider {
    const registry = this.provider as any;
    const hasBeenSubmitted =
      (order.submissionAttempts !== undefined && Number(order.submissionAttempts) > 0) ||
      (Boolean(order.providerStatus) && order.providerStatus !== ProviderStatus.UNKNOWN && order.providerStatus !== 'UNKNOWN');

    if (hasBeenSubmitted && order.providerName && typeof registry.getProvider === 'function') {
      const historical = registry.getProvider(order.providerName);
      if (historical) return historical;
    }
    if (order.network && typeof registry.getProviderForNetwork === 'function') {
      return registry.getProviderForNetwork(order.network);
    }
    if (typeof registry.getActiveProvider === 'function') {
      return registry.getActiveProvider();
    }
    return this.provider;
  }

  /**
   * Processes fulfillment for an order with Reconciliation-Before-Retry, Circuit Breaker, and Idempotency guarantees.
   */
  public async processOrderFulfillment(
    orderId: string,
    correlationId: string,
    currentAttempt = 1,
  ): Promise<ProcessOrderResult> {
    // 1. Concurrency Lock: Prevent multiple workers from processing the same order concurrently
    const lockAcquired = await this.queueService.acquireOrderLock(orderId);
    if (!lockAcquired) {
      logger.warn({ orderId, correlationId }, 'Fulfillment lock already held by another worker; skipping');
      return {
        orderId,
        success: false,
        providerStatus: ProviderStatus.UNKNOWN,
        orderStatus: OrderStatus.READY_FOR_FULFILLMENT,
        error: 'Order currently locked by another worker',
      };
    }

    try {
      // 2. Fetch Order and Provider Projection with Catalog Plan Mapping
      const orderRes = await this.db.query(
        `SELECT o.id, o.public_id, o.user_id, o.agent_id, o.recipient_phone, o.network,
                o.data_amount_mb, o.payment_status, o.order_status, o.product_id,
                o.pricing_snapshot as "pricingSnapshot",
                cp.provider_plan_id as "providerPlanId", cp.provider_plan_code as "providerPlanCode",
                cp.provider_product_code as "providerProductCode", cp.sku, cp.name as "productName",
                po.id as "providerOrderId", po.provider_name as "providerName",
                po.provider_reference as "providerReference", po.provider_status as "providerStatus"
         FROM orders o
         LEFT JOIN catalog_products cp ON o.product_id = cp.id
         LEFT JOIN provider_orders po ON o.id = po.order_id
         WHERE o.id = $1`,
        [orderId],
      );

      if (orderRes.rows.length === 0) {
        logger.error({ orderId }, 'Order not found for fulfillment');
        return {
          orderId,
          success: false,
          providerStatus: ProviderStatus.UNKNOWN,
          orderStatus: OrderStatus.FAILED,
          error: 'Order not found',
        };
      }

      const order = orderRes.rows[0];

      // Verification Invariant: Order must be paid and ready for fulfillment
      if (order.payment_status !== PaymentStatus.PAID) {
        logger.warn({ orderId, paymentStatus: order.payment_status }, 'Order is not paid; cannot fulfill');
        return {
          orderId,
          success: false,
          providerStatus: ProviderStatus.UNKNOWN,
          orderStatus: order.order_status,
          error: 'Order payment has not been captured',
        };
      }

      // If already completed or explicitly fulfilled, do not blindly submit again
      if (
        order.order_status === OrderStatus.COMPLETED ||
        order.providerStatus === ProviderStatus.COMPLETED
      ) {
        logger.info({ orderId }, 'Order is already completed at provider; idempotent no-op');
        return {
          orderId,
          success: true,
          providerStatus: ProviderStatus.COMPLETED,
          orderStatus: OrderStatus.COMPLETED,
        };
      }

      // Dispatch order.processing for agent orders entering active processing
      if (order.agent_id) {
        this.webhookDispatcher?.dispatchAgentEvent(order.agent_id, 'order.processing', {
          id: order.id,
          order_id: order.id,
          public_id: order.public_id,
          status: 'processing',
          network: order.network,
          recipient_phone: order.recipient_phone,
        }).catch(() => {});
      }

      // Resolve specific provider (using current active/routing provider for unsubmitted orders)
      const activeProvider = this.resolveProviderForOrder(order);
      const deterministicReference = `pst_sub_${order.id}`;
      let reconciledBeforeRetry = false;

      // 3. Reconciliation-Before-Retry Strategy
      // Only query getOrderStatus before submission if this is a retry attempt (>1)
      if (currentAttempt > 1) {
        try {
          const checkStatus = await this.circuitBreaker.execute(() =>
            activeProvider.getOrderStatus({ providerReference: deterministicReference, orderId }),
          );

          if (checkStatus && checkStatus.providerStatus !== ProviderStatus.UNKNOWN) {
            logger.info(
              { orderId, checkStatus, providerName: activeProvider.providerName },
              'Reconciliation-Before-Retry: Order already recognized by provider; updating projection without resubmission',
            );
            reconciledBeforeRetry = true;
            return await this.updateProviderProjection(orderId, checkStatus, correlationId);
          }
        } catch (checkErr) {
          logger.warn({ checkErr, orderId, providerName: activeProvider.providerName }, 'Reconciliation-before-retry query returned error; proceeding with evaluated submission');
        }
      }

      // 4. Submit Order to Provider Protected by Circuit Breaker
      let submitResult: SubmitOrderResult;
      const startMs = Date.now();

      // Extract any pre-confirmed ported MSISDNs from pricing snapshot
      const snapshotObj =
        typeof order.pricingSnapshot === 'string'
          ? (() => {
              try {
                return JSON.parse(order.pricingSnapshot);
              } catch {
                return null;
              }
            })()
          : order.pricingSnapshot;
      const confirmedPorted = Array.isArray(snapshotObj?.confirmedPorted)
        ? snapshotObj.confirmedPorted
        : undefined;

      try {
        submitResult = await this.circuitBreaker.execute(() =>
          activeProvider.submitOrder({
            orderId: order.id,
            clientReference: deterministicReference,
            network: order.network,
            recipientPhone: order.recipient_phone,
            dataAmountMb: order.data_amount_mb,
            idempotencyKey: deterministicReference,
            confirmedPorted,
            metadata: {
              correlationId,
              bundleId: order.providerPlanId || order.providerPlanCode || order.product_id,
              providerProductId: order.providerProductCode,
              sku: order.sku,
              productName: order.productName,
              dataAmountMb: order.data_amount_mb,
              volumeGb: Math.max(1, Math.round(order.data_amount_mb / 1024)),
            },
          }),
        );
      } catch (err: any) {
        const latencyMs = Date.now() - startMs;
        const isRetryable = this.retryPolicy.isRetryable(err);

        // Record submission attempt failure (non-blocking)
        await this.db.query(
          `INSERT INTO provider_submission_attempts (
              order_id, provider, idempotency_key, attempt_number,
              status, error_code, error_message, latency_ms
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            order.id,
            activeProvider.providerName,
            deterministicReference,
            currentAttempt,
            'ERROR',
            err.errorCode || 'SUBMISSION_ERROR',
            err.message,
            latencyMs,
          ],
        ).catch(() => {});

        if (!isRetryable || currentAttempt >= this.retryPolicy.getMaxAttempts()) {
          // Route to DLQ and mark order failed
          await this.queueService.routeToDlq({
            orderId: order.id,
            provider: activeProvider.providerName,
            jobId: `job_${order.id}`,
            attemptCount: currentAttempt,
            errorCode: err.errorCode || 'UNRECOVERABLE_FAILURE',
            errorMessage: err.message,
            requestReference: deterministicReference,
            correlationId,
            failureClass: isRetryable ? 'RETRYABLE_EXHAUSTED' : 'PERMANENT_REJECTION',
          }).catch(() => {});

          await this.db.query(
            `UPDATE orders
             SET order_status = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [OrderStatus.FAILED, order.id],
          );

          await this.db.query(
            `UPDATE provider_orders SET provider_status = $1, last_synced_at = CURRENT_TIMESTAMP WHERE order_id = $2`,
            [ProviderStatus.FAILED, order.id],
          ).catch(() => {});

          if (order.agent_id) {
            this.webhookDispatcher?.dispatchAgentEvent(order.agent_id, 'order.rejected', {
              id: order.id,
              order_id: order.id,
              public_id: order.public_id,
              status: 'rejected',
              reason: err.message || 'Fulfillment failure',
            }).catch(() => {});

            this.webhookDispatcher?.dispatchAgentEvent(order.agent_id, 'purchase.failed', {
              id: order.id,
              order_id: order.id,
              public_id: order.public_id,
              status: 'rejected',
              reason: err.message || 'Fulfillment failure',
            }).catch(() => {});
          }

          // Automated Wallet Refund on permanent fulfillment failure
          await this.executeAutomaticRefund(order.id, correlationId, err.message || 'Fulfillment failure');
          await this.checkBulkBatchCompletion(order.id);

          return {
            orderId,
            success: false,
            providerStatus: ProviderStatus.FAILED,
            orderStatus: OrderStatus.FAILED,
            error: err.message,
          };
        }

        throw err;
      }

      const latencyMs = Date.now() - startMs;

      // 5. Record Successful Submission Attempt (non-blocking)
      await this.db.query(
        `INSERT INTO provider_submission_attempts (
            order_id, provider, idempotency_key, attempt_number,
            status, latency_ms, response_payload
         ) VALUES ($1, $2, $3, $4, 'ACCEPTED', $5, $6)`,
        [
          order.id,
          activeProvider.providerName,
          deterministicReference,
          currentAttempt,
          latencyMs,
          JSON.stringify(submitResult),
        ],
      ).catch(() => {});

      // 6. Explicit Provider Acceptance -> Transition Order
      const initialProviderStatus = submitResult.providerStatus || ProviderStatus.RECEIVED;
      const isCompleted = initialProviderStatus === ProviderStatus.COMPLETED;
      const isFailed = initialProviderStatus === ProviderStatus.FAILED || initialProviderStatus === ProviderStatus.REJECTED;
      const finalOrderStatus = isCompleted
        ? OrderStatus.COMPLETED
        : isFailed
        ? OrderStatus.FAILED
        : OrderStatus.SUBMITTED;

      try {
        await this.db.query(
          `UPDATE provider_orders
           SET provider_name = $1,
               provider_reference = $2,
               provider_status = $3,
               raw_payload = $5,
               last_synced_at = CURRENT_TIMESTAMP,
               last_provider_event_at = CURRENT_TIMESTAMP,
               sync_version = sync_version + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE order_id = $4`,
          [
            activeProvider.providerName,
            submitResult.providerReference,
            initialProviderStatus,
            order.id,
            JSON.stringify(submitResult.rawResponse || submitResult),
          ],
        );
      } catch {
        await this.db.query(
          `UPDATE provider_orders
           SET provider_name = $1,
               provider_reference = $2,
               provider_status = $3,
               last_synced_at = CURRENT_TIMESTAMP
           WHERE order_id = $4`,
          [
            activeProvider.providerName,
            submitResult.providerReference,
            initialProviderStatus,
            order.id,
          ],
        ).catch(() => {});
      }

      await this.db.query(
        `UPDATE orders
         SET order_status = $1,
             provider_status = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [finalOrderStatus, initialProviderStatus, order.id],
      );

      // Record Order Event
      await this.db.query(
        `INSERT INTO order_events (
            order_id, event_type, correlation_id, actor_id, actor_type, source,
            previous_state, new_state
         ) VALUES ($1, $2, $3, $4, 'SYSTEM', 'PROVIDER_WORKER', $5, $6)`,
        [
          order.id,
          isCompleted ? OrderEventType.ORDER_COMPLETED : OrderEventType.ORDER_SUBMITTED,
          correlationId,
          order.user_id,
          JSON.stringify({ orderStatus: OrderStatus.READY_FOR_FULFILLMENT }),
          JSON.stringify({
            orderStatus: finalOrderStatus,
            providerStatus: initialProviderStatus,
            providerReference: submitResult.providerReference,
            providerName: activeProvider.providerName,
          }),
        ],
      ).catch(() => {});

      // Dispatch agent webhooks on completion or failure
      if (order.agent_id) {
        if (isCompleted) {
          this.webhookDispatcher?.dispatchAgentEvent(order.agent_id, 'order.approved', {
            id: order.id,
            order_id: order.id,
            public_id: order.public_id,
            reference: submitResult.providerReference,
            provider_reference: submitResult.providerReference,
            status: 'approved',
            network: order.network,
            recipient_phone: order.recipient_phone,
          }).catch(() => {});

          this.webhookDispatcher?.dispatchAgentEvent(order.agent_id, 'purchase.success', {
            id: order.id,
            order_id: order.id,
            public_id: order.public_id,
            reference: submitResult.providerReference,
            provider_reference: submitResult.providerReference,
            status: 'approved',
            network: order.network,
            recipient_phone: order.recipient_phone,
          }).catch(() => {});
        } else if (isFailed) {
          this.webhookDispatcher?.dispatchAgentEvent(order.agent_id, 'order.rejected', {
            id: order.id,
            order_id: order.id,
            public_id: order.public_id,
            status: 'rejected',
            reason: `Provider rejected order with status [${initialProviderStatus}]`,
          }).catch(() => {});

          this.webhookDispatcher?.dispatchAgentEvent(order.agent_id, 'purchase.failed', {
            id: order.id,
            order_id: order.id,
            public_id: order.public_id,
            status: 'rejected',
            reason: `Provider rejected order with status [${initialProviderStatus}]`,
          }).catch(() => {});
        }
      }

      // If provider explicitly rejected/failed, trigger automatic refund immediately
      if (isFailed) {
        await this.executeAutomaticRefund(order.id, correlationId, `Provider rejected order with status [${initialProviderStatus}]`);
      }
      await this.checkBulkBatchCompletion(order.id);

      logger.info(
        { orderId: order.id, providerReference: submitResult.providerReference, providerName: activeProvider.providerName, status: finalOrderStatus },
        `Order processed by ${activeProvider.providerName} and transitioned to ${finalOrderStatus}`,
      );

      return {
        orderId,
        success: !isFailed,
        providerStatus: initialProviderStatus,
        orderStatus: finalOrderStatus,
        reconciledBeforeRetry,
      };
    } finally {
      await this.queueService.releaseOrderLock(orderId);
    }
  }

  /**
   * Executes an automatic, idempotent wallet refund whenever an order experiences a permanent fulfillment failure.
   */
  public async executeAutomaticRefund(
    orderId: string,
    correlationId: string,
    reason: string = 'AUTOMATIC_FULFILLMENT_FAILURE_REFUND',
  ): Promise<boolean> {
    try {
      if (this.refundService) {
        const res = await this.refundService.executeAutomatedOrderRefund(orderId, reason, correlationId);
        if (!res.success) return false;
      } else {
        // Authoritative fallback with balanced double-entry ledger lines if refundService is not injected
        const client = await this.db.connect();
        try {
          await client.query('BEGIN');
          const orderRes = await client.query(
            `SELECT id, public_id, user_id, agent_id, amount_pesewas, currency, payment_status, refund_status
             FROM orders WHERE id = $1 FOR UPDATE`,
            [orderId],
          );
          if (orderRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return false;
          }
          const order = orderRes.rows[0];
          if (order.refund_status === 'COMPLETED') {
            await client.query('COMMIT');
            return true;
          }
          if (order.payment_status !== PaymentStatus.PAID || !order.user_id || Number(order.amount_pesewas) <= 0) {
            await client.query(
              `UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
              [OrderStatus.FAILED, orderId],
            );
            await client.query('COMMIT');
            return true;
          }

          const amountPesewas = Number(order.amount_pesewas);

          // Find or create payment
          const payRes = await client.query(
            `SELECT id FROM payments WHERE order_id = $1 AND status = 'PAID' ORDER BY created_at DESC LIMIT 1`,
            [orderId],
          );
          let paymentId = payRes.rows[0]?.id;
          if (!paymentId) {
            const newPay = await client.query(
              `INSERT INTO payments (order_id, user_id, amount_pesewas, currency, provider, provider_reference, payment_method, status, paid_at)
               VALUES ($1, $2, $3, $4, 'WALLET', $5, 'WALLET', 'PAID', CURRENT_TIMESTAMP) RETURNING id`,
              [order.id, order.user_id, amountPesewas, order.currency || 'GHS', `pst_wal_${order.public_id || order.id}`],
            );
            paymentId = newPay.rows[0].id;
          }

          const refundRes = await client.query(
            `INSERT INTO refunds (payment_id, order_id, amount_pesewas, reason, status)
             VALUES ($1, $2, $3, $4, 'COMPLETED') RETURNING id`,
            [paymentId, order.id, amountPesewas, reason],
          );
          const refundId = refundRes.rows[0].id;

          await client.query(
            `UPDATE payments SET status = 'REFUNDED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [paymentId],
          );
          await client.query(
            `UPDATE orders SET refund_status = 'COMPLETED', payment_status = 'REFUNDED', order_status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [order.id],
          );
          await client.query(
            `UPDATE users
             SET wallet_balance_pesewas = COALESCE(wallet_balance_pesewas, 0) + $1,
                 wallet_balance = ROUND((COALESCE(wallet_balance_pesewas, 0) + $1) / 100.0, 2),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [amountPesewas, order.user_id],
          );

          // Balanced double-entry financial ledger (Total Debits == Total Credits)
          const transactionId = crypto.randomUUID();
          const platformSystemAccountId = '00000000-0000-0000-0000-000000000000';
          await client.query(
            `INSERT INTO financial_ledger (transaction_id, entry_type, account_type, account_id, amount_pesewas, currency, reference_type, reference_id, description)
             VALUES ($1, 'DEBIT', 'PLATFORM_ESCROW', $2, $3, $4, 'REFUND', $5, $6),
                    ($1, 'CREDIT', 'CUSTOMER_WALLET', $7, $3, $4, 'REFUND', $5, $8)`,
            [
              transactionId,
              platformSystemAccountId,
              amountPesewas,
              order.currency || 'GHS',
              refundId,
              `Platform escrow debited for automated refund on Order ${order.id}`,
              order.user_id,
              `Customer wallet credited for automated refund on Order ${order.id}`,
            ],
          );

          await client.query('COMMIT');
        } catch (fErr) {
          await client.query('ROLLBACK').catch(() => {});
          throw fErr;
        } finally {
          client.release();
        }
      }

      // Webhook dispatching: wallet.updated & purchase.failed
      const orderMeta = await this.db.query(
        'SELECT id, public_id, user_id, agent_id, network, recipient_phone, amount_pesewas FROM orders WHERE id = $1',
        [orderId],
      ).catch(() => ({ rows: [] }));
      const ord = orderMeta.rows[0];

      if (ord) {
        const targetAgentId = ord.agent_id || ord.user_id;
        const balRes = await this.db.query(
          'SELECT wallet_balance_pesewas, wallet_balance FROM users WHERE id = $1',
          [ord.user_id],
        ).catch(() => ({ rows: [] }));
        const balanceAfter =
          balRes.rows[0]?.wallet_balance ??
          ((balRes.rows[0]?.wallet_balance_pesewas || 0) / 100).toFixed(2);

        this.webhookDispatcher?.dispatchAgentEvent(targetAgentId, 'wallet.updated', {
          wallet_id: ord.user_id,
          agent_id: targetAgentId,
          direction: 'credit',
          amount: (Number(ord.amount_pesewas || 0) / 100).toFixed(2),
          currency: 'GHS',
          balance_after: balanceAfter,
          reason: `Automated refund for failed order [${orderId}]: ${reason}`,
        }).catch(() => {});
      }

      logger.info(
        { orderId, reason },
        '[FULFILLMENT_WORKER] Automated wallet refund successfully completed for failed order',
      );
      return true;
    } catch (err: any) {
      logger.error(
        { orderId, err: err?.message, stack: err?.stack },
        '[FULFILLMENT_WORKER] Failed to execute automatic refund',
      );
      return false;
    }
  }

  /**
   * Checks if an order belongs to a bulk submission, updates bulk_submission_items status,
   * and if the batch reaches a terminal state (with mixed results), dispatches order.partially_approved.
   */
  public async checkBulkBatchCompletion(orderId: string): Promise<void> {
    try {
      // 1. Check if this order is linked to a bulk submission
      const itemRes = await this.db.query(
        `SELECT submission_id FROM bulk_submission_items WHERE order_id = $1 LIMIT 1`,
        [orderId],
      );
      if (!itemRes.rows || itemRes.rows.length === 0 || !itemRes.rows[0].submission_id) {
        return;
      }
      const submissionId = itemRes.rows[0].submission_id;

      // 2. Fetch order status
      const ordRes = await this.db.query(
        `SELECT order_status FROM orders WHERE id = $1 LIMIT 1`,
        [orderId],
      );
      const currentStatus = ordRes.rows?.[0]?.order_status;
      const isCompleted = currentStatus === OrderStatus.COMPLETED;
      const isFailed = currentStatus === OrderStatus.FAILED || currentStatus === OrderStatus.CANCELLED;

      if (isCompleted) {
        await this.db.query(
          `UPDATE bulk_submission_items SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1`,
          [orderId],
        ).catch(() => {});
      } else if (isFailed) {
        await this.db.query(
          `UPDATE bulk_submission_items SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1`,
          [orderId],
        ).catch(() => {});
      }

      // 3. Inspect aggregate counts for the entire batch
      const statsRes = await this.db.query(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
           COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed
         FROM bulk_submission_items
         WHERE submission_id = $1`,
        [submissionId],
      );

      if (statsRes.rows && statsRes.rows.length > 0) {
        const total = parseInt(statsRes.rows[0].total, 10) || 0;
        const completed = parseInt(statsRes.rows[0].completed, 10) || 0;
        const failed = parseInt(statsRes.rows[0].failed, 10) || 0;

        if (total > 0 && completed + failed === total) {
          // Fetch submission metadata and agent ID
          const subRes = await this.db.query(
            `SELECT bs.id, bs.user_id, a.id as agent_id
             FROM bulk_submissions bs
             LEFT JOIN agents a ON a.user_id = bs.user_id
             WHERE bs.id = $1 LIMIT 1`,
            [submissionId],
          );
          const targetAgentId = subRes.rows?.[0]?.agent_id || subRes.rows?.[0]?.user_id;

          if (completed > 0 && failed > 0) {
            // Mixed batch -> status PARTIALLY_COMPLETED and dispatch order.partially_approved
            await this.db.query(
              `UPDATE bulk_submissions SET status = 'PARTIALLY_COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
              [submissionId],
            ).catch(() => {});

            if (targetAgentId) {
              this.webhookDispatcher?.dispatchAgentEvent(targetAgentId, 'order.partially_approved', {
                id: submissionId,
                submission_id: submissionId,
                status: 'partially_approved',
                total_count: total,
                success_count: completed,
                failed_count: failed,
              }).catch(() => {});
            }
          } else if (completed === total) {
            await this.db.query(
              `UPDATE bulk_submissions SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
              [submissionId],
            ).catch(() => {});
          } else if (failed === total) {
            await this.db.query(
              `UPDATE bulk_submissions SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
              [submissionId],
            ).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      logger.debug({ err: err?.message, orderId }, 'Bulk batch completion check notice');
    }
  }

  private async updateProviderProjection(
    orderId: string,
    statusData: ProviderOrderStatus,
    correlationId: string,
  ): Promise<ProcessOrderResult> {
    const isCompleted = statusData.providerStatus === ProviderStatus.COMPLETED;
    const isFailed = statusData.providerStatus === ProviderStatus.FAILED || statusData.providerStatus === ProviderStatus.REJECTED;

    const newOrderStatus = isCompleted
      ? OrderStatus.COMPLETED
      : isFailed
      ? OrderStatus.FAILED
      : OrderStatus.PROCESSING;

    await this.db.query(
      `UPDATE provider_orders
       SET provider_status = $1,
           last_synced_at = CURRENT_TIMESTAMP,
           sync_version = sync_version + 1
       WHERE order_id = $2`,
      [statusData.providerStatus, orderId],
    ).catch(() => {});

    await this.db.query(
      `UPDATE orders
       SET order_status = $1,
           provider_status = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [newOrderStatus, statusData.providerStatus, orderId],
    );

    await this.db.query(
      `INSERT INTO order_events (
          order_id, event_type, correlation_id, actor_id, actor_type, source,
          previous_state, new_state
       ) VALUES ($1, $2, $3, NULL, 'SYSTEM', 'PROVIDER_WORKER', $4, $5)`,
      [
        orderId,
        isCompleted ? OrderEventType.ORDER_COMPLETED : OrderEventType.PROVIDER_STATUS_UPDATED,
        correlationId,
        JSON.stringify({ previous: 'UNKNOWN' }),
        JSON.stringify({
          orderStatus: newOrderStatus,
          providerStatus: statusData.providerStatus,
        }),
      ],
    ).catch(() => {});

    // Dispatch agent webhooks on projection update
    const orderMetaRes = await this.db.query(
      'SELECT id, public_id, agent_id, network, recipient_phone FROM orders WHERE id = $1',
      [orderId],
    ).catch(() => ({ rows: [] }));
    const ordMeta = orderMetaRes.rows[0];

    if (ordMeta?.agent_id) {
      if (isCompleted) {
        this.webhookDispatcher?.dispatchAgentEvent(ordMeta.agent_id, 'order.approved', {
          id: ordMeta.id,
          order_id: ordMeta.id,
          public_id: ordMeta.public_id,
          status: 'approved',
          network: ordMeta.network,
          recipient_phone: ordMeta.recipient_phone,
        }).catch(() => {});

        this.webhookDispatcher?.dispatchAgentEvent(ordMeta.agent_id, 'purchase.success', {
          id: ordMeta.id,
          order_id: ordMeta.id,
          public_id: ordMeta.public_id,
          status: 'approved',
          network: ordMeta.network,
          recipient_phone: ordMeta.recipient_phone,
        }).catch(() => {});
      } else if (isFailed) {
        this.webhookDispatcher?.dispatchAgentEvent(ordMeta.agent_id, 'order.rejected', {
          id: ordMeta.id,
          order_id: ordMeta.id,
          public_id: ordMeta.public_id,
          status: 'rejected',
          reason: `Provider status transitioned to ${statusData.providerStatus}`,
        }).catch(() => {});

        this.webhookDispatcher?.dispatchAgentEvent(ordMeta.agent_id, 'purchase.failed', {
          id: ordMeta.id,
          order_id: ordMeta.id,
          public_id: ordMeta.public_id,
          status: 'rejected',
          reason: `Provider status transitioned to ${statusData.providerStatus}`,
        }).catch(() => {});
      } else if (statusData.providerStatus === ProviderStatus.PROCESSING) {
        this.webhookDispatcher?.dispatchAgentEvent(ordMeta.agent_id, 'order.processing', {
          id: ordMeta.id,
          order_id: ordMeta.id,
          public_id: ordMeta.public_id,
          status: 'processing',
          network: ordMeta.network,
          recipient_phone: ordMeta.recipient_phone,
        }).catch(() => {});
      }
    }

    // If transitioned to FAILED/REJECTED, automatically refund the order
    if (isFailed) {
      await this.executeAutomaticRefund(orderId, correlationId, `Provider status transitioned to ${statusData.providerStatus}`);
    }

    if (isCompleted || isFailed) {
      await this.checkBulkBatchCompletion(orderId);
    }

    return {
      orderId,
      success: isCompleted || statusData.providerStatus === ProviderStatus.PROCESSING,
      providerStatus: statusData.providerStatus,
      orderStatus: newOrderStatus,
      reconciledBeforeRetry: true,
    };
  }

  /**
   * Attaches a BullMQ worker to the fulfillment queue.
   */
  public attachBullWorker(queueManager: QueueManager) {
    return queueManager.registerWorker(
      'bb:fulfillment',
      async (job) => {
        const { orderId, correlationId } = job.data;
        const result = await this.processOrderFulfillment(
          orderId,
          correlationId || job.id,
          job.attemptsMade + 1,
        );

        if (!result.success && result.providerStatus === ProviderStatus.FAILED) {
          throw new Error(result.error || 'Order fulfillment failed');
        }

        return result;
      },
      { concurrency: 10 },
    );
  }
}
