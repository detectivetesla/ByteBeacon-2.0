import type pg from 'pg';
import { ITelecomProvider } from './telecom/telecom-provider.interface.js';
import { ProviderStatus, OrderStatus, OrderEventType } from '@bytebeacon/shared';
import { logger } from '../logging/logger.js';

export interface ProviderReconciliationSummary {
  reconciliationId: string;
  reconciliationDate: string;
  totalChecked: number;
  matchedCount: number;
  discrepancyCount: number;
  discrepancies: Array<{
    orderId: string;
    providerReference: string;
    localStatus: ProviderStatus;
    actualProviderStatus: ProviderStatus;
    actionTaken: string;
  }>;
}

export class ProviderReconciliationService {
  private readonly db: pg.Pool;
  private readonly provider: ITelecomProvider;

  constructor(db: pg.Pool, provider: ITelecomProvider) {
    this.db = db;
    this.provider = provider;
  }

  /**
   * Reconciles stale processing orders by querying the authoritative GMPL status.
   */
  public async reconcileStaleOrders(
    reconciliationDate: string,
    staleMinutesThreshold = 15,
  ): Promise<ProviderReconciliationSummary> {
    const staleThresholdTime = new Date(Date.now() - staleMinutesThreshold * 60 * 1000);

    const ordersRes = await this.db.query(
      `SELECT po.id, po.order_id as "orderId", po.provider_name as "providerName",
              po.provider_reference as "providerReference", po.provider_status as "providerStatus",
              o.order_status as "orderStatus"
       FROM provider_orders po
       JOIN orders o ON po.order_id = o.id
       WHERE po.provider_status IN ('RECEIVED', 'PROCESSING')
         AND (po.last_synced_at IS NULL OR po.last_synced_at < $1)
       LIMIT 100`,
      [staleThresholdTime],
    );

    const discrepancies: ProviderReconciliationSummary['discrepancies'] = [];
    let matchedCount = 0;

    for (const row of ordersRes.rows) {
      if (!row.providerReference) continue;

      try {
        const actualStatus = await this.provider.getOrderStatus({
          providerReference: row.providerReference,
          orderId: row.orderId,
        });

        if (actualStatus.providerStatus === row.providerStatus) {
          matchedCount++;
        } else {
          // Discrepancy found! Authoritative GMPL status has changed
          const isCompleted = actualStatus.providerStatus === ProviderStatus.COMPLETED;
          const isFailed = actualStatus.providerStatus === ProviderStatus.FAILED || actualStatus.providerStatus === ProviderStatus.REJECTED;

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
             WHERE id = $2`,
            [actualStatus.providerStatus, row.id],
          );

          await this.db.query(
            `UPDATE orders
             SET order_status = $1,
                 provider_status = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [newOrderStatus, actualStatus.providerStatus, row.orderId],
          );

          await this.db.query(
            `INSERT INTO order_events (
                order_id, event_type, correlation_id, actor_id, actor_type, source,
                previous_state, new_state
             ) VALUES ($1, $2, 'reconciliation_cron', NULL, 'SYSTEM', 'RECONCILIATION_WORKER', $3, $4)`,
            [
              row.orderId,
              isCompleted ? OrderEventType.ORDER_COMPLETED : OrderEventType.PROVIDER_STATUS_UPDATED,
              JSON.stringify({ orderStatus: row.orderStatus, providerStatus: row.providerStatus }),
              JSON.stringify({ orderStatus: newOrderStatus, providerStatus: actualStatus.providerStatus }),
            ],
          );

          discrepancies.push({
            orderId: row.orderId,
            providerReference: row.providerReference,
            localStatus: row.providerStatus,
            actualProviderStatus: actualStatus.providerStatus,
            actionTaken: `Updated local status from ${row.providerStatus} to ${actualStatus.providerStatus}`,
          });
        }
      } catch (err) {
        logger.error({ err, orderId: row.orderId }, 'Error polling provider during reconciliation');
      }
    }

    const insertRes = await this.db.query(
      `INSERT INTO provider_reconciliation_records (
          reconciliation_date, provider, total_orders_checked,
          matched_count, discrepancy_count, discrepancies
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        reconciliationDate,
        this.provider.providerName,
        ordersRes.rows.length,
        matchedCount,
        discrepancies.length,
        JSON.stringify(discrepancies),
      ],
    );

    logger.info(
      {
        reconciliationId: insertRes.rows[0].id,
        totalChecked: ordersRes.rows.length,
        discrepancies: discrepancies.length,
      },
      'Completed provider fulfillment reconciliation run',
    );

    return {
      reconciliationId: insertRes.rows[0].id,
      reconciliationDate,
      totalChecked: ordersRes.rows.length,
      matchedCount,
      discrepancyCount: discrepancies.length,
      discrepancies,
    };
  }

  /**
   * Reconciles pending/stale orders and returns high-level metric counts.
   */
  public async reconcilePendingOrders(params?: {
    batchSize?: number;
    olderThanMinutes?: number;
  }): Promise<{
    totalReconciled: number;
    completedCount: number;
    failedCount: number;
    unmatchedCount: number;
  }> {
    const summary = await this.reconcileStaleOrders(
      new Date().toISOString().split('T')[0],
      params?.olderThanMinutes || 15,
    );

    const completed = summary.discrepancies.filter((d) => d.actualProviderStatus === ProviderStatus.COMPLETED).length;
    const failed = summary.discrepancies.filter((d) => d.actualProviderStatus === ProviderStatus.FAILED).length;
    const unmatched = summary.discrepancies.length - (completed + failed);

    return {
      totalReconciled: summary.totalChecked,
      completedCount: completed,
      failedCount: failed,
      unmatchedCount: unmatched,
    };
  }
}

