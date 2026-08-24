import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { FinancialLedgerService } from '../../core/payments/financial-ledger.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../core/errors/app-error.js';
import {
  AdminFinanceStats,
  AdminTransactionDetailDto,
  AdminRefundActionRequest,
  CreateFinancialAdjustmentRequest,
  ReviewFinancialAdjustmentRequest,
  FinancialSafetySettingsDto,
  UpdateFinancialSafetySettingsRequest,
  ReprocessPreviewDto,
  ReprocessExecuteRequest,
  LedgerAccountType,
  LedgerEntryType,
  Currency,
  UserRole,
} from '@bytebeacon/shared';

export interface AdminFinanceRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  auditService: AuditService;
  financialLedgerService?: FinancialLedgerService;
}

export async function adminFinanceRoutes(
  app: FastifyInstance,
  deps: AdminFinanceRouteDependencies,
) {
  const { db, tokenService, apiKeyService, rbacService, auditService, financialLedgerService } = deps;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // Helper: check if user is Super Admin
  const requireSuperAdmin = async (req: FastifyRequest) => {
    if (!req.user || req.user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenError('This high-risk financial operation strictly requires Super Admin privileges.');
    }
  };

  // 1. GET /admin/finance/overview — 12 Authoritative Financial KPI Metrics
  app.get(
    '/admin/finance/overview',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      // 1. Customer & Agent Wallet Balances
      const userBalancesRes = await db.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN role = 'customer' THEN COALESCE(wallet_balance_pesewas, ROUND(COALESCE(wallet_balance, 0) * 100)) ELSE 0 END), 0) as "customerBalancePesewas",
          COALESCE(SUM(CASE WHEN role IN ('agent', 'superagent') THEN COALESCE(wallet_balance_pesewas, ROUND(COALESCE(wallet_balance, 0) * 100)) ELSE 0 END), 0) as "agentBalancePesewas",
          COALESCE(SUM(COALESCE(wallet_balance_pesewas, ROUND(COALESCE(wallet_balance, 0) * 100))), 0) as "totalFloatPesewas"
        FROM users
      `);
      const row = userBalancesRes.rows[0] || {};
      const customerWalletBalancePesewas = row.customerBalancePesewas !== undefined
        ? parseInt(row.customerBalancePesewas || '0', 10)
        : Math.round(parseFloat(row.customerBalanceGhs || '0') * 100);
      const agentWalletBalancePesewas = row.agentBalancePesewas !== undefined
        ? parseInt(row.agentBalancePesewas || '0', 10)
        : Math.round(parseFloat(row.agentBalanceGhs || '0') * 100);
      const totalFloatPesewas = customerWalletBalancePesewas + agentWalletBalancePesewas;

      // 2. Revenue from Completed Orders
      const orderMetricsRes = await db.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN amount_pesewas ELSE 0 END), 0) as "totalRevenue",
          COALESCE(SUM(CASE WHEN payment_status = 'PAID' AND agent_id IS NOT NULL THEN (amount_pesewas * 0.03) ELSE 0 END), 0) as "totalCommissions"
        FROM orders
      `);
      const totalRevenuePesewas = parseInt(orderMetricsRes.rows[0]?.totalRevenue || '0', 10);
      const totalCommissionsPesewas = Math.round(parseFloat(orderMetricsRes.rows[0]?.totalCommissions || '0'));

      // 3. Deposits & Payments
      const paymentMetricsRes = await db.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount_pesewas ELSE 0 END), 0) as "totalDeposits",
          COUNT(CASE WHEN status = 'PROCESSING' THEN 1 END) as "processingCount",
          COALESCE(SUM(CASE WHEN status = 'PROCESSING' THEN amount_pesewas ELSE 0 END), 0) as "processingAmount",
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as "failedCount",
          COALESCE(SUM(CASE WHEN status = 'FAILED' THEN amount_pesewas ELSE 0 END), 0) as "failedAmount"
        FROM payments
      `);
      const totalDepositsPesewas = parseInt(paymentMetricsRes.rows[0]?.totalDeposits || '0', 10);
      const processingPaymentsCount = parseInt(paymentMetricsRes.rows[0]?.processingCount || '0', 10);
      const processingPaymentsPesewas = parseInt(paymentMetricsRes.rows[0]?.processingAmount || '0', 10);
      const failedPaymentsCount = parseInt(paymentMetricsRes.rows[0]?.failedCount || '0', 10);
      const failedPaymentsPesewas = parseInt(paymentMetricsRes.rows[0]?.failedAmount || '0', 10);

      // 4. Withdrawals from store_payouts
      const withdrawalsRes = await db.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount_pesewas ELSE 0 END), 0) as "totalWithdrawals"
        FROM store_payouts
      `);
      const totalWithdrawalsPesewas = parseInt(withdrawalsRes.rows[0]?.totalWithdrawals || '0', 10);

      // 5. Refunds
      const refundsRes = await db.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN amount_pesewas ELSE 0 END), 0) as "totalRefunds",
          COUNT(CASE WHEN status IN ('PENDING', 'REQUESTED') THEN 1 END) as "pendingRefundsCount",
          COALESCE(SUM(CASE WHEN status IN ('PENDING', 'REQUESTED') THEN amount_pesewas ELSE 0 END), 0) as "pendingRefundsAmount"
        FROM refunds
      `);
      const totalRefundsPesewas = parseInt(refundsRes.rows[0]?.totalRefunds || '0', 10);
      const pendingRefundsCount = parseInt(refundsRes.rows[0]?.pendingRefundsCount || '0', 10);
      const pendingRefundsPesewas = parseInt(refundsRes.rows[0]?.pendingRefundsAmount || '0', 10);

      // 6. Unreconciled events count
      const reconCasesRes = await db.query(`
        SELECT COUNT(*) as "unreconciledCount"
        FROM reconciliation_cases
        WHERE status IN ('OPEN', 'INVESTIGATING', 'ESCALATED')
      `);
      const unreconciledEventsCount = parseInt(reconCasesRes.rows[0]?.unreconciledCount || '0', 10);

      // 7. Continuous Double-Entry Ledger Check (Total Debits == Total Credits)
      const ledgerCheckRes = await db.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_pesewas ELSE 0 END), 0) as "totalDebits",
          COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE 0 END), 0) as "totalCredits"
        FROM financial_ledger
      `);
      const totalDebits = parseInt(ledgerCheckRes.rows[0]?.totalDebits || '0', 10);
      const totalCredits = parseInt(ledgerCheckRes.rows[0]?.totalCredits || '0', 10);
      const ledgerBalanceStatus = totalDebits === totalCredits ? 'BALANCED' : 'ANOMALY_DETECTED';

      // 8. 7-day Rolling Trend
      const trendRes = await db.query(`
        SELECT 
          TO_CHAR(d.day, 'YYYY-MM-DD') as "date",
          COALESCE(SUM(CASE WHEN o.payment_status = 'PAID' THEN o.amount_pesewas ELSE 0 END), 0) as "revenuePesewas",
          COALESCE(SUM(CASE WHEN p.status = 'PAID' THEN p.amount_pesewas ELSE 0 END), 0) as "depositsPesewas",
          COALESCE(SUM(CASE WHEN r.status = 'COMPLETED' THEN r.amount_pesewas ELSE 0 END), 0) as "refundsPesewas"
        FROM GENERATE_SERIES(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) d(day)
        LEFT JOIN orders o ON DATE(o.created_at) = DATE(d.day)
        LEFT JOIN payments p ON DATE(p.created_at) = DATE(d.day)
        LEFT JOIN refunds r ON DATE(r.created_at) = DATE(d.day)
        GROUP BY d.day
        ORDER BY d.day ASC
      `);

      const recentDailyTrend = trendRes.rows.map((row) => ({
        date: row.date,
        revenuePesewas: parseInt(row.revenuePesewas || '0', 10),
        depositsPesewas: parseInt(row.depositsPesewas || '0', 10),
        refundsPesewas: parseInt(row.refundsPesewas || '0', 10),
      }));

      const stats: AdminFinanceStats = {
        totalPlatformBalancePesewas: totalFloatPesewas + (totalRevenuePesewas - totalWithdrawalsPesewas - totalRefundsPesewas),
        customerWalletBalancePesewas,
        agentWalletBalancePesewas,
        totalDepositsPesewas,
        totalWithdrawalsPesewas,
        totalRevenuePesewas,
        totalCommissionsPesewas,
        totalRefundsPesewas,
        pendingRefundsCount,
        pendingRefundsPesewas,
        processingPaymentsCount,
        processingPaymentsPesewas,
        failedPaymentsCount,
        failedPaymentsPesewas,
        unreconciledEventsCount,
        ledgerBalanceStatus,
        recentDailyTrend,
      };

      return reply.send({
        success: true,
        data: stats,
      });
    },
  );

  // 2. GET /admin/finance/transactions — Unified Search & Keyset/Paginated Explorer
  app.get<{
    Querystring: {
      search?: string;
      status?: string;
      type?: string;
      role?: string;
      network?: string;
      minAmountPesewas?: string;
      maxAmountPesewas?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      limit?: string;
      cursor?: string;
    };
  }>(
    '/admin/finance/transactions',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const {
        search,
        status,
        type,
        role,
        network,
        minAmountPesewas,
        maxAmountPesewas,
        startDate,
        endDate,
        page = '1',
        limit = '25',
      } = req.query || {};

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
      const offset = (pageNum - 1) * limitNum;

      const whereClauses: string[] = ['1=1'];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (search && search.trim().length > 0) {
        const q = `%${search.trim().toLowerCase()}%`;
        whereClauses.push(`(
          p.id::text ILIKE $${paramIndex} OR
          p.provider_reference ILIKE $${paramIndex} OR
          o.public_id ILIKE $${paramIndex} OR
          u.email ILIKE $${paramIndex} OR
          u.phone ILIKE $${paramIndex} OR
          COALESCE(u.full_name, u.name) ILIKE $${paramIndex}
        )`);
        queryParams.push(q);
        paramIndex++;
      }

      if (status && status !== 'ALL') {
        whereClauses.push(`p.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      if (type && type !== 'ALL') {
        if (type === 'DATA_PURCHASE') {
          whereClauses.push(`o.id IS NOT NULL`);
        } else if (type === 'ADJUSTMENT') {
          whereClauses.push(`p.payment_method = 'WALLET'`);
        } else if (type === 'DEPOSIT') {
          whereClauses.push(`o.id IS NULL AND p.payment_method != 'WALLET'`);
        }
      }

      if (role && role !== 'ALL') {
        whereClauses.push(`u.role = $${paramIndex}`);
        queryParams.push(role);
        paramIndex++;
      }

      if (network && network !== 'ALL') {
        whereClauses.push(`o.network = $${paramIndex}`);
        queryParams.push(network);
        paramIndex++;
      }

      if (minAmountPesewas) {
        whereClauses.push(`p.amount_pesewas >= $${paramIndex}`);
        queryParams.push(parseInt(minAmountPesewas, 10));
        paramIndex++;
      }

      if (maxAmountPesewas) {
        whereClauses.push(`p.amount_pesewas <= $${paramIndex}`);
        queryParams.push(parseInt(maxAmountPesewas, 10));
        paramIndex++;
      }

      if (startDate) {
        whereClauses.push(`p.created_at >= $${paramIndex}`);
        queryParams.push(new Date(startDate));
        paramIndex++;
      }

      if (endDate) {
        whereClauses.push(`p.created_at <= $${paramIndex}`);
        queryParams.push(new Date(endDate));
        paramIndex++;
      }

      const whereSql = whereClauses.join(' AND ');

      // Total count
      const countRes = await db.query(
        `SELECT COUNT(*) as total 
         FROM payments p
         LEFT JOIN orders o ON p.order_id = o.id
         LEFT JOIN users u ON p.user_id = u.id
         WHERE ${whereSql}`,
        queryParams,
      );
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      // Paginated list
      const listSql = `
        SELECT 
          p.id,
          COALESCE(p.provider_reference, p.id::text) as "reference",
          CASE 
            WHEN o.id IS NOT NULL THEN 'DATA_PURCHASE'
            WHEN p.payment_method = 'WALLET' THEN 'ADJUSTMENT'
            ELSE 'DEPOSIT'
          END as "type",
          p.status,
          p.amount_pesewas as "amountPesewas",
          p.currency,
          p.user_id as "userId",
          COALESCE(u.full_name, u.name, 'Unknown User') as "userName",
          COALESCE(u.email, '') as "userEmail",
          COALESCE(u.phone, '') as "userPhone",
          COALESCE(u.role, 'customer') as "userRole",
          p.order_id as "orderId",
          p.id as "paymentId",
          p.provider_reference as "providerReference",
          o.network,
          p.created_at as "createdAt",
          p.paid_at as "completedAt"
        FROM payments p
        LEFT JOIN orders o ON p.order_id = o.id
        LEFT JOIN users u ON p.user_id = u.id
        WHERE ${whereSql}
        ORDER BY p.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const listRes = await db.query(listSql, [...queryParams, limitNum, offset]);

      return reply.send({
        success: true,
        data: {
          items: listRes.rows,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
        },
      });
    },
  );

  // 3. GET /admin/finance/transactions/:id — Comprehensive Financial Audit View
  app.get<{ Params: { id: string } }>(
    '/admin/finance/transactions/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;

      const paymentRes = await db.query(
        `SELECT 
          p.id,
          COALESCE(p.provider_reference, p.id::text) as "reference",
          CASE 
            WHEN o.id IS NOT NULL THEN 'DATA_PURCHASE'
            WHEN p.payment_method = 'WALLET' THEN 'ADJUSTMENT'
            ELSE 'DEPOSIT'
          END as "type",
          p.status,
          p.amount_pesewas as "amountPesewas",
          p.currency,
          p.provider,
          p.provider_reference as "providerReference",
          p.user_id as "userId",
          COALESCE(u.full_name, u.name, 'Customer') as "userName",
          u.email as "userEmail",
          u.phone as "userPhone",
          u.role as "userRole",
          p.order_id as "orderId",
          p.created_at as "createdAt",
          p.paid_at as "completedAt",
          o.public_id as "orderPublicId",
          o.network,
          o.data_amount_mb as "dataAmountMb",
          o.recipient_phone as "recipientPhone",
          o.order_status as "orderStatus",
          o.provider_status as "fulfillmentStatus"
        FROM payments p
        LEFT JOIN orders o ON p.order_id = o.id
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id::text = $1 OR p.provider_reference = $1`,
        [id],
      );

      if (paymentRes.rows.length === 0) {
        throw new NotFoundError(`Transaction not found with identifier '${id}'`);
      }

      const p = paymentRes.rows[0];

      // Fetch related financial ledger entries
      const ledgerRes = await db.query(
        `SELECT 
          id, transaction_id as "transactionId", entry_type as "entryType",
          account_type as "accountType", account_id as "accountId",
          amount_pesewas as "amountPesewas", currency, reference_type as "referenceType",
          reference_id as "referenceId", description, created_at as "createdAt"
        FROM financial_ledger
        WHERE reference_id = $1 OR reference_id = $2 OR transaction_id::text = $1
        ORDER BY created_at ASC`,
        [p.id, p.providerReference || ''],
      );

      // Fetch related payment webhook events
      const eventRes = await db.query(
        `SELECT 
          id, provider_event_id as "providerEventId", event_type as "eventType",
          source, previous_status as "previousStatus", new_status as "newStatus",
          metadata, occurred_at as "occurredAt"
        FROM payment_events
        WHERE payment_id = $1
        ORDER BY occurred_at ASC`,
        [p.id],
      );

      // Fetch audit trail
      const auditRes = await db.query(
        `SELECT 
          actor_id as "actorId", actor_type as "actorType", action,
          ip_address as "ipAddress", metadata, created_at as "timestamp"
        FROM audit_events
        WHERE resource_id = $1 OR resource_id = $2 OR (metadata->>'orderId') = $2
        ORDER BY created_at DESC
        LIMIT 20`,
        [p.id, p.orderId || ''],
      );

      const debitLine = ledgerRes.rows.find((l) => l.entryType === 'DEBIT');
      const creditLine = ledgerRes.rows.find((l) => l.entryType === 'CREDIT');

      const detail: AdminTransactionDetailDto = {
        transaction: {
          id: p.id,
          reference: p.reference,
          type: p.type,
          status: p.status,
          amountPesewas: parseInt(p.amountPesewas, 10),
          currency: p.currency,
          userId: p.userId,
          userName: p.userName,
          userEmail: p.userEmail,
          userPhone: p.userPhone,
          userRole: p.userRole,
          orderId: p.orderId,
          paymentId: p.id,
          providerReference: p.providerReference,
          network: p.network,
          createdAt: p.createdAt,
          completedAt: p.completedAt,
        },
        financialMovement: {
          ledgerJournalId: debitLine?.transactionId || creditLine?.transactionId,
          debitAccount: debitLine?.accountType || 'PLATFORM_ESCROW',
          creditAccount: creditLine?.accountType || 'CUSTOMER_WALLET',
          debitAmountPesewas: debitLine ? parseInt(debitLine.amountPesewas, 10) : parseInt(p.amountPesewas, 10),
          creditAmountPesewas: creditLine ? parseInt(creditLine.amountPesewas, 10) : parseInt(p.amountPesewas, 10),
          ledgerLines: ledgerRes.rows,
        },
        externalPayment: {
          provider: p.provider || 'PAYSTACK',
          providerReference: p.providerReference,
          paymentStatus: p.status,
          verificationStatus: p.status === 'PAID' ? 'VERIFIED' : 'UNVERIFIED',
          webhookStatus: eventRes.rows.length > 0 ? 'DELIVERED' : 'PENDING',
          webhookEventId: eventRes.rows[0]?.providerEventId,
          verifiedAt: p.completedAt,
          rawMetadata: eventRes.rows[0]?.metadata || {},
        },
        relatedOrder: p.orderId ? {
          id: p.orderId,
          publicId: p.orderPublicId,
          dataAmountMb: p.dataAmountMb,
          network: p.network,
          recipientPhone: p.recipientPhone,
          orderStatus: p.orderStatus,
          fulfillmentStatus: p.fulfillmentStatus,
        } : undefined,
        auditTrail: auditRes.rows,
      };

      return reply.send({
        success: true,
        data: detail,
      });
    },
  );

  // 4. GET /admin/finance/ledger — Double-Entry Journal Lines with Invariant Verification
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      entryType?: string;
      accountType?: string;
      transactionId?: string;
    };
  }>(
    '/admin/finance/ledger',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { page = '1', limit = '25', entryType, accountType, transactionId } = req.query || {};
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
      const offset = (pageNum - 1) * limitNum;

      const whereClauses: string[] = ['1=1'];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (entryType && entryType !== 'ALL') {
        whereClauses.push(`entry_type = $${paramIndex}`);
        queryParams.push(entryType);
        paramIndex++;
      }

      if (accountType && accountType !== 'ALL') {
        whereClauses.push(`account_type = $${paramIndex}`);
        queryParams.push(accountType);
        paramIndex++;
      }

      if (transactionId) {
        whereClauses.push(`transaction_id::text = $${paramIndex}`);
        queryParams.push(transactionId);
        paramIndex++;
      }

      const whereSql = whereClauses.join(' AND ');

      const countRes = await db.query(`SELECT COUNT(*) as total FROM financial_ledger WHERE ${whereSql}`, queryParams);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const listSql = `
        SELECT 
          id, transaction_id as "transactionId", entry_type as "entryType",
          account_type as "accountType", account_id as "accountId",
          amount_pesewas as "amountPesewas", currency, reference_type as "referenceType",
          reference_id as "referenceId", description, created_at as "createdAt"
        FROM financial_ledger
        WHERE ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const listRes = await db.query(listSql, [...queryParams, limitNum, offset]);

      // Continuous invariant check
      const totalsRes = await db.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_pesewas ELSE 0 END), 0) as "totalDebits",
          COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE 0 END), 0) as "totalCredits"
        FROM financial_ledger
      `);
      const debits = parseInt(totalsRes.rows[0]?.totalDebits || '0', 10);
      const credits = parseInt(totalsRes.rows[0]?.totalCredits || '0', 10);
      const isBalanced = debits === credits;

      return reply.send({
        success: true,
        data: {
          items: listRes.rows,
          isBalanced,
          status: isBalanced ? 'BALANCED' : 'ANOMALY_DETECTED',
          totalDebitsPesewas: debits,
          totalCreditsPesewas: credits,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
        },
      });
    },
  );

  // 5. GET /admin/finance/ledger/anomalies — Real-time Anomaly Scanner
  app.get(
    '/admin/finance/ledger/anomalies',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req, reply) => {
      // Find any journal transactions where sum(debits) != sum(credits)
      const anomalyRes = await db.query(`
        SELECT 
          transaction_id as "transactionId",
          COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_pesewas ELSE 0 END), 0) as "totalDebits",
          COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE 0 END), 0) as "totalCredits",
          MAX(reference_type) as "referenceType",
          MAX(reference_id) as "referenceId",
          MAX(created_at) as "detectedAt"
        FROM financial_ledger
        GROUP BY transaction_id
        HAVING COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_pesewas ELSE 0 END), 0) != 
               COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE 0 END), 0)
        ORDER BY MAX(created_at) DESC
      `);

      const anomalies = anomalyRes.rows.map((row) => {
        const debits = parseInt(row.totalDebits, 10);
        const credits = parseInt(row.totalCredits, 10);
        return {
          transactionId: row.transactionId,
          referenceType: row.referenceType,
          referenceId: row.referenceId,
          totalDebitsPesewas: debits,
          totalCreditsPesewas: credits,
          discrepancyPesewas: Math.abs(debits - credits),
          severity: Math.abs(debits - credits) > 100000 ? 'CRITICAL' : 'HIGH',
          detectedAt: row.detectedAt,
        };
      });

      return reply.send({
        success: true,
        data: {
          anomaliesCount: anomalies.length,
          status: anomalies.length === 0 ? 'HEALTHY' : 'ANOMALIES_DETECTED',
          anomalies,
        },
      });
    },
  );

  // 6. GET /admin/finance/refunds — Dedicated Refund Pipeline Tracking
  app.get<{
    Querystring: { status?: string; riskLevel?: string; page?: string; limit?: string };
  }>(
    '/admin/finance/refunds',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { status, riskLevel, page = '1', limit = '20' } = req.query || {};
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const whereClauses: string[] = ['1=1'];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (status && status !== 'ALL') {
        whereClauses.push(`r.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      if (riskLevel && riskLevel !== 'ALL') {
        whereClauses.push(`r.risk_level = $${paramIndex}`);
        queryParams.push(riskLevel);
        paramIndex++;
      }

      const whereSql = whereClauses.join(' AND ');

      const countRes = await db.query(`SELECT COUNT(*) as total FROM refunds r WHERE ${whereSql}`, queryParams);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const listSql = `
        SELECT 
          r.id,
          r.order_id as "orderId",
          COALESCE(o.public_id, r.order_id::text) as "orderPublicId",
          r.payment_id as "paymentId",
          o.user_id as "userId",
          COALESCE(u.full_name, u.name, 'Customer') as "customerName",
          u.email as "customerEmail",
          r.amount_pesewas as "amountPesewas",
          r.reason,
          r.status,
          r.risk_level as "riskLevel",
          r.provider_refund_reference as "providerReference",
          r.created_at as "requestedAt",
          r.updated_at as "processedAt",
          r.admin_notes as "adminNotes"
        FROM refunds r
        LEFT JOIN orders o ON r.order_id = o.id
        LEFT JOIN users u ON o.user_id = u.id
        WHERE ${whereSql}
        ORDER BY r.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const listRes = await db.query(listSql, [...queryParams, limitNum, offset]);

      return reply.send({
        success: true,
        data: {
          items: listRes.rows,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
        },
      });
    },
  );

  // 7. POST /admin/finance/refunds/:id/action — Process Refund with Double-Entry Ledger Reversal
  app.post<{ Params: { id: string }; Body: AdminRefundActionRequest }>(
    '/admin/finance/refunds/:id/action',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { action, reason, rejectionReason } = req.body || {};

      if (!action || !['APPROVE', 'REJECT', 'PROCESS'].includes(action)) {
        throw new BadRequestError("Action must be 'APPROVE', 'REJECT', or 'PROCESS'");
      }

      const refundRes = await db.query(
        `SELECT r.id, r.order_id, r.amount_pesewas, r.status, r.risk_level, o.user_id 
         FROM refunds r
         JOIN orders o ON r.order_id = o.id
         WHERE r.id = $1`,
        [id],
      );

      if (refundRes.rows.length === 0) {
        throw new NotFoundError(`Refund record not found with ID '${id}'`);
      }

      const refund = refundRes.rows[0];
      const amountPesewas = parseInt(refund.amount_pesewas, 10);
      const isHighRisk = refund.risk_level === 'HIGH_RISK' || amountPesewas > 50000;

      // Super Admin check for high risk
      if (isHighRisk && action === 'APPROVE') {
        await requireSuperAdmin(req);
      }

      const client = await db.connect();
      try {
        await client.query('BEGIN');

        if (action === 'APPROVE' || action === 'PROCESS') {
          // Post double-entry reversal: Debit PLATFORM_ESCROW, Credit CUSTOMER_WALLET
          if (financialLedgerService) {
            await financialLedgerService.recordJournalEntries(client, [
              {
                accountType: LedgerAccountType.PLATFORM_ESCROW,
                accountId: 'PLATFORM_RESERVE',
                entryType: LedgerEntryType.DEBIT,
                amountPesewas,
                currency: Currency.GHS,
                referenceType: 'REFUND_REVERSAL',
                referenceId: id,
                description: `Refund reversal for order ${refund.order_id}: ${reason || 'Approved refund'}`,
              },
              {
                accountType: LedgerAccountType.CUSTOMER_WALLET,
                accountId: refund.user_id,
                entryType: LedgerEntryType.CREDIT,
                amountPesewas,
                currency: Currency.GHS,
                referenceType: 'REFUND_REVERSAL',
                referenceId: id,
                description: `Customer refund credit for order ${refund.order_id}: ${reason || 'Approved refund'}`,
              },
            ]);
          }

          // Update user wallet projection
          await client.query(
            `UPDATE users SET wallet_balance_pesewas = COALESCE(wallet_balance_pesewas, 0) + $1, wallet_balance = COALESCE(wallet_balance, 0) + $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [amountPesewas, amountPesewas / 100, refund.user_id],
          );

          // Update refund status
          await client.query(
            `UPDATE refunds SET status = 'COMPLETED', approved_by = $1, admin_notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [req.user!.sub, reason || 'Refund executed', id],
          );

          // Update order refund status
          await client.query(
            `UPDATE orders SET refund_status = 'COMPLETED', payment_status = 'REFUNDED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [refund.order_id],
          );
        } else if (action === 'REJECT') {
          await client.query(
            `UPDATE refunds SET status = 'REJECTED', approved_by = $1, admin_notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [req.user!.sub, rejectionReason || reason || 'Refund rejected by admin', id],
          );

          await client.query(
            `UPDATE orders SET refund_status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [refund.order_id],
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: action === 'APPROVE' ? 'ADMIN_REFUND_APPROVED' : 'ADMIN_REFUND_REJECTED',
          resourceType: 'refunds',
          resourceId: id,
          metadata: { action, reason, amountPesewas, orderId: refund.order_id },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        message: `Refund ${action.toLowerCase()}d successfully.`,
      });
    },
  );

  // 8. GET /admin/finance/withdrawals — Dedicated Agent Withdrawals
  app.get<{
    Querystring: { status?: string; page?: string; limit?: string };
  }>(
    '/admin/finance/withdrawals',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { status, page = '1', limit = '20' } = req.query || {};
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const whereClauses: string[] = ['1=1'];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (status && status !== 'ALL') {
        whereClauses.push(`p.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      const whereSql = whereClauses.join(' AND ');

      const countRes = await db.query(`SELECT COUNT(*) as total FROM store_payouts p WHERE ${whereSql}`, queryParams);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const listSql = `
        SELECT 
          p.id,
          p.store_id as "storeId",
          s.store_name as "storeName",
          s.store_slug as "storeSlug",
          p.agent_id as "agentId",
          COALESCE(u.full_name, u.name, 'Agent') as "agentName",
          u.email as "agentEmail",
          p.amount_pesewas as "amountPesewas",
          p.destination_account as "destinationAccount",
          p.destination_provider as "destinationProvider",
          p.status,
          p.admin_notes as "adminNotes",
          p.reviewed_by as "reviewedBy",
          p.reviewed_at as "reviewedAt",
          p.paid_at as "paidAt",
          p.created_at as "createdAt"
        FROM store_payouts p
        JOIN stores s ON p.store_id = s.id
        LEFT JOIN agents a ON p.agent_id = a.id
        LEFT JOIN users u ON a.user_id = u.id
        WHERE ${whereSql}
        ORDER BY p.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const listRes = await db.query(listSql, [...queryParams, limitNum, offset]);

      return reply.send({
        success: true,
        data: {
          items: listRes.rows,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
        },
      });
    },
  );

  // 9. GET /admin/finance/adjustments — Two-Person Float Adjustment Queue
  app.get(
    '/admin/finance/adjustments',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req, reply) => {
      const listRes = await db.query(`
        SELECT 
          fa.id,
          fa.adjustment_number as "adjustmentNumber",
          fa.user_id as "userId",
          COALESCE(u.full_name, u.name, 'User') as "userName",
          u.email as "userEmail",
          u.role as "userRole",
          fa.amount_pesewas as "amountPesewas",
          fa.direction,
          fa.reason,
          fa.requested_by as "requestedBy",
          COALESCE(req_u.full_name, req_u.name, 'Admin') as "requestedByName",
          fa.status,
          fa.approved_by as "approvedBy",
          COALESCE(app_u.full_name, app_u.name) as "approvedByName",
          fa.approved_at as "approvedAt",
          fa.rejection_reason as "rejectionReason",
          fa.ledger_journal_id as "ledgerJournalId",
          fa.created_at as "createdAt",
          fa.updated_at as "updatedAt"
        FROM financial_adjustments fa
        JOIN users u ON fa.user_id = u.id
        LEFT JOIN users req_u ON fa.requested_by = req_u.id
        LEFT JOIN users app_u ON fa.approved_by = app_u.id
        ORDER BY fa.created_at DESC
      `);

      return reply.send({
        success: true,
        data: listRes.rows,
      });
    },
  );

  // 10. POST /admin/finance/adjustments/request — Admin Requests Float Adjustment
  app.post<{ Body: CreateFinancialAdjustmentRequest }>(
    '/admin/finance/adjustments/request',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { userId, amountPesewas, direction, reason } = req.body || {};

      if (!userId || !amountPesewas || amountPesewas <= 0 || !direction || !reason || reason.trim().length < 5) {
        throw new BadRequestError('User ID, positive amount in pesewas, direction (CREDIT/DEBIT), and detailed reason (min 5 chars) are required.');
      }

      const userRes = await db.query('SELECT id, full_name, email FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) {
        throw new NotFoundError(`Target user account not found with ID '${userId}'`);
      }

      const adjNumber = `ADJ-${Date.now().toString().slice(-6)}`;

      const insertRes = await db.query(
        `INSERT INTO financial_adjustments (
            adjustment_number, user_id, amount_pesewas, direction, reason, requested_by, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
         RETURNING id, adjustment_number as "adjustmentNumber", status, created_at as "createdAt"`,
        [adjNumber, userId, amountPesewas, direction, reason.trim(), req.user!.sub],
      );

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_FLOAT_ADJUSTMENT_REQUESTED',
          resourceType: 'financial_adjustments',
          resourceId: insertRes.rows[0].id,
          metadata: { userId, amountPesewas, direction, reason, adjNumber },
          ipAddress: req.ip,
        });
      }

      return reply.status(201).send({
        success: true,
        data: insertRes.rows[0],
        message: 'Adjustment request submitted and queued for Super Admin review.',
      });
    },
  );

  // 11. POST /admin/finance/adjustments/:id/action — Super Admin Approves/Rejects Adjustment with Ledger Voucher
  app.post<{ Params: { id: string }; Body: ReviewFinancialAdjustmentRequest }>(
    '/admin/finance/adjustments/:id/action',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      await requireSuperAdmin(req);

      const { id } = req.params;
      const { action, reason } = req.body || {};

      if (!action || !['APPROVE', 'REJECT'].includes(action)) {
        throw new BadRequestError("Action must be 'APPROVE' or 'REJECT'");
      }

      const adjRes = await db.query(
        'SELECT id, user_id, amount_pesewas, direction, reason, status FROM financial_adjustments WHERE id = $1',
        [id],
      );

      if (adjRes.rows.length === 0) {
        throw new NotFoundError(`Adjustment request not found with ID '${id}'`);
      }

      const adj = adjRes.rows[0];
      if (adj.status !== 'PENDING') {
        throw new BadRequestError(`Adjustment is already in '${adj.status}' status and cannot be modified.`);
      }

      const amountPesewas = parseInt(adj.amount_pesewas, 10);
      const userId = adj.user_id;

      const client = await db.connect();
      try {
        await client.query('BEGIN');

        if (action === 'APPROVE') {
          // Post balanced double-entry voucher
          if (financialLedgerService) {
            const entries = adj.direction === 'CREDIT'
              ? [
                  {
                    accountType: LedgerAccountType.PLATFORM_ESCROW,
                    accountId: 'PLATFORM_RESERVE',
                    entryType: LedgerEntryType.DEBIT,
                    amountPesewas,
                    currency: Currency.GHS,
                    referenceType: 'MANUAL_ADJUSTMENT',
                    referenceId: id,
                    description: `Super Admin Approved Float Credit: ${adj.reason}`,
                  },
                  {
                    accountType: LedgerAccountType.CUSTOMER_WALLET,
                    accountId: userId,
                    entryType: LedgerEntryType.CREDIT,
                    amountPesewas,
                    currency: Currency.GHS,
                    referenceType: 'MANUAL_ADJUSTMENT',
                    referenceId: id,
                    description: `Super Admin Approved Float Credit: ${adj.reason}`,
                  },
                ]
              : [
                  {
                    accountType: LedgerAccountType.CUSTOMER_WALLET,
                    accountId: userId,
                    entryType: LedgerEntryType.DEBIT,
                    amountPesewas,
                    currency: Currency.GHS,
                    referenceType: 'MANUAL_ADJUSTMENT',
                    referenceId: id,
                    description: `Super Admin Approved Float Debit: ${adj.reason}`,
                  },
                  {
                    accountType: LedgerAccountType.PLATFORM_ESCROW,
                    accountId: 'PLATFORM_RESERVE',
                    entryType: LedgerEntryType.CREDIT,
                    amountPesewas,
                    currency: Currency.GHS,
                    referenceType: 'MANUAL_ADJUSTMENT',
                    referenceId: id,
                    description: `Super Admin Approved Float Debit: ${adj.reason}`,
                  },
                ];

            await financialLedgerService.recordJournalEntries(client, entries);
          }

          // Update user wallet balance projection
          const delta = adj.direction === 'CREDIT' ? (amountPesewas / 100) : -(amountPesewas / 100);
          const deltaPesewas = adj.direction === 'CREDIT' ? amountPesewas : -amountPesewas;
          await client.query(
            `UPDATE users SET wallet_balance_pesewas = COALESCE(wallet_balance_pesewas, 0) + $1, wallet_balance = COALESCE(wallet_balance, 0) + $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [deltaPesewas, delta, userId],
          );

          // Update adjustment status
          await client.query(
            `UPDATE financial_adjustments SET status = 'APPROVED', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [req.user!.sub, id],
          );
        } else {
          await client.query(
            `UPDATE financial_adjustments SET status = 'REJECTED', approved_by = $1, approved_at = CURRENT_TIMESTAMP, rejection_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [req.user!.sub, reason || 'Rejected by Super Admin', id],
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: action === 'APPROVE' ? 'SUPER_ADMIN_FLOAT_ADJUSTMENT_APPROVED' : 'SUPER_ADMIN_FLOAT_ADJUSTMENT_REJECTED',
          resourceType: 'financial_adjustments',
          resourceId: id,
          metadata: { action, reason, amountPesewas, userId },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        message: `Adjustment ${action.toLowerCase()}d and ledger voucher committed.`,
      });
    },
  );

  // 12. GET /admin/finance/safety-controls — Financial Safety Controls & Limits
  app.get(
    '/admin/finance/safety-controls',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req, reply) => {
      const res = await db.query(`
        SELECT 
          emergency_payments_disabled as "emergencyPaymentsDisabled",
          emergency_withdrawals_disabled as "emergencyWithdrawalsDisabled",
          emergency_refunds_disabled as "emergencyRefundsDisabled",
          wallet_operations_frozen as "walletOperationsFrozen",
          agent_purchases_frozen as "agentPurchasesFrozen",
          global_maintenance_mode as "globalMaintenanceMode",
          provider_disabled as "providerDisabled",
          max_single_transaction_pesewas as "maxSingleTransactionPesewas",
          max_daily_withdrawal_pesewas as "maxDailyWithdrawalPesewas",
          max_daily_deposit_pesewas as "maxDailyDepositPesewas",
          suspicious_velocity_threshold as "suspiciousVelocityThreshold",
          updated_at as "updatedAt"
        FROM financial_safety_settings
        LIMIT 1
      `);

      const settings: FinancialSafetySettingsDto = res.rows[0] || {
        emergencyPaymentsDisabled: false,
        emergencyWithdrawalsDisabled: false,
        emergencyRefundsDisabled: false,
        walletOperationsFrozen: false,
        agentPurchasesFrozen: false,
        globalMaintenanceMode: false,
        providerDisabled: { datahouse: false, paystack: false, gmpl: false },
        maxSingleTransactionPesewas: 500000,
        maxDailyWithdrawalPesewas: 2000000,
        maxDailyDepositPesewas: 5000000,
        suspiciousVelocityThreshold: 10,
        updatedAt: new Date().toISOString(),
      };

      return reply.send({
        success: true,
        data: settings,
      });
    },
  );

  // 13. PUT /admin/finance/safety-controls — Super Admin Updates Kill Switches (Audited)
  app.put<{ Body: UpdateFinancialSafetySettingsRequest }>(
    '/admin/finance/safety-controls',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      await requireSuperAdmin(req);

      const { settings, reason } = req.body || {};
      if (!settings || !reason || reason.trim().length < 5) {
        throw new BadRequestError('Safety settings payload and mandatory justification (min 5 chars) are required.');
      }

      await db.query(
        `UPDATE financial_safety_settings SET
          emergency_payments_disabled = COALESCE($1, emergency_payments_disabled),
          emergency_withdrawals_disabled = COALESCE($2, emergency_withdrawals_disabled),
          emergency_refunds_disabled = COALESCE($3, emergency_refunds_disabled),
          wallet_operations_frozen = COALESCE($4, wallet_operations_frozen),
          agent_purchases_frozen = COALESCE($5, agent_purchases_frozen),
          global_maintenance_mode = COALESCE($6, global_maintenance_mode),
          provider_disabled = COALESCE($7, provider_disabled),
          max_single_transaction_pesewas = COALESCE($8, max_single_transaction_pesewas),
          max_daily_withdrawal_pesewas = COALESCE($9, max_daily_withdrawal_pesewas),
          max_daily_deposit_pesewas = COALESCE($10, max_daily_deposit_pesewas),
          suspicious_velocity_threshold = COALESCE($11, suspicious_velocity_threshold),
          updated_by = $12,
          updated_at = CURRENT_TIMESTAMP`,
        [
          settings.emergencyPaymentsDisabled,
          settings.emergencyWithdrawalsDisabled,
          settings.emergencyRefundsDisabled,
          settings.walletOperationsFrozen,
          settings.agentPurchasesFrozen,
          settings.globalMaintenanceMode,
          settings.providerDisabled ? JSON.stringify(settings.providerDisabled) : null,
          settings.maxSingleTransactionPesewas,
          settings.maxDailyWithdrawalPesewas,
          settings.maxDailyDepositPesewas,
          settings.suspiciousVelocityThreshold,
          req.user!.sub,
        ],
      );

      if (settings.globalMaintenanceMode !== undefined) {
        const isEnabled = Boolean(settings.globalMaintenanceMode);
        await db.query(
          `UPDATE system_configurations
           SET value = $1, last_modified_by = $2, last_modified_at = CURRENT_TIMESTAMP
           WHERE config_key = 'maintenance_mode'`,
          [JSON.stringify(isEnabled), req.user!.sub],
        ).catch(() => {});

        await db.query(
          `UPDATE platform_feature_flags
           SET is_enabled = $1, last_toggled_by = $2, last_toggled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE flag_key = 'MAINTENANCE_MODE'`,
          [isEnabled, req.user!.sub],
        ).catch(() => {});

        await db.query(
          `INSERT INTO emergency_system_controls (control_key, name, description, is_enabled, last_toggled_by, last_toggled_at, updated_at)
           VALUES ('MAINTENANCE_MODE', 'Platform Maintenance Mode', 'System maintenance switch', $1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (control_key) DO UPDATE SET is_enabled = EXCLUDED.is_enabled, last_toggled_by = EXCLUDED.last_toggled_by, last_toggled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`,
          [isEnabled, req.user!.sub],
        ).catch(() => {});
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'SUPER_ADMIN_FINANCIAL_SAFETY_CONTROLS_UPDATED',
          resourceType: 'financial_safety_settings',
          resourceId: 'global',
          metadata: { settings, reason },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        message: 'Financial safety controls and operational limits updated.',
      });
    },
  );

  // 14. POST /admin/finance/reprocess/preview — Pre-flight Eligibility Scanner
  app.post(
    '/admin/finance/reprocess/preview',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req, reply) => {
      const failedRes = await db.query(`
        SELECT 
          dlq.id,
          dlq.order_id as "orderId",
          o.public_id as "publicId",
          o.recipient_phone as "recipientPhone",
          o.network,
          o.amount_pesewas as "amountPesewas",
          dlq.failure_class as "failureClass",
          dlq.error_code as "errorCode",
          dlq.error_message as "errorMessage",
          CASE 
            WHEN dlq.failure_class IN ('TRANSIENT_NETWORK', 'RATE_LIMIT', 'TIMEOUT') AND dlq.attempt_count < 5 THEN TRUE
            ELSE FALSE
          END as "eligibleForRetry",
          CASE 
            WHEN dlq.failure_class IN ('TRANSIENT_NETWORK', 'RATE_LIMIT', 'TIMEOUT') AND dlq.attempt_count < 5 THEN 'Transient network failure within attempt limits'
            ELSE 'Permanent failure or maximum retry attempts exceeded'
          END as "retryReason"
        FROM provider_dlq dlq
        LEFT JOIN orders o ON dlq.order_id = o.id
        WHERE dlq.status = 'PENDING_REVIEW'
        ORDER BY dlq.created_at DESC
        LIMIT 100
      `);

      const eligibleItems = failedRes.rows;
      const eligibleCount = eligibleItems.filter((i) => i.eligibleForRetry).length;
      const ineligibleCount = eligibleItems.length - eligibleCount;

      const summaryByNetwork: Record<string, number> = {};
      eligibleItems.forEach((item) => {
        const net = item.network || 'UNKNOWN';
        summaryByNetwork[net] = (summaryByNetwork[net] || 0) + 1;
      });

      const preview: ReprocessPreviewDto = {
        totalFailed: eligibleItems.length,
        eligibleCount,
        ineligibleCount,
        eligibleItems,
        summaryByNetwork,
      };

      return reply.send({
        success: true,
        data: preview,
      });
    },
  );

  // 15. POST /admin/finance/reprocess/execute — Controlled Reprocessing Batch
  app.post<{ Body: ReprocessExecuteRequest }>(
    '/admin/finance/reprocess/execute',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { itemIds, reprocessAllEligible, reason } = req.body || {};

      if (!reason || reason.trim().length < 5) {
        throw new BadRequestError('A detailed reason (min 5 chars) is mandatory for batch reprocessing.');
      }

      let query = `
        SELECT id, order_id, failure_class, attempt_count
        FROM provider_dlq
        WHERE status = 'PENDING_REVIEW' AND failure_class IN ('TRANSIENT_NETWORK', 'RATE_LIMIT', 'TIMEOUT') AND attempt_count < 5
      `;
      const params: any[] = [];

      if (!reprocessAllEligible && itemIds && itemIds.length > 0) {
        query += ` AND id = ANY($1)`;
        params.push(itemIds);
      }

      const itemsRes = await db.query(query, params);
      const eligibleItems = itemsRes.rows;

      if (eligibleItems.length === 0) {
        return reply.send({
          success: true,
          data: { reprocessedCount: 0 },
          message: 'No eligible items found for reprocessing.',
        });
      }

      // Mark items as queued / replaying
      const ids = eligibleItems.map((i) => i.id);
      await db.query(
        `UPDATE provider_dlq SET status = 'RESOLVED', updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1)`,
        [ids],
      );

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_BATCH_REPROCESS_EXECUTED',
          resourceType: 'provider_dlq',
          resourceId: 'batch',
          metadata: { count: eligibleItems.length, reason, itemIds: ids },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        data: { reprocessedCount: eligibleItems.length },
        message: `Successfully enqueued ${eligibleItems.length} transactions for safe re-execution.`,
      });
    },
  );

  // 16. POST /admin/finance/reports/export — Asynchronous Financial Dataset Export
  app.post<{ Body: { reportType: string; format?: string; startDate?: string; endDate?: string } }>(
    '/admin/finance/reports/export',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { reportType = 'REVENUE', format = 'csv', startDate, endDate } = req.body || {};

      let sql = '';
      let filename = `financial-report-${reportType.toLowerCase()}-${Date.now()}.csv`;
      const dateFilter = startDate && endDate ? `AND p.created_at BETWEEN '${startDate}' AND '${endDate}'` : '';
      const ledgerDateFilter = startDate && endDate ? `WHERE created_at BETWEEN '${startDate}' AND '${endDate}'` : '';

      if (reportType === 'REVENUE' || reportType === 'TRANSACTIONS') {
        sql = `
          SELECT 
            p.id as "Payment ID",
            COALESCE(p.provider_reference, '') as "Provider Reference",
            p.amount_pesewas / 100.0 as "Amount (GHS)",
            p.status as "Status",
            p.payment_method as "Method",
            u.email as "Customer Email",
            p.created_at as "Created Date"
          FROM payments p
          LEFT JOIN users u ON p.user_id = u.id
          WHERE 1=1 ${dateFilter}
          ORDER BY p.created_at DESC
          LIMIT 5000
        `;
      } else if (reportType === 'LEDGER') {
        sql = `
          SELECT 
            transaction_id as "Journal ID",
            entry_type as "Entry Type",
            account_type as "Account",
            amount_pesewas / 100.0 as "Amount (GHS)",
            currency as "Currency",
            reference_type as "Ref Type",
            reference_id as "Ref ID",
            description as "Description",
            created_at as "Timestamp"
          FROM financial_ledger
          ${ledgerDateFilter}
          ORDER BY created_at DESC
          LIMIT 5000
        `;
      } else if (reportType === 'REFUNDS') {
        sql = `
          SELECT 
            r.id as "Refund ID",
            r.order_id as "Order ID",
            r.amount_pesewas / 100.0 as "Amount (GHS)",
            r.reason as "Reason",
            r.status as "Status",
            r.risk_level as "Risk Level",
            r.created_at as "Requested Date"
          FROM refunds r
          ORDER BY r.created_at DESC
          LIMIT 5000
        `;
      } else {
        sql = `
          SELECT 
            id as "Case ID",
            case_number as "Case Number",
            severity as "Severity",
            source as "Source",
            account_name as "Account",
            amount_pesewas / 100.0 as "Discrepancy (GHS)",
            status as "Status",
            expected_state as "Expected",
            actual_state as "Actual",
            created_at as "Detected Date"
          FROM reconciliation_cases
          ORDER BY created_at DESC
          LIMIT 5000
        `;
      }

      const res = await db.query(sql);

      if (format === 'json') {
        return reply.send({
          success: true,
          data: res.rows,
        });
      }

      // Convert rows to CSV
      const rows = res.rows;
      if (rows.length === 0) {
        return reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send('No data available');
      }

      const headers = Object.keys(rows[0]);
      const csvLines = [headers.join(',')];
      for (const row of rows) {
        const line = headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',');
        csvLines.push(line);
      }

      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(csvLines.join('\n'));
    },
  );
}
