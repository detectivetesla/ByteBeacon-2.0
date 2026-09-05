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

  constructor(
    db: pg.Pool,
    provider: ITelecomProvider,
    circuitBreaker: CircuitBreaker,
    retryPolicy: RetryPolicy,
    queueService: FulfillmentQueueService,
    webhookDispatcher?: AgentWebhookDispatcherService,
  ) {
    this.db = db;
    this.provider = provider;
    this.circuitBreaker = circuitBreaker;
    this.retryPolicy = retryPolicy;
    this.queueService = queueService;
    this.webhookDispatcher = webhookDispatcher || new AgentWebhookDispatcherService(db);
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

      try {
        submitResult = await this.circuitBreaker.execute(() =>
          activeProvider.submitOrder({
            orderId: order.id,
            clientReference: deterministicReference,
            network: order.network,
            recipientPhone: order.recipient_phone,
            dataAmountMb: order.data_amount_mb,
            idempotencyKey: deterministicReference,
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
      // 1. Fetch order details
      const orderRes = await this.db.query(
        `SELECT id, user_id, agent_id, amount_pesewas, payment_status, refund_status
         FROM orders
         WHERE id = $1`,
        [orderId],
      );

      if (orderRes.rows.length === 0) return false;
      const order = orderRes.rows[0];

      // Verification: must be paid and not already refunded
      if (
        order.payment_status !== PaymentStatus.PAID ||
        order.refund_status === 'COMPLETED' ||
        !order.user_id ||
        !order.amount_pesewas ||
        Number(order.amount_pesewas) <= 0
      ) {
        return false;
      }

      const amountPesewas = Number(order.amount_pesewas);

      // 2. Refund user's wallet
      await this.db.query(
        `UPDATE users
         SET wallet_balance_pesewas = wallet_balance_pesewas + $1,
             wallet_balance = ROUND((wallet_balance_pesewas + $1) / 100.0, 2),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [amountPesewas, order.user_id],
      );

      // 3. Mark order as refunded
      await this.db.query(
        `UPDATE orders
         SET refund_status = 'COMPLETED',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [orderId],
      );

      // 4. Record ledger entry (double-entry accounting)
      await this.db.query(
        `INSERT INTO financial_ledger (
            transaction_id, entry_type, account_type, account_id,
            amount_pesewas, currency, reference_type, reference_id,
            description
         ) VALUES (
            uuid_generate_v4(), 'CREDIT', 'CUSTOMER_WALLET', $1,
            $2, 'GHS', 'ORDER_REFUND', $3,
            $4
         )`,
        [order.user_id, amountPesewas, orderId, `Automated refund for failed order [${orderId}]: ${reason}`],
      ).catch(() => {});

      // 5. Insert order event
      await this.db.query(
        `INSERT INTO order_events (
            order_id, event_type, correlation_id, actor_id, actor_type, source,
            previous_state, new_state
         ) VALUES ($1, 'ORDER_REFUNDED', $2, $3, 'SYSTEM', 'FULFILLMENT_WORKER', $4, $5)`,
        [
          orderId,
          correlationId,
          order.user_id,
          JSON.stringify({ refundStatus: order.refund_status || 'NONE' }),
          JSON.stringify({
            refundStatus: 'COMPLETED',
            amountPesewas,
            reason,
            refundedAt: new Date().toISOString(),
          }),
        ],
      ).catch(() => {});

      // 6. Webhook dispatching: wallet.updated
      const targetAgentId = order.agent_id || order.user_id;
      if (targetAgentId) {
        const balRes = await this.db.query(
          'SELECT wallet_balance_pesewas, wallet_balance FROM users WHERE id = $1',
          [order.user_id],
        ).catch(() => ({ rows: [] }));
        const balanceAfter =
          balRes.rows[0]?.wallet_balance ??
          ((balRes.rows[0]?.wallet_balance_pesewas || 0) / 100).toFixed(2);

        this.webhookDispatcher?.dispatchAgentEvent(targetAgentId, 'wallet.updated', {
          wallet_id: order.user_id,
          agent_id: targetAgentId,
          direction: 'credit',
          amount: (amountPesewas / 100).toFixed(2),
          currency: 'GHS',
          balance_after: balanceAfter,
          reason: `Automated refund for failed order [${orderId}]: ${reason}`,
        }).catch(() => {});
      }

      logger.info(
        { orderId, userId: order.user_id, amountPesewas, reason },
        '[FULFILLMENT_WORKER] Automated wallet refund successfully executed for failed order',
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
