import type pg from 'pg';
import type { Redis } from 'ioredis';
import { ITelecomProvider } from './telecom/telecom-provider.interface.js';
import { DataHouseWebhookPayload } from './datahouse/datahouse.types.js';
import { DataHouseMapper } from './datahouse/datahouse.mapper.js';
import { ProviderStatus, OrderStatus, OrderEventType, RefundStatus } from '@bytebeacon/shared';
import { UnauthorizedError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';

export class DataHouseWebhookService {
  private readonly db: pg.Pool;
  private readonly redis: Redis | null;
  private readonly provider: ITelecomProvider;

  constructor(db: pg.Pool, redis: Redis | null, provider: ITelecomProvider) {
    this.db = db;
    this.redis = redis;
    this.provider = provider;
  }

  /**
   * Processes an incoming DataHouse webhook with HMAC signature verification,
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
      logger.warn({ correlationId }, 'Forged or invalid DataHouse webhook signature rejected');
      throw new UnauthorizedError('Invalid DataHouse webhook signature');
    }

    const payloadText = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody;
    let payload: DataHouseWebhookPayload;
    try {
      payload = JSON.parse(payloadText) as DataHouseWebhookPayload;
    } catch {
      logger.error({ correlationId }, 'Malformed DataHouse webhook JSON');
      return { status: 'IGNORED', message: 'Malformed JSON payload' };
    }

    const eventId =
      payload.eventId ||
      payload.event_id ||
      payload.id ||
      `dh_evt_${payload.type || 'status'}_${payload.data?.id || payload.data?.orderId || payload.data?.referenceCode || Date.now()}`;

    const eventTimestamp = new Date(payload.timestamp ? (typeof payload.timestamp === 'number' ? payload.timestamp * 1000 : payload.timestamp) : Date.now());
    const eventType = payload.type || 'ORDER_STATUS_UPDATE';

    // 2. Redis Deduplication Accelerator
    if (this.redis) {
      const redisKey = `webhook:datahouse:dedup:${eventId}`;
      const isSet = await this.redis.set(redisKey, '1', 'EX', 86400, 'NX');
      if (!isSet) {
        logger.info({ eventId }, 'Duplicate DataHouse webhook dropped by Redis accelerator');
        return { status: 'DUPLICATE', message: 'Event already processed' };
      }
    }

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // 3. PostgreSQL Durable Uniqueness Check
      const existingEvt = await client.query(
        `SELECT id FROM provider_events WHERE provider = 'DATAHOUSE' AND provider_event_id = $1`,
        [eventId],
      );

      if (existingEvt.rows.length > 0) {
        await client.query('COMMIT');
        return { status: 'DUPLICATE', message: 'Event already recorded' };
      }

      // 4. Locate Local Provider Order Projection
      const reference = payload.data?.referenceCode || payload.data?.reference;
      const datahouseOrderId = payload.data?.id || payload.data?.orderId || payload.data?.order_id;

      const projRes = await client.query(
        `SELECT po.id, po.order_id as "orderId", po.provider_status as "currentStatus",
                po.last_synced_at as "lastSyncedAt", po.sync_version as "syncVersion",
                o.order_status as "orderStatus", o.payment_status as "paymentStatus",
                o.amount_pesewas as "amountPesewas"
         FROM provider_orders po
         JOIN orders o ON po.order_id = o.id
         WHERE po.provider_reference = $1 OR po.provider_order_id = $2 OR o.public_id = $1 OR o.public_id = $2
         FOR UPDATE`,
        [reference, datahouseOrderId],
      );

      if (projRes.rows.length === 0) {
        logger.warn({ reference, datahouseOrderId }, 'DataHouse webhook received for unmatched internal order');

        await client.query(
          `INSERT INTO provider_events (
              provider, provider_event_id, provider_order_id, event_type,
              event_timestamp, event_version, correlation_id, provider_status,
              payload, is_applied, rejection_reason
           ) VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, false, 'Unmatched internal order')`,
          [
            'DATAHOUSE',
            eventId,
            datahouseOrderId || null,
            eventType,
            eventTimestamp,
            correlationId,
            payload.data?.status || 'UNKNOWN',
            JSON.stringify(payload),
          ],
        );

        await client.query('COMMIT');
        return { status: 'IGNORED', message: 'Order reference not matched' };
      }

      const projection = projRes.rows[0];
      const incomingStatus = DataHouseMapper.mapStatus(payload.data?.status);

      // 5. Stale / Out-of-Order Event Protection
      const lastSyncTime = projection.lastSyncedAt ? new Date(projection.lastSyncedAt).getTime() : 0;
      const isStaleTimestamp = eventTimestamp.getTime() < lastSyncTime - 5000; // Allow 5s clock buffer
      const isRegressionFromTerminal =
        (projection.currentStatus === ProviderStatus.COMPLETED ||
          projection.currentStatus === ProviderStatus.FAILED) &&
        incomingStatus === ProviderStatus.PROCESSING;

      if (isStaleTimestamp || isRegressionFromTerminal) {
        const reason = isRegressionFromTerminal
          ? `Status regression blocked: ${projection.currentStatus} -> ${incomingStatus}`
          : `Stale event timestamp: incoming (${eventTimestamp.toISOString()}) < current (${new Date(lastSyncTime).toISOString()})`;

        logger.warn({ orderId: projection.orderId, eventId, reason }, 'Stale out-of-order DataHouse event ignored');

        await client.query(
          `INSERT INTO provider_events (
              provider, provider_event_id, provider_order_id, order_id, event_type,
              event_timestamp, event_version, correlation_id, provider_status,
              payload, is_applied, rejection_reason
           ) VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, false, $9)`,
          [
            'DATAHOUSE',
            eventId,
            datahouseOrderId || null,
            projection.orderId,
            eventType,
            eventTimestamp,
            correlationId,
            payload.data?.status || 'UNKNOWN',
            JSON.stringify(payload),
            reason,
          ],
        );

        await client.query('COMMIT');
        return { status: 'STALE', message: reason };
      }

      // 6. Apply Status Transitions to Orders & Provider Orders
      let nextOrderStatus = projection.orderStatus;
      let refundStatus = 'NONE';

      if (incomingStatus === ProviderStatus.COMPLETED) {
        nextOrderStatus = OrderStatus.COMPLETED;
      } else if (incomingStatus === ProviderStatus.FAILED || incomingStatus === ProviderStatus.REJECTED) {
        nextOrderStatus = OrderStatus.FAILED;
        if (projection.paymentStatus === 'PAID') {
          refundStatus = RefundStatus.PENDING;
        }
      } else if (incomingStatus === ProviderStatus.PROCESSING) {
        nextOrderStatus = OrderStatus.PROCESSING;
      }

      // Update provider_orders
      await client.query(
        `UPDATE provider_orders
         SET provider_status = $1,
             raw_payload = $2,
             last_synced_at = $3,
             last_provider_event_at = $3,
             sync_version = sync_version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [incomingStatus, JSON.stringify(payload), eventTimestamp, projection.id],
      );

      // Update orders
      await client.query(
        `UPDATE orders
         SET provider_status = $1,
             order_status = $2,
             refund_status = CASE WHEN $3 != 'NONE' THEN $3 ELSE refund_status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [incomingStatus, nextOrderStatus, refundStatus, projection.orderId],
      );

      // Record applied provider event
      await client.query(
        `INSERT INTO provider_events (
            provider, provider_event_id, provider_order_id, order_id, event_type,
            event_timestamp, event_version, correlation_id, provider_status,
            payload, is_applied
         ) VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, true)`,
        [
          'DATAHOUSE',
          eventId,
          datahouseOrderId || null,
          projection.orderId,
          eventType,
          eventTimestamp,
          correlationId,
          payload.data?.status || 'UNKNOWN',
          JSON.stringify(payload),
        ],
      );

      // Record immutable order audit event
      await client.query(
        `INSERT INTO order_events (
            order_id, event_type, correlation_id, actor_type, source,
            previous_state, new_state, metadata
         ) VALUES ($1, $2, $3, 'PROVIDER', 'DATAHOUSE_WEBHOOK', $4, $5, $6)`,
        [
          projection.orderId,
          OrderEventType.PROVIDER_STATUS_UPDATED,
          correlationId,
          JSON.stringify({
            orderStatus: projection.orderStatus,
            providerStatus: projection.currentStatus,
          }),
          JSON.stringify({
            orderStatus: nextOrderStatus,
            providerStatus: incomingStatus,
          }),
          JSON.stringify({ eventId, eventType, incomingPayload: payload.data }),
        ],
      );

      await client.query('COMMIT');
      logger.info(
        { orderId: projection.orderId, providerStatus: incomingStatus, orderStatus: nextOrderStatus },
        'DataHouse webhook applied successfully',
      );

      return { status: 'PROCESSED', message: 'Order projection updated' };
    } catch (err: any) {
      await client.query('ROLLBACK');
      logger.error({ err, correlationId }, 'DataHouse webhook processing error');
      throw err;
    } finally {
      client.release();
    }
  }
}
