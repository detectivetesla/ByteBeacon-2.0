import crypto from 'node:crypto';
import type pg from 'pg';
import {
  NetworkProvider,
  Currency,
  OrderStatus,
  PaymentStatus,
  ProviderStatus,
  RefundStatus,
  OrderEventType,
  PaymentEventType,
  PaymentMethod,
  LedgerEntryType,
  LedgerAccountType,
  CreateOrderRequest,
  OrderSummaryDto,
  OrderDetailsDto,
  OrderPricingSnapshot,
  PaginatedResponse,
  CustomerOrderDto,
  toCustomerFacingStatus,
  AgentOrdersListData,
  AgentOrderDetailData,
  AgentOrderListItem,
} from '@bytebeacon/shared';
import { OrderStateMachine } from './order-state-machine.js';
import { CatalogService } from './catalog.service.js';
import { IdempotencyService } from './idempotency.service.js';
import { FinancialLedgerService } from '../payments/financial-ledger.service.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../errors/app-error.js';
import { FulfillmentQueueService } from '../providers/fulfillment-queue.service.js';
import { FulfillmentWorker } from '../providers/fulfillment-worker.js';
import { logger } from '../logging/logger.js';

export interface CreateOrderContext {
  userId: string;
  correlationId: string;
  actorType: 'CUSTOMER' | 'AGENT' | 'ADMIN';
  agentId?: string;
  ipAddress?: string;
}

export class OrderService {
  private readonly db: pg.Pool;
  private readonly catalogService: CatalogService;
  private readonly idempotencyService: IdempotencyService;
  private readonly ledgerService: FinancialLedgerService;
  private readonly fulfillmentQueueService?: FulfillmentQueueService;
  private readonly fulfillmentWorker?: FulfillmentWorker;

  constructor(
    db: pg.Pool,
    catalogService: CatalogService,
    idempotencyService: IdempotencyService,
    ledgerService?: FinancialLedgerService,
    fulfillmentQueueService?: FulfillmentQueueService,
    fulfillmentWorker?: FulfillmentWorker,
  ) {
    this.db = db;
    this.catalogService = catalogService;
    this.idempotencyService = idempotencyService;
    this.ledgerService = ledgerService ?? new FinancialLedgerService(db);
    this.fulfillmentQueueService = fulfillmentQueueService;
    this.fulfillmentWorker = fulfillmentWorker;
  }

  public async createOrder(
    input: CreateOrderRequest,
    context: CreateOrderContext,
  ): Promise<{ order: OrderDetailsDto; isIdempotentReplay: boolean }> {
    const requestHash = this.idempotencyService.computeHash(input);

    // 1. Idempotency pre-check
    if (input.idempotencyKey) {
      const existing = await this.idempotencyService.getExistingResponse(
        input.idempotencyKey,
        context.userId,
        requestHash,
      );

      if (existing.exists && existing.body) {
        return {
          order: existing.body as OrderDetailsDto,
          isIdempotentReplay: true,
        };
      }
    }

    // 2. Resolve Product & Authoritative Pricing from Server Catalog
    const product = await this.catalogService.getProductById(input.productId);

    // 2a. Check individual user custom pricing override first
    let pricePesewas: number | null = null;
    if (context.userId) {
      try {
        const userPriceRes = await this.db.query(
          `SELECT custom_price_pesewas FROM user_pricing WHERE user_id = $1 AND product_id = $2 AND is_active = TRUE`,
          [context.userId, product.id],
        );
        if (userPriceRes?.rows?.length > 0 && userPriceRes.rows[0]?.custom_price_pesewas) {
          pricePesewas = parseInt(userPriceRes.rows[0].custom_price_pesewas, 10);
        }
      } catch {
        // ignore fallback to role/base price
      }
    }

    // 2b. If no user override and actor is AGENT, check agent_pricing table override
    if (pricePesewas === null && context.actorType === 'AGENT' && context.agentId) {
      try {
        const agentPriceRes = await this.db.query(
          `SELECT custom_price_pesewas FROM agent_pricing WHERE agent_id = $1 AND product_id = $2 AND is_active = TRUE`,
          [context.agentId, product.id],
        );
        if (agentPriceRes?.rows?.length > 0 && agentPriceRes.rows[0]?.custom_price_pesewas) {
          pricePesewas = parseInt(agentPriceRes.rows[0].custom_price_pesewas, 10);
        }
      } catch {
        // ignore fallback to role/base price
      }
    }

    // 2c. Fallback to catalog role default
    if (pricePesewas === null) {
      pricePesewas =
        context.actorType === 'AGENT' && product.agentPricePesewas
          ? product.agentPricePesewas
          : product.basePricePesewas;
    }

    const publicId = `ord_${crypto.randomBytes(12).toString('hex')}`;
    const cleanPhone = input.recipientPhone.trim().replace(/\s+/g, '');

    const pricingSnapshot: OrderPricingSnapshot = {
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      network: product.network,
      dataAmountMb: product.dataAmountMb,
      unitPricePesewas: pricePesewas,
      currency: Currency.GHS,
      snapshotTimestamp: new Date().toISOString(),
    };

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const isWalletPayment =
        input.paymentMethod === PaymentMethod.WALLET ||
        input.paymentMethod === 'WALLET' ||
        input.paymentMethod === 'wallet';

      const initialPaymentStatus = isWalletPayment ? PaymentStatus.PAID : PaymentStatus.PENDING;
      const initialOrderStatus = isWalletPayment
        ? OrderStatus.READY_FOR_FULFILLMENT
        : OrderStatus.CREATED;

      if (isWalletPayment) {
        const userRes = await client.query(
          `SELECT wallet_balance_pesewas, wallet_balance FROM users WHERE id = $1 FOR UPDATE`,
          [context.userId],
        );

        let currentBalancePesewas = 0;
        if (userRes.rows.length > 0) {
          const rawRow = userRes.rows[0];
          if (rawRow.wallet_balance_pesewas !== null && rawRow.wallet_balance_pesewas !== undefined) {
            currentBalancePesewas = parseInt(String(rawRow.wallet_balance_pesewas), 10);
          } else if (rawRow.wallet_balance !== null && rawRow.wallet_balance !== undefined) {
            currentBalancePesewas = Math.round(parseFloat(rawRow.wallet_balance) * 100);
          }
        }

        if (currentBalancePesewas < pricePesewas) {
          throw new BadRequestError(
            `Insufficient wallet balance. Required: GH₵ ${(pricePesewas / 100).toFixed(2)}, Available: GH₵ ${(currentBalancePesewas / 100).toFixed(2)}. Please top up your wallet.`,
          );
        }

        await client.query(
          `UPDATE users
           SET wallet_balance_pesewas = GREATEST(0, COALESCE(wallet_balance_pesewas, 0) - $1),
               wallet_balance = GREATEST(0, ROUND((COALESCE(wallet_balance_pesewas, 0) - $1) / 100.0, 2)),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [pricePesewas, context.userId],
        );
      }

      // 3. Insert Order
      const insertOrderQuery = `
        INSERT INTO orders (
          public_id, user_id, agent_id, product_id, recipient_phone,
          network, data_amount_mb, amount_pesewas, currency,
          pricing_snapshot, payment_status, order_status, provider_status,
          refund_status, idempotency_key
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id, public_id as "publicId", user_id as "userId", agent_id as "agentId",
                  product_id as "productId", recipient_phone as "recipientPhone",
                  network, data_amount_mb as "dataAmountMb", amount_pesewas as "amountPesewas",
                  currency, pricing_snapshot as "pricingSnapshot", payment_status as "paymentStatus",
                  order_status as "orderStatus", provider_status as "providerStatus",
                  refund_status as "refundStatus", created_at as "createdAt", updated_at as "updatedAt"
      `;

      const orderRes = await client.query(insertOrderQuery, [
        publicId,
        context.userId,
        context.agentId || null,
        product.id,
        cleanPhone,
        product.network,
        product.dataAmountMb,
        pricePesewas,
        Currency.GHS,
        JSON.stringify(pricingSnapshot),
        initialPaymentStatus,
        initialOrderStatus,
        ProviderStatus.UNKNOWN,
        RefundStatus.NONE,
        input.idempotencyKey || null,
      ]);

      const orderRow = orderRes.rows[0];

      // 4. Insert Order Item
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price_pesewas, total_pesewas)
         VALUES ($1, $2, 1, $3, $3)`,
        [orderRow.id, product.id, pricePesewas],
      );

      // 5. Insert Initial Provider Order Projection (Database is authoritative single source of truth)
      const provInsertRes = await client.query(
        `INSERT INTO provider_orders (order_id, provider_name, provider_status)
         VALUES (
           $1,
           COALESCE(
             (SELECT name FROM telecom_providers WHERE is_authoritative = TRUE LIMIT 1),
             (SELECT name FROM telecom_providers ORDER BY created_at ASC LIMIT 1),
             'Portal-02'
           ),
           'UNKNOWN'
         )
         RETURNING provider_name as "providerName"`,
        [orderRow.id],
      ).catch(() => ({ rows: [{ providerName: 'Portal-02' }] }));
      const authoritativeProviderName = provInsertRes?.rows?.[0]?.providerName || 'Portal-02';

      // 6. Insert Order Event
      const eventRes = await client.query(
        `INSERT INTO order_events (order_id, event_type, correlation_id, actor_id, actor_type, source, new_state)
         VALUES ($1, $2, $3, $4, $5, 'API', $6)
         RETURNING id, event_type as "eventType", correlation_id as "correlationId",
                   actor_id as "actorId", actor_type as "actorType",
                   previous_state as "previousState", new_state as "newState",
                   metadata, occurred_at as "occurredAt"`,
        [
          orderRow.id,
          OrderEventType.ORDER_CREATED,
          context.correlationId,
          context.userId,
          context.actorType,
          JSON.stringify({
            orderStatus: initialOrderStatus,
            paymentStatus: initialPaymentStatus,
          }),
        ],
      );

      const events: any[] = [];
      if (eventRes?.rows && eventRes.rows.length > 0) {
        events.push({
          id: eventRes.rows[0].id,
          eventType: eventRes.rows[0].eventType as OrderEventType,
          correlationId: eventRes.rows[0].correlationId,
          actorId: eventRes.rows[0].actorId,
          actorType: eventRes.rows[0].actorType,
          previousState: null,
          newState: eventRes.rows[0].newState,
          metadata: eventRes.rows[0].metadata,
          occurredAt: new Date(eventRes.rows[0].occurredAt).toISOString(),
        });
      }

      // If wallet payment, record payment and payment events
      if (isWalletPayment) {
        const paymentPublicId = `pay_${crypto.randomBytes(8).toString('hex')}`;
        let paymentRecord: any;
        try {
          const paymentRes = await client.query(
            `INSERT INTO payments (
                public_id, order_id, user_id, amount_pesewas, currency,
                provider, provider_reference, payment_method, status, paid_at
             ) VALUES ($1, $2, $3, $4, $5, 'WALLET', $6, 'WALLET', $7, CURRENT_TIMESTAMP)
             RETURNING id, public_id as "publicId", created_at as "createdAt"`,
            [
              paymentPublicId,
              orderRow.id,
              context.userId,
              pricePesewas,
              Currency.GHS,
              `pst_wal_${orderRow.publicId}`,
              PaymentStatus.PAID,
            ],
          );
          paymentRecord = paymentRes.rows?.[0];
        } catch {
          // Fallback if public_id is not yet migrated in payments
          const paymentRes = await client.query(
            `INSERT INTO payments (
                order_id, user_id, amount_pesewas, currency,
                provider, provider_reference, payment_method, status, paid_at
             ) VALUES ($1, $2, $3, $4, 'WALLET', $5, 'WALLET', $6, CURRENT_TIMESTAMP)
             RETURNING id, created_at as "createdAt"`,
            [
              orderRow.id,
              context.userId,
              pricePesewas,
              Currency.GHS,
              `pst_wal_${orderRow.publicId}`,
              PaymentStatus.PAID,
            ],
          );
          paymentRecord = paymentRes.rows?.[0];
        }

        if (paymentRecord?.id) {
          await client.query(
            `INSERT INTO payment_attempts (payment_id, attempt_number, provider_channel, status)
             VALUES ($1, 1, 'WALLET', 'SUCCESS')`,
            [paymentRecord.id],
          ).catch(() => {});

          await client.query(
            `INSERT INTO payment_events (payment_id, provider, event_type, correlation_id, source, previous_status, new_status, metadata)
             VALUES ($1, 'WALLET', $2, $3, 'API', NULL, $4, $5)`,
            [
              paymentRecord.id,
              PaymentEventType.PAYMENT_CAPTURED,
              context.correlationId,
              PaymentStatus.PAID,
              JSON.stringify({ paymentMethod: 'WALLET', amountPesewas: pricePesewas }),
            ],
          ).catch(() => {});
        }

        const payConfirmRes = await client.query(
          `INSERT INTO order_events (order_id, event_type, correlation_id, actor_id, actor_type, source, previous_state, new_state)
           VALUES ($1, $2, $3, $4, 'SYSTEM', 'WALLET_ENGINE', $5, $6)
           RETURNING id, event_type as "eventType", correlation_id as "correlationId",
                     actor_id as "actorId", actor_type as "actorType",
                     previous_state as "previousState", new_state as "newState",
                     metadata, occurred_at as "occurredAt"`,
          [
            orderRow.id,
            OrderEventType.PAYMENT_CONFIRMED,
            context.correlationId,
            context.userId,
            JSON.stringify({ paymentStatus: PaymentStatus.PENDING }),
            JSON.stringify({
              paymentStatus: PaymentStatus.PAID,
              orderStatus: OrderStatus.READY_FOR_FULFILLMENT,
            }),
          ],
        );

        if (payConfirmRes.rows.length > 0) {
          events.push({
            id: payConfirmRes.rows[0].id,
            eventType: payConfirmRes.rows[0].eventType as OrderEventType,
            correlationId: payConfirmRes.rows[0].correlationId,
            actorId: payConfirmRes.rows[0].actorId,
            actorType: payConfirmRes.rows[0].actorType,
            previousState: payConfirmRes.rows[0].previousState,
            newState: payConfirmRes.rows[0].newState,
            metadata: payConfirmRes.rows[0].metadata,
            occurredAt: new Date(payConfirmRes.rows[0].occurredAt).toISOString(),
          });
        }

        const platformSystemAccountId = '00000000-0000-0000-0000-000000000000';

        await this.ledgerService.recordJournalEntries(client, [
          {
            entryType: LedgerEntryType.DEBIT,
            accountType: LedgerAccountType.CUSTOMER_WALLET,
            accountId: context.userId,
            amountPesewas: pricePesewas,
            currency: Currency.GHS,
            referenceType: 'ORDER',
            referenceId: orderRow.id,
            description: `Wallet payment for Order ${orderRow.publicId}`,
          },
          {
            entryType: LedgerEntryType.CREDIT,
            accountType: LedgerAccountType.PLATFORM_ESCROW,
            accountId: platformSystemAccountId,
            amountPesewas: pricePesewas,
            currency: Currency.GHS,
            referenceType: 'ORDER',
            referenceId: orderRow.id,
            description: `Platform escrow credited for Order ${orderRow.publicId}`,
          },
        ]).catch((ledgerErr) => {
          logger.warn({ err: ledgerErr?.message, orderId: orderRow.id }, 'Ledger entry recording notice');
        });
      }

      const orderDetails: OrderDetailsDto = {
        id: orderRow.id,
        publicId: orderRow.publicId,
        userId: orderRow.userId,
        agentId: orderRow.agentId,
        recipientPhone: orderRow.recipientPhone,
        network: orderRow.network as NetworkProvider,
        dataAmountMb: orderRow.dataAmountMb,
        amountPesewas: parseInt(orderRow.amountPesewas, 10),
        currency: orderRow.currency as Currency,
        paymentStatus: orderRow.paymentStatus as PaymentStatus,
        orderStatus: orderRow.orderStatus as OrderStatus,
        providerStatus: orderRow.providerStatus as ProviderStatus,
        refundStatus: orderRow.refundStatus as RefundStatus,
        pricingSnapshot,
        providerOrder: {
          providerName: authoritativeProviderName,
          providerReference: null,
          providerStatus: ProviderStatus.UNKNOWN,
          lastSyncedAt: null,
          lastProviderEventAt: null,
          syncVersion: 0,
        },
        events,
        createdAt: new Date(orderRow.createdAt).toISOString(),
        updatedAt: new Date(orderRow.updatedAt).toISOString(),
      };

      // 7. Save Idempotency Record atomically inside the same transaction
      if (input.idempotencyKey) {
        await this.idempotencyService.saveResponse(client, {
          key: input.idempotencyKey,
          userId: context.userId,
          endpoint: '/api/v1/orders',
          requestHash,
          responseStatus: 202,
          responseBody: orderDetails,
        });
      }

      await client.query('COMMIT');

      // 8. Trigger Background Telecom Fulfillment if Paid via Wallet
      if (isWalletPayment) {
        logger.info(
          { orderId: orderRow.id, correlationId: context.correlationId, hasFQS: !!this.fulfillmentQueueService, hasFW: !!this.fulfillmentWorker },
          '[ORDER_SERVICE] Wallet payment confirmed — dispatching to fulfillment pipeline',
        );
        if (this.fulfillmentQueueService) {
          this.fulfillmentQueueService
            .enqueueOrderFulfillment({
              orderId: orderRow.id,
              correlationId: context.correlationId,
              idempotencyKey: `pst_wal_sub_${orderRow.id}`,
              attemptCount: 1,
              network: product.network,
              phoneNumber: cleanPhone,
              bundleId: product.id,
              dataAmountMb: product.dataAmountMb,
            })
            .catch((err) => {
              logger.warn(
                { orderId: orderRow.id, err: err?.message },
                'Failed to enqueue order fulfillment job on wallet payment',
              );
            });
        }
        if (this.fulfillmentWorker) {
          logger.info({ orderId: orderRow.id }, '[ORDER_SERVICE] Calling FulfillmentWorker.processOrderFulfillment directly');
          setImmediate(() => {
            this.fulfillmentWorker!
              .processOrderFulfillment(orderRow.id, context.correlationId)
              .then((result) => {
                logger.info(
                  { orderId: orderRow.id, result },
                  '[ORDER_SERVICE] FulfillmentWorker.processOrderFulfillment completed',
                );
              })
              .catch((err) => {
                logger.error(
                  { orderId: orderRow.id, err: err?.message, stack: err?.stack },
                  '[ORDER_SERVICE] FulfillmentWorker.processOrderFulfillment FAILED',
                );
              });
          });
        } else {
          logger.warn({ orderId: orderRow.id }, '[ORDER_SERVICE] No FulfillmentWorker available — order will stay READY_FOR_FULFILLMENT');
        }
      }

      return {
        order: orderDetails,
        isIdempotentReplay: false,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async getOrderById(
    orderIdOrPublicId: string,
    userId: string,
    isAdmin = false,
  ): Promise<OrderDetailsDto> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      orderIdOrPublicId,
    );

    const query = `
      SELECT o.id, o.public_id as "publicId", o.user_id as "userId", o.agent_id as "agentId",
             o.recipient_phone as "recipientPhone", o.network, o.data_amount_mb as "dataAmountMb",
             o.amount_pesewas as "amountPesewas", o.currency, o.pricing_snapshot as "pricingSnapshot",
             o.payment_status as "paymentStatus", o.order_status as "orderStatus",
             o.provider_status as "providerStatus", o.refund_status as "refundStatus",
             o.created_at as "createdAt", o.updated_at as "updatedAt",
             po.provider_name as "poProviderName", po.provider_reference as "poProviderReference",
             po.provider_status as "poProviderStatus", po.last_synced_at as "poLastSyncedAt",
             po.last_provider_event_at as "poLastProviderEventAt", po.sync_version as "poSyncVersion"
      FROM orders o
      LEFT JOIN provider_orders po ON o.id = po.order_id
      WHERE ${isUuid ? 'o.id = $1' : 'o.public_id = $1'}
    `;

    const result = await this.db.query(query, [orderIdOrPublicId]);
    if (result.rows.length === 0) {
      throw new NotFoundError(`Order '${orderIdOrPublicId}' not found`);
    }

    let row = result.rows[0];

    // Strict Cross-Tenant Authorization Check
    if (!isAdmin && row.userId !== userId) {
      throw new ForbiddenError('You are not authorized to access this order record');
    }

    // 1. Self-Healing: If order is PAID & READY_FOR_FULFILLMENT, trigger background fulfillment
    if (row.orderStatus === OrderStatus.READY_FOR_FULFILLMENT && this.fulfillmentWorker) {
      setImmediate(() => {
        this.fulfillmentWorker!.processOrderFulfillment(row.id, `lookup_self_heal_${Date.now()}`).catch(() => {});
      });
    }

    // 2. Live Provider Reconciliation: If submitted/processing and has provider reference, check live provider status
    if (
      (row.orderStatus === OrderStatus.SUBMITTED || row.orderStatus === OrderStatus.PROCESSING) &&
      row.poProviderReference &&
      this.fulfillmentWorker
    ) {
      const isStale = !row.poLastSyncedAt || Date.now() - new Date(row.poLastSyncedAt).getTime() > 10000;
      if (isStale) {
        try {
          const provider = (this.fulfillmentWorker as any).provider;
          if (provider && typeof provider.getOrderStatus === 'function') {
            const liveStatus = await provider.getOrderStatus({
              providerReference: row.poProviderReference,
              orderId: row.id,
            });
            if (liveStatus && liveStatus.providerStatus && liveStatus.providerStatus !== ProviderStatus.UNKNOWN) {
              const isCompleted = liveStatus.providerStatus === ProviderStatus.COMPLETED;
              const isFailed =
                liveStatus.providerStatus === ProviderStatus.FAILED ||
                liveStatus.providerStatus === ProviderStatus.REJECTED;
              const newOrderStatus = isCompleted
                ? OrderStatus.COMPLETED
                : isFailed
                ? OrderStatus.FAILED
                : OrderStatus.PROCESSING;

              await this.db.query(
                `UPDATE provider_orders
                 SET provider_status = $1, last_synced_at = CURRENT_TIMESTAMP, sync_version = sync_version + 1
                 WHERE order_id = $2`,
                [liveStatus.providerStatus, row.id],
              );
              await this.db.query(
                `UPDATE orders
                 SET order_status = $1, provider_status = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [newOrderStatus, liveStatus.providerStatus, row.id],
              );
              row.orderStatus = newOrderStatus;
              row.providerStatus = liveStatus.providerStatus;
              row.poProviderStatus = liveStatus.providerStatus;
              row.poLastSyncedAt = new Date();
            }
          }
        } catch (err: any) {
          logger.debug({ orderId: row.id, err: err?.message }, 'Order lookup status reconciliation notice');
        }
      }
    }

    // Fetch Events History
    const eventsQuery = `
      SELECT id, event_type as "eventType", correlation_id as "correlationId",
             actor_id as "actorId", actor_type as "actorType",
             previous_state as "previousState", new_state as "newState",
             metadata, occurred_at as "occurredAt"
      FROM order_events
      WHERE order_id = $1
      ORDER BY occurred_at ASC
    `;
    const eventsRes = await this.db.query(eventsQuery, [row.id]);

    return {
      id: row.id,
      publicId: row.publicId,
      userId: row.userId,
      agentId: row.agentId,
      recipientPhone: row.recipientPhone,
      network: row.network as NetworkProvider,
      dataAmountMb: row.dataAmountMb,
      amountPesewas: parseInt(row.amountPesewas, 10),
      currency: row.currency as Currency,
      paymentStatus: row.paymentStatus as PaymentStatus,
      orderStatus: row.orderStatus as OrderStatus,
      providerStatus: row.providerStatus as ProviderStatus,
      refundStatus: row.refundStatus as RefundStatus,
      pricingSnapshot: row.pricingSnapshot,
      providerOrder: row.poProviderName
        ? {
            providerName: row.poProviderName,
            providerReference: row.poProviderReference,
            providerStatus: row.poProviderStatus as ProviderStatus,
            lastSyncedAt: row.poLastSyncedAt ? new Date(row.poLastSyncedAt).toISOString() : null,
            lastProviderEventAt: row.poLastProviderEventAt
              ? new Date(row.poLastProviderEventAt).toISOString()
              : null,
            syncVersion: row.poSyncVersion || 0,
          }
        : null,
      events: eventsRes.rows.map((e) => ({
        id: e.id,
        eventType: e.eventType as OrderEventType,
        correlationId: e.correlationId,
        actorId: e.actorId,
        actorType: e.actorType,
        previousState: e.previousState,
        newState: e.newState,
        metadata: e.metadata,
        occurredAt: new Date(e.occurredAt).toISOString(),
      })),
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  public async getPublicOrder(reference: string): Promise<CustomerOrderDto | null> {
    const cleanRef = (reference || '').trim();
    if (!cleanRef) return null;

    let altPhone = cleanRef;
    if (cleanRef.startsWith('0') && cleanRef.length === 10) {
      altPhone = `233${cleanRef.slice(1)}`;
    } else if (cleanRef.startsWith('233') && cleanRef.length === 12) {
      altPhone = `0${cleanRef.slice(3)}`;
    } else if (cleanRef.startsWith('+233') && cleanRef.length === 13) {
      altPhone = `0${cleanRef.slice(4)}`;
    }

    const res = await this.db.query(
      `SELECT o.id, o.public_id as "publicId", o.recipient_phone as "recipientPhone", o.network,
              o.data_amount_mb as "dataAmountMb", o.amount_pesewas as "amountPesewas", o.currency,
              o.payment_status as "paymentStatus", o.order_status as "orderStatus",
              o.pricing_snapshot as "pricingSnapshot",
              o.created_at as "createdAt", o.updated_at as "updatedAt",
              po.provider_reference as "poProviderReference", po.provider_status as "poProviderStatus",
              po.last_synced_at as "poLastSyncedAt"
       FROM orders o
       LEFT JOIN provider_orders po ON o.id = po.order_id
       WHERE LOWER(o.public_id) = LOWER($1)
          OR o.id::text = $1
          OR LOWER(o.id::text) = LOWER($1)
          OR o.recipient_phone = $1
          OR o.recipient_phone = $2
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [cleanRef, altPhone],
    );

    if (res.rows.length === 0) {
      return null;
    }

    let row = res.rows[0];

    // 1. Self-Healing: If order is PAID & READY_FOR_FULFILLMENT, trigger background fulfillment
    if (row.orderStatus === OrderStatus.READY_FOR_FULFILLMENT && this.fulfillmentWorker) {
      setImmediate(() => {
        this.fulfillmentWorker!.processOrderFulfillment(row.id, `track_self_heal_${Date.now()}`).catch(() => {});
      });
    }

    // 2. Live Provider Reconciliation
    if (
      (row.orderStatus === OrderStatus.SUBMITTED || row.orderStatus === OrderStatus.PROCESSING) &&
      row.poProviderReference &&
      this.fulfillmentWorker
    ) {
      const isStale = !row.poLastSyncedAt || Date.now() - new Date(row.poLastSyncedAt).getTime() > 10000;
      if (isStale) {
        try {
          const provider = (this.fulfillmentWorker as any).provider;
          if (provider && typeof provider.getOrderStatus === 'function') {
            const liveStatus = await provider.getOrderStatus({
              providerReference: row.poProviderReference,
              orderId: row.id,
            });
            if (liveStatus && liveStatus.providerStatus && liveStatus.providerStatus !== ProviderStatus.UNKNOWN) {
              const isCompleted = liveStatus.providerStatus === ProviderStatus.COMPLETED;
              const isFailed =
                liveStatus.providerStatus === ProviderStatus.FAILED ||
                liveStatus.providerStatus === ProviderStatus.REJECTED;
              const newOrderStatus = isCompleted
                ? OrderStatus.COMPLETED
                : isFailed
                ? OrderStatus.FAILED
                : OrderStatus.PROCESSING;

              await this.db.query(
                `UPDATE provider_orders
                 SET provider_status = $1, last_synced_at = CURRENT_TIMESTAMP, sync_version = sync_version + 1
                 WHERE order_id = $2`,
                [liveStatus.providerStatus, row.id],
              );
              await this.db.query(
                `UPDATE orders
                 SET order_status = $1, provider_status = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [newOrderStatus, liveStatus.providerStatus, row.id],
              );
              row.orderStatus = newOrderStatus;
              row.providerStatus = liveStatus.providerStatus;
            }
          }
        } catch (err: any) {
          logger.debug({ orderId: row.id, err: err?.message }, 'Track order status reconciliation notice');
        }
      }
    }

    const { status, statusLabel } = toCustomerFacingStatus(
      row.orderStatus as OrderStatus,
      row.paymentStatus as PaymentStatus,
    );

    const dataAmountMb = parseInt(row.dataAmountMb, 10) || 0;
    const dataDisplay = `${(dataAmountMb / 1024).toFixed(dataAmountMb % 1024 === 0 ? 0 : 1)} GB`;
    const amountPesewas = parseInt(row.amountPesewas, 10) || 0;
    const amountDisplay = `GH₵ ${(amountPesewas / 100).toFixed(2)}`;

    return {
      orderId: row.publicId || row.id,
      id: row.id,
      publicId: row.publicId,
      status,
      statusLabel,
      orderStatus: row.orderStatus,
      paymentStatus: row.paymentStatus === PaymentStatus.PAID ? 'PAID' : row.paymentStatus === PaymentStatus.PROCESSING ? 'PROCESSING' : row.paymentStatus === PaymentStatus.FAILED ? 'FAILED' : row.paymentStatus === PaymentStatus.REFUNDED ? 'REFUNDED' : 'PENDING',
      network: row.network as NetworkProvider,
      dataAmountMb,
      dataDisplay,
      product: {
        name: `${row.network} ${dataDisplay} Data Bundle`,
        network: row.network as NetworkProvider,
        volumeDisplay: dataDisplay,
        validityDisplay: '30 Days',
      },
      recipientPhone: row.recipientPhone,
      amountPesewas,
      amountDisplay,
      currency: row.currency as Currency,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      completedAt: row.orderStatus === OrderStatus.COMPLETED ? new Date(row.updatedAt).toISOString() : null,
    } as CustomerOrderDto;
  }


  public async listOrders(
    userId: string,
    isAdmin = false,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<OrderSummaryDto>> {
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, public_id as "publicId", user_id as "userId", agent_id as "agentId",
             recipient_phone as "recipientPhone", network, data_amount_mb as "dataAmountMb",
             amount_pesewas as "amountPesewas", currency,
             payment_status as "paymentStatus", order_status as "orderStatus",
             provider_status as "providerStatus", refund_status as "refundStatus",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM orders
    `;
    const params: unknown[] = [];

    if (!isAdmin) {
      query += ' WHERE user_id = $1';
      params.push(userId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    const countQuery = isAdmin
      ? 'SELECT COUNT(*) as total FROM orders'
      : 'SELECT COUNT(*) as total FROM orders WHERE user_id = $1';
    const countParams = isAdmin ? [] : [userId];
    const countRes = await this.db.query<{ total: string }>(countQuery, countParams);
    const total = parseInt(countRes.rows[0].total, 10) || 0;

    return {
      items: result.rows.map((r) => ({
        id: r.id,
        publicId: r.publicId,
        userId: r.userId,
        agentId: r.agentId,
        recipientPhone: r.recipientPhone,
        network: r.network as NetworkProvider,
        dataAmountMb: r.dataAmountMb,
        amountPesewas: parseInt(r.amountPesewas, 10),
        currency: r.currency as Currency,
        paymentStatus: r.paymentStatus as PaymentStatus,
        orderStatus: r.orderStatus as OrderStatus,
        providerStatus: r.providerStatus as ProviderStatus,
        refundStatus: r.refundStatus as RefundStatus,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString(),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public async cancelOrder(
    orderId: string,
    userId: string,
    correlationId: string,
    isAdmin = false,
  ): Promise<OrderDetailsDto> {
    const order = await this.getOrderById(orderId, userId, isAdmin);

    // Validate Transition via State Machine
    OrderStateMachine.validateTransition(order.orderStatus, OrderStatus.CANCELLED);

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [OrderStatus.CANCELLED, order.id],
      );

      await client.query(
        `INSERT INTO order_events (order_id, event_type, correlation_id, actor_id, actor_type, source, previous_state, new_state)
         VALUES ($1, $2, $3, $4, $5, 'API', $6, $7)`,
        [
          order.id,
          OrderEventType.ORDER_CANCELLED,
          correlationId,
          userId,
          isAdmin ? 'ADMIN' : 'CUSTOMER',
          JSON.stringify({ orderStatus: order.orderStatus }),
          JSON.stringify({ orderStatus: OrderStatus.CANCELLED }),
        ],
      );

      await client.query('COMMIT');

      return await this.getOrderById(order.id, userId, isAdmin);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Lists an agent's data orders (newest first) with per-order delivery tally.
   * Excludes WAEC checker orders. The list omits the recipient array.
   */
  public async listAgentOrders(params: {
    agentOrUserId: string;
    status?: string;
    network?: string;
    paymentStatus?: string;
    after?: string;
    before?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<AgentOrdersListData> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 30));
    const offset = (page - 1) * limit;

    // Resolve agent and user ID
    let agentId = params.agentOrUserId;
    let userId = params.agentOrUserId;
    try {
      const agentRes = await this.db.query(
        'SELECT id, user_id as "userId" FROM agents WHERE id = $1 OR user_id = $1',
        [params.agentOrUserId],
      );
      if (agentRes.rows.length > 0) {
        agentId = agentRes.rows[0].id;
        userId = agentRes.rows[0].userId;
      }
    } catch {
      // Continue with provided ID
    }

    const conditions: string[] = ['(o.agent_id = $1 OR o.user_id = $2)'];
    const queryParams: any[] = [agentId, userId];
    let paramIdx = 3;

    // Filter by network
    if (params.network && params.network.toUpperCase() !== 'ALL') {
      conditions.push(`o.network = $${paramIdx}`);
      queryParams.push(params.network.toUpperCase());
      paramIdx++;
    }

    // Filter by status
    if (params.status && params.status.toLowerCase() !== 'all') {
      const st = params.status.toLowerCase();
      if (st === 'approved' || st === 'fulfilled' || st === 'completed') {
        conditions.push(`(o.order_status = 'COMPLETED' OR o.provider_status = 'COMPLETED')`);
      } else if (st === 'received' || st === 'created' || st === 'submitted') {
        conditions.push(`(o.order_status IN ('CREATED', 'SUBMITTED', 'READY_FOR_FULFILLMENT') OR o.provider_status IN ('UNKNOWN', 'RECEIVED'))`);
      } else if (st === 'processing') {
        conditions.push(`(o.order_status = 'PROCESSING' OR o.provider_status = 'PROCESSING')`);
      } else if (st === 'rejected' || st === 'fulfillment_failed' || st === 'failed' || st === 'cancelled') {
        conditions.push(`(o.order_status IN ('FAILED', 'CANCELLED') OR o.provider_status IN ('FAILED', 'REJECTED'))`);
      } else {
        conditions.push(`(o.order_status ILIKE $${paramIdx} OR o.provider_status ILIKE $${paramIdx})`);
        queryParams.push(st);
        paramIdx++;
      }
    }

    // Filter by paymentStatus
    if (params.paymentStatus && params.paymentStatus.toLowerCase() !== 'all') {
      conditions.push(`o.payment_status ILIKE $${paramIdx}`);
      queryParams.push(params.paymentStatus);
      paramIdx++;
    }

    // Filter by date bounds
    if (params.after) {
      conditions.push(`o.created_at >= $${paramIdx}`);
      queryParams.push(new Date(params.after));
      paramIdx++;
    }
    if (params.before) {
      conditions.push(`o.created_at <= $${paramIdx}`);
      queryParams.push(new Date(params.before));
      paramIdx++;
    }

    // Filter by search (TXN reference or phone in any format)
    if (params.search && params.search.trim()) {
      const s = params.search.trim();
      conditions.push(
        `(o.public_id ILIKE $${paramIdx} OR o.recipient_phone ILIKE $${paramIdx} OR po.provider_reference ILIKE $${paramIdx} OR o.idempotency_key ILIKE $${paramIdx})`,
      );
      queryParams.push(`%${s}%`);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total Count Query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM orders o
      LEFT JOIN provider_orders po ON o.id = po.order_id
      ${whereClause}
    `;
    const countRes = await this.db.query(countQuery, queryParams);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // Select Query
    const selectQuery = `
      SELECT o.id, o.public_id as "publicId", o.recipient_phone as "recipientPhone",
             o.network, o.data_amount_mb as "dataAmountMb", o.amount_pesewas as "amountPesewas",
             o.currency, o.payment_status as "paymentStatus", o.order_status as "orderStatus",
             o.provider_status as "providerStatus", o.created_at as "createdAt", o.updated_at as "updatedAt",
             po.provider_reference as "providerReference", bsi.submission_id as "submissionId"
      FROM orders o
      LEFT JOIN provider_orders po ON o.id = po.order_id
      LEFT JOIN bulk_submission_items bsi ON o.id = bsi.order_id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    const selectParams = [...queryParams, limit, offset];
    const itemsRes = await this.db.query(selectQuery, selectParams);

    const data: AgentOrderListItem[] = itemsRes.rows.map((r: any) => {
      const isApproved = r.orderStatus === 'COMPLETED' || r.providerStatus === 'COMPLETED';
      const isFailed = r.orderStatus === 'FAILED' || r.orderStatus === 'CANCELLED' || r.providerStatus === 'FAILED' || r.providerStatus === 'REJECTED';
      const isPending = !isApproved && !isFailed;

      const mappedStatus = isApproved ? 'approved' : isFailed ? 'rejected' : r.orderStatus === 'PROCESSING' ? 'processing' : 'received';
      const sizeGb = Math.round((r.dataAmountMb || 0) / 1024) || Math.max(1, Number(((r.dataAmountMb || 0) / 1024).toFixed(1)));
      const amountGhs = (parseInt(r.amountPesewas || '0', 10) / 100).toFixed(2);

      return {
        id: r.publicId,
        referenceCode: r.providerReference || r.publicId,
        network: r.network,
        status: mappedStatus,
        paymentStatus: String(r.paymentStatus || 'PENDING').toLowerCase(),
        amount: amountGhs,
        groupSizeGb: sizeGb,
        submissionId: r.submissionId || null,
        createdAt: new Date(r.createdAt).toISOString(),
        approvedAt: isApproved ? new Date(r.updatedAt).toISOString() : null,
        approvedByName: isApproved ? 'Ops Team' : null,
        beneficiaryCount: 1,
        totalDataGb: sizeGb,
        delivery: {
          approved: isApproved ? 1 : 0,
          pending: isPending ? 1 : 0,
          failed: isFailed ? 1 : 0,
          total: 1,
        },
        beneficiaries: [] as never[],
      };
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Looks up one agent order's status and full recipient list by public ID or reference code.
   */
  public async getAgentOrderById(
    orderIdOrPublicId: string,
    agentOrUserId: string,
  ): Promise<AgentOrderDetailData> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      orderIdOrPublicId,
    );

    // Resolve agent and user ID
    let agentId = agentOrUserId;
    let userId = agentOrUserId;
    try {
      const agentRes = await this.db.query(
        'SELECT id, user_id as "userId" FROM agents WHERE id = $1 OR user_id = $1',
        [agentOrUserId],
      );
      if (agentRes.rows.length > 0) {
        agentId = agentRes.rows[0].id;
        userId = agentRes.rows[0].userId;
      }
    } catch {
      // Continue with provided ID
    }

    const query = `
      SELECT o.id, o.public_id as "publicId", o.user_id as "userId", o.agent_id as "agentId",
             o.recipient_phone as "recipientPhone", o.network, o.data_amount_mb as "dataAmountMb",
             o.amount_pesewas as "amountPesewas", o.currency, o.pricing_snapshot as "pricingSnapshot",
             o.payment_status as "paymentStatus", o.order_status as "orderStatus",
             o.provider_status as "providerStatus", o.created_at as "createdAt", o.updated_at as "updatedAt",
             po.provider_reference as "providerReference", bsi.submission_id as "submissionId"
      FROM orders o
      LEFT JOIN provider_orders po ON o.id = po.order_id
      LEFT JOIN bulk_submission_items bsi ON o.id = bsi.order_id
      WHERE (${isUuid ? 'o.id = $1' : 'o.public_id = $1 OR po.provider_reference = $1'})
        AND (o.agent_id = $2 OR o.user_id = $3)
      LIMIT 1
    `;

    const result = await this.db.query(query, [orderIdOrPublicId, agentId, userId]);
    if (result.rows.length === 0) {
      throw new NotFoundError(`Order '${orderIdOrPublicId}' not found for current agent`);
    }

    let r = result.rows[0];

    // 1. Self-Healing: If order is PAID & READY_FOR_FULFILLMENT, trigger background fulfillment
    if (r.orderStatus === OrderStatus.READY_FOR_FULFILLMENT && this.fulfillmentWorker) {
      setImmediate(() => {
        this.fulfillmentWorker!.processOrderFulfillment(r.id, `agent_self_heal_${Date.now()}`).catch(() => {});
      });
    }

    // 2. Live Provider Reconciliation
    if (
      (r.orderStatus === OrderStatus.SUBMITTED || r.orderStatus === OrderStatus.PROCESSING) &&
      r.providerReference &&
      this.fulfillmentWorker
    ) {
      try {
        const provider = (this.fulfillmentWorker as any).provider;
        if (provider && typeof provider.getOrderStatus === 'function') {
          const liveStatus = await provider.getOrderStatus({
            providerReference: r.providerReference,
            orderId: r.id,
          });
          if (liveStatus && liveStatus.providerStatus && liveStatus.providerStatus !== ProviderStatus.UNKNOWN) {
            const isCompleted = liveStatus.providerStatus === ProviderStatus.COMPLETED;
            const isFailed =
              liveStatus.providerStatus === ProviderStatus.FAILED ||
              liveStatus.providerStatus === ProviderStatus.REJECTED;
            const newOrderStatus = isCompleted
              ? OrderStatus.COMPLETED
              : isFailed
              ? OrderStatus.FAILED
              : OrderStatus.PROCESSING;

            await this.db.query(
              `UPDATE provider_orders
               SET provider_status = $1, last_synced_at = CURRENT_TIMESTAMP, sync_version = sync_version + 1
               WHERE order_id = $2`,
              [liveStatus.providerStatus, r.id],
            );
            await this.db.query(
              `UPDATE orders
               SET order_status = $1, provider_status = $2, updated_at = CURRENT_TIMESTAMP
               WHERE id = $3`,
              [newOrderStatus, liveStatus.providerStatus, r.id],
            );
            r.orderStatus = newOrderStatus;
            r.providerStatus = liveStatus.providerStatus;
          }
        }
      } catch (err: any) {
        logger.debug({ orderId: r.id, err: err?.message }, 'Agent order status reconciliation notice');
      }
    }
    const isApproved = r.orderStatus === 'COMPLETED' || r.providerStatus === 'COMPLETED';
    const isFailed = r.orderStatus === 'FAILED' || r.orderStatus === 'CANCELLED' || r.providerStatus === 'FAILED' || r.providerStatus === 'REJECTED';
    const isPending = !isApproved && !isFailed;

    const mappedStatus = isApproved ? 'approved' : isFailed ? 'rejected' : r.orderStatus === 'PROCESSING' ? 'processing' : 'received';
    const sizeGb = Math.round((r.dataAmountMb || 0) / 1024) || Math.max(1, Number(((r.dataAmountMb || 0) / 1024).toFixed(1)));
    const amountGhs = (parseInt(r.amountPesewas || '0', 10) / 100).toFixed(2);

    return {
      id: r.publicId,
      referenceCode: r.providerReference || r.publicId,
      network: r.network,
      status: mappedStatus,
      paymentStatus: String(r.paymentStatus || 'PENDING').toLowerCase(),
      amount: amountGhs,
      groupSizeGb: sizeGb,
      submissionId: r.submissionId || null,
      createdAt: new Date(r.createdAt).toISOString(),
      approvedAt: isApproved ? new Date(r.updatedAt).toISOString() : null,
      approvedByName: isApproved ? 'Ops Team' : null,
      paymentSplit: null,
      beneficiaryCount: 1,
      totalDataGb: sizeGb,
      delivery: {
        approved: isApproved ? 1 : 0,
        pending: isPending ? 1 : 0,
        failed: isFailed ? 1 : 0,
        total: 1,
      },
      beneficiaries: [
        {
          id: `ben_${r.publicId.slice(4)}`,
          phoneNumber: r.recipientPhone,
          dataVolumeGb: Number(sizeGb).toFixed(2),
          amount: amountGhs,
          network: r.network,
          status: mappedStatus,
          isPorted: false,
        },
      ],
    };
  }
}

