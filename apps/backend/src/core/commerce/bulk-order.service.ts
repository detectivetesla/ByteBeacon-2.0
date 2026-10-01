import crypto from 'node:crypto';
import type pg from 'pg';
import * as XLSX from 'xlsx';
import {
  BulkSubmissionStatus,
  OrderStatus,
  CreateBulkSubmissionRequest,
  BulkSubmissionDetailsDto,
  NetworkProvider,
  AgentBulkOrderResult,
  AgentBulkChildOrderDto,
  Currency,
  PaymentMethod,
  LedgerEntryType,
  LedgerAccountType,
} from '@bytebeacon/shared';
import { CatalogService } from './catalog.service.js';
import { IdempotencyService } from './idempotency.service.js';
import { FinancialLedgerService } from '../payments/financial-ledger.service.js';
import { BadRequestError, NotFoundError, ForbiddenError, UnprocessableEntityError, InsufficientBalanceError, BulkNotOnSandboxError } from '../errors/app-error.js';
import { FulfillmentQueueService } from '../providers/fulfillment-queue.service.js';
import { FulfillmentWorker } from '../providers/fulfillment-worker.js';
import { AgentWebhookDispatcherService } from '../webhooks/agent-webhook-dispatcher.service.js';
import { logger } from '../logging/logger.js';

export class BulkOrderService {
  private readonly db: pg.Pool;
  private readonly catalogService: CatalogService;
  private readonly ledgerService: FinancialLedgerService;
  private readonly fulfillmentQueueService?: FulfillmentQueueService;
  private readonly fulfillmentWorker?: FulfillmentWorker;
  private readonly idempotencyService?: IdempotencyService;

  constructor(
    db: pg.Pool,
    catalogService: CatalogService,
    ledgerService?: FinancialLedgerService,
    fulfillmentQueueService?: FulfillmentQueueService,
    fulfillmentWorker?: FulfillmentWorker,
    idempotencyService?: IdempotencyService,
  ) {
    this.db = db;
    this.catalogService = catalogService;
    this.ledgerService = ledgerService ?? new FinancialLedgerService(db);
    this.fulfillmentQueueService = fulfillmentQueueService;
    this.fulfillmentWorker = fulfillmentWorker;
    this.idempotencyService = idempotencyService ?? (db ? new IdempotencyService(db) : undefined);
  }

  public async isOrderProcessingPaused(): Promise<boolean> {
    try {
      const res = await this.db.query(
        `SELECT (
          EXISTS (
            SELECT 1 FROM emergency_system_controls
            WHERE control_key IN ('PAUSE_ORDER_OPERATIONS', 'KILL_SWITCH_TELECOM_DISPATCH')
              AND is_enabled = true
          )
          OR EXISTS (
            SELECT 1 FROM platform_feature_flags
            WHERE flag_key = 'PAUSE_ORDER_OPERATIONS' AND is_enabled = true
          )
        ) AS is_active`
      );
      return Boolean(res.rows[0]?.is_active);
    } catch {
      return false;
    }
  }

  public async isTotalOrderLockdownActive(): Promise<boolean> {
    try {
      const res = await this.db.query(
        `SELECT (
          EXISTS (
            SELECT 1 FROM emergency_system_controls
            WHERE control_key = 'TOTAL_ORDER_LOCKDOWN'
              AND is_enabled = true
          )
          OR EXISTS (
            SELECT 1 FROM platform_feature_flags
            WHERE flag_key = 'TOTAL_ORDER_LOCKDOWN' AND is_enabled = true
          )
        ) AS is_active`
      );
      return Boolean(res.rows[0]?.is_active);
    } catch {
      return false;
    }
  }

  public async createBulkSubmission(
    input: CreateBulkSubmissionRequest,
    userId: string,
  ): Promise<BulkSubmissionDetailsDto> {
    const isTotalLockdown = await this.isTotalOrderLockdownActive();
    if (isTotalLockdown) {
      throw new BadRequestError(
        'Bulk order submissions and spreadsheet uploads are completely paused under total platform lockdown.',
      );
    }

    if (!input.name || !input.items || !Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestError('Bulk submission name and a non-empty items array are required');
    }

    if (input.items.length > 5000) {
      throw new BadRequestError('Bulk submission exceeds maximum batch limit of 5,000 items per request');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // ─── Self-healing DDL: each statement gets its own SAVEPOINT so a single
      //     failure does NOT abort the entire transaction (PostgreSQL behaviour).
      const safeDDL = async (label: string, sql: string) => {
        try {
          await client.query(`SAVEPOINT ${label}`);
          await client.query(sql);
          await client.query(`RELEASE SAVEPOINT ${label}`);
        } catch (ddlErr: any) {
          await client.query(`ROLLBACK TO SAVEPOINT ${label}`).catch(() => {});
          logger.warn({ err: ddlErr?.message, label }, '[BULK_ORDER_SERVICE] DDL self-heal skipped');
        }
      };

      // 1. Ensure bulk_submissions table exists
      await safeDDL('ddl_bs_create', `
        CREATE TABLE IF NOT EXISTS bulk_submissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL DEFAULT 'Bulk Order',
          total_count INT NOT NULL DEFAULT 0,
          processed_count INT NOT NULL DEFAULT 0,
          success_count INT NOT NULL DEFAULT 0,
          failed_count INT NOT NULL DEFAULT 0,
          total_amount_pesewas BIGINT NOT NULL DEFAULT 0,
          status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
          idempotency_key VARCHAR(255),
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 2. Rename legacy columns if present
      await safeDDL('ddl_bs_rename', `
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bulk_submissions' AND column_name = 'title')
             AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bulk_submissions' AND column_name = 'name') THEN
              ALTER TABLE bulk_submissions RENAME COLUMN title TO name;
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bulk_submissions' AND column_name = 'batch_name')
             AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bulk_submissions' AND column_name = 'name') THEN
              ALTER TABLE bulk_submissions RENAME COLUMN batch_name TO name;
          END IF;
        END $$
      `);

      // 3. Ensure all bulk_submissions columns exist
      await safeDDL('ddl_bs_cols', `
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT 'Bulk Order';
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS total_count INT NOT NULL DEFAULT 0;
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS processed_count INT NOT NULL DEFAULT 0;
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS success_count INT NOT NULL DEFAULT 0;
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS failed_count INT NOT NULL DEFAULT 0;
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS total_amount_pesewas BIGINT NOT NULL DEFAULT 0;
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'PENDING';
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      `);

      // 4. Ensure orders table pause-tracking and idempotent columns exist
      await safeDDL('ddl_ord_cols', `
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS paused_from_status VARCHAR(50);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS failure_reason TEXT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS public_id VARCHAR(100);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255)
      `);

      // 5. Ensure bulk_submission_items table exists
      await safeDDL('ddl_bsi_create', `
        CREATE TABLE IF NOT EXISTS bulk_submission_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          submission_id UUID NOT NULL,
          order_id UUID,
          recipient_phone VARCHAR(30) NOT NULL DEFAULT '',
          product_id UUID,
          amount_pesewas BIGINT NOT NULL DEFAULT 0,
          status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
          error_message TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 6. Ensure bulk_submission_items columns exist
      await safeDDL('ddl_bsi_cols', `
        ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS submission_id UUID;
        ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS order_id UUID;
        ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(30) DEFAULT '';
        ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS product_id UUID;
        ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS amount_pesewas BIGINT DEFAULT 0;
        ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'CREATED';
        ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS error_message TEXT
      `);

      // 7. Drop NOT NULL from product_id if needed
      await safeDDL('ddl_bsi_null', `
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bulk_submission_items' AND column_name = 'product_id') THEN
            ALTER TABLE bulk_submission_items ALTER COLUMN product_id DROP NOT NULL;
          END IF;
        END $$
      `);

      // 8. Ensure order_items table exists (needed for batch inserts below)
      await safeDDL('ddl_oi_create', `
        CREATE TABLE IF NOT EXISTS order_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id UUID NOT NULL,
          product_id UUID,
          quantity INT NOT NULL DEFAULT 1,
          unit_price_pesewas BIGINT NOT NULL DEFAULT 0,
          total_pesewas BIGINT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 9. Ensure provider_orders table exists (needed for batch inserts below)
      await safeDDL('ddl_po_create', `
        CREATE TABLE IF NOT EXISTS provider_orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id UUID NOT NULL,
          provider_name VARCHAR(100) NOT NULL DEFAULT '',
          provider_reference VARCHAR(255),
          provider_status VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN',
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 10. Ensure orders_order_status_check constraint accommodates PAUSED
      await safeDDL('ddl_ord_chk', `
        DO $$
        DECLARE
            c_name TEXT;
        BEGIN
            SELECT con.conname INTO c_name
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
            WHERE rel.relname = 'orders' AND att.attname = 'order_status' AND con.contype = 'c';

            IF c_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', c_name);
            END IF;

            ALTER TABLE orders ADD CONSTRAINT orders_order_status_check
                CHECK (order_status IN ('CREATED', 'VALIDATING', 'READY_FOR_FULFILLMENT', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED'));
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END $$
      `);

      // Check if user is an agent for correct pricing
      let isUserAgent = false;
      try {
        const agentCheck = await client.query(
          `SELECT 1 FROM agents WHERE user_id = $1 AND (is_active = TRUE)
           UNION
           SELECT 1 FROM users WHERE id = $1 AND role = 'agent'`,
          [userId],
        );
        isUserAgent = agentCheck.rows.length > 0;
      } catch {}

      // 1. Pre-cache ALL active catalog products in one query (eliminates per-item DB lookups)
      let catalogRes = await client.query(
        `SELECT id, sku, network, name, data_amount_mb as "dataAmountMb",
                base_price_pesewas as "basePricePesewas",
                agent_price_pesewas as "agentPricePesewas",
                is_active as "isActive"
         FROM catalog_products
         WHERE is_active = TRUE
         ORDER BY base_price_pesewas ASC`,
      );

      // Auto-seed default catalog if empty so orders can never fail due to an unseeded catalog
      if (catalogRes.rows.length === 0) {
        try {
          await client.query(`
            INSERT INTO catalog_products (sku, network, name, data_amount_mb, validity_days, base_price_pesewas, agent_price_pesewas, is_active)
            VALUES
              ('MTN-1GB', 'MTN', 'MTN 1GB Non-Expiry', 1024, 30, 600, 550, TRUE),
              ('MTN-2GB', 'MTN', 'MTN 2GB Non-Expiry', 2048, 30, 1200, 1100, TRUE),
              ('MTN-3GB', 'MTN', 'MTN 3GB Non-Expiry', 3072, 30, 1700, 1600, TRUE),
              ('MTN-5GB', 'MTN', 'MTN 5GB Non-Expiry', 5120, 30, 2500, 2400, TRUE),
              ('MTN-10GB', 'MTN', 'MTN 10GB Non-Expiry', 10240, 30, 4800, 4600, TRUE),
              ('TELECEL-1GB', 'TELECEL', 'Telecel 1GB Non-Expiry', 1024, 30, 600, 550, TRUE),
              ('TELECEL-2GB', 'TELECEL', 'Telecel 2GB Non-Expiry', 2048, 30, 1200, 1100, TRUE),
              ('TELECEL-5GB', 'TELECEL', 'Telecel 5GB Non-Expiry', 5120, 30, 2500, 2400, TRUE),
              ('AIRTELTIGO-1GB', 'AIRTELTIGO', 'AirtelTigo 1GB Non-Expiry', 1024, 30, 550, 500, TRUE),
              ('AIRTELTIGO-2GB', 'AIRTELTIGO', 'AirtelTigo 2GB Non-Expiry', 2048, 30, 1100, 1000, TRUE),
              ('AIRTELTIGO-5GB', 'AIRTELTIGO', 'AirtelTigo 5GB Non-Expiry', 5120, 30, 2400, 2300, TRUE)
            ON CONFLICT (sku) DO UPDATE SET is_active = TRUE;
          `);
          catalogRes = await client.query(
            `SELECT id, sku, network, name, data_amount_mb as "dataAmountMb",
                    base_price_pesewas as "basePricePesewas",
                    agent_price_pesewas as "agentPricePesewas",
                    is_active as "isActive"
             FROM catalog_products
             WHERE is_active = TRUE
             ORDER BY base_price_pesewas ASC`,
          );
        } catch {}
      }

      const allProducts = catalogRes.rows.map((r: any) => ({
        id: r.id,
        sku: r.sku,
        network: (r.network || '').toUpperCase(),
        name: r.name,
        dataAmountMb: parseInt(r.dataAmountMb, 10),
        basePricePesewas: parseInt(r.basePricePesewas, 10),
        agentPricePesewas: r.agentPricePesewas ? parseInt(r.agentPricePesewas, 10) : null,
        isActive: r.isActive,
      }));
      // Build lookup maps for fast in-memory resolution
      const productById = new Map(allProducts.map((p: any) => [p.id, p]));
      const productByNetVol = new Map(allProducts.map((p: any) => [`${p.network}:${p.dataAmountMb}`, p]));

      // Pre-cache user/agent custom pricing in one query
      const allProductIds = allProducts.map((p: any) => p.id);
      const userPricingMap = new Map<string, number>();
      if (allProductIds.length > 0) {
        try {
          const pricingRes = await client.query(
            `SELECT product_id, custom_price_pesewas FROM user_pricing WHERE user_id = $1 AND product_id = ANY($2) AND is_active = TRUE
             UNION
             SELECT product_id, custom_price_pesewas FROM agent_pricing WHERE (agent_id = $1 OR agent_id IN (SELECT id FROM agents WHERE user_id = $1)) AND product_id = ANY($2) AND is_active = TRUE`,
            [userId, allProductIds],
          );
          for (const row of pricingRes.rows) {
            if (row.custom_price_pesewas) {
              userPricingMap.set(row.product_id, parseInt(row.custom_price_pesewas, 10));
            }
          }
        } catch {
          // ignore — fall back to base/agent pricing
        }
      }

      // 2. Resolve each item's product price from in-memory cache (zero additional DB queries per item)
      let totalAmountPesewas = 0;
      const itemsToInsert: Array<{
        recipientPhone: string;
        productId: string;
        product: any;
        amountPesewas: number;
      }> = [];

      for (const item of input.items) {
        let product: any = null;
        const isFallbackId =
          typeof item.productId === 'string' &&
          (item.productId.startsWith('fallback-') || item.productId.startsWith('custom-bundle-'));

        // Try direct ID lookup from in-memory cache
        if (!isFallbackId) {
          product = productById.get(item.productId) || null;
          // If not in cache, try the catalog service as last resort
          if (!product) {
            try {
              product = await this.catalogService.getProductById(item.productId);
            } catch {
              // Product ID not found in catalog — will attempt fallback resolution below
            }
          }
        }

        // Fallback resolution: parse network + volume from ID or item metadata, resolve in-memory
        if (!product) {
          const fallbackMatch = (item.productId || '').match(
            /^(?:fallback-(\w+)-|custom-bundle-)(\d+(?:\.\d+)?)gb$/i,
          );
          const fbNetwork = fallbackMatch?.[1]
            ? fallbackMatch[1].toUpperCase()
            : (item as any).network?.toUpperCase() || 'MTN';
          const fbVolumeMb = fallbackMatch?.[2]
            ? Math.round(parseFloat(fallbackMatch[2]) * 1024)
            : (item as any).dataAmountMb || 1024;

          // 1) Exact match on network + volume from cache
          product = productByNetVol.get(`${fbNetwork}:${fbVolumeMb}`) || null;

          if (!product) {
            // 2) Closest volume match for the same network (in-memory)
            const sameNetwork = allProducts.filter((p: any) => p.network === fbNetwork);
            if (sameNetwork.length > 0) {
              product = sameNetwork.reduce((closest: any, p: any) =>
                Math.abs(p.dataAmountMb - fbVolumeMb) < Math.abs(closest.dataAmountMb - fbVolumeMb) ? p : closest,
              );
            }
          }

          if (!product && allProducts.length > 0) {
            // 3) Any active product as absolute fallback
            product = allProducts[0];
          }
        }

        if (!product) {
          throw new BadRequestError(
            `Product '${item.productId}' could not be resolved to an active catalog product. Please refresh your bundles and try again.`,
          );
        }

        const cleanPhone = item.recipientPhone.trim().replace(/\s+/g, '');
        let itemPrice =
          isUserAgent && product.agentPricePesewas ? product.agentPricePesewas : product.basePricePesewas;

        if (!itemPrice || itemPrice <= 0) {
          itemPrice = (item as any).amountPesewas || (item as any).pricePesewas || 0;
        }

        // Check user-specific pricing from pre-cached map (zero DB queries)
        const customPrice = userPricingMap.get(product.id);
        if (customPrice && customPrice > 0) {
          itemPrice = customPrice;
        }

        if (!itemPrice || isNaN(itemPrice) || itemPrice <= 0) {
          const sizeGb = (product.dataAmountMb || 1024) / 1024;
          itemPrice = Math.max(100, Math.round(sizeGb * 450));
        }

        totalAmountPesewas += itemPrice;

        itemsToInsert.push({
          recipientPhone: cleanPhone,
          productId: product.id,
          product,
          amountPesewas: itemPrice,
        });
      }

      const isWalletPayment =
        input.paymentMethod === PaymentMethod.WALLET ||
        input.paymentMethod === 'WALLET' ||
        (input.paymentMethod as any) === 'wallet';

      if (isWalletPayment) {
        const userRes = await client.query(
          `SELECT wallet_balance_pesewas, wallet_balance FROM users WHERE id = $1 FOR UPDATE`,
          [userId],
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

        if (currentBalancePesewas < totalAmountPesewas) {
          const have = (currentBalancePesewas / 100).toFixed(2);
          const need = (totalAmountPesewas / 100).toFixed(2);
          throw new InsufficientBalanceError(
            `Insufficient wallet balance: have ${have} GHS, need ${need} GHS`,
          );
        }

        await client.query(
          `UPDATE users
           SET wallet_balance_pesewas = GREATEST(0, COALESCE(wallet_balance_pesewas, ROUND(COALESCE(wallet_balance, 0)::numeric * 100, 0)) - $1),
               wallet_balance = GREATEST(0, ROUND((COALESCE(wallet_balance_pesewas, ROUND(COALESCE(wallet_balance, 0)::numeric * 100, 0)) - $1) / 100.0, 2)),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [totalAmountPesewas, userId],
        );
      }

      // 2. Insert Bulk Submission
      const subQuery = `
        INSERT INTO bulk_submissions (user_id, name, total_count, total_amount_pesewas, status, idempotency_key)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, user_id as "userId", name, total_count as "totalCount",
                  processed_count as "processedCount", success_count as "successCount",
                  failed_count as "failedCount", total_amount_pesewas as "totalAmountPesewas",
                  status, created_at as "createdAt", updated_at as "updatedAt"
      `;

      const isPaused = await this.isOrderProcessingPaused();

      const subRes = await client.query(subQuery, [
        userId,
        input.name.trim(),
        itemsToInsert.length,
        totalAmountPesewas,
        isWalletPayment ? 'PROCESSING' : 'PENDING',
        input.idempotencyKey || null,
      ]);
      const subRow = subRes.rows[0];

      // 3. Batch Insert Items & Child Orders if paid
      const createdItems: Array<{
        id: string;
        submissionId: string;
        orderId: string | null;
        recipientPhone: string;
        productId: string;
        amountPesewas: number;
        status: OrderStatus;
        errorMessage: string | null;
        createdAt: string;
      }> = [];
      const dispatchedOrderIds: string[] = [];

      // Pre-resolve default provider and per-network provider mapping (eliminates per-row subqueries)
      let defaultProviderName = 'DataHouse';
      try {
        const provRes = await client.query(
          `SELECT name FROM telecom_providers WHERE is_authoritative = TRUE AND (is_active = TRUE OR status = 'ACTIVE') LIMIT 1`,
        );
        if (provRes.rows.length > 0 && provRes.rows[0].name) {
          defaultProviderName = provRes.rows[0].name;
        }
      } catch {}

      const networkProviderMap = new Map<string, string>();
      try {
        const netRes = await client.query(
          `SELECT UPPER(code) as code, primary_provider_name FROM telecom_networks WHERE is_active = TRUE OR status = 'ACTIVE'`,
        );
        for (const r of netRes.rows) {
          if (r.primary_provider_name) {
            networkProviderMap.set(r.code, r.primary_provider_name);
          }
        }
      } catch {}

      const BATCH_SIZE = 50;
      for (let c = 0; c < itemsToInsert.length; c += BATCH_SIZE) {
        const chunk = itemsToInsert.slice(c, c + BATCH_SIZE);

        if (isWalletPayment) {
          // 3a. Batch Insert orders
          const orderValues: any[] = [];
          const orderPlaceholders: string[] = [];

          chunk.forEach((item, i) => {
            const childPublicId = `ord_${crypto.randomBytes(12).toString('hex')}`;
            const baseIdx = i * 13;
            orderPlaceholders.push(
              `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6}, $${baseIdx + 7}, 'GHS', $${baseIdx + 8}, 'PAID', $${baseIdx + 9}, 'UNKNOWN', 'NONE', $${baseIdx + 10}, $${baseIdx + 11}, $${baseIdx + 12}, $${baseIdx + 13})`,
            );
            orderValues.push(
              childPublicId,
              userId,
              item.product.id,
              item.recipientPhone,
              item.product.network,
              item.product.dataAmountMb,
              item.amountPesewas,
              JSON.stringify({
                productId: item.product.id,
                dataAmountMb: item.product.dataAmountMb,
                pricePesewas: item.amountPesewas,
                confirmedPorted: input.confirmedPorted,
                placedDuringFreeze: isPaused ? true : undefined,
              }),
              isPaused ? 'PAUSED' : 'READY_FOR_FULFILLMENT',
              `${subRow.id}_${item.recipientPhone}_${Date.now()}_${c + i}`,
              isPaused,
              isPaused ? new Date() : null,
              isPaused ? 'READY_FOR_FULFILLMENT' : null,
            );
          });

          const ordersRes = await client.query(
            `INSERT INTO orders (
              public_id, user_id, product_id, recipient_phone,
              network, data_amount_mb, amount_pesewas, currency,
              pricing_snapshot, payment_status, order_status, provider_status,
              refund_status, idempotency_key, is_paused, paused_at, paused_from_status
            )
            VALUES ${orderPlaceholders.join(', ')}
            RETURNING id, public_id, recipient_phone`,
            orderValues,
          );

          const insertedOrderIds = ordersRes.rows.map((r: any) => r.id);
          dispatchedOrderIds.push(...insertedOrderIds);

          // 3b. Batch Insert order_items
          const orderItemValues: any[] = [];
          const orderItemPlaceholders: string[] = [];
          chunk.forEach((item, i) => {
            const orderId = insertedOrderIds[i];
            const baseIdx = i * 3;
            orderItemPlaceholders.push(`($${baseIdx + 1}, $${baseIdx + 2}, 1, $${baseIdx + 3}, $${baseIdx + 3})`);
            orderItemValues.push(orderId, item.product.id, item.amountPesewas);
          });
          await client.query(
            `INSERT INTO order_items (order_id, product_id, quantity, unit_price_pesewas, total_pesewas)
             VALUES ${orderItemPlaceholders.join(', ')}`,
            orderItemValues,
          ).catch(() => {});

          // 3c. Batch Insert provider_orders
          const providerValues: any[] = [];
          const providerPlaceholders: string[] = [];
          chunk.forEach((item, i) => {
            const orderId = insertedOrderIds[i];
            const childRef = `TXN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
            const providerName = networkProviderMap.get(item.product.network) || defaultProviderName;
            const baseIdx = i * 3;
            providerPlaceholders.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, 'UNKNOWN')`);
            providerValues.push(orderId, providerName, childRef);
          });
          await client.query(
            `INSERT INTO provider_orders (order_id, provider_name, provider_reference, provider_status)
             VALUES ${providerPlaceholders.join(', ')}`,
            providerValues,
          ).catch(() => {});

          // 3d. Batch Insert bulk_submission_items
          const subItemValues: any[] = [];
          const subItemPlaceholders: string[] = [];
          chunk.forEach((item, i) => {
            const orderId = insertedOrderIds[i];
            const baseIdx = i * 6;
            subItemPlaceholders.push(
              `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6})`,
            );
            subItemValues.push(
              subRow.id,
              orderId,
              item.recipientPhone,
              item.productId,
              item.amountPesewas,
              'READY_FOR_FULFILLMENT',
            );
          });
          const subItemsRes = await client.query(
            `INSERT INTO bulk_submission_items (submission_id, order_id, recipient_phone, product_id, amount_pesewas, status)
             VALUES ${subItemPlaceholders.join(', ')}
             RETURNING id, submission_id as "submissionId", order_id as "orderId",
                       recipient_phone as "recipientPhone", product_id as "productId",
                       amount_pesewas as "amountPesewas", status, error_message as "errorMessage",
                       created_at as "createdAt"`,
            subItemValues,
          );
          for (const ir of subItemsRes.rows) {
            createdItems.push({
              id: ir.id,
              submissionId: ir.submissionId,
              orderId: ir.orderId,
              recipientPhone: ir.recipientPhone,
              productId: ir.productId,
              amountPesewas: parseInt(ir.amountPesewas, 10),
              status: ir.status as OrderStatus,
              errorMessage: ir.errorMessage,
              createdAt: new Date(ir.createdAt).toISOString(),
            });
          }
        } else {
          // Non-wallet bulk submission items insert
          const subItemValues: any[] = [];
          const subItemPlaceholders: string[] = [];
          chunk.forEach((item, i) => {
            const baseIdx = i * 6;
            subItemPlaceholders.push(
              `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6})`,
            );
            subItemValues.push(subRow.id, null, item.recipientPhone, item.productId, item.amountPesewas, 'CREATED');
          });
          const subItemsRes = await client.query(
            `INSERT INTO bulk_submission_items (submission_id, order_id, recipient_phone, product_id, amount_pesewas, status)
             VALUES ${subItemPlaceholders.join(', ')}
             RETURNING id, submission_id as "submissionId", order_id as "orderId",
                       recipient_phone as "recipientPhone", product_id as "productId",
                       amount_pesewas as "amountPesewas", status, error_message as "errorMessage",
                       created_at as "createdAt"`,
            subItemValues,
          );
          for (const ir of subItemsRes.rows) {
            createdItems.push({
              id: ir.id,
              submissionId: ir.submissionId,
              orderId: ir.orderId,
              recipientPhone: ir.recipientPhone,
              productId: ir.productId,
              amountPesewas: parseInt(ir.amountPesewas, 10),
              status: ir.status as OrderStatus,
              errorMessage: ir.errorMessage,
              createdAt: new Date(ir.createdAt).toISOString(),
            });
          }
        }
      }

      if (isWalletPayment) {
        // Determine if user is an agent for correct ledger account type
        let walletAccountType = LedgerAccountType.CUSTOMER_WALLET;
        try {
          const agentCheck = await client.query(
            `SELECT 1 FROM agents WHERE user_id = $1 AND is_active = TRUE LIMIT 1`,
            [userId],
          );
          if (agentCheck.rows.length > 0) {
            walletAccountType = LedgerAccountType.AGENT_WALLET;
          }
        } catch {
          // Default to CUSTOMER_WALLET if agents table doesn't exist or query fails
        }

        const platformSystemAccountId = '00000000-0000-0000-0000-000000000000';
        await this.ledgerService.recordJournalEntries(client, [
          {
            entryType: LedgerEntryType.DEBIT,
            accountType: walletAccountType,
            accountId: userId,
            amountPesewas: totalAmountPesewas,
            currency: Currency.GHS,
            referenceType: 'ORDER',
            referenceId: subRow.id,
            description: `Wallet payment for bulk submission (${input.name.trim()})`,
          },
          {
            entryType: LedgerEntryType.CREDIT,
            accountType: LedgerAccountType.PLATFORM_ESCROW,
            accountId: platformSystemAccountId,
            amountPesewas: totalAmountPesewas,
            currency: Currency.GHS,
            referenceType: 'ORDER',
            referenceId: subRow.id,
            description: `Platform escrow credited for bulk submission ${subRow.id}`,
          },
        ]).catch((ledgerErr) => {
          logger.warn(
            { err: ledgerErr?.message, submissionId: subRow.id },
            '[BULK_ORDER_SERVICE] Ledger journal entry failed — order proceeds without audit log',
          );
        });
      }

      await client.query('COMMIT');

      // 4. Trigger fulfillment for all created child orders
      if (isWalletPayment && dispatchedOrderIds.length > 0 && !isPaused) {
        logger.info(
          { submissionId: subRow.id, count: dispatchedOrderIds.length },
          '[BULK_ORDER_SERVICE] Dispatching child orders to fulfillment pipeline',
        );
        for (const orderId of dispatchedOrderIds) {
          if (this.fulfillmentQueueService) {
            this.fulfillmentQueueService
              .enqueueOrderFulfillment({
                orderId,
                correlationId: `bulk_sub_${subRow.id}`,
                idempotencyKey: `bulk_sub_${orderId}`,
                attemptCount: 1,
              })
              .catch(() => {});
          }
          if (this.fulfillmentWorker) {
            setImmediate(() => {
              this.fulfillmentWorker!
                .processOrderFulfillment(orderId, `bulk_sub_${subRow.id}`)
                .catch((err) => {
                  logger.error({ err, orderId }, 'Bulk submission item background fulfillment error');
                });
            });
          }
        }
      } else if (isWalletPayment && dispatchedOrderIds.length > 0 && isPaused) {
        logger.info(
          { submissionId: subRow.id, count: dispatchedOrderIds.length },
          '[BULK_ORDER_SERVICE] Bulk child orders created during operational freeze — held in PAUSED status without telecom dispatch',
        );
      }

      return {
        id: subRow.id,
        userId: subRow.userId,
        name: subRow.name,
        totalCount: subRow.totalCount,
        processedCount: subRow.processedCount,
        successCount: subRow.successCount,
        failedCount: subRow.failedCount,
        totalAmountPesewas: parseInt(subRow.totalAmountPesewas, 10),
        status: subRow.status as BulkSubmissionStatus,
        items: createdItems,
        createdAt: new Date(subRow.createdAt).toISOString(),
        updatedAt: new Date(subRow.updatedAt).toISOString(),
      };
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      logger.error({ err, userId }, '[BULK_ORDER_SERVICE] createBulkSubmission transaction error');

      if (err instanceof BadRequestError || err?.name === 'AppError' || err?.statusCode) {
        throw err;
      }
      if (err?.code === '23503') {
        throw new BadRequestError(`Database reference error: ${err.detail || err.message}`);
      }
      if (err?.code === '23505') {
        throw new BadRequestError(`Duplicate entry error: ${err.detail || err.message}`);
      }
      if (err?.code === '23514') {
        throw new BadRequestError(`Validation check constraint error: ${err.detail || err.message}`);
      }
      if (err?.code === '42703') {
        throw new BadRequestError(`Database schema column error: ${err.message}. Please apply database migrations.`);
      }
      if (err?.code === '42P01') {
        throw new BadRequestError(`Database table missing: ${err.message}. Please apply database migrations.`);
      }

      // Catch any remaining PostgreSQL errors with a code
      if (err?.code && typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code)) {
        throw new BadRequestError(
          `Database error [${err.code}]: ${err.message}${err.detail ? ' — ' + err.detail : ''}. Please contact support.`,
        );
      }

      // Catch "current transaction is aborted" (happens when a prior statement failed)
      if (err?.message?.includes('current transaction is aborted')) {
        throw new BadRequestError(
          'A database schema issue prevented the order. Please contact support or retry.',
        );
      }

      throw err;
    } finally {
      client.release();
    }
  }

  public async getBulkSubmissionById(
    submissionId: string,
    userId: string,
    isAdmin = false,
  ): Promise<BulkSubmissionDetailsDto> {
    const subQuery = `
      SELECT id, user_id as "userId", name, total_count as "totalCount",
             processed_count as "processedCount", success_count as "successCount",
             failed_count as "failedCount", total_amount_pesewas as "totalAmountPesewas",
             status, created_at as "createdAt", updated_at as "updatedAt"
      FROM bulk_submissions
      WHERE id = $1
    `;

    const subRes = await this.db.query(subQuery, [submissionId]);
    if (subRes.rows.length === 0) {
      throw new NotFoundError(`Bulk submission '${submissionId}' not found`);
    }

    const subRow = subRes.rows[0];

    if (!isAdmin && subRow.userId !== userId) {
      throw new ForbiddenError('You are not authorized to view this bulk submission');
    }

    const itemsQuery = `
      SELECT id, submission_id as "submissionId", order_id as "orderId",
             recipient_phone as "recipientPhone", product_id as "productId",
             amount_pesewas as "amountPesewas", status, error_message as "errorMessage",
             created_at as "createdAt"
      FROM bulk_submission_items
      WHERE submission_id = $1
      ORDER BY created_at ASC
    `;
    const itemsRes = await this.db.query(itemsQuery, [submissionId]);

    return {
      id: subRow.id,
      userId: subRow.userId,
      name: subRow.name,
      totalCount: subRow.totalCount,
      processedCount: subRow.processedCount,
      successCount: subRow.successCount,
      failedCount: subRow.failedCount,
      totalAmountPesewas: parseInt(subRow.totalAmountPesewas, 10),
      status: subRow.status as BulkSubmissionStatus,
      items: itemsRes.rows.map((ir) => ({
        id: ir.id,
        submissionId: ir.submissionId,
        orderId: ir.orderId,
        recipientPhone: ir.recipientPhone,
        productId: ir.productId,
        amountPesewas: parseInt(ir.amountPesewas, 10),
        status: ir.status as OrderStatus,
        errorMessage: ir.errorMessage,
        createdAt: new Date(ir.createdAt).toISOString(),
      })),
      createdAt: new Date(subRow.createdAt).toISOString(),
      updatedAt: new Date(subRow.updatedAt).toISOString(),
    };
  }

  /**
   * Places an agent bulk order auto-split into per-bundle-size child orders.
   * POST /agent/orders/bulk
   */
  public async placeAgentBulkOrder(params: {
    agentOrUserId?: string;
    userId?: string;
    isSandbox?: boolean;
    simulate?: boolean;
    network: NetworkProvider | string;
    recipients: Array<{ phoneNumber: string; dataSizeGb: number }>;
    idempotencyKey: string;
    confirmedPorted?: string[];
    onUnvalidated?: 'set_aside' | 'reject';
  }): Promise<AgentBulkOrderResult> {
    const isTotalLockdown = await this.isTotalOrderLockdownActive();
    if (isTotalLockdown) {
      throw new BadRequestError(
        'Bulk order submissions and spreadsheet uploads are completely paused under total platform lockdown.',
      );
    }

    const isSimulate = Boolean(params.simulate);

    // 1. Sandbox key check — allow simulation with test keys or guide developer
    if (params.isSandbox && !isSimulate) {
      throw new BulkNotOnSandboxError(
        'Bulk orders cannot be executed with sandbox test keys (ak_test_...). To simulate 1,000-recipient bulk testing in sandbox, pass "simulate": true in your request body or header "x-simulate: true". For live carrier fulfillment, please use a live API key (ak_live_...).',
      );
    }

    // 2. Input validation
    const netUpper = String(params.network || '').trim().toUpperCase();
    if (!netUpper || (netUpper !== 'MTN' && netUpper !== 'TELECEL' && netUpper !== 'AIRTELTIGO')) {
      throw new BadRequestError("Invalid network provider. Supported networks: 'MTN', 'TELECEL'");
    }

    if (!params.idempotencyKey || typeof params.idempotencyKey !== 'string' || params.idempotencyKey.length < 8 || params.idempotencyKey.length > 36) {
      throw new BadRequestError('idempotencyKey is required and must be between 8 and 36 characters');
    }

    if (!Array.isArray(params.recipients) || params.recipients.length === 0 || params.recipients.length > 1000) {
      throw new BadRequestError('recipients must be a non-empty array with at most 1000 items');
    }

    // Resolve agent and user ID
    const effectiveTargetId = params.agentOrUserId || params.userId || '';
    let agentId = effectiveTargetId;
    let userId = effectiveTargetId;
    try {
      const agentRes = await this.db.query(
        'SELECT id, user_id as "userId" FROM agents WHERE id = $1 OR user_id = $1',
        [effectiveTargetId],
      );
      if (agentRes.rows.length > 0) {
        agentId = agentRes.rows[0].id;
        userId = agentRes.rows[0].userId;
      }
    } catch {
      // fallback to provided ID
    }

    // 2b. Idempotency Check & Replay Protection (Redis 24h + DB Fallback)
    const requestHash = this.idempotencyService
      ? this.idempotencyService.computeHash({
          network: netUpper,
          recipients: params.recipients,
          confirmedPorted: params.confirmedPorted,
          onUnvalidated: params.onUnvalidated,
        })
      : '';

    if (this.idempotencyService && params.idempotencyKey) {
      const existing = await this.idempotencyService.getExistingResponse(
        params.idempotencyKey,
        userId,
        requestHash,
      );

      if (existing.exists && existing.body) {
        return existing.body as AgentBulkOrderResult;
      }
    }

    // 3. Normalization and Phone Validation
    const confirmedPortedSet = new Set(
      (params.confirmedPorted || []).map((p) => this.normalizePhone(p).normalized),
    );

    const onUnvalidated = params.onUnvalidated === 'reject' ? 'reject' : 'set_aside';

    const normalizedRecipients: Array<{
      rawPhone: string;
      normalizedPhone: string;
      valid: boolean;
      dataSizeGb: number;
      isPorted: boolean;
    }> = [];

    for (const r of params.recipients) {
      const { normalized, valid, raw } = this.normalizePhone(r.phoneNumber);
      const sizeGb = Number(r.dataSizeGb);
      if (isNaN(sizeGb) || sizeGb < 0.1 || sizeGb > 1000) {
        throw new BadRequestError(`Invalid data size '${r.dataSizeGb}' for phone '${r.phoneNumber}'. Must be 0.1-1000 GB.`);
      }
      if (!valid) {
        throw new BadRequestError(`Invalid Ghanaian phone number format: '${r.phoneNumber}'`);
      }
      const isPorted = confirmedPortedSet.has(normalized);
      normalizedRecipients.push({
        rawPhone: raw,
        normalizedPhone: normalized,
        valid,
        dataSizeGb: sizeGb,
        isPorted,
      });
    }

    // 4. MTN Up2U Validation & Precheck
    const blocked: string[] = [];
    const acceptedRecipients: Array<{
      phoneNumber: string;
      dataSizeGb: number;
      isPorted?: boolean;
    }> = [];

    if (netUpper === 'MTN' && !isSimulate) {
      const allPhones = Array.from(new Set(normalizedRecipients.map((r) => r.normalizedPhone)));
      const knownPhones = new Set<string>();

      try {
        const queryPhones = Array.from(
          new Set(
            allPhones.flatMap((p) => [
              p,
              `+233${p.startsWith('0') ? p.slice(1) : p}`,
              `233${p.startsWith('0') ? p.slice(1) : p}`,
            ]),
          ),
        );

        const valRes = await this.db.query(
          `SELECT phone_number as "phone" FROM beneficiary_validation
           WHERE phone_number = ANY($1) AND network = 'MTN' AND validation_status IN ('VALID', 'APPROVED')
           UNION
           SELECT phone_number as "phone" FROM pending_beneficiary_approvals
           WHERE phone_number = ANY($1) AND network = 'MTN' AND status = 'APPROVED'`,
          [queryPhones],
        );
        for (const row of valRes.rows) {
          if (row.phone) {
            const norm = this.normalizePhone(row.phone).normalized;
            knownPhones.add(norm);
            knownPhones.add(row.phone);
          }
        }

        const prevOrdersRes = await this.db.query(
          `SELECT DISTINCT recipient_phone as "phone" FROM orders
           WHERE recipient_phone = ANY($1) AND network = 'MTN' AND order_status IN ('COMPLETED', 'DELIVERED', 'PROCESSING', 'SUBMITTED', 'READY_FOR_FULFILLMENT')`,
          [queryPhones],
        );
        for (const row of prevOrdersRes.rows) {
          if (row.phone) {
            const norm = this.normalizePhone(row.phone).normalized;
            knownPhones.add(norm);
            knownPhones.add(row.phone);
          }
        }
      } catch {
        // Table or query fallback
      }

      const unvalidatedPhones: string[] = [];

      for (const r of normalizedRecipients) {
        const isKnown = knownPhones.has(r.normalizedPhone) || knownPhones.has(r.rawPhone);
        if (isKnown) {
          acceptedRecipients.push({
            phoneNumber: r.normalizedPhone,
            dataSizeGb: r.dataSizeGb,
            isPorted: r.isPorted,
          });
        } else {
          unvalidatedPhones.push(r.normalizedPhone);
          if (!blocked.includes(r.normalizedPhone)) {
            blocked.push(r.normalizedPhone);
          }
        }
      }

      if (unvalidatedPhones.length > 0) {
        if (onUnvalidated === 'reject') {
          throw new UnprocessableEntityError(
            `Cannot process bulk order: ${unvalidatedPhones.length} recipient(s) are not yet validated with MTN (${unvalidatedPhones.slice(0, 3).join(', ')}...).`,
          );
        }

        // Record unvalidated numbers into pending_beneficiary_approvals and beneficiary_validation for MTN approval
        try {
          for (const phone of unvalidatedPhones) {
            const matchRecip = normalizedRecipients.find((r) => r.normalizedPhone === phone);
            const sizeGb = matchRecip?.dataSizeGb ?? null;

            if (agentId || userId) {
              await this.db.query(
                `INSERT INTO pending_beneficiary_approvals (
                  phone_number, network, agent_id, status, attempt_count,
                  last_bundle_size_gb, first_detected_at, last_detected_at, created_at, updated_at
                ) VALUES ($1, 'MTN', $2, 'PENDING', 1, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (agent_id, phone_number, network) DO UPDATE
                SET attempt_count = pending_beneficiary_approvals.attempt_count + 1,
                    last_bundle_size_gb = COALESCE(EXCLUDED.last_bundle_size_gb, pending_beneficiary_approvals.last_bundle_size_gb),
                    last_detected_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP`,
                [phone, agentId || userId, sizeGb],
              ).catch(() => {});
            }

            await this.db.query(
              `INSERT INTO beneficiary_validation (
                phone_number, network, validation_status, attempt_count,
                last_bundle_size_gb, agent_id, created_at, updated_at
              ) VALUES ($1, 'MTN', 'PENDING', 1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT (phone_number, network) DO UPDATE
              SET attempt_count = beneficiary_validation.attempt_count + 1,
                  last_bundle_size_gb = COALESCE(EXCLUDED.last_bundle_size_gb, beneficiary_validation.last_bundle_size_gb),
                  updated_at = CURRENT_TIMESTAMP`,
              [phone, sizeGb, agentId || userId],
            ).catch(() => {});
          }
        } catch {
          // Ignore unique conflicts
        }
      }
    } else {
      // Telecel / Other networks never block
      for (const r of normalizedRecipients) {
        acceptedRecipients.push({
          phoneNumber: r.normalizedPhone,
          dataSizeGb: r.dataSizeGb,
          isPorted: r.isPorted,
        });
      }
    }

    // 5. If every recipient was unvalidated and set aside
    if (acceptedRecipients.length === 0) {
      return {
        id: '',
        referenceCode: '',
        network: netUpper,
        amount: '0.00',
        status: 'received',
        createdAt: new Date().toISOString(),
        beneficiaryCount: 0,
        groupCount: 0,
        orders: [],
        blocked,
      };
    }

    // 6. Group accepted recipients by distinct bundle size for summary
    const sizeMap = new Map<number, Array<{ phoneNumber: string; dataSizeGb: number; isPorted?: boolean }>>();
    for (const r of acceptedRecipients) {
      const list = sizeMap.get(r.dataSizeGb) || [];
      list.push(r);
      sizeMap.set(r.dataSizeGb, list);
    }

    const sortedSizes = Array.from(sizeMap.keys()).sort((a, b) => a - b);
    const childOrders: AgentBulkChildOrderDto[] = [];
    let grandTotalPesewas = 0;

    if (isSimulate) {
      const submissionPublicId = `sub_sbx_${crypto.randomBytes(12).toString('hex')}`;
      const submissionRef = `BLK-SBX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      for (const sizeGb of sortedSizes) {
        const recipientsForSize = sizeMap.get(sizeGb)!;
        const count = recipientsForSize.length;
        const unitPricePesewas = Math.round(sizeGb * 420);
        const groupAmountPesewas = count * unitPricePesewas;
        grandTotalPesewas += groupAmountPesewas;

        const childPublicId = `ord_sbx_${crypto.randomBytes(12).toString('hex')}`;
        const childRef = `SBX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        childOrders.push({
          id: childPublicId,
          publicId: childPublicId,
          referenceCode: childRef,
          sizeGb,
          beneficiaryCount: count,
          amount: (groupAmountPesewas / 100).toFixed(2),
          status: 'fulfilled',
        });
      }

      const bulkResult: AgentBulkOrderResult = {
        id: submissionPublicId,
        referenceCode: submissionRef,
        network: netUpper,
        amount: (grandTotalPesewas / 100).toFixed(2),
        status: 'fulfilled',
        createdAt: new Date().toISOString(),
        beneficiaryCount: acceptedRecipients.length,
        groupCount: childOrders.length,
        orders: childOrders,
        blocked: [],
        isSandbox: true,
      };

      if (this.idempotencyService && params.idempotencyKey) {
        try {
          const simClient = await this.db.connect();
          if (simClient) {
            try {
              await this.idempotencyService.saveResponse(simClient, {
                key: params.idempotencyKey,
                userId,
                endpoint: '/agent/orders/bulk',
                requestHash,
                responseStatus: 201,
                responseBody: bulkResult,
              });
            } catch {} finally {
              simClient.release?.();
            }
          }
        } catch {
          // ignore
        }
      }

      return bulkResult;
    }

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // ─── Self-healing DDL: each statement gets its own SAVEPOINT so a single
      //     failure does NOT abort the entire transaction (PostgreSQL behaviour).
      const safeDDL = async (label: string, sql: string) => {
        try {
          await client.query(`SAVEPOINT ${label}`);
          await client.query(sql);
          await client.query(`RELEASE SAVEPOINT ${label}`);
        } catch (ddlErr: any) {
          await client.query(`ROLLBACK TO SAVEPOINT ${label}`).catch(() => {});
          logger.warn({ err: ddlErr?.message, label }, '[BULK_ORDER_SERVICE] Agent DDL self-heal skipped');
        }
      };

      await safeDDL('ag_bs_create', `
        CREATE TABLE IF NOT EXISTS bulk_submissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL DEFAULT 'Bulk Order',
          total_count INT NOT NULL DEFAULT 0,
          processed_count INT NOT NULL DEFAULT 0,
          success_count INT NOT NULL DEFAULT 0,
          failed_count INT NOT NULL DEFAULT 0,
          total_amount_pesewas BIGINT NOT NULL DEFAULT 0,
          status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
          idempotency_key VARCHAR(255),
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await safeDDL('ag_bs_rename', `
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bulk_submissions' AND column_name = 'title')
             AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bulk_submissions' AND column_name = 'name') THEN
              ALTER TABLE bulk_submissions RENAME COLUMN title TO name;
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bulk_submissions' AND column_name = 'batch_name')
             AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bulk_submissions' AND column_name = 'name') THEN
              ALTER TABLE bulk_submissions RENAME COLUMN batch_name TO name;
          END IF;
        END $$
      `);

      await safeDDL('ag_bs_cols', `
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT 'Bulk Order';
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS total_count INT NOT NULL DEFAULT 0;
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS processed_count INT NOT NULL DEFAULT 0;
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS success_count INT NOT NULL DEFAULT 0;
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS failed_count INT NOT NULL DEFAULT 0;
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS total_amount_pesewas BIGINT NOT NULL DEFAULT 0;
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'PENDING';
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      `);

      await safeDDL('ag_ord_cols', `
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS paused_from_status VARCHAR(50);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS failure_reason TEXT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS public_id VARCHAR(100);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255)
      `);

      const submissionPublicId = `sub_${crypto.randomBytes(12).toString('hex')}`;
      const submissionRef = `BLK-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

      // Pre-calculate grand total
      for (const r of acceptedRecipients) {
        let unitPricePesewas = Math.round(r.dataSizeGb * 420);
        try {
          const productRes = await client.query(
            `SELECT id, agent_price_pesewas as "agentPrice", base_price_pesewas as "basePrice"
             FROM catalog_products
             WHERE network = $1 AND data_amount_mb = $2 AND is_active = TRUE
             LIMIT 1`,
            [netUpper, Math.round(r.dataSizeGb * 1024)],
          );
          if (productRes.rows.length > 0) {
            unitPricePesewas = productRes.rows[0].agentPrice || productRes.rows[0].basePrice || unitPricePesewas;
          }
        } catch {}
        grandTotalPesewas += unitPricePesewas;
      }

      // Check agent wallet balance and verify sufficient funds
      const userRes = await client.query(
        `SELECT wallet_balance_pesewas, wallet_balance FROM users WHERE id = $1 FOR UPDATE`,
        [userId],
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

      if (currentBalancePesewas < grandTotalPesewas) {
        const have = (currentBalancePesewas / 100).toFixed(2);
        const need = (grandTotalPesewas / 100).toFixed(2);
        throw new InsufficientBalanceError(
          `Insufficient agent wallet balance: have ${have} GHS, need ${need} GHS`,
        );
      }

      // Debit agent wallet for the grand total
      await client.query(
        `UPDATE users
         SET wallet_balance_pesewas = GREATEST(0, COALESCE(wallet_balance_pesewas, ROUND(COALESCE(wallet_balance, 0)::numeric * 100, 0)) - $1),
             wallet_balance = GREATEST(0, ROUND((COALESCE(wallet_balance_pesewas, ROUND(COALESCE(wallet_balance, 0)::numeric * 100, 0)) - $1) / 100.0, 2)),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [grandTotalPesewas, userId],
      );

      const isPaused = await this.isOrderProcessingPaused();

      // Insert Bulk Submission
      const subRes = await client.query(
        `INSERT INTO bulk_submissions (
          user_id, name, total_count, total_amount_pesewas, status, idempotency_key
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [
          userId,
          `Bulk ${netUpper} (${acceptedRecipients.length} recipients)`,
          acceptedRecipients.length,
          grandTotalPesewas,
          'PROCESSING',
          params.idempotencyKey,
        ],
      );
      const subDbId = subRes.rows[0].id;
      const createdChildOrderIds: string[] = [];

      // Create one child order per distinct bundle size (ascending)
      for (const sizeGb of sortedSizes) {
        const recipientsForSize = sizeMap.get(sizeGb)!;
        const count = recipientsForSize.length;
        let unitPricePesewas = Math.round(sizeGb * 420);
        let matchedProductId: string | null = null;

        try {
          const productRes = await client.query(
            `SELECT id, agent_price_pesewas as "agentPrice", base_price_pesewas as "basePrice"
             FROM catalog_products
             WHERE network = $1 AND data_amount_mb = $2 AND is_active = TRUE
             LIMIT 1`,
            [netUpper, Math.round(sizeGb * 1024)],
          );
          if (productRes.rows.length > 0) {
            matchedProductId = productRes.rows[0].id;
            unitPricePesewas = productRes.rows[0].agentPrice || productRes.rows[0].basePrice || unitPricePesewas;
          }
        } catch {}

        const groupAmountPesewas = count * unitPricePesewas;
        const childPublicId = `ord_${crypto.randomBytes(12).toString('hex')}`;
        const childRef = `TXN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        const childOrderRes = await client.query(
          `INSERT INTO orders (
            public_id, user_id, agent_id, product_id, recipient_phone,
            network, data_amount_mb, amount_pesewas, currency,
            pricing_snapshot, payment_status, order_status, provider_status,
            refund_status, idempotency_key, is_paused, paused_at, paused_from_status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'GHS', $9, 'PAID', $10, 'UNKNOWN', 'NONE', $11, $12, $13, $14)
          RETURNING id`,
          [
            childPublicId,
            userId,
            agentId,
            matchedProductId,
            recipientsForSize[0].phoneNumber,
            netUpper,
            Math.round(sizeGb * 1024),
            groupAmountPesewas,
            JSON.stringify({
              sizeGb,
              groupSizeGb: sizeGb,
              unitPricePesewas,
              beneficiaryCount: count,
              confirmedPorted: params.confirmedPorted,
              placedDuringFreeze: isPaused ? true : undefined,
              beneficiaries: recipientsForSize.map((r) => ({
                id: `ben_${crypto.randomBytes(6).toString('hex')}`,
                phoneNumber: r.phoneNumber,
                dataVolumeGb: Number(sizeGb).toFixed(2),
                amount: (unitPricePesewas / 100).toFixed(2),
                network: netUpper,
                status: 'received',
                isPorted: r.isPorted,
              })),
            }),
            isPaused ? 'PAUSED' : 'READY_FOR_FULFILLMENT',
            `${params.idempotencyKey}_${sizeGb}gb_${Date.now()}`,
            isPaused,
            isPaused ? new Date() : null,
            isPaused ? 'READY_FOR_FULFILLMENT' : null,
          ],
        );

        const childOrderId = childOrderRes.rows[0].id;
        createdChildOrderIds.push(childOrderId);

        if (matchedProductId) {
          await client.query(
            `INSERT INTO order_items (order_id, product_id, quantity, unit_price_pesewas, total_pesewas)
             VALUES ($1, $2, $3, $4, $5)`,
            [childOrderId, matchedProductId, count, unitPricePesewas, groupAmountPesewas],
          ).catch(() => {});
        }

        await client.query(
          `INSERT INTO provider_orders (order_id, provider_name, provider_reference, provider_status)
           VALUES (
             $1,
              COALESCE(
                (SELECT primary_provider_name FROM telecom_networks WHERE UPPER(code) = UPPER($3) AND (is_active = TRUE OR status = 'ACTIVE') LIMIT 1),
                (SELECT name FROM telecom_providers WHERE is_authoritative = TRUE AND (is_active = TRUE OR status = 'ACTIVE') LIMIT 1),
                (SELECT name FROM telecom_providers WHERE is_active = TRUE OR status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1),
                'DataHouse'
              ),
             $2,
             'UNKNOWN'
           )`,
          [childOrderId, childRef, netUpper],
        ).catch(() => {});

        for (const r of recipientsForSize) {
          await client.query(
            `INSERT INTO bulk_submission_items (submission_id, order_id, recipient_phone, product_id, amount_pesewas, status)
             VALUES ($1, $2, $3, $4, $5, 'READY_FOR_FULFILLMENT')`,
            [subDbId, childOrderId, r.phoneNumber, matchedProductId, unitPricePesewas],
          ).catch(() => {});
        }

        childOrders.push({
          id: childPublicId,
          publicId: childPublicId,
          referenceCode: childRef,
          sizeGb,
          beneficiaryCount: count,
          amount: (groupAmountPesewas / 100).toFixed(2),
          status: 'received',
        });
      }

      // Post double-entry financial ledger journal lines
      const platformSystemAccountId = '00000000-0000-0000-0000-000000000000';
      await this.ledgerService.recordJournalEntries(client, [
        {
          entryType: LedgerEntryType.DEBIT,
          accountType: LedgerAccountType.AGENT_WALLET,
          accountId: userId,
          amountPesewas: grandTotalPesewas,
          currency: Currency.GHS,
          referenceType: 'ORDER',
          referenceId: submissionPublicId,
          description: `Bulk data bundle purchase for ${acceptedRecipients.length} recipients (${netUpper})`,
        },
        {
          entryType: LedgerEntryType.CREDIT,
          accountType: LedgerAccountType.PLATFORM_ESCROW,
          accountId: platformSystemAccountId,
          amountPesewas: grandTotalPesewas,
          currency: Currency.GHS,
          referenceType: 'ORDER',
          referenceId: submissionPublicId,
          description: `Platform escrow credited for bulk submission ${submissionPublicId}`,
        },
      ]).catch((ledgerErr) => {
        logger.warn(
          { err: ledgerErr?.message, submissionId: submissionPublicId },
          '[BULK_ORDER_SERVICE] Agent bulk ledger journal entry failed — order proceeds without audit log',
        );
      });

      const bulkResult: AgentBulkOrderResult = {
        id: submissionPublicId,
        referenceCode: submissionRef,
        network: netUpper,
        amount: (grandTotalPesewas / 100).toFixed(2),
        status: 'received',
        createdAt: new Date().toISOString(),
        beneficiaryCount: acceptedRecipients.length,
        groupCount: childOrders.length,
        orders: childOrders,
        blocked,
      };

      if (this.idempotencyService && params.idempotencyKey) {
        await this.idempotencyService.saveResponse(client, {
          key: params.idempotencyKey,
          userId,
          endpoint: '/agent/orders/bulk',
          requestHash,
          responseStatus: 201,
          responseBody: bulkResult,
        }).catch((err) => {
          logger.warn({ err: err?.message, key: params.idempotencyKey }, 'Failed to save bulk idempotency record');
        });
      }

      await client.query('COMMIT');

      // Dispatch order.received webhook events for the agent
      const webhookDispatcher = new AgentWebhookDispatcherService(this.db);
      for (const orderId of createdChildOrderIds) {
        webhookDispatcher.dispatchAgentEvent(agentId, 'order.received', {
          id: orderId,
          order_id: orderId,
          submission_id: submissionPublicId,
          network: netUpper,
          status: 'received',
          created_at: new Date().toISOString(),
        }).catch(() => {});
      }

      // Dispatch all child orders to fulfillment pipeline
      if (!isPaused) {
        logger.info(
          { submissionId: submissionPublicId, count: createdChildOrderIds.length },
          '[BULK_ORDER_SERVICE] Agent bulk submission dispatching child orders to fulfillment pipeline',
        );
        for (const orderId of createdChildOrderIds) {
          if (this.fulfillmentQueueService) {
            this.fulfillmentQueueService
              .enqueueOrderFulfillment({
                orderId,
                correlationId: `bulk_${submissionPublicId}`,
                idempotencyKey: `bulk_sub_${orderId}`,
                attemptCount: 1,
              })
              .catch(() => {});
          }
          if (this.fulfillmentWorker) {
            setImmediate(() => {
              this.fulfillmentWorker!
                .processOrderFulfillment(orderId, `bulk_${submissionPublicId}`)
                .catch((err) => {
                  logger.error({ err, orderId }, 'Agent bulk child order background fulfillment error');
                });
            });
          }
        }
      } else {
        logger.info(
          { submissionId: submissionPublicId, count: createdChildOrderIds.length },
          '[BULK_ORDER_SERVICE] Agent bulk submission child orders held in PAUSED status (Operational Freeze) without telecom dispatch',
        );
      }

      return bulkResult;
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err?.code) {
        if (err.code === '42703') {
          throw new BadRequestError(`Database schema mismatch (missing column): ${err.message || 'Unknown column'}`);
        }
        if (err.code === '42P01') {
          throw new BadRequestError(`Database table missing: ${err.message || 'Unknown table'}`);
        }
        if (err.code === '23503') {
          throw new BadRequestError(`Invalid reference: foreign key violation (${err.detail || err.message})`);
        }
        if (err.code === '23505') {
          throw new BadRequestError(`Duplicate transaction detected (${err.detail || err.message})`);
        }
        if (err.code === '23514') {
          throw new BadRequestError(`Constraint violation: ${err.detail || err.message}`);
        }
      }
      // Catch any remaining PostgreSQL errors
      if (err?.code && typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code)) {
        throw new BadRequestError(
          `Database error [${err.code}]: ${err.message}${err.detail ? ' — ' + err.detail : ''}`,
        );
      }
      if (err?.message?.includes('current transaction is aborted')) {
        throw new BadRequestError('A database schema issue prevented the order. Please contact support or retry.');
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Helper to parse Excel XLSX buffer into recipients array for dashboard upload.
   */
  public parseXlsxRecipients(buffer: Buffer | ArrayBuffer): Array<{ phoneNumber: string; dataSizeGb: number }> {
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new BadRequestError('Uploaded spreadsheet has no sheets.');
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      throw new BadRequestError('Worksheet is empty or corrupted.');
    }

    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
    if (!rawRows || rawRows.length === 0) {
      throw new BadRequestError('Spreadsheet contains no data rows.');
    }

    let phoneCol = 0;
    let volumeCol = 1;
    let startRow = 0;

    // Detect header row
    for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;
      let foundPhone = -1;
      let foundVol = -1;

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim().toLowerCase();
        if (val.includes('phone') || val.includes('msisdn') || val.includes('recipient') || val.includes('number') || val.includes('beneficiary')) {
          foundPhone = c;
        } else if (val.includes('data') || val.includes('volume') || val.includes('gb') || val.includes('size') || val.includes('bundle')) {
          foundVol = c;
        }
      }

      if (foundPhone !== -1 || foundVol !== -1) {
        if (foundPhone !== -1) phoneCol = foundPhone;
        if (foundVol !== -1) volumeCol = foundVol;
        startRow = r + 1;
        break;
      }
    }

    const recipients: Array<{ phoneNumber: string; dataSizeGb: number }> = [];

    for (let r = startRow; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!Array.isArray(row) || row.length === 0) continue;
      const rawPhone = String(row[phoneCol] || '').trim();
      const rawVol = String(row[volumeCol] || '').trim();
      if (!rawPhone && !rawVol) continue;

      const norm = this.normalizePhone(rawPhone);
      if (!norm.valid) continue;

      let sizeGb = parseFloat(rawVol.toLowerCase().replace(/gb/g, '').replace(/mb/g, '').trim());
      if (isNaN(sizeGb)) sizeGb = 1;
      if (rawVol.toLowerCase().includes('mb') || sizeGb >= 100) {
        sizeGb = sizeGb / 1024;
      }

      recipients.push({
        phoneNumber: norm.normalized,
        dataSizeGb: sizeGb,
      });
    }

    if (recipients.length === 0) {
      throw new BadRequestError('No valid recipient rows found in uploaded spreadsheet.');
    }

    return recipients;
  }

  private normalizePhone(phone: string): { normalized: string; valid: boolean; raw: string } {
    const raw = String(phone || '').trim();
    let clean = raw.replace(/[\s\-()]/g, '');

    if (clean.startsWith('+233')) {
      clean = '0' + clean.slice(4);
    } else if (clean.startsWith('233') && clean.length === 12) {
      clean = '0' + clean.slice(3);
    } else if (/^[235]\d{8}$/.test(clean)) {
      clean = '0' + clean;
    }

    const valid = /^0[235]\d{8}$/.test(clean);
    return {
      raw,
      normalized: valid ? clean : raw,
      valid,
    };
  }
}

