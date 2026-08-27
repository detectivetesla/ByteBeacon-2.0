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

  constructor(
    db: pg.Pool,
    provider: ITelecomProvider,
    circuitBreaker: CircuitBreaker,
    retryPolicy: RetryPolicy,
    queueService: FulfillmentQueueService,
  ) {
    this.db = db;
    this.provider = provider;
    this.circuitBreaker = circuitBreaker;
    this.retryPolicy = retryPolicy;
    this.queueService = queueService;
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
      // 2. Fetch Order and Provider Projection
      const orderRes = await this.db.query(
        `SELECT o.id, o.public_id, o.user_id, o.recipient_phone, o.network,
                o.data_amount_mb, o.payment_status, o.order_status,
                po.id as "providerOrderId", po.provider_name as "providerName",
                po.provider_reference as "providerReference", po.provider_status as "providerStatus",
                po.submission_attempts as "submissionAttempts"
         FROM orders o
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

      // Resolve specific provider (using current active/routing provider for unsubmitted orders)
      const activeProvider = this.resolveProviderForOrder(order);
      const deterministicReference = `pst_sub_${order.id}`;
      let reconciledBeforeRetry = false;

      // 3. Reconciliation-Before-Retry Strategy
      // Only query getOrderStatus before submission if this is a retry attempt (>1) or has prior submission attempts
      if (currentAttempt > 1 || (order.submissionAttempts !== undefined && Number(order.submissionAttempts) > 0)) {
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
            metadata: { correlationId },
          }),
        );
      } catch (err: any) {
        const latencyMs = Date.now() - startMs;
        const isRetryable = this.retryPolicy.isRetryable(err);

        // Record submission attempt failure
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
        );

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
          });

          await this.db.query(
            `UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [OrderStatus.FAILED, order.id],
          );

          await this.db.query(
            `UPDATE provider_orders SET provider_status = $1, last_synced_at = CURRENT_TIMESTAMP WHERE order_id = $2`,
            [ProviderStatus.FAILED, order.id],
          );

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

      // 5. Record Successful Submission Attempt
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
      );

      // 6. Explicit Provider Acceptance -> Transition Order
      const initialProviderStatus = submitResult.providerStatus || ProviderStatus.RECEIVED;
      const isCompleted = initialProviderStatus === ProviderStatus.COMPLETED;
      const isFailed = initialProviderStatus === ProviderStatus.FAILED || initialProviderStatus === ProviderStatus.REJECTED;
      const finalOrderStatus = isCompleted
        ? OrderStatus.COMPLETED
        : isFailed
        ? OrderStatus.FAILED
        : OrderStatus.SUBMITTED;

      await this.db.query(
        `UPDATE provider_orders
         SET provider_name = $1,
             provider_reference = $2,
             provider_status = $3,
             submission_attempts = submission_attempts + 1,
             last_synced_at = CURRENT_TIMESTAMP,
             sync_version = sync_version + 1
         WHERE order_id = $4`,
        [activeProvider.providerName, submitResult.providerReference, initialProviderStatus, order.id],
      );

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
      );

      logger.info(
        { orderId: order.id, providerReference: submitResult.providerReference, providerName: activeProvider.providerName, status: finalOrderStatus },
        `Order explicitly accepted by ${activeProvider.providerName} and transitioned to ${finalOrderStatus}`,
      );

      return {
        orderId,
        success: true,
        providerStatus: initialProviderStatus,
        orderStatus: finalOrderStatus,
        reconciledBeforeRetry,
      };
    } finally {
      await this.queueService.releaseOrderLock(orderId);
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
    );

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
    );

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
