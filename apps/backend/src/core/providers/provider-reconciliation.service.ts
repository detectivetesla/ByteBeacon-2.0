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
   * Resolves the provider instance for a specific historical order.
   */
  private resolveProviderForRecord(providerName?: string): ITelecomProvider {
    const registry = this.provider as any;
    if (providerName && typeof registry.getProvider === 'function') {
      const historical = registry.getProvider(providerName);
      if (historical) return historical;
    }
    return this.provider;
  }

  /**
   * Reconciles stale processing orders by querying authoritative provider status.
   * Resolves historical provider for each order to guarantee historical fidelity.
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

      const orderProvider = this.resolveProviderForRecord(row.providerName);

      try {
        const actualStatus = await orderProvider.getOrderStatus({
          providerReference: row.providerReference,
          orderId: row.orderId,
        });

        if (actualStatus.providerStatus === row.providerStatus) {
          matchedCount++;
        } else {
          // Discrepancy found! Authoritative provider status has changed
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
                 refund_status = CASE WHEN $4 = TRUE AND payment_status = 'PAID' THEN 'COMPLETED' ELSE refund_status END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [newOrderStatus, actualStatus.providerStatus, row.orderId, isFailed],
          );

          if (isFailed) {
            const orderInfo = await this.db.query(
              `SELECT user_id, amount_pesewas, payment_status, refund_status FROM orders WHERE id = $1`,
              [row.orderId],
            );
            if (orderInfo.rows.length > 0) {
              const ord = orderInfo.rows[0];
              if (ord.payment_status === 'PAID' && ord.user_id && ord.amount_pesewas && Number(ord.amount_pesewas) > 0) {
                const refundAmt = Number(ord.amount_pesewas);
                await this.db.query(
                  `UPDATE users
                   SET wallet_balance_pesewas = wallet_balance_pesewas + $1,
                       wallet_balance = ROUND((wallet_balance_pesewas + $1) / 100.0, 2),
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = $2`,
                  [refundAmt, ord.user_id],
                );
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
                  [ord.user_id, refundAmt, row.orderId, `Automated refund on reconciliation failure [${row.orderId}]`],
                ).catch(() => {});
              }
            }
          }

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
            actionTaken: `Updated local status from ${row.providerStatus} to ${actualStatus.providerStatus} via ${orderProvider.providerName}`,
          });
        }
      } catch (err) {
        logger.error({ err, orderId: row.orderId, providerName: orderProvider.providerName }, 'Error polling provider during reconciliation');
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

  /**
   * Directly queries the authoritative upstream provider for a specific order and reconciles its state.
   */
  public async reconcileSingleOrder(orderId: string): Promise<{
    orderId: string;
    providerName: string;
    providerReference: string;
    previousStatus: ProviderStatus;
    actualStatus: ProviderStatus;
    orderStatus: OrderStatus;
    updated: boolean;
  }> {
    const res = await this.db.query(
      `SELECT o.id, o.public_id as "publicId", o.order_status as "orderStatus",
              o.provider_status as "orderProviderStatus", o.network,
              po.id as "providerOrderId", po.provider_name as "providerName",
              po.provider_reference as "providerReference", po.provider_status as "providerStatus"
       FROM orders o
       LEFT JOIN provider_orders po ON o.id = po.order_id
       WHERE o.id = $1`,
      [orderId],
    );

    if (res.rows.length === 0) {
      throw new Error(`Order [${orderId}] not found for reconciliation`);
    }

    const row = res.rows[0];
    const providerName = row.providerName || (typeof (this.provider as any).getActiveProvider === 'function' ? (this.provider as any).getActiveProvider().providerName : this.provider.providerName);
    const orderProvider = this.resolveProviderForRecord(providerName);
    const reference = row.providerReference || `pst_sub_${row.id}`;

    const actualStatus = await orderProvider.getOrderStatus({
      providerReference: reference,
      orderId: row.id,
    });

    const isCompleted = actualStatus.providerStatus === ProviderStatus.COMPLETED;
    const isFailed = actualStatus.providerStatus === ProviderStatus.FAILED || actualStatus.providerStatus === ProviderStatus.REJECTED;

    const newOrderStatus = isCompleted
      ? OrderStatus.COMPLETED
      : isFailed
      ? OrderStatus.FAILED
      : actualStatus.providerStatus === ProviderStatus.PROCESSING || actualStatus.providerStatus === ProviderStatus.RECEIVED
      ? OrderStatus.PROCESSING
      : (row.orderStatus as OrderStatus);

    await this.db.query(
      `UPDATE provider_orders
       SET provider_status = $1,
           last_synced_at = CURRENT_TIMESTAMP,
           sync_version = sync_version + 1
       WHERE order_id = $2`,
      [actualStatus.providerStatus, row.id],
    );

    await this.db.query(
      `UPDATE orders
       SET order_status = $1,
           provider_status = $2,
           refund_status = CASE WHEN $4 = TRUE AND payment_status = 'PAID' THEN 'COMPLETED' ELSE refund_status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [newOrderStatus, actualStatus.providerStatus, row.id, isFailed],
    );

    if (isFailed) {
      const orderInfo = await this.db.query(
        `SELECT user_id, amount_pesewas, payment_status, refund_status FROM orders WHERE id = $1`,
        [row.id],
      );
      if (orderInfo.rows.length > 0) {
        const ord = orderInfo.rows[0];
        if (ord.payment_status === 'PAID' && ord.user_id && ord.amount_pesewas && Number(ord.amount_pesewas) > 0) {
          const refundAmt = Number(ord.amount_pesewas);
          await this.db.query(
            `UPDATE users
             SET wallet_balance_pesewas = wallet_balance_pesewas + $1,
                 wallet_balance = ROUND((wallet_balance_pesewas + $1) / 100.0, 2),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [refundAmt, ord.user_id],
          );
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
            [ord.user_id, refundAmt, row.id, `Automated refund on single reconciliation failure [${row.id}]`],
          ).catch(() => {});
        }
      }
    }

    await this.db.query(
      `INSERT INTO order_events (
          order_id, event_type, correlation_id, actor_id, actor_type, source,
          previous_state, new_state
       ) VALUES ($1, $2, 'admin_reconcile', NULL, 'SYSTEM', 'ADMIN_RECONCILIATION', $3, $4)`,
      [
        row.id,
        isCompleted ? OrderEventType.ORDER_COMPLETED : OrderEventType.PROVIDER_STATUS_UPDATED,
        JSON.stringify({ orderStatus: row.orderStatus, providerStatus: row.orderProviderStatus || row.providerStatus }),
        JSON.stringify({ orderStatus: newOrderStatus, providerStatus: actualStatus.providerStatus }),
      ],
    );

    return {
      orderId: row.id,
      providerName: orderProvider.providerName,
      providerReference: reference,
      previousStatus: (row.orderProviderStatus || row.providerStatus || ProviderStatus.UNKNOWN) as ProviderStatus,
      actualStatus: actualStatus.providerStatus,
      orderStatus: newOrderStatus,
      updated: (row.orderProviderStatus || row.providerStatus) !== actualStatus.providerStatus,
    };
  }
}
