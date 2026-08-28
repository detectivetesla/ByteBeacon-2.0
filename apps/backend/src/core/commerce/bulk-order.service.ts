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
import { FinancialLedgerService } from '../payments/financial-ledger.service.js';
import { BadRequestError, NotFoundError, ForbiddenError, UnprocessableEntityError } from '../errors/app-error.js';

export class BulkOrderService {
  private readonly db: pg.Pool;
  private readonly catalogService: CatalogService;
  private readonly ledgerService: FinancialLedgerService;

  constructor(db: pg.Pool, catalogService: CatalogService, ledgerService?: FinancialLedgerService) {
    this.db = db;
    this.catalogService = catalogService;
    this.ledgerService = ledgerService ?? new FinancialLedgerService(db);
  }

  public async createBulkSubmission(
    input: CreateBulkSubmissionRequest,
    userId: string,
  ): Promise<BulkSubmissionDetailsDto> {
    if (!input.name || !input.items || !Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestError('Bulk submission name and a non-empty items array are required');
    }

    if (input.items.length > 5000) {
      throw new BadRequestError('Bulk submission exceeds maximum batch limit of 5,000 items per request');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // 1. Resolve each item's product price from server catalog
      let totalAmountPesewas = 0;
      const itemsToInsert: Array<{
        recipientPhone: string;
        productId: string;
        amountPesewas: number;
      }> = [];

      for (const item of input.items) {
        const product = await this.catalogService.getProductById(item.productId);
        const cleanPhone = item.recipientPhone.trim().replace(/\s+/g, '');
        let itemPrice = product.basePricePesewas;

        try {
          const userPriceRes = await client.query(
            `SELECT custom_price_pesewas FROM user_pricing WHERE user_id = $1 AND product_id = $2 AND is_active = TRUE`,
            [userId, product.id],
          );
          if (userPriceRes?.rows?.length > 0 && userPriceRes.rows[0]?.custom_price_pesewas) {
            itemPrice = parseInt(userPriceRes.rows[0].custom_price_pesewas, 10);
          }
        } catch {
          // ignore fallback to base price
        }

        totalAmountPesewas += itemPrice;

        itemsToInsert.push({
          recipientPhone: cleanPhone,
          productId: product.id,
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
          throw new BadRequestError(
            `Insufficient wallet balance. Required: GH₵ ${(totalAmountPesewas / 100).toFixed(2)}, Available: GH₵ ${(currentBalancePesewas / 100).toFixed(2)}. Please top up your wallet.`,
          );
        }

        await client.query(
          `UPDATE users
           SET wallet_balance_pesewas = GREATEST(0, COALESCE(wallet_balance_pesewas, 0) - $1),
               wallet_balance = GREATEST(0, ROUND((COALESCE(wallet_balance_pesewas, 0) - $1) / 100.0, 2)),
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

      const subRes = await client.query(subQuery, [
        userId,
        input.name.trim(),
        itemsToInsert.length,
        totalAmountPesewas,
        isWalletPayment ? 'PROCESSING' : 'PENDING',
        input.idempotencyKey || null,
      ]);
      const subRow = subRes.rows[0];

      // 3. Batch Insert Items
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

      for (const item of itemsToInsert) {
        const itemRes = await client.query(
          `INSERT INTO bulk_submission_items (submission_id, recipient_phone, product_id, amount_pesewas, status)
           VALUES ($1, $2, $3, $4, 'CREATED')
           RETURNING id, submission_id as "submissionId", order_id as "orderId",
                     recipient_phone as "recipientPhone", product_id as "productId",
                     amount_pesewas as "amountPesewas", status, error_message as "errorMessage",
                     created_at as "createdAt"`,
          [subRow.id, item.recipientPhone, item.productId, item.amountPesewas],
        );
        const ir = itemRes.rows[0];
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

      if (isWalletPayment) {
        const platformSystemAccountId = '00000000-0000-0000-0000-000000000000';
        await this.ledgerService.recordJournalEntries(client, [
          {
            entryType: LedgerEntryType.DEBIT,
            accountType: LedgerAccountType.CUSTOMER_WALLET,
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
        ]);
      }

      await client.query('COMMIT');

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
    } catch (err) {
      await client.query('ROLLBACK');
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
    agentOrUserId: string;
    isSandbox?: boolean;
    network: NetworkProvider | string;
    recipients: Array<{ phoneNumber: string; dataSizeGb: number }>;
    idempotencyKey: string;
    confirmedPorted?: string[];
    onUnvalidated?: 'set_aside' | 'reject';
  }): Promise<AgentBulkOrderResult> {
    // 1. Sandbox key check
    if (params.isSandbox) {
      const err = new BadRequestError('Bulk orders are not allowed on sandbox API keys. Please use a live API key.');
      (err as any).code = 'BULK_NOT_ON_SANDBOX';
      throw err;
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
      // fallback to provided ID
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
    }> = [];

    if (netUpper === 'MTN') {
      const allPhones = Array.from(new Set(normalizedRecipients.map((r) => r.normalizedPhone)));
      const knownPhones = new Set<string>();

      try {
        const valRes = await this.db.query(
          `SELECT phone_number as "phone" FROM beneficiary_validation
           WHERE phone_number = ANY($1) AND network = 'MTN' AND validation_status IN ('VALID', 'APPROVED')`,
          [allPhones],
        );
        for (const row of valRes.rows) {
          knownPhones.add(row.phone);
        }

        const prevOrdersRes = await this.db.query(
          `SELECT DISTINCT recipient_phone as "phone" FROM orders
           WHERE recipient_phone = ANY($1) AND network = 'MTN' AND order_status IN ('COMPLETED', 'DELIVERED')`,
          [allPhones],
        );
        for (const row of prevOrdersRes.rows) {
          knownPhones.add(row.phone);
        }
      } catch {
        // Table or query fallback
      }

      const unvalidatedPhones: string[] = [];

      for (const r of normalizedRecipients) {
        const isKnown = knownPhones.has(r.normalizedPhone);
        if (isKnown) {
          acceptedRecipients.push({
            phoneNumber: r.normalizedPhone,
            dataSizeGb: r.dataSizeGb,
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

        // Record unvalidated numbers into beneficiary_validation for MTN approval
        try {
          for (const phone of unvalidatedPhones) {
            await this.db.query(
              `INSERT INTO beneficiary_validation (phone_number, network, validation_status, created_at, updated_at)
               VALUES ($1, 'MTN', 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
               ON CONFLICT (phone_number, network) DO NOTHING`,
              [phone],
            );
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

    // 6. Group accepted recipients by distinct bundle size (ascending)
    const sizeMap = new Map<number, Array<{ phoneNumber: string; dataSizeGb: number }>>();
    for (const r of acceptedRecipients) {
      const list = sizeMap.get(r.dataSizeGb) || [];
      list.push(r);
      sizeMap.set(r.dataSizeGb, list);
    }

    const sortedSizes = Array.from(sizeMap.keys()).sort((a, b) => a - b);
    const childOrders: AgentBulkChildOrderDto[] = [];
    let grandTotalPesewas = 0;

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const submissionPublicId = `sub_${crypto.randomBytes(12).toString('hex')}`;
      const submissionRef = `BLK-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

      for (const sizeGb of sortedSizes) {
        const recipientsForSize = sizeMap.get(sizeGb)!;
        const count = recipientsForSize.length;

        // Determine price per unit: e.g. 4.20 GHS per GB -> Math.round(sizeGb * 420) pesewas
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
            let price = productRes.rows[0].agentPrice || productRes.rows[0].basePrice || unitPricePesewas;

            // Check user_pricing override
            try {
              const userPriceRes = await client.query(
                `SELECT custom_price_pesewas FROM user_pricing WHERE user_id = $1 AND product_id = $2 AND is_active = TRUE`,
                [userId, matchedProductId],
              );
              if (userPriceRes?.rows?.length > 0 && userPriceRes.rows[0]?.custom_price_pesewas) {
                price = parseInt(userPriceRes.rows[0].custom_price_pesewas, 10);
              } else {
                // Check agent_pricing if agent record exists
                const agentPriceRes = await client.query(
                  `SELECT ap.custom_price_pesewas FROM agent_pricing ap
                   JOIN agents a ON a.id = ap.agent_id
                   WHERE a.user_id = $1 AND ap.product_id = $2 AND ap.is_active = TRUE`,
                  [userId, matchedProductId],
                );
                if (agentPriceRes?.rows?.length > 0 && agentPriceRes.rows[0]?.custom_price_pesewas) {
                  price = parseInt(agentPriceRes.rows[0].custom_price_pesewas, 10);
                }
              }
            } catch {
              // ignore
            }

            unitPricePesewas = price;
          }
        } catch {
          // fallback
        }

        const childTotalPesewas = unitPricePesewas * count;
        grandTotalPesewas += childTotalPesewas;

        const childPublicId = `ord_${crypto.randomBytes(12).toString('hex')}`;
        const childRef = `TXN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        // Insert child order
        const childOrderRes = await client.query(
          `INSERT INTO orders (
            public_id, user_id, agent_id, product_id, recipient_phone,
            network, data_amount_mb, amount_pesewas, currency,
            pricing_snapshot, payment_status, order_status, provider_status,
            refund_status, idempotency_key
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'GHS', $9, 'PAID', 'CREATED', 'RECEIVED', 'NONE', $10)
          RETURNING id`,
          [
            childPublicId,
            userId,
            agentId,
            matchedProductId,
            recipientsForSize[0]?.phoneNumber || '0000000000',
            netUpper,
            Math.round(sizeGb * 1024),
            childTotalPesewas,
            JSON.stringify({ sizeGb, count, unitPricePesewas }),
            `${params.idempotencyKey}_${sizeGb}`,
          ],
        );

        const childOrderId = childOrderRes.rows[0].id;

        // Insert provider order projection
        const envProvider = (process.env.AUTHORITATIVE_PROVIDER || '').trim();
        const activeProviderName = envProvider || 'DataHouse';
        await client.query(
          `INSERT INTO provider_orders (order_id, provider_name, provider_reference, provider_status)
           VALUES ($1, $2, $3, 'RECEIVED')`,
          [childOrderId, activeProviderName, childRef],
        );

        childOrders.push({
          id: childPublicId,
          publicId: childPublicId,
          referenceCode: childRef,
          sizeGb,
          beneficiaryCount: count,
          amount: (childTotalPesewas / 100).toFixed(2),
          status: 'received',
        });
      }

      // Insert Bulk Submission
      const subRes = await client.query(
        `INSERT INTO bulk_submissions (
          user_id, name, total_count, total_amount_pesewas, status, idempotency_key
        )
        VALUES ($1, $2, $3, $4, 'PROCESSING', $5)
        RETURNING id`,
        [
          userId,
          `Bulk ${netUpper} (${acceptedRecipients.length} recipients)`,
          acceptedRecipients.length,
          grandTotalPesewas,
          params.idempotencyKey,
        ],
      );
      const subDbId = subRes.rows[0].id;

      // Insert bulk items
      for (const r of acceptedRecipients) {
        await client.query(
          `INSERT INTO bulk_submission_items (submission_id, recipient_phone, product_id, amount_pesewas, status)
           VALUES ($1, $2, (SELECT id FROM catalog_products WHERE network = $3 LIMIT 1), $4, 'CREATED')`,
          [subDbId, r.phoneNumber, netUpper, Math.round(r.dataSizeGb * 420)],
        ).catch(() => {});
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
        throw new BadRequestError(
          `Insufficient wallet balance. Required: GH₵ ${(grandTotalPesewas / 100).toFixed(2)}, Available: GH₵ ${(currentBalancePesewas / 100).toFixed(2)}. Please top up your wallet.`,
        );
      }

      // Debit agent wallet for the linear per-GB total
      await client.query(
        `UPDATE users
         SET wallet_balance_pesewas = GREATEST(0, COALESCE(wallet_balance_pesewas, 0) - $1),
             wallet_balance = GREATEST(0, ROUND((COALESCE(wallet_balance_pesewas, 0) - $1) / 100.0, 2)),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [grandTotalPesewas, userId],
      );

      // Post double-entry financial ledger journal lines
      const platformSystemAccountId = '00000000-0000-0000-0000-000000000000';
      await this.ledgerService.recordJournalEntries(client, [
        {
          entryType: LedgerEntryType.DEBIT,
          accountType: LedgerAccountType.CUSTOMER_WALLET,
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
      ]);

      await client.query('COMMIT');

      return {
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
    } catch (err) {
      await client.query('ROLLBACK');
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

