import type pg from 'pg';
import type { Redis } from 'ioredis';
import { ITelecomProvider } from './telecom/telecom-provider.interface.js';
import { GmplWebhookPayload } from './gmpl/gmpl.types.js';
import { GmplMapper } from './gmpl/gmpl.mapper.js';
import { ProviderStatus, OrderStatus, OrderEventType } from '@bytebeacon/shared';
import { RefundService } from '../payments/refund.service.js';
import { UnauthorizedError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';

export class GmplWebhookService {
  private readonly db: pg.Pool;
  private readonly redis: Redis | null;
  private readonly provider: ITelecomProvider;
  private readonly refundService?: RefundService;

  constructor(
    db: pg.Pool,
    redis: Redis | null,
    provider: ITelecomProvider,
    refundService?: RefundService,
  ) {
    this.db = db;
    this.redis = redis;
    this.provider = provider;
    this.refundService = refundService;
  }

  /**
   * Processes an incoming GMPL webhook with HMAC signature verification,
   * durable deduplication, and out-of-order stale event protection.
   */
  public async handleWebhook(
    rawBody: string | Buffer,
    signature: string,
    correlationId: string,
  ): Promise<{ status: 'PROCESSED' | 'DUPLICATE' | 'STALE' | 'IGNORED'; message: string }> {
    // 1. Signature Verification
    const isValid = this.provider.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.warn({ correlationId }, 'Forged or invalid GMPL webhook signature rejected');
      throw new UnauthorizedError('Invalid GMPL webhook signature');
    }

    const payloadText = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody;
    let payload: GmplWebhookPayload;
    try {
      payload = JSON.parse(payloadText) as GmplWebhookPayload;
    } catch {
      logger.error({ correlationId }, 'Malformed GMPL webhook JSON');
      return { status: 'IGNORED', message: 'Malformed JSON payload' };
    }

    const providerEventId = payload.event_id || `${payload.event}_${payload.data?.reference}_${payload.timestamp}`;
    const eventTimestamp = new Date(payload.timestamp || Date.now());
    const eventVersion = payload.event_version || 1;
    let orderToRefundOnFailure: { orderId: string; status: string } | null = null;

    // 2. Redis Acceleration Deduplication
    if (this.redis) {
      const redisKey = `webhook:gmpl:dedup:${providerEventId}`;
      const isSet = await this.redis.set(redisKey, '1', 'EX', 86400, 'NX');
      if (!isSet) {
        logger.info({ providerEventId }, 'Duplicate GMPL webhook dropped by Redis accelerator');
        return { status: 'DUPLICATE', message: 'Event already processed' };
      }
    }

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // 3. PostgreSQL Durable Uniqueness Check
      const existingEvt = await client.query(
        `SELECT id FROM provider_events WHERE provider = 'GMPL' AND provider_event_id = $1`,
        [providerEventId],
      );

      if (existingEvt.rows.length > 0) {
        await client.query('COMMIT');
        return { status: 'DUPLICATE', message: 'Event already recorded' };
      }

      // 4. Find Local Provider Order Projection
      const reference = payload.data?.reference;
      const gmplOrderId = payload.data?.order_id;

      const projRes = await client.query(
        `SELECT po.id, po.order_id as "orderId", po.provider_status as "currentStatus",
                po.last_event_at as "lastEventAt", po.last_event_version as "lastEventVersion",
                o.order_status as "orderStatus"
         FROM provider_orders po
         JOIN orders o ON po.order_id = o.id
         WHERE po.provider_reference = $1 OR po.provider_order_id = $2
         FOR UPDATE`,
        [reference, gmplOrderId],
      );

      if (projRes.rows.length === 0) {
        logger.warn({ reference, gmplOrderId }, 'GMPL webhook received for unknown internal order');
        // Record event as unapplied
        await client.query(
          `INSERT INTO provider_events (
              provider, provider_event_id, provider_order_id, event_type,
              event_timestamp, event_version, correlation_id, provider_status,
              payload, is_applied, rejection_reason
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, 'Unknown order')`,
          [
            'GMPL',
            providerEventId,
            gmplOrderId,
            payload.event,
            eventTimestamp,
            eventVersion,
            correlationId,
            payload.data.status,
            JSON.stringify(payload),
          ],
        );

        await client.query('COMMIT');
        return { status: 'IGNORED', message: 'Order reference not found' };
      }

      const projection = projRes.rows[0];
      const incomingStatus = GmplMapper.mapProviderStatus(payload.data.status);

      // 5. Out-of-Order Stale Event Protection
      const lastEventTime = projection.lastEventAt ? new Date(projection.lastEventAt).getTime() : 0;
      const lastEventVer = projection.lastEventVersion || 0;
      const isStaleTimestamp = eventTimestamp.getTime() < lastEventTime;
      const isStaleVersion = eventVersion < lastEventVer;
      const isRegressionFromTerminal =
        (projection.currentStatus === ProviderStatus.COMPLETED ||
          projection.currentStatus === ProviderStatus.FAILED) &&
        incomingStatus === ProviderStatus.PROCESSING;

      if (isStaleTimestamp || isStaleVersion || isRegressionFromTerminal) {
        const reason = isRegressionFromTerminal
          ? `Status regression blocked: ${projection.currentStatus} -> ${incomingStatus}`
          : `Stale timestamp/version: incoming (${eventTimestamp.toISOString()}, v${eventVersion}) < current (${new Date(lastEventTime).toISOString()}, v${lastEventVer})`;

        logger.warn({ orderId: projection.orderId, providerEventId, reason }, 'Stale out-of-order event ignored');

        await client.query(
          `INSERT INTO provider_events (
              provider, provider_event_id, provider_order_id, order_id, event_type,
              event_timestamp, event_version, correlation_id, provider_status,
              payload, is_applied, rejection_reason
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10)`,
          [
            'GMPL',
            providerEventId,
            gmplOrderId,
            projection.orderId,
            payload.event,
            eventTimestamp,
            eventVersion,
            correlationId,
            payload.data.status,
            JSON.stringify(payload),
            reason,
          ],
        );

        await client.query('COMMIT');
        return { status: 'STALE', message: reason };
      }

      // 6. Record Valid Event & Advance Local Projection
      await client.query(
        `INSERT INTO provider_events (
            provider, provider_event_id, provider_order_id, order_id, event_type,
            event_timestamp, event_version, correlation_id, provider_status,
            payload, is_applied
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
        [
          'GMPL',
          providerEventId,
          gmplOrderId,
          projection.orderId,
          payload.event,
          eventTimestamp,
          eventVersion,
          correlationId,
          payload.data.status,
          JSON.stringify(payload),
        ],
      );

      const isCompleted = incomingStatus === ProviderStatus.COMPLETED;
      const isFailed = incomingStatus === ProviderStatus.FAILED || incomingStatus === ProviderStatus.REJECTED;

      const newOrderStatus = isCompleted
        ? OrderStatus.COMPLETED
        : isFailed
        ? OrderStatus.FAILED
        : OrderStatus.PROCESSING;

      await client.query(
        `UPDATE provider_orders
         SET provider_order_id = COALESCE(provider_order_id, $1),
             provider_status = $2,
             last_event_at = $3,
             last_event_version = $4,
             last_synced_at = CURRENT_TIMESTAMP,
             sync_version = sync_version + 1
         WHERE id = $5`,
        [gmplOrderId, incomingStatus, eventTimestamp, eventVersion, projection.id],
      );

      await client.query(
        `UPDATE orders
         SET order_status = $1,
             provider_status = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [newOrderStatus, incomingStatus, projection.orderId],
      );

      if (isFailed) {
        orderToRefundOnFailure = { orderId: projection.orderId, status: incomingStatus };
      }

      if (isFailed && !this.refundService) {
        const orderInfo = await client.query(
          `SELECT user_id, agent_id, amount_pesewas, payment_status, refund_status FROM orders WHERE id = $1`,
          [projection.orderId],
        );
        if (orderInfo.rows.length > 0) {
          const ord = orderInfo.rows[0];
          const isPaid = ['PAID', 'SUCCESS', 'COMPLETED'].includes(String(ord.payment_status || '').toUpperCase());
          if (isPaid && ord.refund_status !== 'COMPLETED' && Number(ord.amount_pesewas) > 0) {
            const refundAmt = Number(ord.amount_pesewas);
            let targetUserId = ord.user_id;
            let targetAccountType = 'CUSTOMER_WALLET';
            if (!targetUserId && ord.agent_id) {
              const agRes = await client.query('SELECT user_id FROM agents WHERE id = $1 LIMIT 1', [ord.agent_id]).catch(() => ({ rows: [] }));
              targetUserId = agRes.rows[0]?.user_id;
              targetAccountType = 'AGENT_WALLET';
            }
            if (targetUserId) {
              await client.query(
                `UPDATE users
                 SET wallet_balance_pesewas = wallet_balance_pesewas + $1,
                     wallet_balance = ROUND((wallet_balance_pesewas + $1) / 100.0, 2),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [refundAmt, targetUserId],
              );
              await client.query(
                `UPDATE orders
                 SET refund_status = 'COMPLETED',
                     payment_status = 'REFUNDED',
                     order_status = 'FAILED',
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [projection.orderId],
              );
              await client.query(
                `INSERT INTO refunds (order_id, amount_pesewas, reason, status)
                 VALUES ($1, $2, $3, 'COMPLETED')`,
                [projection.orderId, refundAmt, `Automated refund on GMPL webhook failure [${projection.orderId}]`],
              ).catch(() => {});
              await client.query(
                `INSERT INTO financial_ledger (
                    transaction_id, entry_type, account_type, account_id,
                    amount_pesewas, currency, reference_type, reference_id,
                    description
                 ) VALUES 
                   (uuid_generate_v4(), 'DEBIT', 'PLATFORM_ESCROW', '00000000-0000-0000-0000-000000000000', $1, 'GHS', 'ORDER_REFUND', $2, $3),
                   (uuid_generate_v4(), 'CREDIT', $4, $5, $1, 'GHS', 'ORDER_REFUND', $2, $3)`,
                [refundAmt, projection.orderId, `Automated refund on GMPL webhook failure [${projection.orderId}]`, targetAccountType, targetUserId],
              ).catch(() => {});
            }
          }
        }
      }

      await client.query(
        `INSERT INTO order_events (
            order_id, event_type, correlation_id, actor_id, actor_type, source,
            previous_state, new_state
         ) VALUES ($1, $2, $3, NULL, 'PROVIDER_WEBHOOK', 'GMPL', $4, $5)`,
        [
          projection.orderId,
          isCompleted ? OrderEventType.ORDER_COMPLETED : OrderEventType.PROVIDER_STATUS_UPDATED,
          correlationId,
          JSON.stringify({ orderStatus: projection.orderStatus, providerStatus: projection.currentStatus }),
          JSON.stringify({ orderStatus: newOrderStatus, providerStatus: incomingStatus }),
        ],
      );

      await client.query('COMMIT');
      logger.info(
        { orderId: projection.orderId, newOrderStatus, providerStatus: incomingStatus },
        'GMPL webhook processed and local projection updated',
      );

    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        return { status: 'DUPLICATE', message: 'Event already recorded' };
      }
      logger.error({ err, correlationId }, 'Error handling GMPL webhook');
      throw err;
    } finally {
      client.release();
    }

    if (orderToRefundOnFailure && this.refundService) {
      await this.refundService.executeAutomatedOrderRefund(
        orderToRefundOnFailure.orderId,
        `Automated refund on GMPL webhook failure [${orderToRefundOnFailure.status}]`,
        correlationId,
      ).catch((e: any) => {
        logger.warn({ orderId: orderToRefundOnFailure?.orderId, err: e?.message }, '[GMPL_WEBHOOK] Failed executing automated refund');
      });
    }

    return { status: 'PROCESSED', message: 'Fulfillment status updated' };
  }
}
