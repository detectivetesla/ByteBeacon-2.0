import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { FinancialLedgerService } from '../../core/payments/financial-ledger.service.js';
import { IPaymentProvider } from '../../core/payments/payment-provider.interface.js';
import { OrderService } from '../../core/commerce/order.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { createMaintenanceHook } from '../../plugins/maintenance.plugin.js';
import { FeatureFlagService } from '../../infrastructure/features/feature-flag.service.js';
import { BadRequestError, NotFoundError, ConflictError } from '../../core/errors/app-error.js';
import {
  ApplyAgentRequest,
  AgentProfileDto,
  ApiResponse,
  Currency,
  PaymentMethod,
  LedgerEntryType,
  LedgerAccountType,
} from '@bytebeacon/shared';

export interface AgentRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  ledgerService?: FinancialLedgerService;
  paymentProvider?: IPaymentProvider;
  featureFlagService?: FeatureFlagService;
  orderService?: OrderService;
}

export async function agentRoutes(
  app: FastifyInstance,
  deps: AgentRouteDependencies,
) {
  const { db, tokenService, apiKeyService, rbacService, ledgerService, paymentProvider } = deps;
  const featureFlagService = deps.featureFlagService ?? (app as any).featureFlagService ?? new FeatureFlagService(db);
  const orderService = deps.orderService ?? (app as any).orderService;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);
  const maintenanceHook = createMaintenanceHook(featureFlagService);

  interface ListAgentOrdersQuery {
    status?: string;
    network?: string;
    paymentStatus?: string;
    after?: string;
    before?: string;
    search?: string;
    page?: string;
    limit?: string;
  }

  // 0. LIST AGENT ORDERS: GET /agent/orders & GET /agents/orders
  const handleListAgentOrders = async (
    req: FastifyRequest<{ Querystring: ListAgentOrdersQuery }>,
    reply: FastifyReply,
  ) => {
    const {
      status,
      network,
      paymentStatus,
      after,
      before,
      search,
      page,
      limit,
    } = req.query;

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 30;

    let result;
    if (orderService) {
      result = await orderService.listAgentOrders({
        agentOrUserId: req.user!.sub,
        status,
        network,
        paymentStatus,
        after,
        before,
        search,
        page: pageNum,
        limit: limitNum,
      });
    } else {
      result = { data: [], meta: { page: pageNum, limit: limitNum, total: 0, totalPages: 1 } };
    }

    return reply.status(200).send({
      success: true,
      statusCode: 200,
      message: 'Success',
      data: {
        data: result.data,
        orders: result.data,
        total: result.meta.total,
        page: result.meta.page,
        limit: result.meta.limit,
        totalPages: result.meta.totalPages,
        meta: result.meta,
      },
    });
  };

  app.get<{ Querystring: ListAgentOrdersQuery }>(
    '/agent/orders',
    { preHandler: [authHooks.authenticate] },
    handleListAgentOrders,
  );
  app.get<{ Querystring: ListAgentOrdersQuery }>(
    '/agents/orders',
    { preHandler: [authHooks.authenticate] },
    handleListAgentOrders,
  );

  // 0.1 LOOKUP AGENT ORDER BY ID: GET /agent/orders/:id & GET /agents/orders/:id
  const handleGetAgentOrder = async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const { id } = req.params;
    if (!id) {
      throw new BadRequestError('Order ID is required');
    }

    if (!orderService) {
      throw new NotFoundError(`Order '${id}' not found`);
    }

    const order = await orderService.getAgentOrderById(id, req.user!.sub);

    return reply.status(200).send({
      success: true,
      statusCode: 200,
      message: 'Success',
      data: order,
    });
  };

  app.get<{ Params: { id: string } }>(
    '/agent/orders/:id',
    { preHandler: [authHooks.authenticate] },
    handleGetAgentOrder,
  );
  app.get<{ Params: { id: string } }>(
    '/agents/orders/:id',
    { preHandler: [authHooks.authenticate] },
    handleGetAgentOrder,
  );

  // 1. GET AGENT PROFILE
  app.get(
    '/agents/profile',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const query = `
        SELECT id, user_id as "userId", business_name as "businessName",
               slug, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
        FROM agents
        WHERE user_id = $1
      `;

      const result = await db.query(query, [req.user!.sub]);
      if (result.rows.length === 0) {
        throw new NotFoundError('Agent account not found for current user');
      }

      const r = result.rows[0];
      const profile: AgentProfileDto = {
        id: r.id,
        userId: r.userId,
        businessName: r.businessName,
        slug: r.slug,
        isActive: r.isActive,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString(),
      };

      const response: ApiResponse<AgentProfileDto> = {
        success: true,
        data: profile,
      };

      return reply.send(response);
    },
  );

  // 2. APPLY AS AGENT
  app.post<{ Body: ApplyAgentRequest }>(
    '/agents/apply',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest<{ Body: ApplyAgentRequest }>, reply: FastifyReply) => {
      const { businessName, slug } = req.body || {};

      if (!businessName || !slug) {
        throw new BadRequestError('Business name and store slug are required');
      }

      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Check if user already is an agent
      const existingUser = await db.query('SELECT id FROM agents WHERE user_id = $1', [req.user!.sub]);
      if (existingUser.rows.length > 0) {
        throw new ConflictError('You have already applied or have an active agent account');
      }

      // Check slug uniqueness
      const existingSlug = await db.query('SELECT id FROM agents WHERE slug = $1', [cleanSlug]);
      if (existingSlug.rows.length > 0) {
        throw new ConflictError('Storefront slug is already taken. Please choose another.');
      }

      const insertRes = await db.query(
        `INSERT INTO agents (user_id, business_name, slug, is_active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, user_id as "userId", business_name as "businessName",
                   slug, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
        [req.user!.sub, businessName.trim(), cleanSlug],
      );

      // Update user role to agent
      await db.query("UPDATE users SET role = 'agent' WHERE id = $1", [req.user!.sub]);

      const r = insertRes.rows[0];
      const profile: AgentProfileDto = {
        id: r.id,
        userId: r.userId,
        businessName: r.businessName,
        slug: r.slug,
        isActive: r.isActive,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString(),
      };

      const response: ApiResponse<AgentProfileDto> = {
        success: true,
        data: profile,
      };

      return reply.status(201).send(response);
    },
  );

  // 3. GET AGENT WALLET TRANSACTIONS (Filtered, Sorted, Paginated)
  const handleGetWalletTransactions = async (
    req: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const {
      type = 'ALL',
      status: _status = 'ALL',
      dateRange = '30d',
      sortBy = 'newest',
      page = '1',
      limit = '10',
      search = '',
    } = (req.query as {
      type?: string;
      status?: string;
      dateRange?: string;
      startDate?: string;
      endDate?: string;
      sortBy?: string;
      page?: string;
      limit?: string;
      search?: string;
    }) || {};

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    const conditions: string[] = ['account_id = $1'];
    const params: any[] = [req.user!.sub];
    let paramIdx = 2;

    // Filter by Type
    if (type && type !== 'ALL') {
      if (type === 'DEPOSIT') {
        conditions.push(`(reference_type = 'DEPOSIT' OR reference_type = 'PAYMENT' OR description ILIKE '%top-up%' OR description ILIKE '%deposit%')`);
      } else if (type === 'PURCHASE') {
        conditions.push(`(reference_type = 'ORDER' OR description ILIKE '%bundle%' OR description ILIKE '%purchase%')`);
      } else if (type === 'REFUND') {
        conditions.push(`(reference_type = 'REFUND' OR description ILIKE '%refund%')`);
      } else if (type === 'ADJUSTMENT') {
        conditions.push(`(reference_type = 'ADJUSTMENT' OR description ILIKE '%adjust%' OR description ILIKE '%bonus%')`);
      }
    }

    // Filter by Date Range
    if (dateRange && dateRange !== 'all') {
      let interval = '30 days';
      if (dateRange === 'today') interval = '1 day';
      else if (dateRange === '7d') interval = '7 days';
      else if (dateRange === '30d') interval = '30 days';
      else if (dateRange === '90d') interval = '90 days';
      else if (dateRange === '1y') interval = '1 year';

      conditions.push(`created_at >= NOW() - INTERVAL '${interval}'`);
    }

    // Search keyword filter
    if (search && search.trim()) {
      conditions.push(`(description ILIKE $${paramIdx} OR reference_id ILIKE $${paramIdx})`);
      params.push(`%${search.trim()}%`);
      paramIdx++;
    }

    // Sorting
    let orderClause = 'ORDER BY created_at DESC';
    if (sortBy === 'oldest') {
      orderClause = 'ORDER BY created_at ASC';
    } else if (sortBy === 'highest') {
      orderClause = 'ORDER BY amount_pesewas DESC';
    } else if (sortBy === 'lowest') {
      orderClause = 'ORDER BY amount_pesewas ASC';
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countRes = await db.query(
      `SELECT COUNT(*) as total FROM financial_ledger ${whereClause}`,
      params,
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // Paginated Select Query
    const offset = (pageNum - 1) * limitNum;
    const selectQuery = `
      SELECT id, entry_type as "entryType", account_type as "accountType",
             account_id as "accountId", amount_pesewas as "amountPesewas",
             currency, reference_type as "referenceType", reference_id as "referenceId",
             description, created_at as "createdAt"
      FROM financial_ledger
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(limitNum, offset);

    const itemsRes = await db.query(selectQuery, params);

    const items = itemsRes.rows.map((r) => {
      const isCredit = r.entryType === 'CREDIT';
      let inferredType: 'DEPOSIT' | 'PURCHASE' | 'REFUND' | 'ADJUSTMENT' = 'PURCHASE';
      if (r.referenceType === 'DEPOSIT' || r.description?.toLowerCase().includes('top-up') || r.description?.toLowerCase().includes('deposit')) {
        inferredType = 'DEPOSIT';
      } else if (r.referenceType === 'REFUND' || r.description?.toLowerCase().includes('refund')) {
        inferredType = 'REFUND';
      } else if (r.referenceType === 'ADJUSTMENT' || r.description?.toLowerCase().includes('bonus')) {
        inferredType = 'ADJUSTMENT';
      }

      return {
        id: r.referenceId || `TXN-${r.id.substring(0, 8).toUpperCase()}`,
        ledgerId: r.id,
        type: inferredType,
        method: inferredType === 'DEPOSIT' ? 'Paystack' : inferredType === 'PURCHASE' ? 'Wallet' : 'Internal',
        amountPesewas: Number(r.amountPesewas),
        feePesewas: inferredType === 'DEPOSIT' ? Math.round(Number(r.amountPesewas) * 0.03) : 0,
        isCredit,
        description: r.description,
        status: 'SUCCESSFUL',
        date: new Date(r.createdAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        rawDate: new Date(r.createdAt).toISOString(),
      };
    });

    return reply.send({
      success: true,
      data: {
        items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
      },
    });
  };

  app.get('/agents/wallet/transactions', { preHandler: [authHooks.authenticateCustomer] }, handleGetWalletTransactions);
  app.get('/agent/wallet/transactions', { preHandler: [authHooks.authenticateCustomer] }, handleGetWalletTransactions);
  app.get('/wallet/transactions', { preHandler: [authHooks.authenticateCustomer] }, handleGetWalletTransactions);

  // 4. GET AGENT / CUSTOMER WALLET BALANCE
  const handleGetWalletBalance = async (req: FastifyRequest, reply: FastifyReply) => {
    let balancePesewas = 0;
    if (ledgerService) {
      const bal = await ledgerService.getAccountBalance(LedgerAccountType.CUSTOMER_WALLET, req.user!.sub);
      balancePesewas = bal.balancePesewas;
    } else {
      const res = await db.query(
        `SELECT COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE -amount_pesewas END), 0) as balance
         FROM financial_ledger WHERE account_id = $1`,
        [req.user!.sub],
      );
      balancePesewas = Number(res.rows[0]?.balance || 0);
    }

    return reply.send({
      success: true,
      data: {
        balancePesewas,
        balanceGhs: balancePesewas / 100,
        availablePesewas: balancePesewas,
        availableGhs: balancePesewas / 100,
        currency: 'GHS',
      },
    });
  };

  app.get('/agents/wallet/balance', { preHandler: [authHooks.authenticateCustomer] }, handleGetWalletBalance);
  app.get('/agent/wallet/balance', { preHandler: [authHooks.authenticateCustomer] }, handleGetWalletBalance);
  app.get('/wallet/balance', { preHandler: [authHooks.authenticateCustomer] }, handleGetWalletBalance);
  app.get('/customer/wallet/balance', { preHandler: [authHooks.authenticateCustomer] }, handleGetWalletBalance);

  // 5. INITIALIZE WALLET TOPUP (Paystack)
  app.post<{ Body: { amountPesewas: number; callbackUrl?: string } }>(
    '/agents/wallet/topup/initialize',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest<{ Body: { amountPesewas: number; callbackUrl?: string } }>, reply: FastifyReply) => {
      const { amountPesewas, callbackUrl } = req.body || {};
      if (!amountPesewas || amountPesewas < 100) {
        throw new BadRequestError('Minimum top-up amount is GH₵ 1.00 (100 pesewas)');
      }

      if (paymentProvider) {
        const initRes = await paymentProvider.initializePayment({
          orderId: `topup_${req.user!.sub}_${Date.now()}`,
          email: req.user!.email || 'agent@bytebeacon.com',
          amountPesewas,
          currency: Currency.GHS,
          paymentMethod: PaymentMethod.MOMO,
          callbackUrl: callbackUrl || 'https://bytebeacon.online/agent/wallet',
          metadata: {
            type: 'WALLET_TOPUP',
            userId: req.user!.sub,
          },
        });

        return reply.send({
          success: true,
          data: {
            authorizationUrl: initRes.authorizationUrl,
            reference: initRes.providerReference,
          },
        });
      }

      const reference = `pst_topup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return reply.send({
        success: true,
        data: {
          authorizationUrl: `https://checkout.paystack.com/${reference}`,
          reference,
        },
      });
    },
  );

  // 6. VERIFY WALLET TOPUP & POST DOUBLE-ENTRY JOURNAL
  app.post<{ Body: { reference: string } }>(
    '/agents/wallet/topup/verify',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest<{ Body: { reference: string } }>, reply: FastifyReply) => {
      const { reference } = req.body || {};
      if (!reference) {
        throw new BadRequestError('Payment reference is required');
      }

      let verifiedAmountPesewas = 5000;
      if (paymentProvider) {
        const verifyRes = await paymentProvider.verifyPayment(reference);
        if (verifyRes.status !== 'SUCCESS') {
          throw new BadRequestError(`Payment verification failed: status is ${verifyRes.status}`);
        }
        verifiedAmountPesewas = verifyRes.amountPesewas;
      }

      if (ledgerService) {
        const platformAccountId = '00000000-0000-0000-0000-000000000000';
        await ledgerService.recordJournalEntries(db, [
          {
            entryType: LedgerEntryType.DEBIT,
            accountType: LedgerAccountType.PLATFORM_ESCROW,
            accountId: platformAccountId,
            amountPesewas: verifiedAmountPesewas,
            currency: Currency.GHS,
            referenceType: 'DEPOSIT',
            referenceId: reference,
            description: `Paystack wallet top-up verified (${reference})`,
          },
          {
            entryType: LedgerEntryType.CREDIT,
            accountType: LedgerAccountType.CUSTOMER_WALLET,
            accountId: req.user!.sub,
            amountPesewas: verifiedAmountPesewas,
            currency: Currency.GHS,
            referenceType: 'DEPOSIT',
            referenceId: reference,
            description: `Paystack wallet deposit credited (${reference})`,
          },
        ]);
      }

      return reply.send({
        success: true,
        data: {
          success: true,
          newBalancePesewas: verifiedAmountPesewas,
        },
      });
    },
  );

  // 7. AGENT PROFIT WITHDRAWALS
  app.post<{
    Body: {
      amountPesewas: number;
      payoutMethod: string;
      accountNumber: string;
      accountName: string;
      bankName?: string;
    };
  }>(
    '/agents/withdrawals',
    { preHandler: [authHooks.authenticateCustomer, maintenanceHook] },
    async (req: FastifyRequest<{
      Body: {
        amountPesewas: number;
        payoutMethod: string;
        accountNumber: string;
        accountName: string;
        bankName?: string;
      };
    }>, reply: FastifyReply) => {
      const { amountPesewas, payoutMethod, accountNumber, accountName, bankName } = req.body || {};

      if (!amountPesewas || amountPesewas < 1000) {
        throw new BadRequestError('Minimum withdrawal amount is GH₵ 10.00 (1000 pesewas)');
      }
      if (!accountNumber || !accountName || !payoutMethod) {
        throw new BadRequestError('Payout method, account number, and account name are required');
      }

      // Check agent wallet balance
      let currentBalancePesewas = 0;
      try {
        const balRes = await db.query<{ wallet_balance: string; wallet_balance_pesewas: string }>(
          'SELECT wallet_balance, wallet_balance_pesewas FROM users WHERE id = $1',
          [req.user!.sub],
        );
        if (balRes.rows[0]) {
          const row = balRes.rows[0];
          if (row.wallet_balance_pesewas !== null && row.wallet_balance_pesewas !== undefined) {
            currentBalancePesewas = parseInt(row.wallet_balance_pesewas, 10) || 0;
          } else if (row.wallet_balance) {
            currentBalancePesewas = Math.round(parseFloat(row.wallet_balance) * 100) || 0;
          }
        }
      } catch {
        currentBalancePesewas = 0;
      }

      if (currentBalancePesewas < amountPesewas) {
        throw new BadRequestError(`Insufficient balance. Available: GH₵ ${(currentBalancePesewas / 100).toFixed(2)}`);
      }

      const withdrawalId = `wth_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const reference = `PAYOUT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

      // Post double-entry journal to debit wallet and credit payout escrow
      if (ledgerService) {
        const platformAccountId = '00000000-0000-0000-0000-000000000000';
        await ledgerService.recordJournalEntries(db, [
          {
            entryType: LedgerEntryType.DEBIT,
            accountType: LedgerAccountType.CUSTOMER_WALLET,
            accountId: req.user!.sub,
            amountPesewas,
            currency: Currency.GHS,
            referenceType: 'WITHDRAWAL',
            referenceId: withdrawalId,
            description: `Agent profit withdrawal to ${payoutMethod} (${accountNumber})`,
          },
          {
            entryType: LedgerEntryType.CREDIT,
            accountType: LedgerAccountType.PLATFORM_ESCROW,
            accountId: platformAccountId,
            amountPesewas,
            currency: Currency.GHS,
            referenceType: 'WITHDRAWAL',
            referenceId: withdrawalId,
            description: `Payout processing escrow for withdrawal (${withdrawalId})`,
          },
        ]);
      }

      // Update user wallet balance cache
      try {
        await db.query(
          `UPDATE users
           SET wallet_balance_pesewas = GREATEST(0, COALESCE(wallet_balance_pesewas, 0) - $1),
               wallet_balance = GREATEST(0, COALESCE(wallet_balance, 0) - ($1::numeric / 100))
           WHERE id = $2`,
          [amountPesewas, req.user!.sub],
        );
      } catch {
        // Continue
      }

      return reply.status(201).send({
        success: true,
        data: {
          id: withdrawalId,
          reference,
          amountPesewas,
          feePesewas: 0,
          method: payoutMethod === 'BANK' ? `${bankName || 'Bank'} Account` : payoutMethod.replace('_', ' '),
          recipientAccount: accountNumber,
          recipientName: accountName,
          status: 'PROCESSING',
          createdAt: new Date().toISOString(),
        },
      });
    },
  );

  // 7. GET AGENT WITHDRAWALS
  app.get(
    '/agents/withdrawals',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await db.query<{
          id: string;
          reference_id: string;
          amount_pesewas: string;
          description: string;
          created_at: string;
        }>(
          `SELECT id, reference_id, amount_pesewas, description, created_at
           FROM financial_ledger
           WHERE account_id = $1 AND reference_type = 'WITHDRAWAL' AND entry_type = 'DEBIT'
           ORDER BY created_at DESC
           LIMIT 50`,
          [req.user!.sub],
        );

        const withdrawals = (result.rows || []).map((row) => ({
          id: row.id,
          reference: row.reference_id || `PAYOUT-${row.id.slice(0, 8).toUpperCase()}`,
          amountPesewas: parseInt(row.amount_pesewas, 10) || 0,
          feePesewas: 0,
          method: 'Mobile Money',
          recipientAccount: '—',
          recipientName: 'Agent Payout',
          status: 'COMPLETED',
          date: new Date(row.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          rawDate: row.created_at,
        }));

        return reply.send({
          success: true,
          data: {
            withdrawals,
          },
        });
      } catch {
        return reply.send({
          success: true,
          data: {
            withdrawals: [],
          },
        });
      }
    },
  );

  // 9. GET AGENT REVENUE TREND ANALYTICS (/agents/analytics/revenue)
  app.get(
    '/agents/analytics/revenue',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const agentRes = await db.query('SELECT id FROM agents WHERE user_id = $1', [req.user!.sub]);
      const agentId = agentRes.rows[0]?.id;

      const userClause = agentId
        ? '(user_id = $1 OR agent_id = $2)'
        : 'user_id = $1';
      const userParams = agentId ? [req.user!.sub, agentId] : [req.user!.sub];

      // Fetch completed orders in last 365 days
      const ordersRes = await db.query(
        `SELECT amount_pesewas, created_at, order_status, payment_status
         FROM orders
         WHERE ${userClause}
           AND (order_status = 'COMPLETED' OR payment_status = 'PAID')
           AND created_at >= CURRENT_TIMESTAMP - INTERVAL '365 days'
         ORDER BY created_at ASC`,
        userParams,
      );

      const completedOrders = ordersRes.rows;
      const now = new Date();

      // Helper for period aggregation
      const calculatePeriodStats = (days: number, intervalCount: number, labelPrefix: string, type: 'daily' | 'weekly' | 'monthly' | 'quarterly') => {
        const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const periodOrders = completedOrders.filter((o) => new Date(o.created_at) >= periodStart);

        const totalPesewas = periodOrders.reduce((acc, o) => acc + (parseInt(o.amount_pesewas, 10) || 0), 0);
        const orderCount = periodOrders.length;
        const totalGhs = totalPesewas / 100;

        // Bucket points
        const points: Array<{ label: string; revenue: number; orders: number }> = [];
        const intervalMs = (days * 24 * 60 * 60 * 1000) / intervalCount;

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 0; i < intervalCount; i++) {
          const bucketStart = new Date(periodStart.getTime() + i * intervalMs);
          const bucketEnd = new Date(periodStart.getTime() + (i + 1) * intervalMs);

          const bucketOrders = periodOrders.filter((o) => {
            const d = new Date(o.created_at);
            return d >= bucketStart && d < bucketEnd;
          });

          const bucketRevenue = bucketOrders.reduce((acc, o) => acc + (parseInt(o.amount_pesewas, 10) || 0), 0) / 100;

          let label = `${labelPrefix}${i + 1}`;
          if (type === 'daily') {
            label = dayNames[bucketStart.getDay()];
          }

          points.push({
            label,
            revenue: Math.round(bucketRevenue * 100) / 100,
            orders: bucketOrders.length,
          });
        }

        return {
          label: `${days} days`,
          revenueDisplay: `GH₵ ${totalGhs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          orderCount,
          trendDisplay: orderCount > 0 ? '↑ Live' : '0.0%',
          points,
        };
      };

      const result = {
        '7D': calculatePeriodStats(7, 7, '', 'daily'),
        '30D': calculatePeriodStats(30, 4, 'W', 'weekly'),
        '90D': calculatePeriodStats(90, 3, 'M', 'monthly'),
        '1Y': calculatePeriodStats(365, 4, 'Q', 'quarterly'),
      };

      return reply.send({
        success: true,
        data: result,
      });
    },
  );

  // 10. GET AGENT SALES & MARGIN ANALYTICS (/agents/analytics/sales-margins)
  app.get<{
    Querystring: {
      period?: string;
      network?: string;
      source?: string;
      startDate?: string;
      endDate?: string;
    };
  }>(
    '/agents/analytics/sales-margins',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const { period = '30d', network = 'ALL', startDate, endDate } = req.query;

      const agentRes = await db.query('SELECT id FROM agents WHERE user_id = $1', [req.user!.sub]);
      const agentId = agentRes.rows[0]?.id;

      const conditions: string[] = ['(o.user_id = $1' + (agentId ? ' OR o.agent_id = $2' : '') + ')'];
      const params: any[] = [req.user!.sub];
      if (agentId) params.push(agentId);

      if (network && network !== 'ALL') {
        params.push(network);
        conditions.push(`o.network = $${params.length}`);
      }

      if (startDate) {
        params.push(startDate);
        conditions.push(`o.created_at >= $${params.length}`);
      } else {
        let days = 30;
        if (period === 'today') days = 1;
        else if (period === '7d') days = 7;
        else if (period === '30d') days = 30;
        else if (period === '90d') days = 90;
        else if (period === '1y') days = 365;
        conditions.push(`o.created_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'`);
      }

      if (endDate) {
        params.push(endDate);
        conditions.push(`o.created_at <= $${params.length}`);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const ordersRes = await db.query(
        `SELECT o.id, o.network, o.data_amount_mb, o.amount_pesewas, o.order_status, o.payment_status, o.refund_status, o.created_at
         FROM orders o
         ${whereClause}`,
        params,
      );

      const allOrders = ordersRes.rows;
      const completedOrders = allOrders.filter((o) => o.order_status === 'COMPLETED' || o.payment_status === 'PAID');
      const refundedOrders = allOrders.filter((o) => o.refund_status === 'COMPLETED');

      const grossSalesPesewas = completedOrders.reduce((sum, o) => sum + (parseInt(o.amount_pesewas, 10) || 0), 0);
      const refundsPesewas = refundedOrders.reduce((sum, o) => sum + (parseInt(o.amount_pesewas, 10) || 0), 0);
      const netSalesPesewas = Math.max(0, grossSalesPesewas - refundsPesewas);

      // Estimated wholesale base cost (82% of sales price on average)
      const totalCostPesewas = Math.round(netSalesPesewas * 0.82);
      const grossProfitPesewas = netSalesPesewas - totalCostPesewas;
      const marginPercent = netSalesPesewas > 0 ? Math.round((grossProfitPesewas / netSalesPesewas) * 1000) / 10 : 0;
      const totalOrders = completedOrders.length;
      const avgOrderValueGhs = totalOrders > 0 ? (netSalesPesewas / totalOrders / 100) : 0;

      // Network Breakdown
      const networks = ['MTN', 'TELECEL', 'AIRTELTIGO'];
      const networkBreakdown = networks.map((net) => {
        const netOrders = completedOrders.filter((o) => o.network === net);
        const netSales = netOrders.reduce((sum, o) => sum + (parseInt(o.amount_pesewas, 10) || 0), 0) / 100;
        const netCost = netSales * 0.82;
        const netProfit = netSales - netCost;
        const netMargin = netSales > 0 ? Math.round((netProfit / netSales) * 1000) / 10 : 0;
        const share = grossSalesPesewas > 0 ? Math.round((netSales * 100 / (grossSalesPesewas / 100)) * 10) / 10 : 0;

        return {
          network: net,
          name: net === 'MTN' ? 'MTN Ghana' : net === 'TELECEL' ? 'Telecel Ghana' : 'AirtelTigo Ghana',
          color: net === 'MTN' ? '#FFCC00' : net === 'TELECEL' ? '#E7192D' : '#0066B2',
          orders: netOrders.length,
          sales: Math.round(netSales * 100) / 100,
          cost: Math.round(netCost * 100) / 100,
          profit: Math.round(netProfit * 100) / 100,
          margin: netMargin,
          share,
        };
      });

      // Bundle Breakdown
      const bundleGroups = new Map<string, { name: string; network: string; orders: number; salesPesewas: number }>();
      completedOrders.forEach((o) => {
        const sizeGb = (o.data_amount_mb || 0) / 1024;
        const name = `${sizeGb >= 1 ? `${sizeGb} GB` : `${o.data_amount_mb} MB`} ${o.network}`;
        const key = `${o.network}_${o.data_amount_mb}`;
        const curr = bundleGroups.get(key) || { name, network: o.network, orders: 0, salesPesewas: 0 };
        curr.orders += 1;
        curr.salesPesewas += parseInt(o.amount_pesewas, 10) || 0;
        bundleGroups.set(key, curr);
      });

      const bundleBreakdown = Array.from(bundleGroups.entries()).map(([id, b]) => {
        const costPesewas = Math.round(b.salesPesewas * 0.82);
        const profitPesewas = b.salesPesewas - costPesewas;
        const marginPct = b.salesPesewas > 0 ? Math.round((profitPesewas / b.salesPesewas) * 1000) / 10 : 0;
        return {
          id,
          name: b.name,
          network: b.network,
          orders: b.orders,
          salesPesewas: b.salesPesewas,
          costPesewas,
          profitPesewas,
          marginPercent: marginPct,
        };
      });

      return reply.send({
        success: true,
        data: {
          totals: {
            grossSalesGhs: grossSalesPesewas / 100,
            refundsGhs: refundsPesewas / 100,
            netSalesGhs: netSalesPesewas / 100,
            totalCostGhs: totalCostPesewas / 100,
            grossProfitGhs: grossProfitPesewas / 100,
            marginPercent,
            totalOrders,
            avgOrderValueGhs: Math.round(avgOrderValueGhs * 100) / 100,
          },
          networkBreakdown,
          bundleBreakdown,
        },
      });
    },
  );

  // 11. GET AGENT PENDING MTN BENEFICIARY APPROVALS (/agents/pending-approvals)
  app.get<{
    Querystring: {
      status?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/agents/pending-approvals',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const { status = 'ALL', page = '1', limit = '20' } = req.query;
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = ['ba.user_id = $1'];
      const params: any[] = [req.user!.sub];

      if (status && status !== 'ALL') {
        params.push(status);
        conditions.push(`ba.status = $${params.length}`);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      try {
        const countRes = await db.query(`SELECT COUNT(*) as total FROM beneficiary_approvals ba ${whereClause}`, params);
        const total = parseInt(countRes.rows[0]?.total || '0', 10);

        const itemsRes = await db.query(
          `SELECT ba.id, ba.phone_number as "phoneNumber", ba.network, ba.status,
                  ba.created_at as "createdAt", ba.updated_at as "updatedAt"
           FROM beneficiary_approvals ba
           ${whereClause}
           ORDER BY ba.created_at DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limitNum, offset],
        );

        return reply.send({
          success: true,
          data: {
            items: itemsRes.rows,
            total,
            page: pageNum,
            limit: limitNum,
          },
        });
      } catch {
        return reply.send({
          success: true,
          data: {
            items: [],
            total: 0,
            page: pageNum,
            limit: limitNum,
          },
        });
      }
    },
  );

  // 12. UPDATE AGENT SETTINGS & PROFILE (/agents/settings & /agents/profile)
  app.put<{
    Body: {
      businessName?: string;
      businessPhone?: string;
      businessEmail?: string;
      whatsAppNumber?: string;
      fullName?: string;
      personalEmail?: string;
      personalPhone?: string;
    };
  }>(
    '/agents/settings',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const {
        businessName,
        businessPhone,
        businessEmail,
        whatsAppNumber,
        fullName,
        personalEmail,
        personalPhone,
      } = req.body || {};

      const userId = req.user!.sub;

      // Update user details
      if (fullName || personalPhone || personalEmail) {
        await db.query(
          `UPDATE users
           SET full_name = COALESCE($1, full_name),
               name = COALESCE($1, name),
               phone = COALESCE($2, phone),
               email = COALESCE($3, email),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [fullName || null, personalPhone || null, personalEmail ? personalEmail.toLowerCase().trim() : null, userId],
        );
      }

      // Update agent details if present
      if (businessName) {
        await db.query(
          `UPDATE agents
           SET business_name = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2`,
          [businessName.trim(), userId],
        );
      }

      // Also update store details if present
      if (businessName || businessPhone || businessEmail || whatsAppNumber) {
        await db.query(
          `UPDATE stores
           SET store_name = COALESCE($1, store_name),
               contact_phone = COALESCE($2, contact_phone),
               contact_email = COALESCE($3, contact_email),
               contact_whatsapp = COALESCE($4, contact_whatsapp),
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $5`,
          [businessName || null, businessPhone || null, businessEmail || null, whatsAppNumber || null, userId],
        );
      }

      return reply.send({
        success: true,
        message: 'Agent settings and profile updated successfully.',
      });
    },
  );

  app.patch<{
    Body: {
      fullName?: string;
      phone?: string;
      email?: string;
    };
  }>(
    '/agents/profile',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const { fullName, phone, email } = req.body || {};
      const userId = req.user!.sub;

      await db.query(
        `UPDATE users
         SET full_name = COALESCE($1, full_name),
             name = COALESCE($1, name),
             phone = COALESCE($2, phone),
             email = COALESCE($3, email),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [fullName || null, phone || null, email ? email.toLowerCase().trim() : null, userId],
      );

      return reply.send({
        success: true,
        message: 'Profile updated successfully.',
      });
    },
  );

  // 13. SUB-AGENTS MANAGEMENT
  app.get(
    '/agents/sub-agents',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        // 1. Identify current agent
        const agentRes = await db.query(
          'SELECT id FROM agents WHERE user_id = $1 OR id = $1',
          [req.user!.sub],
        );
        const currentAgentId = agentRes.rows[0]?.id;

        if (!currentAgentId) {
          return reply.send({
            success: true,
            data: {
              subAgents: [],
            },
          });
        }

        // 2. Query ONLY sub-agents belonging to this parent agent
        const result = await db.query<{
          id: string;
          agentTableId: string;
          name: string;
          email: string;
          phone: string;
          storeName: string;
          storeSlug: string;
          storeStatus: string;
          status: string;
          balancePesewas: string | number;
          commissionRate: string | number;
          ordersCount: string | number;
          successfulOrdersCount: string | number;
          failedOrdersCount: string | number;
          totalSalesPesewas: string | number;
          createdAt: string;
        }>(
          `SELECT u.id as "id",
                  a.id as "agentTableId",
                  COALESCE(u.full_name, a.business_name, 'Sub-Agent') as "name",
                  u.email,
                  COALESCE(u.phone, '—') as "phone",
                  COALESCE(s.store_name, a.business_name, u.full_name, 'Sub-Agent Store') as "storeName",
                  COALESCE(s.slug, a.slug, 'sub-store') as "storeSlug",
                  COALESCE(s.store_status, 'ONLINE') as "storeStatus",
                  COALESCE(a.status, 'ACTIVE') as "status",
                  COALESCE(u.wallet_balance_pesewas, 0) as "balancePesewas",
                  COALESCE(a.commission_rate, 8) as "commissionRate",
                  COALESCE((SELECT COUNT(*) FROM orders WHERE agent_id = a.id OR user_id = u.id), 0) as "ordersCount",
                  COALESCE((SELECT COUNT(*) FROM orders WHERE (agent_id = a.id OR user_id = u.id) AND order_status IN ('COMPLETED', 'DELIVERED')), 0) as "successfulOrdersCount",
                  COALESCE((SELECT COUNT(*) FROM orders WHERE (agent_id = a.id OR user_id = u.id) AND order_status = 'FAILED'), 0) as "failedOrdersCount",
                  COALESCE((SELECT SUM(amount_pesewas) FROM orders WHERE (agent_id = a.id OR user_id = u.id) AND payment_status = 'PAID'), 0) as "totalSalesPesewas",
                  a.created_at as "createdAt"
           FROM agents a
           JOIN users u ON a.user_id = u.id
           LEFT JOIN stores s ON s.agent_id = a.id
           WHERE a.parent_agent_id = $1
           ORDER BY a.created_at DESC`,
          [currentAgentId],
        );

        const subAgents = (result.rows || []).map((row) => {
          const salesPesewas = parseInt(row.totalSalesPesewas as any || '0', 10) || 0;
          const commissionRate = parseFloat(row.commissionRate as any || '8') || 8;
          const commissionPesewas = Math.round((salesPesewas * commissionRate) / 100);
          const ordersCount = parseInt(row.ordersCount as any || '0', 10) || 0;
          const successfulCount = parseInt(row.successfulOrdersCount as any || '0', 10) || 0;
          const failedCount = parseInt(row.failedOrdersCount as any || '0', 10) || 0;
          const balancePesewas = parseInt(row.balancePesewas as any || '0', 10) || 0;

          return {
            id: row.id,
            agentId: `SA-${row.id.slice(0, 6).toUpperCase()}`,
            name: row.name,
            email: row.email,
            phone: row.phone,
            storeName: row.storeName,
            storeSlug: row.storeSlug,
            storeStatus: row.storeStatus === 'MAINTENANCE' ? 'MAINTENANCE' : row.storeStatus === 'OFFLINE' ? 'OFFLINE' : 'ONLINE',
            enabledProductsCount: 12,
            dateJoined: new Date(row.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
            lastActive: 'Active today',
            rawLastActive: row.createdAt,
            status: row.status === 'ACTIVE' ? 'ACTIVE' : row.status === 'PENDING' ? 'PENDING' : row.status === 'SUSPENDED' ? 'SUSPENDED' : 'INACTIVE',
            ordersCount,
            successfulOrdersCount: successfulCount,
            failedOrdersCount: failedCount,
            totalSalesPesewas: salesPesewas,
            totalCommissionPesewas: commissionPesewas,
            balancePesewas,
            totalDepositedPesewas: balancePesewas,
            totalSpentPesewas: salesPesewas,
            recentOrders: [],
            activityLogs: [
              {
                id: `log-${row.id}-1`,
                time: new Date(row.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
                text: 'Enrolled as sub-agent under partner network',
              },
            ],
          };
        });

        return reply.send({
          success: true,
          data: {
            subAgents,
          },
        });
      } catch {
        return reply.send({
          success: true,
          data: {
            subAgents: [],
          },
        });
      }
    },
  );

  app.post<{
    Body: {
      name: string;
      email: string;
      phone: string;
      storeName?: string;
    };
  }>(
    '/agents/sub-agents',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest<{
      Body: {
        name: string;
        email: string;
        phone: string;
        storeName?: string;
      };
    }>, reply: FastifyReply) => {
      const { name, email, phone, storeName } = req.body || {};
      if (!name || !email || !phone) {
        throw new BadRequestError('Name, email, and phone are required for sub-agent enrollment');
      }

      // 1. Ensure current agent record exists
      const agentRes = await db.query(
        'SELECT id FROM agents WHERE user_id = $1 OR id = $1',
        [req.user!.sub],
      );
      let parentAgentId = agentRes.rows[0]?.id;
      if (!parentAgentId) {
        const insertParent = await db.query<{ id: string }>(
          `INSERT INTO agents (user_id, business_name, status)
           VALUES ($1, $2, 'ACTIVE')
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [req.user!.sub, req.user?.email || 'Agent Business'],
        );
        parentAgentId = insertParent.rows[0]?.id;
        if (!parentAgentId) {
          const refetch = await db.query('SELECT id FROM agents WHERE user_id = $1 OR id = $1', [req.user!.sub]);
          parentAgentId = refetch.rows[0]?.id;
        }
      }

      const existing = await db.query('SELECT id FROM users WHERE email = $1 OR phone = $2', [
        email.toLowerCase().trim(),
        phone.trim(),
      ]);
      if (existing.rows.length > 0) {
        throw new BadRequestError('A user with this email or phone already exists');
      }

      const defaultHash = '$argon2id$v=19$m=65536,t=3,p=4$tempHash$tempHashPlaceholder';
      const insertRes = await db.query<{ id: string; created_at: string }>(
        `INSERT INTO users (email, phone, full_name, name, password_hash, role, status, security_domain)
         VALUES ($1, $2, $3, $3, $4, 'agent', 'ACTIVE', 'CUSTOMER')
         RETURNING id, created_at`,
        [email.toLowerCase().trim(), phone.trim(), name.trim(), defaultHash],
      );

      const createdUser = insertRes.rows[0];
      const cleanSlug = (storeName || name.trim()).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `sa-${createdUser.id.slice(0, 6)}`;

      const insertAgentRes = await db.query<{ id: string }>(
        `INSERT INTO agents (user_id, parent_agent_id, business_name, slug, status, commission_rate)
         VALUES ($1, $2, $3, $4, 'ACTIVE', 8.00)
         RETURNING id`,
        [createdUser.id, parentAgentId, storeName?.trim() || `${name.trim()}'s Store`, cleanSlug],
      );
      const newAgentRecord = insertAgentRes.rows[0];

      if (newAgentRecord) {
        await db.query(
          `INSERT INTO stores (agent_id, user_id, store_name, slug, store_status, approval_status)
           VALUES ($1, $2, $3, $4, 'ONLINE', 'APPROVED')
           ON CONFLICT DO NOTHING`,
          [newAgentRecord.id, createdUser.id, storeName?.trim() || `${name.trim()}'s Store`, cleanSlug],
        ).catch(() => {});
      }

      return reply.status(201).send({
        success: true,
        data: {
          id: createdUser.id,
          agentId: `SA-${createdUser.id.slice(0, 6).toUpperCase()}`,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          storeName: storeName || `${name.trim()}'s Store`,
          storeSlug: cleanSlug,
          storeStatus: 'ONLINE',
          status: 'ACTIVE',
          createdAt: createdUser.created_at,
        },
      });
    },
  );

  // 14. UPDATE SUB-AGENT STATUS
  app.patch<{
    Params: { id: string };
    Body: { status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' };
  }>(
    '/agents/sub-agents/:id/status',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest<{
      Params: { id: string };
      Body: { status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' };
    }>, reply: FastifyReply) => {
      const { id } = req.params;
      const { status } = req.body || {};
      if (!status || !['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(status)) {
        throw new BadRequestError('Invalid sub-agent status');
      }

      const agentRes = await db.query(
        'SELECT id FROM agents WHERE user_id = $1 OR id = $1',
        [req.user!.sub],
      );
      const parentAgentId = agentRes.rows[0]?.id;
      if (!parentAgentId) {
        throw new NotFoundError('Agent profile not found');
      }

      const updateRes = await db.query(
        `UPDATE agents
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE (id = $2 OR user_id = $2) AND parent_agent_id = $3
         RETURNING id, status`,
        [status, id, parentAgentId],
      );

      if (updateRes.rows.length === 0) {
        throw new NotFoundError('Sub-agent not found under your account');
      }

      return reply.send({
        success: true,
        data: {
          id,
          status: updateRes.rows[0].status,
        },
      });
    },
  );
}


