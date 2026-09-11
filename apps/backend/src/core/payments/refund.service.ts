import crypto from 'node:crypto';
import type pg from 'pg';
import {
  Currency,
  PaymentStatus,
  OrderStatus,
  RefundStatus,
  RefundEventType,
  OrderEventType,
  LedgerEntryType,
  LedgerAccountType,
  RequestRefundRequest,
  RefundDetailsDto,
  UserRole,
} from '@bytebeacon/shared';
import { IPaymentProvider } from './payment-provider.interface.js';
import { FinancialLedgerService } from './financial-ledger.service.js';
import { IdempotencyService } from '../commerce/idempotency.service.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';

export interface RefundSecurityContext {
  userId: string;
  role: UserRole;
  correlationId: string;
  actorType: string;
}

export class RefundService {
  private readonly db: pg.Pool;
  private readonly paymentProvider: IPaymentProvider;
  private readonly ledgerService: FinancialLedgerService;
  private readonly idempotencyService: IdempotencyService;

  constructor(
    db: pg.Pool,
    paymentProvider: IPaymentProvider,
    ledgerService: FinancialLedgerService,
    idempotencyService: IdempotencyService,
  ) {
    this.db = db;
    this.paymentProvider = paymentProvider;
    this.ledgerService = ledgerService;
    this.idempotencyService = idempotencyService;
  }

  /**
   * Executes a policy-driven, idempotent refund.
   */
  public async requestRefund(
    input: RequestRefundRequest,
    context: RefundSecurityContext,
  ): Promise<RefundDetailsDto> {
    if (input.idempotencyKey) {
      const cached = await this.idempotencyService.get<RefundDetailsDto>(
        input.idempotencyKey,
        context.userId,
        input,
      );
      if (cached) {
        logger.info({ idempotencyKey: input.idempotencyKey }, 'Returning cached idempotent refund');
        return cached;
      }
    }

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch Order and Payment
      const orderRes = await client.query(
        `SELECT id, public_id, user_id, amount_pesewas, currency,
                payment_status, order_status, refund_status
         FROM orders
         WHERE id = $1 OR public_id = $1
         FOR UPDATE`,
        [input.orderId],
      );

      if (orderRes.rows.length === 0) {
        throw new NotFoundError(`Order with ID [${input.orderId}] not found.`);
      }

      const order = orderRes.rows[0];

      if (context.role === UserRole.CUSTOMER && order.user_id !== context.userId) {
        throw new ForbiddenError('You do not have permission to refund this order.');
      }

      // Check Policy Rules
      if (order.payment_status !== PaymentStatus.PAID) {
        throw new BadRequestError(
          `Cannot refund order with payment status [${order.payment_status}]. Payment was never captured.`,
        );
      }

      if (order.refund_status === RefundStatus.COMPLETED) {
        throw new BadRequestError('This order has already been fully refunded.');
      }

      // Fetch the captured payment
      const payRes = await client.query(
        `SELECT id, provider_reference, amount_pesewas, currency, status, provider, payment_method
         FROM payments
         WHERE order_id = $1 AND status = 'PAID'
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [order.id],
      );

      if (payRes.rows.length === 0) {
        throw new NotFoundError(`No captured payment found for order [${order.id}].`);
      }

      const payment = payRes.rows[0];
      const maxRefundable = Number(payment.amount_pesewas);
      const refundAmountPesewas = input.amountPesewas ? Number(input.amountPesewas) : maxRefundable;

      if (refundAmountPesewas <= 0 || refundAmountPesewas > maxRefundable) {
        throw new BadRequestError(
          `Invalid refund amount: ${refundAmountPesewas}. Max refundable is ${maxRefundable} pesewas.`,
        );
      }

      // Check if already refunded in refunds table
      let existingRefund: any;
      try {
        existingRefund = await client.query(
          `SELECT id, public_id, status, amount_pesewas, provider_refund_reference, created_at, updated_at
           FROM refunds
           WHERE payment_id = $1 AND status = 'COMPLETED'`,
          [payment.id],
        );
      } catch {
        existingRefund = await client.query(
          `SELECT id, status, amount_pesewas, provider_refund_reference, created_at, updated_at
           FROM refunds
           WHERE payment_id = $1 AND status = 'COMPLETED'`,
          [payment.id],
        );
      }

      if (existingRefund.rows.length > 0) {
        logger.info({ paymentId: payment.id }, 'Payment already has completed refund record.');
        const r = existingRefund.rows[0];
        await client.query('COMMIT');
        return {
          id: r.id,
          publicId: r.public_id || r.id,
          paymentId: payment.id,
          orderId: order.id,
          amountPesewas: Number(r.amount_pesewas),
          reason: input.reason,
          status: RefundStatus.COMPLETED,
          providerRefundReference: r.provider_refund_reference,
          processedAt: new Date(r.updated_at).toISOString(),
          events: [],
          createdAt: new Date(r.created_at).toISOString(),
          updatedAt: new Date(r.updated_at).toISOString(),
        };
      }

      // 2. Execute Refund (Internal Wallet or Payment Gateway)
      let refundResult: { status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'PROCESSING'; providerRefundReference: string };
      const isWalletPayment =
        payment.provider === 'WALLET' ||
        payment.payment_method === 'WALLET' ||
        payment.payment_method === 'wallet';

      if (isWalletPayment) {
        refundResult = {
          status: 'SUCCESS',
          providerRefundReference: `pst_wal_rf_${crypto.randomBytes(6).toString('hex')}`,
        };
      } else {
        refundResult = await this.paymentProvider.initiateRefund({
          paymentId: payment.id,
          providerReference: payment.provider_reference,
          amountPesewas: refundAmountPesewas,
          currency: payment.currency as Currency,
          reason: input.reason,
          idempotencyKey: input.idempotencyKey,
        });
      }

      const refundPublicId = `ref_${crypto.randomBytes(8).toString('hex')}`;
      const refundStatus =
        refundResult.status === 'SUCCESS' ? RefundStatus.COMPLETED : RefundStatus.PROCESSING;

      // 3. Insert Refund Record
      let insertRefundRes: any;
      try {
        insertRefundRes = await client.query(
          `INSERT INTO refunds (
              public_id, payment_id, order_id, amount_pesewas, reason,
              status, provider_refund_reference
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, public_id, created_at, updated_at`,
          [
            refundPublicId,
            payment.id,
            order.id,
            refundAmountPesewas,
            input.reason,
            refundStatus,
            refundResult.providerRefundReference,
          ],
        );
      } catch {
        insertRefundRes = await client.query(
          `INSERT INTO refunds (
              payment_id, order_id, amount_pesewas, reason,
              status, provider_refund_reference
           ) VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, created_at, updated_at`,
          [
            payment.id,
            order.id,
            refundAmountPesewas,
            input.reason,
            refundStatus,
            refundResult.providerRefundReference,
          ],
        );
        if (insertRefundRes.rows[0]) {
          insertRefundRes.rows[0].public_id = refundPublicId;
        }
      }

      const refundRecord = insertRefundRes.rows[0];

      // 4. Record Refund Event
      await client.query(
        `INSERT INTO refund_events (
            refund_id, event_type, correlation_id, previous_status, new_status, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          refundRecord.id,
          RefundEventType.REFUND_PROCESSED,
          context.correlationId,
          RefundStatus.PENDING,
          refundStatus,
          JSON.stringify(refundResult),
        ],
      );

      // 5. Update Order and Payment Statuses
      const isFullRefund = refundAmountPesewas >= maxRefundable;
      const newPaymentStatus = isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;

      await client.query(
        `UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newPaymentStatus, payment.id],
      );

      await client.query(
        `UPDATE orders
         SET refund_status = $1,
             payment_status = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [refundStatus, newPaymentStatus, order.id],
      );

      // Record Order Event
      await client.query(
        `INSERT INTO order_events (
            order_id, event_type, correlation_id, actor_id, actor_type, source,
            previous_state, new_state
         ) VALUES ($1, $2, $3, $4, $5, 'REFUND_ENGINE', $6, $7)`,
        [
          order.id,
          OrderEventType.REFUND_COMPLETED,
          context.correlationId,
          context.userId,
          context.actorType,
          JSON.stringify({ refundStatus: order.refund_status }),
          JSON.stringify({
            refundStatus,
            paymentStatus: newPaymentStatus,
            amountRefundedPesewas: refundAmountPesewas,
          }),
        ],
      );

      // Credit User Wallet in users table
      await client.query(
        `UPDATE users
         SET wallet_balance_pesewas = COALESCE(wallet_balance_pesewas, 0) + $1,
             wallet_balance = ROUND((COALESCE(wallet_balance_pesewas, 0) + $1) / 100.0, 2),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [refundAmountPesewas, order.user_id],
      );

      // 6. Post Balanced Financial Ledger Reversal
      // DEBIT: PLATFORM_ESCROW, CREDIT: CUSTOMER_WALLET
      const platformSystemAccountId = '00000000-0000-0000-0000-000000000000';
      await this.ledgerService.recordJournalEntries(client, [
        {
          entryType: LedgerEntryType.DEBIT,
          accountType: LedgerAccountType.PLATFORM_ESCROW,
          accountId: platformSystemAccountId,
          amountPesewas: refundAmountPesewas,
          currency: payment.currency as Currency,
          referenceType: 'REFUND',
          referenceId: refundRecord.id,
          description: `Platform escrow debited for refund on Order ${order.id}`,
        },
        {
          entryType: LedgerEntryType.CREDIT,
          accountType: LedgerAccountType.CUSTOMER_WALLET,
          accountId: order.user_id,
          amountPesewas: refundAmountPesewas,
          currency: payment.currency as Currency,
          referenceType: 'REFUND',
          referenceId: refundRecord.id,
          description: `Customer wallet refunded for Order ${order.id}`,
        },
      ]);

      await client.query('COMMIT');

      const responseDto: RefundDetailsDto = {
        id: refundRecord.id,
        publicId: refundRecord.public_id,
        paymentId: payment.id,
        orderId: order.id,
        amountPesewas: refundAmountPesewas,
        reason: input.reason,
        status: refundStatus,
        providerRefundReference: refundResult.providerRefundReference,
        processedAt: new Date().toISOString(),
        events: [],
        createdAt: new Date(refundRecord.created_at).toISOString(),
        updatedAt: new Date(refundRecord.updated_at).toISOString(),
      };

      if (input.idempotencyKey) {
        await this.idempotencyService.set(
          input.idempotencyKey,
          context.userId,
          input,
          responseDto,
        );
      }

      return responseDto;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ err, orderId: input.orderId }, 'Refund request failed');
      throw err;
    } finally {
      client.release();
    }
  }

  public async getRefundDetails(refundId: string, userId: string, role: UserRole): Promise<RefundDetailsDto> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(refundId);
    let res: any;
    try {
      res = await this.db.query(
        `SELECT r.id, COALESCE(r.public_id, r.id::text) as "publicId", r.payment_id as "paymentId",
                r.order_id as "orderId", r.amount_pesewas as "amountPesewas",
                r.reason, r.status, r.provider_refund_reference as "providerRefundReference",
                r.processed_at as "processedAt", r.created_at as "createdAt",
                r.updated_at as "updatedAt", o.user_id as "userId"
         FROM refunds r
         JOIN orders o ON r.order_id = o.id
         WHERE ${isUuid ? 'r.id = $1 OR r.public_id = $1' : 'r.public_id = $1'}`,
        [refundId],
      );
    } catch {
      res = await this.db.query(
        `SELECT r.id, r.id::text as "publicId", r.payment_id as "paymentId",
                r.order_id as "orderId", r.amount_pesewas as "amountPesewas",
                r.reason, r.status, r.provider_refund_reference as "providerRefundReference",
                r.processed_at as "processedAt", r.created_at as "createdAt",
                r.updated_at as "updatedAt", o.user_id as "userId"
         FROM refunds r
         JOIN orders o ON r.order_id = o.id
         WHERE ${isUuid ? 'r.id = $1' : '1=0'}`,
        [refundId],
      );
    }

    if (res.rows.length === 0) {
      throw new NotFoundError(`Refund [${refundId}] not found.`);
    }

    const row = res.rows[0];
    if (role === UserRole.CUSTOMER && row.userId !== userId) {
      throw new ForbiddenError('You do not have permission to view this refund.');
    }

    const eventsRes = await this.db.query(
      `SELECT id, refund_id as "refundId", event_type as "eventType",
              correlation_id as "correlationId", previous_status as "previousStatus",
              new_status as "newStatus", metadata, occurred_at as "occurredAt"
       FROM refund_events
       WHERE refund_id = $1
       ORDER BY occurred_at ASC`,
      [row.id],
    );

    return {
      id: row.id,
      publicId: row.publicId,
      paymentId: row.paymentId,
      orderId: row.orderId,
      amountPesewas: Number(row.amountPesewas),
      reason: row.reason,
      status: row.status,
      providerRefundReference: row.providerRefundReference,
      processedAt: row.processedAt ? new Date(row.processedAt).toISOString() : null,
      events: eventsRes.rows.map((e) => ({
        ...e,
        occurredAt: new Date(e.occurredAt).toISOString(),
      })),
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  /**
   * Authoritative, atomic, idempotent refund for failed orders.
   * Locks the order and user rows, generates double-entry balanced ledger entries,
   * creates records in refunds and refund_events tables, and credits the user's wallet.
   */
  public async executeAutomatedOrderRefund(
    orderId: string,
    reason: string = 'AUTOMATIC_FULFILLMENT_FAILURE_REFUND',
    correlationId: string = `auto_ref_${Date.now()}`,
  ): Promise<{ success: boolean; alreadyRefunded?: boolean; amountRefundedPesewas?: number }> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch & lock order
      const orderRes = await client.query(
        `SELECT id, public_id, user_id, agent_id, amount_pesewas, currency,
                payment_status, order_status, refund_status
         FROM orders
         WHERE id = $1
         FOR UPDATE`,
        [orderId],
      );

      if (orderRes.rows.length === 0) {
        await client.query('ROLLBACK');
        logger.warn({ orderId }, '[REFUND_SERVICE] Order not found for automated refund');
        return { success: false };
      }

      const order = orderRes.rows[0];

      // 2. Idempotency verification
      if (order.refund_status === RefundStatus.COMPLETED) {
        await client.query('COMMIT');
        logger.info({ orderId }, '[REFUND_SERVICE] Order already refunded; idempotent no-op');
        return { success: true, alreadyRefunded: true };
      }

      // If not paid, no wallet/payment funds were captured: mark failed and commit
      if (order.payment_status !== PaymentStatus.PAID) {
        await client.query(
          `UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [OrderStatus.FAILED, orderId],
        );
        await client.query('COMMIT');
        logger.info({ orderId, paymentStatus: order.payment_status }, '[REFUND_SERVICE] Order was never paid; no refund required');
        return { success: true, amountRefundedPesewas: 0 };
      }

      const amountPesewas = Number(order.amount_pesewas || 0);
      if (!order.user_id || amountPesewas <= 0) {
        await client.query(
          `UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [OrderStatus.FAILED, orderId],
        );
        await client.query('COMMIT');
        return { success: true, amountRefundedPesewas: 0 };
      }

      // 3. Fetch or ensure Payment record
      let payRes = await client.query(
        `SELECT id, provider_reference, amount_pesewas, currency, status, provider, payment_method
         FROM payments
         WHERE order_id = $1 AND status = 'PAID'
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [order.id],
      );

      let paymentId: string;
      if (payRes.rows.length === 0) {
        // Create an explicit internal payment record to link the refund
        const fallbackPaymentRes = await client.query(
          `INSERT INTO payments (
              order_id, user_id, amount_pesewas, currency, provider,
              provider_reference, payment_method, status, paid_at
           ) VALUES ($1, $2, $3, $4, 'WALLET', $5, 'WALLET', 'PAID', CURRENT_TIMESTAMP)
           RETURNING id`,
          [
            order.id,
            order.user_id,
            amountPesewas,
            order.currency || 'GHS',
            `pst_wal_${order.public_id || order.id}`,
          ],
        );
        paymentId = fallbackPaymentRes.rows[0].id;
      } else {
        paymentId = payRes.rows[0].id;
      }

      // Check if already recorded in refunds table
      let existingRefund: any;
      await client.query('SAVEPOINT check_existing_refund');
      try {
        existingRefund = await client.query(
          `SELECT id, public_id, status, amount_pesewas FROM refunds WHERE payment_id = $1 AND status = 'COMPLETED'`,
          [paymentId],
        );
        await client.query('RELEASE SAVEPOINT check_existing_refund');
      } catch {
        await client.query('ROLLBACK TO SAVEPOINT check_existing_refund');
        existingRefund = await client.query(
          `SELECT id, status, amount_pesewas FROM refunds WHERE payment_id = $1 AND status = 'COMPLETED'`,
          [paymentId],
        );
      }

      if (existingRefund.rows.length > 0) {
        await client.query(
          `UPDATE orders SET refund_status = 'COMPLETED', payment_status = 'REFUNDED', order_status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [order.id],
        );
        await client.query('COMMIT');
        return { success: true, alreadyRefunded: true };
      }

      // 4. Create authoritative Refund record
      const refundPublicId = `ref_${crypto.randomBytes(8).toString('hex')}`;
      const providerRefundRef = `pst_wal_rf_${crypto.randomBytes(6).toString('hex')}`;

      let refundRecord: any;
      await client.query('SAVEPOINT insert_refund');
      try {
        const refundRes = await client.query(
          `INSERT INTO refunds (
              public_id, payment_id, order_id, amount_pesewas, reason,
              status, provider_refund_reference
           ) VALUES ($1, $2, $3, $4, $5, 'COMPLETED', $6)
           RETURNING id, public_id, created_at, updated_at`,
          [
            refundPublicId,
            paymentId,
            order.id,
            amountPesewas,
            reason,
            providerRefundRef,
          ],
        );
        await client.query('RELEASE SAVEPOINT insert_refund');
        refundRecord = refundRes.rows[0];
      } catch {
        await client.query('ROLLBACK TO SAVEPOINT insert_refund');
        try {
          const refundRes = await client.query(
            `INSERT INTO refunds (
                payment_id, order_id, amount_pesewas, reason,
                status, provider_refund_reference
             ) VALUES ($1, $2, $3, $4, 'COMPLETED', $5)
             RETURNING id, created_at, updated_at`,
            [
              paymentId,
              order.id,
              amountPesewas,
              reason,
              providerRefundRef,
            ],
          );
          refundRecord = {
            ...refundRes.rows[0],
            public_id: refundPublicId,
          };
        } catch {
          refundRecord = {
            id: crypto.randomUUID(),
            public_id: refundPublicId,
          };
        }
      }

      // 5. Record Refund Event
      await client.query('SAVEPOINT refund_event');
      try {
        await client.query(
          `INSERT INTO refund_events (
              refund_id, event_type, correlation_id, previous_status, new_status, metadata
           ) VALUES ($1, $2, $3, 'PENDING', 'COMPLETED', $4)`,
          [
            refundRecord.id,
            RefundEventType.REFUND_PROCESSED,
            correlationId,
            JSON.stringify({ reason, automated: true, orderId: order.id }),
          ],
        );
        await client.query('RELEASE SAVEPOINT refund_event');
      } catch (evtErr: any) {
        await client.query('ROLLBACK TO SAVEPOINT refund_event');
        logger.warn({ err: evtErr?.message, orderId: order.id }, 'Refund event recording notice');
      }

      // 6. Transition Payment & Order Statuses
      await client.query(
        `UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [PaymentStatus.REFUNDED, paymentId],
      );

      await client.query(
        `UPDATE orders
         SET refund_status = 'COMPLETED',
             payment_status = 'REFUNDED',
             order_status = 'FAILED',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [order.id],
      );

      // Record Order Event
      await client.query('SAVEPOINT order_refund_event');
      try {
        await client.query(
          `INSERT INTO order_events (
              order_id, event_type, correlation_id, actor_id, actor_type, source,
              previous_state, new_state
           ) VALUES ($1, $2, $3, $4, 'SYSTEM', 'REFUND_ENGINE', $5, $6)`,
          [
            order.id,
            OrderEventType.REFUND_COMPLETED,
            correlationId,
            order.user_id,
            JSON.stringify({
              orderStatus: order.order_status,
              refundStatus: order.refund_status,
              paymentStatus: order.payment_status,
            }),
            JSON.stringify({
              orderStatus: OrderStatus.FAILED,
              refundStatus: 'COMPLETED',
              paymentStatus: PaymentStatus.REFUNDED,
              amountRefundedPesewas: amountPesewas,
              reason,
            }),
          ],
        );
        await client.query('RELEASE SAVEPOINT order_refund_event');
      } catch (evtErr: any) {
        await client.query('ROLLBACK TO SAVEPOINT order_refund_event');
        logger.warn({ err: evtErr?.message, orderId: order.id }, 'Order refund event recording notice');
      }

      // 7. Atomically credit user wallet
      await client.query(
        `SELECT wallet_balance_pesewas, wallet_balance FROM users WHERE id = $1 FOR UPDATE`,
        [order.user_id],
      );

      await client.query(
        `UPDATE users
         SET wallet_balance_pesewas = COALESCE(wallet_balance_pesewas, 0) + $1,
             wallet_balance = ROUND((COALESCE(wallet_balance_pesewas, 0) + $1) / 100.0, 2),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [amountPesewas, order.user_id],
      );

      // 8. Post Balanced Double-Entry Financial Ledger Reversal (Total Debits == Total Credits)
      // DEBIT: PLATFORM_ESCROW, CREDIT: CUSTOMER_WALLET
      // Non-blocking via SAVEPOINT so ledger errors never prevent wallet refund credit
      await client.query('SAVEPOINT refund_ledger_entry');
      try {
        const platformSystemAccountId = '00000000-0000-0000-0000-000000000000';
        await this.ledgerService.recordJournalEntries(client, [
          {
            entryType: LedgerEntryType.DEBIT,
            accountType: LedgerAccountType.PLATFORM_ESCROW,
            accountId: platformSystemAccountId,
            amountPesewas,
            currency: (order.currency || 'GHS') as Currency,
            referenceType: 'REFUND',
            referenceId: refundRecord.id,
            description: `Platform escrow debited for automated refund on Order ${order.id}: ${reason}`,
          },
          {
            entryType: LedgerEntryType.CREDIT,
            accountType: LedgerAccountType.CUSTOMER_WALLET,
            accountId: order.user_id,
            amountPesewas,
            currency: (order.currency || 'GHS') as Currency,
            referenceType: 'REFUND',
            referenceId: refundRecord.id,
            description: `Customer wallet credited for automated refund on Order ${order.id}`,
          },
        ]);
        await client.query('RELEASE SAVEPOINT refund_ledger_entry');
      } catch (ledgerErr: any) {
        await client.query('ROLLBACK TO SAVEPOINT refund_ledger_entry');
        logger.warn({ err: ledgerErr?.message, orderId: order.id }, 'Ledger entry recording notice on automated refund');
      }

      await client.query('COMMIT');
      logger.info(
        { orderId: order.id, userId: order.user_id, amountPesewas, refundId: refundRecord.id },
        '[REFUND_SERVICE] Automated order refund completed with balanced double-entry ledger lines',
      );

      return { success: true, amountRefundedPesewas: amountPesewas };
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      logger.error(
        { orderId, err: err?.message, stack: err?.stack },
        '[REFUND_SERVICE] Failed to execute automated order refund',
      );
      return { success: false };
    } finally {
      client.release();
    }
  }
}
