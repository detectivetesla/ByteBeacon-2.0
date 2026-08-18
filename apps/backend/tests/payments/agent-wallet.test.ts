import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { agentRoutes } from '../../src/routes/commerce/agent.routes.js';
import { FinancialLedgerService } from '../../src/core/payments/financial-ledger.service.js';
import { IPaymentProvider } from '../../src/core/payments/payment-provider.interface.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { UserRole } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Agent Wallet Endpoints Suite', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockLedger: FinancialLedgerService;
  let mockPaymentProvider: IPaymentProvider;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: 'usr_agent_99', status: 'ACTIVE', role: 'agent' }],
      }),
    } as unknown as pg.Pool;

    mockLedger = {
      getAccountBalance: vi.fn().mockResolvedValue({
        balancePesewas: 145000, // GH₵ 1,450.00
        totalDebits: 50000,
        totalCredits: 195000,
      }),
      recordJournalEntries: vi.fn().mockResolvedValue([]),
    } as unknown as FinancialLedgerService;

    mockPaymentProvider = {
      initializePayment: vi.fn().mockResolvedValue({
        provider: 'PAYSTACK',
        providerReference: 'pst_topup_ref_123',
        authorizationUrl: 'https://checkout.paystack.com/pst_topup_ref_123',
        accessCode: 'acc_123',
        rawResponse: {},
      }),
      verifyPayment: vi.fn().mockResolvedValue({
        provider: 'PAYSTACK',
        providerReference: 'pst_topup_ref_123',
        status: 'SUCCESS',
        amountPesewas: 50000, // GH₵ 500.00
        currency: 'GHS',
        paidAt: new Date(),
        channel: 'mobile_money',
        rawResponse: {},
      }),
      initiateRefund: vi.fn(),
      verifyWebhookSignature: vi.fn(),
    };

    mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'usr_agent_99',
        email: 'agent@bytebeacon.com',
        role: UserRole.AGENT,
        status: 'ACTIVE',
        sessionId: 'sess_1',
        securityDomain: 'customer',
      }),
    } as unknown as TokenService;

    mockApiKeyService = {} as unknown as ApiKeyService;
    mockRbacService = {
      hasPermission: vi.fn().mockReturnValue(true),
    } as unknown as RbacService;

    app = Fastify();
    await app.register(agentRoutes, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      ledgerService: mockLedger,
      paymentProvider: mockPaymentProvider,
    });
  });

  describe('GET /agents/wallet/balance', () => {
    it('should return authoritative wallet balance in pesewas and GHS', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agents/wallet/balance',
        headers: {
          authorization: 'Bearer valid_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.balancePesewas).toBe(145000);
      expect(json.data.balanceGhs).toBe(1450);
      expect(json.data.currency).toBe('GHS');
    });
  });

  describe('POST /agents/wallet/topup/initialize', () => {
    it('should initialize top-up intent and return Paystack authorization URL', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agents/wallet/topup/initialize',
        headers: {
          authorization: 'Bearer valid_token',
        },
        payload: {
          amountPesewas: 50000, // GH₵ 500.00
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.authorizationUrl).toBe('https://checkout.paystack.com/pst_topup_ref_123');
      expect(json.data.reference).toBe('pst_topup_ref_123');
    });

    it('should reject top-up below minimum 100 pesewas (GH₵ 1.00)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agents/wallet/topup/initialize',
        headers: {
          authorization: 'Bearer valid_token',
        },
        payload: {
          amountPesewas: 50, // 50 pesewas is below min
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.message).toContain('Minimum top-up amount');
    });
  });

  describe('POST /agents/wallet/topup/verify', () => {
    it('should verify Paystack reference and post balanced double-entry ledger lines', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agents/wallet/topup/verify',
        headers: {
          authorization: 'Bearer valid_token',
        },
        payload: {
          reference: 'pst_topup_ref_123',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.newBalancePesewas).toBe(50000);

      expect(mockLedger.recordJournalEntries).toHaveBeenCalledWith(
        mockDb,
        expect.arrayContaining([
          expect.objectContaining({
            entryType: 'DEBIT',
            accountType: 'PLATFORM_ESCROW',
            amountPesewas: 50000,
          }),
          expect.objectContaining({
            entryType: 'CREDIT',
            accountType: 'CUSTOMER_WALLET',
            accountId: 'usr_agent_99',
            amountPesewas: 50000,
          }),
        ]),
      );
    });
  });
});
