import crypto from 'node:crypto';
import type pg from 'pg';
import {
  Currency,
  PaymentStatus,
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
      const existingRefund = await client.query(
        `SELECT id, public_id, status, amount_pesewas, provider_refund_reference, created_at, updated_at
         FROM refunds
         WHERE payment_id = $1 AND status = 'COMPLETED'`,
        [payment.id],
      );

      if (existingRefund.rows.length > 0) {
        logger.info({ paymentId: payment.id }, 'Payment already has completed refund record.');
        const r = existingRefund.rows[0];
        await client.query('COMMIT');
        return {
          id: r.id,
          publicId: r.public_id,
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
      const insertRefundRes = await client.query(
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
    const res = await this.db.query(
      `SELECT r.id, r.public_id as "publicId", r.payment_id as "paymentId",
              r.order_id as "orderId", r.amount_pesewas as "amountPesewas",
              r.reason, r.status, r.provider_refund_reference as "providerRefundReference",
              r.processed_at as "processedAt", r.created_at as "createdAt",
              r.updated_at as "updatedAt", o.user_id as "userId"
       FROM refunds r
       JOIN orders o ON r.order_id = o.id
       WHERE r.id = $1 OR r.public_id = $1`,
      [refundId],
    );

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
}
