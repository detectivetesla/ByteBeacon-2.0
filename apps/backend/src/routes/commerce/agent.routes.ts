import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { FinancialLedgerService } from '../../core/payments/financial-ledger.service.js';
import { IPaymentProvider } from '../../core/payments/payment-provider.interface.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
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
}

export async function agentRoutes(
  app: FastifyInstance,
  deps: AgentRouteDependencies,
) {
  const { db, tokenService, apiKeyService, rbacService, ledgerService, paymentProvider } = deps;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

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
      await db.query("UPDATE users SET role = 'agent' WHERE uuid = $1", [req.user!.sub]);

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
  app.get<{
    Querystring: {
      type?: string;
      status?: string;
      dateRange?: string;
      startDate?: string;
      endDate?: string;
      sortBy?: string;
      page?: string;
      limit?: string;
      search?: string;
    };
  }>(
    '/agents/wallet/transactions',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const {
        type = 'ALL',
        status: _status = 'ALL',
        dateRange = '30d',
        sortBy = 'newest',
        page = '1',
        limit = '10',
        search = '',
      } = req.query;

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
    },
  );

  // 4. GET AGENT WALLET BALANCE
  app.get(
    '/agents/wallet/balance',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
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
    },
  );

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
          callbackUrl: callbackUrl || 'https://bytebeacon.com/agent/wallet',
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
    { preHandler: [authHooks.authenticateCustomer] },
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
          'SELECT wallet_balance, wallet_balance_pesewas FROM users WHERE uuid = $1',
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
           WHERE uuid = $2`,
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
           FROM ledger_entries
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

  // 8. SUB-AGENTS MANAGEMENT
  app.get(
    '/agents/sub-agents',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await db.query<{
          id: string;
          email: string;
          phone: string;
          fullName: string;
          status: string;
          created_at: string;
        }>(
          `SELECT uuid as id, email, phone, full_name as "fullName", status, created_at
           FROM users
           WHERE role = 'agent' AND uuid != $1
           ORDER BY created_at DESC
           LIMIT 50`,
          [req.user!.sub],
        );

        const subAgents = (result.rows || []).map((row) => ({
          id: row.id,
          agentId: `SA-${row.id.slice(0, 6).toUpperCase()}`,
          name: row.fullName || 'Sub-Agent',
          email: row.email,
          phone: row.phone || '—',
          storeName: `${row.fullName || 'Agent'}'s Store`,
          storeSlug: (row.fullName || 'agent').toLowerCase().replace(/\s+/g, '-'),
          storeStatus: 'ONLINE',
          enabledProductsCount: 12,
          dateJoined: new Date(row.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
          lastActive: 'Active today',
          rawLastActive: row.created_at,
          status: row.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
          ordersCount: 0,
          successfulOrdersCount: 0,
          failedOrdersCount: 0,
          totalSalesPesewas: 0,
          totalCommissionPesewas: 0,
          balancePesewas: 0,
          totalDepositedPesewas: 0,
          totalSpentPesewas: 0,
          recentOrders: [],
          activityLogs: [],
        }));

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
}

