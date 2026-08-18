import crypto from 'node:crypto';
import type pg from 'pg';
import {
  Currency,
  PaymentStatus,
  OrderStatus,
  PaymentEventType,
  OrderEventType,
  LedgerEntryType,
  LedgerAccountType,
  PaymentIntentDto,
  PaymentDetailsDto,
  InitializePaymentRequest,
  UserRole,
} from '@bytebeacon/shared';
import { IPaymentProvider } from './payment-provider.interface.js';
import { FinancialLedgerService } from './financial-ledger.service.js';
import { IdempotencyService } from '../commerce/idempotency.service.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';

export interface PaymentSecurityContext {
  userId: string;
  userEmail: string;
  role: UserRole;
  correlationId: string;
  actorType: string;
  ipAddress?: string;
}

export class PaymentService {
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
   * Initializes a payment intent for an existing order.
   * Resolves amount strictly from the persisted order in pesewas (never client submitted).
   */
  public async initializePayment(
    input: InitializePaymentRequest,
    context: PaymentSecurityContext,
  ): Promise<PaymentIntentDto> {
    if (input.idempotencyKey) {
      const cached = await this.idempotencyService.get<PaymentIntentDto>(
        input.idempotencyKey,
        context.userId,
        input,
      );
      if (cached) {
        logger.info(
          { idempotencyKey: input.idempotencyKey, userId: context.userId },
          'Returning cached idempotent payment intent',
        );
        return cached;
      }
    }

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch and Lock Order
      const orderRes = await client.query(
        `SELECT id, public_id, user_id, amount_pesewas, currency,
                payment_status, order_status
         FROM orders
         WHERE id = $1 OR public_id = $1
         FOR UPDATE`,
        [input.orderId],
      );

      if (orderRes.rows.length === 0) {
        throw new NotFoundError(`Order with ID [${input.orderId}] not found.`);
      }

      const order = orderRes.rows[0];

      // Tenant isolation: customers cannot pay for other users' orders
      if (context.role === UserRole.CUSTOMER && order.user_id !== context.userId) {
        throw new ForbiddenError('You do not have permission to initialize payment for this order.');
      }

      if (order.payment_status === PaymentStatus.PAID) {
        throw new BadRequestError('Order has already been paid.');
      }

      if (order.order_status === OrderStatus.CANCELLED || order.order_status === OrderStatus.FAILED) {
        throw new BadRequestError(`Cannot pay for an order in status ${order.order_status}.`);
      }

      const amountPesewas = Number(order.amount_pesewas);
      const currency = order.currency as Currency;
      const paymentPublicId = `pay_${crypto.randomBytes(8).toString('hex')}`;
      const tempRef = `pst_init_${crypto.randomBytes(8).toString('hex')}`;

      // 2. Insert Payment Record
      const paymentRes = await client.query(
        `INSERT INTO payments (
            public_id, order_id, user_id, amount_pesewas, currency,
            provider, provider_reference, payment_method, status
         ) VALUES ($1, $2, $3, $4, $5, 'PAYSTACK', $6, $7, $8)
         RETURNING id, public_id, created_at`,
        [
          paymentPublicId,
          order.id,
          context.userId,
          amountPesewas,
          currency,
          tempRef,
          input.paymentMethod,
          PaymentStatus.PENDING,
        ],
      );

      const payment = paymentRes.rows[0];

      // 3. Insert Initial Payment Attempt
      await client.query(
        `INSERT INTO payment_attempts (
            payment_id, attempt_number, provider_channel, status
         ) VALUES ($1, 1, $2, 'PENDING')`,
        [payment.id, input.channel || 'mobile_money'],
      );

      // 4. Record Initial Payment Event
      await client.query(
        `INSERT INTO payment_events (
            payment_id, provider, event_type, correlation_id, source,
            previous_status, new_status, metadata
         ) VALUES ($1, 'PAYSTACK', $2, $3, 'API', NULL, $4, $5)`,
        [
          payment.id,
          PaymentEventType.PAYMENT_INITIALIZED,
          context.correlationId,
          PaymentStatus.PENDING,
          JSON.stringify({ paymentMethod: input.paymentMethod, channel: input.channel }),
        ],
      );

      // 5. Call Payment Gateway
      const gatewayResult = await this.paymentProvider.initializePayment({
        orderId: order.id,
        amountPesewas,
        currency,
        email: input.email || context.userEmail,
        paymentMethod: input.paymentMethod,
        channel: input.channel,
        callbackUrl: input.callbackUrl,
        metadata: {
          paymentId: payment.id,
          paymentPublicId,
          correlationId: context.correlationId,
        },
      });

      // Update payment with authoritative provider reference
      await client.query(
        `UPDATE payments SET provider_reference = $1 WHERE id = $2`,
        [gatewayResult.providerReference, payment.id],
      );

      await client.query('COMMIT');

      const responseDto: PaymentIntentDto = {
        paymentId: payment.id,
        publicId: payment.public_id,
        orderId: order.id,
        amountPesewas,
        currency,
        authorizationUrl: gatewayResult.authorizationUrl,
        reference: gatewayResult.providerReference,
        status: PaymentStatus.PENDING,
        createdAt: new Date(payment.created_at).toISOString(),
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
      logger.error({ err, orderId: input.orderId }, 'Failed to initialize payment');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Processes a verified successful payment:
   * 1. Updates payment status to PAID
   * 2. Emits PAYMENT_CAPTURED payment event
   * 3. Transitions order paymentStatus = PAID and orderStatus = READY_FOR_FULFILLMENT
   * 4. Posts double-entry financial ledger records (Total Debits = Total Credits)
   */
  public async processSuccessfulPayment(
    paymentId: string,
    providerReference: string,
    gatewayData: {
      channel?: string;
      authorizationCode?: string;
      paidAt?: Date;
      amountPesewas: number;
    },
    correlationId: string,
  ): Promise<{ alreadyProcessed: boolean }> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const payRes = await client.query(
        `SELECT id, order_id, user_id, amount_pesewas, currency, status, provider_reference
         FROM payments
         WHERE id = $1
         FOR UPDATE`,
        [paymentId],
      );

      if (payRes.rows.length === 0) {
        throw new NotFoundError(`Payment with ID [${paymentId}] not found.`);
      }

      const payment = payRes.rows[0];

      if (payment.status === PaymentStatus.PAID) {
        logger.info({ paymentId }, 'Payment already in PAID status; idempotent no-op.');
        await client.query('COMMIT');
        return { alreadyProcessed: true };
      }

      const amountPesewas = Number(payment.amount_pesewas);
      const paidAt = gatewayData.paidAt || new Date();

      // 1. Update Payment Status
      await client.query(
        `UPDATE payments
         SET status = $1, provider_reference = $2, authorization_code = $3,
             paid_at = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [
          PaymentStatus.PAID,
          providerReference,
          gatewayData.authorizationCode || null,
          paidAt,
          paymentId,
        ],
      );

      // 2. Record Payment Event
      await client.query(
        `INSERT INTO payment_events (
            payment_id, provider, event_type, correlation_id, source,
            previous_status, new_status, metadata
         ) VALUES ($1, 'PAYSTACK', $2, $3, 'WEBHOOK', $4, $5, $6)`,
        [
          paymentId,
          PaymentEventType.PAYMENT_CAPTURED,
          correlationId,
          payment.status,
          PaymentStatus.PAID,
          JSON.stringify({
            providerReference,
            channel: gatewayData.channel,
            amountPesewas,
          }),
        ],
      );

      // 3. Transition Order to READY_FOR_FULFILLMENT (NEVER DIRECTLY COMPLETED!)
      await client.query(
        `UPDATE orders
         SET payment_status = $1,
             order_status = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [PaymentStatus.PAID, OrderStatus.READY_FOR_FULFILLMENT, payment.order_id],
      );

      // 4. Record Order Event
      await client.query(
        `INSERT INTO order_events (
            order_id, event_type, correlation_id, actor_id, actor_type, source,
            previous_state, new_state
         ) VALUES ($1, $2, $3, $4, 'SYSTEM', 'PAYMENT_ENGINE', $5, $6)`,
        [
          payment.order_id,
          OrderEventType.PAYMENT_CONFIRMED,
          correlationId,
          payment.user_id,
          JSON.stringify({ paymentStatus: PaymentStatus.PENDING }),
          JSON.stringify({
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.READY_FOR_FULFILLMENT,
          }),
        ],
      );

      // 5. Post Balanced Double-Entry Financial Ledger Lines
      // Total Debits = Total Credits = amountPesewas
      const platformSystemAccountId = '00000000-0000-0000-0000-000000000000';
      await this.ledgerService.recordJournalEntries(client, [
        {
          entryType: LedgerEntryType.DEBIT,
          accountType: LedgerAccountType.CUSTOMER_WALLET,
          accountId: payment.user_id,
          amountPesewas,
          currency: payment.currency as Currency,
          referenceType: 'PAYMENT',
          referenceId: paymentId,
          description: `Customer payment received for Order ${payment.order_id}`,
        },
        {
          entryType: LedgerEntryType.CREDIT,
          accountType: LedgerAccountType.PLATFORM_ESCROW,
          accountId: platformSystemAccountId,
          amountPesewas,
          currency: payment.currency as Currency,
          referenceType: 'PAYMENT',
          referenceId: paymentId,
          description: `Platform escrow credited for Order ${payment.order_id}`,
        },
      ]);

      await client.query('COMMIT');
      logger.info({ paymentId, orderId: payment.order_id }, 'Payment successfully processed and order ready for fulfillment');

      return { alreadyProcessed: false };
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ err, paymentId }, 'Failed to process successful payment');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves payment details by ID or Public ID with tenant isolation.
   */
  public async getPaymentDetails(
    paymentId: string,
    userId: string,
    role: UserRole,
  ): Promise<PaymentDetailsDto> {
    const payRes = await this.db.query(
      `SELECT id, public_id as "publicId", order_id as "orderId", user_id as "userId",
              amount_pesewas as "amountPesewas", currency, provider,
              provider_reference as "providerReference", payment_method as "paymentMethod",
              status, paid_at as "paidAt", created_at as "createdAt", updated_at as "updatedAt"
       FROM payments
       WHERE id = $1 OR public_id = $1`,
      [paymentId],
    );

    if (payRes.rows.length === 0) {
      throw new NotFoundError(`Payment [${paymentId}] not found.`);
    }

    const row = payRes.rows[0];

    if (role === UserRole.CUSTOMER && row.userId !== userId) {
      throw new ForbiddenError('You do not have permission to access this payment.');
    }

    const [attemptsRes, eventsRes, ledgerEntries] = await Promise.all([
      this.db.query(
        `SELECT id, payment_id as "paymentId", attempt_number as "attemptNumber",
                provider_channel as "providerChannel", status, error_code as "errorCode",
                error_message as "errorMessage", created_at as "createdAt"
         FROM payment_attempts
         WHERE payment_id = $1
         ORDER BY attempt_number ASC`,
        [row.id],
      ),
      this.db.query(
        `SELECT id, payment_id as "paymentId", event_type as "eventType",
                correlation_id as "correlationId", source, previous_status as "previousStatus",
                new_status as "newStatus", metadata, occurred_at as "occurredAt"
         FROM payment_events
         WHERE payment_id = $1
         ORDER BY occurred_at ASC`,
        [row.id],
      ),
      this.ledgerService.getEntriesByReference('PAYMENT', row.id),
    ]);

    return {
      id: row.id,
      publicId: row.publicId,
      orderId: row.orderId,
      userId: row.userId,
      amountPesewas: Number(row.amountPesewas),
      currency: row.currency,
      provider: row.provider,
      providerReference: row.providerReference,
      paymentMethod: row.paymentMethod,
      status: row.status,
      paidAt: row.paidAt ? new Date(row.paidAt).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      attempts: attemptsRes.rows.map((a) => ({
        ...a,
        createdAt: new Date(a.createdAt).toISOString(),
      })),
      events: eventsRes.rows.map((e) => ({
        ...e,
        occurredAt: new Date(e.occurredAt).toISOString(),
      })),
      ledgerEntries,
    };
  }
}
