import type pg from 'pg';
import type { Redis } from 'ioredis';
import { IPaymentProvider } from './payment-provider.interface.js';
import { PaymentService } from './payment.service.js';
import { UnauthorizedError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';

export interface PaystackWebhookPayload {
  event: string;
  data: {
    id?: number;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    channel?: string;
    paid_at?: string;
    authorization?: { authorization_code?: string };
    metadata?: {
      orderId?: string;
      paymentId?: string;
      correlationId?: string;
    };
  };
}

export class PaymentWebhookService {
  private readonly db: pg.Pool;
  private readonly redis: Redis | null;
  private readonly paymentProvider: IPaymentProvider;
  private readonly paymentService: PaymentService;

  constructor(
    db: pg.Pool,
    redis: Redis | null,
    paymentProvider: IPaymentProvider,
    paymentService: PaymentService,
  ) {
    this.db = db;
    this.redis = redis;
    this.paymentProvider = paymentProvider;
    this.paymentService = paymentService;
  }

  /**
   * Validates Paystack HMAC signature and processes the incoming webhook idempotently.
   */
  public async handlePaystackWebhook(
    rawBody: string | Buffer,
    signature: string,
    correlationId: string,
  ): Promise<{ status: 'PROCESSED' | 'DUPLICATE' | 'IGNORED'; message: string }> {
    // 1. Strict Cryptographic Signature Verification
    const isValid = this.paymentProvider.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.warn({ correlationId }, 'Forged or invalid Paystack webhook signature rejected');
      throw new UnauthorizedError('Invalid webhook signature');
    }

    const payloadText = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody;
    let payload: PaystackWebhookPayload;
    try {
      payload = JSON.parse(payloadText) as PaystackWebhookPayload;
    } catch {
      logger.error({ correlationId }, 'Failed to parse Paystack webhook JSON payload');
      return { status: 'IGNORED', message: 'Malformed JSON payload' };
    }

    const eventName = payload.event;
    const providerEventId = payload.data?.id ? String(payload.data.id) : `${eventName}_${payload.data?.reference}`;

    // 2. Redis Acceleration Layer for Duplicate Check
    if (this.redis) {
      const redisKey = `webhook:paystack:dedup:${providerEventId}`;
      const isSet = await this.redis.set(redisKey, '1', 'EX', 86400, 'NX');
      if (!isSet) {
        logger.info({ providerEventId, correlationId }, 'Duplicate webhook event dropped by Redis accelerator');
        return { status: 'DUPLICATE', message: 'Event already processed' };
      }
    }

    // 3. PostgreSQL Authoritative Uniqueness Guarantee
    const client = await this.db.connect();
    try {
      // Find matching payment by provider reference or metadata payment ID
      const reference = payload.data?.reference;
      const metadataPaymentId = payload.data?.metadata?.paymentId;

      let payRes = await client.query(
        `SELECT id, order_id, user_id, amount_pesewas, status,
                CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'metadata')
                     THEN metadata ELSE '{}'::jsonb END as metadata
         FROM payments
         WHERE provider_reference = $1 OR id = $2`,
        [reference, metadataPaymentId || '00000000-0000-0000-0000-000000000000'],
      );

      if (payRes.rows.length === 0) {
        // Fallback safety net for wallet top-ups: check webhook payload metadata
        const metadataObj = (payload.data?.metadata || {}) as Record<string, any>;
        const metaType = metadataObj.type;
        const metaUserId = metadataObj.userId;
        if (metaType === 'WALLET_TOPUP' && metaUserId) {
          logger.info({ reference, metaUserId }, 'Auto-registering pending wallet top-up payment from webhook payload metadata');
          try {
            payRes = await client.query(
              `INSERT INTO payments (
                 user_id, amount_pesewas, currency, provider, provider_reference, payment_method, status, metadata
               ) VALUES ($1, $2, 'GHS', 'PAYSTACK', $3, 'MOMO', 'PENDING', $4)
               RETURNING id, order_id, user_id, amount_pesewas, status, metadata`,
              [
                metaUserId,
                Number(payload.data.amount || 100),
                reference,
                JSON.stringify(payload.data.metadata),
              ],
            );
          } catch {
            // Fallback if metadata column is not present
            payRes = await client.query(
              `INSERT INTO payments (
                 user_id, amount_pesewas, currency, provider, provider_reference, payment_method, status
               ) VALUES ($1, $2, 'GHS', 'PAYSTACK', $3, 'MOMO', 'PENDING')
               RETURNING id, order_id, user_id, amount_pesewas, status`,
              [
                metaUserId,
                Number(payload.data.amount || 100),
                reference,
              ],
            );
          }
        } else {
          logger.warn({ reference, metadataPaymentId }, 'Webhook received for unknown internal payment');
          return { status: 'IGNORED', message: 'Payment record not found' };
        }
      }

      const payment = payRes.rows[0];

      // Check PostgreSQL unique constraint for durable idempotency
      const existingEvent = await client.query(
        `SELECT id FROM payment_events WHERE provider = 'PAYSTACK' AND provider_event_id = $1`,
        [providerEventId],
      );

      if (existingEvent.rows.length > 0) {
        logger.info({ providerEventId }, 'Duplicate webhook event detected in PostgreSQL payment_events');
        return { status: 'DUPLICATE', message: 'Event already recorded' };
      }

      // Record durable event record
      await client.query(
        `INSERT INTO payment_events (
            payment_id, provider, provider_event_id, event_type, correlation_id,
            source, previous_status, new_status, metadata
         ) VALUES ($1, 'PAYSTACK', $2, $3, $4, 'WEBHOOK', $5, $6, $7)`,
        [
          payment.id,
          providerEventId,
          eventName,
          correlationId,
          payment.status,
          eventName === 'charge.success' ? 'PAID' : payment.status,
          JSON.stringify(payload),
        ],
      );

      client.release();

      // Process payment status transition asynchronously/in-line if charge.success
      if (eventName === 'charge.success') {
        const isWalletTopup =
          !payment.order_id ||
          String(payment.order_id).startsWith('topup_') ||
          payment.metadata?.type === 'WALLET_TOPUP' ||
          (payload.data?.metadata as any)?.type === 'WALLET_TOPUP';

        if (isWalletTopup) {
          await this.paymentService.processSuccessfulWalletTopup(
            payment.id,
            reference,
            {
              amountPesewas: payload.data.amount,
              channel: payload.data.channel,
              authorizationCode: payload.data.authorization?.authorization_code,
              paidAt: payload.data.paid_at ? new Date(payload.data.paid_at) : new Date(),
            },
            correlationId,
          );
        } else {
          await this.paymentService.processSuccessfulPayment(
            payment.id,
            reference,
            {
              amountPesewas: payload.data.amount,
              channel: payload.data.channel,
              authorizationCode: payload.data.authorization?.authorization_code,
              paidAt: payload.data.paid_at ? new Date(payload.data.paid_at) : new Date(),
            },
            correlationId,
          );
        }
      }

      return { status: 'PROCESSED', message: 'Webhook successfully processed' };
    } catch (err: any) {
      client.release();
      if (err.code === '23505') {
        // Postgres unique violation on uq_payment_provider_event
        logger.info({ providerEventId }, 'Concurrent duplicate webhook caught by Postgres UNIQUE constraint');
        return { status: 'DUPLICATE', message: 'Event already recorded' };
      }
      logger.error({ err, correlationId }, 'Error processing Paystack webhook');
      throw err;
    }
  }
}
