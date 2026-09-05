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
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [event.providerStatus, event.orderId],
        );

        // Auto refund wallet balance
        const orderInfo = await client.query(
          `SELECT user_id, amount_pesewas, payment_status, refund_status FROM orders WHERE id = $1`,
          [event.orderId],
        );
        if (orderInfo.rows.length > 0) {
          const ord = orderInfo.rows[0];
          if (ord.payment_status === 'PAID' && ord.user_id && ord.amount_pesewas && Number(ord.amount_pesewas) > 0) {
            const refundAmt = Number(ord.amount_pesewas);
            await client.query(
              `UPDATE users
               SET wallet_balance_pesewas = wallet_balance_pesewas + $1,
                   wallet_balance = ROUND((wallet_balance_pesewas + $1) / 100.0, 2),
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $2`,
              [refundAmt, ord.user_id],
            );
            await client.query(
              `INSERT INTO financial_ledger (
                  transaction_id, entry_type, account_type, account_id,
                  amount_pesewas, currency, reference_type, reference_id,
                  description
               ) VALUES (
                  uuid_generate_v4(), 'CREDIT', 'CUSTOMER_WALLET', $1,
                  $2, 'GHS', 'ORDER_REFUND', $3,
                  $4
               )`,
              [ord.user_id, refundAmt, event.orderId, `Automated refund on provider sync failure [${event.orderId}]`],
            ).catch(() => {});
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
