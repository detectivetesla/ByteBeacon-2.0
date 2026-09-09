import crypto from 'node:crypto';
import type pg from 'pg';
import { ProviderStatus } from '@bytebeacon/shared';

export interface ProviderSyncEvent {
  orderId: string;
  providerName: string;
  providerReference?: string;
  providerStatus: ProviderStatus;
  eventTimestamp: Date;
  eventVersion: number;
  rawPayload?: Record<string, unknown>;
}

export interface ProviderSyncResult {
  applied: boolean;
  orderId: string;
  previousStatus?: ProviderStatus;
  newStatus: ProviderStatus;
  reason?: string;
}

export class ProviderSyncService {
  private readonly db: pg.Pool;

  constructor(db: pg.Pool) {
    this.db = db;
  }

  public async syncProviderEvent(event: ProviderSyncEvent): Promise<ProviderSyncResult> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // 1. Lock provider_orders record
      const selectQuery = `
        SELECT id, provider_status as "providerStatus", sync_version as "syncVersion",
               last_provider_event_at as "lastProviderEventAt"
        FROM provider_orders
        WHERE order_id = $1
        FOR UPDATE
      `;
      const selectRes = await client.query<{
        id: string;
        providerStatus: ProviderStatus;
        syncVersion: number;
        lastProviderEventAt: Date | null;
      }>(selectQuery, [event.orderId]);

      if (selectRes.rows.length === 0) {
        // Create initial provider_orders record if not yet created
        await client.query(
          `INSERT INTO provider_orders (order_id, provider_name, provider_reference, provider_status, raw_payload, last_synced_at, last_provider_event_at, sync_version)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7)`,
          [
            event.orderId,
            event.providerName,
            event.providerReference || null,
            event.providerStatus,
            JSON.stringify(event.rawPayload || {}),
            event.eventTimestamp,
            event.eventVersion,
          ],
        );

        // Record sync event
        await client.query(
          `INSERT INTO provider_sync_records (order_id, provider_name, event_timestamp, event_version, status_received, is_applied, reason)
           VALUES ($1, $2, $3, $4, $5, TRUE, 'Initial provider event registered')`,
          [
            event.orderId,
            event.providerName,
            event.eventTimestamp,
            event.eventVersion,
            event.providerStatus,
          ],
        );

        await client.query('COMMIT');
        return {
          applied: true,
          orderId: event.orderId,
          newStatus: event.providerStatus,
        };
      }

      const current = selectRes.rows[0];

      // Stale event detection: Ignore if incoming event is older than recorded event
      if (
        event.eventVersion < current.syncVersion ||
        (current.lastProviderEventAt && event.eventTimestamp < new Date(current.lastProviderEventAt))
      ) {
        await client.query(
          `INSERT INTO provider_sync_records (order_id, provider_name, event_timestamp, event_version, status_received, is_applied, reason)
           VALUES ($1, $2, $3, $4, $5, FALSE, 'Stale provider event ignored (older timestamp or version)')`,
          [
            event.orderId,
            event.providerName,
            event.eventTimestamp,
            event.eventVersion,
            event.providerStatus,
          ],
        );

        await client.query('COMMIT');
        return {
          applied: false,
          orderId: event.orderId,
          previousStatus: current.providerStatus,
          newStatus: current.providerStatus,
          reason: 'Stale provider event ignored',
        };
      }

      // Update provider_orders projection
      await client.query(
        `UPDATE provider_orders
         SET provider_status = $1,
             raw_payload = $2,
             last_synced_at = CURRENT_TIMESTAMP,
             last_provider_event_at = $3,
             sync_version = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $5`,
        [
          event.providerStatus,
          JSON.stringify(event.rawPayload || {}),
          event.eventTimestamp,
          event.eventVersion,
          event.orderId,
        ],
      );

      // Update main order provider_status projection
      const isFailed = event.providerStatus === 'FAILED' || event.providerStatus === 'REJECTED';
      const isCompleted = event.providerStatus === 'COMPLETED';

      if (isFailed) {
        await client.query(
          `UPDATE orders
           SET provider_status = $1,
               order_status = 'FAILED',
               refund_status = CASE WHEN payment_status = 'PAID' THEN 'COMPLETED' ELSE refund_status END,
               payment_status = CASE WHEN payment_status = 'PAID' THEN 'REFUNDED' ELSE payment_status END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [event.providerStatus, event.orderId],
        );

        // Auto refund wallet balance with balanced double-entry ledger lines
        const orderInfo = await client.query(
          `SELECT id, public_id, user_id, amount_pesewas, currency, payment_status, refund_status FROM orders WHERE id = $1 FOR UPDATE`,
          [event.orderId],
        );
        if (orderInfo.rows.length > 0) {
          const ord = orderInfo.rows[0];
          if (ord.payment_status === 'PAID' || ord.refund_status === 'COMPLETED') {
            const refundAmt = Number(ord.amount_pesewas || 0);
            if (ord.user_id && refundAmt > 0) {
              await client.query(
                `UPDATE users
                 SET wallet_balance_pesewas = COALESCE(wallet_balance_pesewas, 0) + $1,
                     wallet_balance = ROUND((COALESCE(wallet_balance_pesewas, 0) + $1) / 100.0, 2),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [refundAmt, ord.user_id],
              );

              // Find or create payment
              const payRes = await client.query(
                `SELECT id FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [event.orderId],
              );
              let paymentId = payRes.rows[0]?.id;
              if (!paymentId) {
                const newPay = await client.query(
                  `INSERT INTO payments (order_id, user_id, amount_pesewas, currency, provider, provider_reference, payment_method, status, paid_at)
                   VALUES ($1, $2, $3, $4, 'WALLET', $5, 'WALLET', 'REFUNDED', CURRENT_TIMESTAMP) RETURNING id`,
                  [event.orderId, ord.user_id, refundAmt, ord.currency || 'GHS', `pst_wal_${ord.public_id || event.orderId}`],
                );
                paymentId = newPay.rows[0].id;
              } else {
                await client.query(
                  `UPDATE payments SET status = 'REFUNDED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                  [paymentId],
                );
              }

              // Create record in refunds table
              const refundRes = await client.query(
                `INSERT INTO refunds (payment_id, order_id, amount_pesewas, reason, status)
                 VALUES ($1, $2, $3, $4, 'COMPLETED') RETURNING id`,
                [paymentId, event.orderId, refundAmt, `Automated refund on provider sync failure [${event.orderId}]`],
              );
              const refundId = refundRes.rows[0]?.id;

              // Balanced double-entry financial ledger (Total Debits == Total Credits)
              const transactionId = crypto.randomUUID();
              const platformSystemAccountId = '00000000-0000-0000-0000-000000000000';
              await client.query(
                `INSERT INTO financial_ledger (
                    transaction_id, entry_type, account_type, account_id,
                    amount_pesewas, currency, reference_type, reference_id,
                    description
                 ) VALUES 
                 ($1, 'DEBIT', 'PLATFORM_ESCROW', $2, $3, $4, 'REFUND', $5, $6),
                 ($1, 'CREDIT', 'CUSTOMER_WALLET', $7, $3, $4, 'REFUND', $5, $8)`,
                [
                  transactionId,
                  platformSystemAccountId,
                  refundAmt,
                  ord.currency || 'GHS',
                  refundId || event.orderId,
                  `Platform escrow debited for automated refund on Order ${event.orderId}`,
                  ord.user_id,
                  `Customer wallet credited for automated refund on Order ${event.orderId}`,
                ],
              ).catch(() => {});
            }
          }
        }
      } else {
        await client.query(
          `UPDATE orders
           SET provider_status = $1,
               order_status = CASE WHEN $3 = TRUE THEN 'COMPLETED' ELSE order_status END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [event.providerStatus, event.orderId, isCompleted],
        );
      }

      // Record successful sync
      await client.query(
        `INSERT INTO provider_sync_records (order_id, provider_name, event_timestamp, event_version, status_received, is_applied)
         VALUES ($1, $2, $3, $4, $5, TRUE)`,
        [
          event.orderId,
          event.providerName,
          event.eventTimestamp,
          event.eventVersion,
          event.providerStatus,
        ],
      );

      await client.query('COMMIT');

      return {
        applied: true,
        orderId: event.orderId,
        previousStatus: current.providerStatus,
        newStatus: event.providerStatus,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
