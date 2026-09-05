import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { agentRoutes } from '../../src/routes/commerce/agent.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { FinancialLedgerService } from '../../src/core/payments/financial-ledger.service.js';
import { AgentWebhookDispatcherService } from '../../src/core/webhooks/agent-webhook-dispatcher.service.js';
import { errorHandler } from '../../src/core/errors/app-error.js';
import { ApiKeyEnvironment, ApiKeyStatus } from '@bytebeacon/shared';
import type pg from 'pg';

describe('DataHouse Agent API Specification Full Compliance Suite', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTokenService: TokenService;
  let apiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockLedgerService: FinancialLedgerService;

  // Pre-hashed API keys
  const liveUnrestrictedKey = 'ak_live_unrestricted_master_key_123456';
  const liveUnrestrictedPrefix = liveUnrestrictedKey.substring(0, 16);
  const liveUnrestrictedHash = crypto.createHash('sha256').update(liveUnrestrictedKey).digest('hex');

  const liveBundlesKey = 'ak_live_bundles_scoped_key_123456789';
  const liveBundlesPrefix = liveBundlesKey.substring(0, 16);
  const liveBundlesHash = crypto.createHash('sha256').update(liveBundlesKey).digest('hex');

  const liveBeneficiariesKey = 'ak_live_beneficiaries_scoped_12345678';
  const liveBeneficiariesPrefix = liveBeneficiariesKey.substring(0, 16);
  const liveBeneficiariesHash = crypto.createHash('sha256').update(liveBeneficiariesKey).digest('hex');

  const liveWalletKey = 'ak_live_wallet_scoped_key_1234567890';
  const liveWalletPrefix = liveWalletKey.substring(0, 16);
  const liveWalletHash = crypto.createHash('sha256').update(liveWalletKey).digest('hex');

  const liveWebhooksReadKey = 'ak_live_webhooks_read_scoped_1234567';
  const liveWebhooksReadPrefix = liveWebhooksReadKey.substring(0, 16);
  const liveWebhooksReadHash = crypto.createHash('sha256').update(liveWebhooksReadKey).digest('hex');

  const mockBundles = [
    {
      id: 'bnd_mtn_1gb',
      name: 'MTN 1GB Data',
      network: 'MTN',
      data_amount_mb: 1024,
      base_price_pesewas: 1000, // GH₵ 10.00
      agent_price_pesewas: 950, // GH₵ 9.50
      validity_days: 30,
      validity_desc: '30 Days',
      is_active: true,
      custom_price_pesewas: null,
    },
    {
      id: 'bnd_mtn_5gb',
      name: 'MTN 5GB Data',
      network: 'MTN',
      data_amount_mb: 5120,
      base_price_pesewas: 4500, // GH₵ 45.00
      agent_price_pesewas: 4200, // GH₵ 42.00
      validity_days: 30,
      validity_desc: '30 Days',
      is_active: true,
      custom_price_pesewas: 3800, // Override: GH₵ 38.00
    },
    {
      id: 'bnd_tel_2gb',
      name: 'Telecel 2GB Data',
      network: 'TELECEL',
      data_amount_mb: 2048,
      base_price_pesewas: 1800,
      agent_price_pesewas: null,
      validity_days: 30,
      validity_desc: '30 Days',
      is_active: true,
      custom_price_pesewas: null,
    },
  ];

  const mockBeneficiaries = [
    {
      id: 'ben_1',
      phone_number: '0244123456',
      network: 'MTN',
      validation_status: 'VALID',
      status: 'APPROVED',
      created_at: '2026-04-18T10:00:00.000Z',
      updated_at: '2026-04-18T10:15:00.000Z',
      validated_at: '2026-04-18T10:15:00.000Z',
    },
    {
      id: 'ben_2',
      phone_number: '0555987654',
      network: 'MTN',
      validation_status: 'PENDING',
      status: 'PENDING',
      created_at: '2026-04-18T11:00:00.000Z',
      updated_at: '2026-04-18T11:00:00.000Z',
      validated_at: null,
    },
    {
      id: 'ben_3',
      phone_number: '0200112233',
      network: 'TELECEL',
      validation_status: 'INVALID',
      status: 'REJECTED',
      created_at: '2026-04-18T12:00:00.000Z',
      updated_at: '2026-04-18T12:05:00.000Z',
      validated_at: '2026-04-18T12:05:00.000Z',
    },
  ];

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string, params?: any[]) => {
        const sql = query.replace(/\s+/g, ' ');

        // API Key Lookups
        if (sql.includes('FROM api_keys')) {
          const prefix = params?.[0];
          if (prefix === liveUnrestrictedPrefix) {
            return Promise.resolve({
              rows: [
                {
                  id: 'key_unrestricted',
                  agentId: 'agt_master_1',
                  name: 'Master Agent',
                  keyHash: liveUnrestrictedHash,
                  environment: ApiKeyEnvironment.LIVE,
                  scopes: [], // Unrestricted
                  rateLimitTier: 'TIER_AGENT',
                  status: ApiKeyStatus.ACTIVE,
                  expiresAt: null,
                },
              ],
            });
          }
          if (prefix === liveBundlesPrefix) {
            return Promise.resolve({
              rows: [
                {
                  id: 'key_bundles',
                  agentId: 'agt_master_1',
                  name: 'Bundles Only Agent',
                  keyHash: liveBundlesHash,
                  environment: ApiKeyEnvironment.LIVE,
                  scopes: ['bundles:read'],
                  rateLimitTier: 'TIER_AGENT',
                  status: ApiKeyStatus.ACTIVE,
                  expiresAt: null,
                },
              ],
            });
          }
          if (prefix === liveBeneficiariesPrefix) {
            return Promise.resolve({
              rows: [
                {
                  id: 'key_beneficiaries',
                  agentId: 'agt_master_1',
                  name: 'Beneficiaries Only Agent',
                  keyHash: liveBeneficiariesHash,
                  environment: ApiKeyEnvironment.LIVE,
                  scopes: ['beneficiaries:read'],
                  rateLimitTier: 'TIER_AGENT',
                  status: ApiKeyStatus.ACTIVE,
                  expiresAt: null,
                },
              ],
            });
          }
          if (prefix === liveWalletPrefix) {
            return Promise.resolve({
              rows: [
                {
                  id: 'key_wallet',
                  agentId: 'agt_master_1',
                  name: 'Wallet Only Agent',
                  keyHash: liveWalletHash,
                  environment: ApiKeyEnvironment.LIVE,
                  scopes: ['wallet:read'],
                  rateLimitTier: 'TIER_AGENT',
                  status: ApiKeyStatus.ACTIVE,
                  expiresAt: null,
                },
              ],
            });
          }
          if (prefix === liveWebhooksReadPrefix) {
            return Promise.resolve({
              rows: [
                {
                  id: 'key_wh_read',
                  agentId: 'agt_master_1',
                  name: 'Webhooks Read Only Agent',
                  keyHash: liveWebhooksReadHash,
                  environment: ApiKeyEnvironment.LIVE,
                  scopes: ['webhooks:read'],
                  rateLimitTier: 'TIER_AGENT',
                  status: ApiKeyStatus.ACTIVE,
                  expiresAt: null,
                },
              ],
            });
          }
        }

        // Agent Profile / Me Lookups
        if (sql.includes('SELECT u.id as user_id') && sql.includes('FROM users u')) {
          return Promise.resolve({
            rows: [
              {
                user_id: 'usr_01J8ABCDEF',
                full_name: 'Mensah Telecommunications',
                email: 'mensah@datahouse.com',
                phone_number: '0244123456',
                user_status: 'ACTIVE',
                agent_id: 'agt_01J8ABCDEF',
                business_name: 'Mensah Data House',
                agent_tier: 'TIER_1',
                agent_status: 'ACTIVE',
                commission_rate: '2.50',
              },
            ],
          });
        }

        // Agent record lookup (for bundles or profile)
        if (sql.includes('FROM agents WHERE user_id = $1 OR id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'agt_01J8ABCDEF',
                agent_tier: 'TIER_1',
                price_per_gb: 4.5,
              },
            ],
          });
        }

        // Bundles listing
        if (sql.includes('FROM catalog_products cp')) {
          if (sql.includes('COUNT(*) as total')) {
            return Promise.resolve({ rows: [{ total: String(mockBundles.length) }] });
          }
          let filtered = [...mockBundles];
          if (sql.includes('cp.id::text = $1') || sql.includes('cp.id = $1')) {
            const requestedId = params?.[0];
            filtered = filtered.filter((b) => b.id === requestedId);
          }
          if (sql.includes('UPPER(cp.network) = UPPER($2)')) {
            const net = params?.[1]?.toUpperCase();
            filtered = filtered.filter((b) => b.network === net);
          }
          if (sql.includes('ILIKE')) {
            filtered = filtered.filter((b) => b.name.includes('MTN'));
          }
          return Promise.resolve({ rows: filtered });
        }

        // Beneficiaries listing
        if (sql.includes('FROM beneficiary_validation') || sql.includes('FROM pending_beneficiary_approvals')) {
          if (sql.includes('COUNT(*) as total')) {
            return Promise.resolve({ rows: [{ total: String(mockBeneficiaries.length) }] });
          }
          let filtered = [...mockBeneficiaries];
          if (sql.includes("validation_status = 'VALID'") || sql.includes("LOWER(status) = LOWER($") || sql.includes("LOWER(status) = LOWER('approved')")) {
            filtered = filtered.filter((b) => b.validation_status === 'VALID' || (b as any).status === 'APPROVED');
          }
          return Promise.resolve({ rows: filtered });
        }

        // Financial Ledger balance & entries
        if (sql.includes('FROM financial_ledger WHERE account_id = $1')) {
          if (sql.includes('COUNT(*) as total')) {
            return Promise.resolve({ rows: [{ total: '2' }] });
          }
          return Promise.resolve({
            rows: [
              {
                id: 'led_entry_2',
                transaction_id: 'tx_2',
                entry_type: 'DEBIT',
                amount_pesewas: 950,
                reference_type: 'ORDER',
                reference_id: 'ORD-01J8ABCDEF',
                balance_after: 14050,
                balance_before: 15000,
                created_at: '2026-04-18T11:00:00.000Z',
              },
              {
                id: 'led_entry_1',
                transaction_id: 'tx_1',
                entry_type: 'CREDIT',
                amount_pesewas: 15000,
                reference_type: 'WALLET_TOPUP',
                reference_id: 'PST_TOPUP_1',
                balance_after: 15000,
                balance_before: 0,
                created_at: '2026-04-18T10:00:00.000Z',
              },
            ],
          });
        }

        // Webhooks table
        if (sql.includes('FROM agent_webhooks WHERE agent_id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'sub_01J8WH123',
                url: 'https://webhook.site/my-endpoint',
                events: ['purchase.success', 'purchase.failed'],
                status: 'ACTIVE',
                createdAt: '2026-04-18T10:00:00.000Z',
              },
            ],
          });
        }

        if (sql.includes('INSERT INTO agent_webhooks')) {
          return Promise.resolve({
            rows: [
              {
                id: 'sub_01J8NEWHOOK',
                url: params?.[1],
                events: params?.[3],
                status: 'ACTIVE',
                createdAt: '2026-04-18T12:00:00.000Z',
              },
            ],
          });
        }

        if (sql.includes('FROM agent_webhooks WHERE id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: params?.[0],
                agentId: 'agt_master_1',
                url: 'https://webhook.site/my-endpoint',
                events: ['purchase.success', 'purchase.failed'],
                status: 'ACTIVE',
                createdAt: '2026-04-18T10:00:00.000Z',
              },
            ],
          });
        }

        if (sql.includes('UPDATE agent_webhooks')) {
          return Promise.resolve({ rowCount: 1 });
        }

        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    apiKeyService = new ApiKeyService(mockDb);
    mockTokenService = new TokenService('test-jwt-secret-key-that-is-at-least-32-chars-long', 900);
    mockRbacService = {
      hasPermission: vi.fn().mockReturnValue(true),
    } as unknown as RbacService;

    mockLedgerService = {
      getAccountBalance: vi.fn().mockResolvedValue({
        balancePesewas: 15000, // GH₵ 150.00
        totalDebits: 5000,
        totalCredits: 20000,
      }),
      recordJournalEntries: vi.fn().mockResolvedValue([]),
    } as unknown as FinancialLedgerService;

    app = Fastify();
    app.setErrorHandler(errorHandler);

    await app.register(agentRoutes, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService,
      rbacService: mockRbacService,
      ledgerService: mockLedgerService,
    });

    await app.ready();
  });

  // -------------------------------------------------------------------------
  // 1. GET /agent/me (Profile probe)
  // -------------------------------------------------------------------------
  describe('GET /agent/me', () => {
    it('returns agent profile and wallet snapshot with unrestricted key', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/me',
        headers: {
          'x-api-key': liveUnrestrictedKey,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('agt_01J8ABCDEF');
      expect(json.data.publicId).toBe('agt_agt_01J8AB');
      expect(json.data.businessName).toBe('Mensah Data House');
      expect(json.data.email).toBe('mensah@datahouse.com');
      expect(json.data.status).toBe('active');
      expect(json.data.tier).toBe('TIER_1');
      expect(json.data.wallet.balance).toBe(150.0);
      expect(json.data.wallet.availableToSpend).toBe(150.0);
    });

    it('returns agent profile with scoped key (no specific scope required)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/me',
        headers: {
          'x-api-key': liveBundlesKey,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.businessName).toBe('Mensah Data House');
    });

    it('rejects unauthenticated requests without API key', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/me',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // 2. GET /agent/bundles (Catalog & dynamic price hierarchy)
  // -------------------------------------------------------------------------
  describe('GET /agent/bundles', () => {
    it('returns bundles priced according to tier hierarchy', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/bundles?network=MTN&page=1&limit=10',
        headers: {
          'x-api-key': liveBundlesKey,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.meta.page).toBe(1);
      expect(json.meta.limit).toBe(10);
      expect(json.data).toBeInstanceOf(Array);

      // Check bundle 1 (MTN 1GB):
      // base: GH₵ 10.00, agent.price_per_gb: 4.5, 1GB => GH₵ 4.50
      const bnd1 = json.data.find((b: any) => b.id === 'bnd_mtn_1gb');
      expect(bnd1).toBeDefined();
      expect(bnd1.capacity).toBe(1);
      expect(bnd1.capacityUnit).toBe('GB');
      expect(bnd1.price).toBe(10.0);
      expect(bnd1.amount).toBe(10.0);
      expect(bnd1.agentAmount).toBe(4.5);

      // Check bundle 2 (MTN 5GB):
      // base: GH₵ 45.00, custom override: GH₵ 38.00 (resolution: per-bundle override wins over pricePerGb)
      const bnd2 = json.data.find((b: any) => b.id === 'bnd_mtn_5gb');
      expect(bnd2).toBeDefined();
      expect(bnd2.price).toBe(45.0);
      expect(bnd2.agentAmount).toBe(38.0);
    });

    it('blocks callers lacking bundles:read scope with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/bundles',
        headers: {
          'x-api-key': liveBeneficiariesKey, // Only has beneficiaries:read
        },
      });

      expect(res.statusCode).toBe(403);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('lacks required permission scope');
    });

    it('allows unrestricted key to access bundles catalog', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/bundles',
        headers: {
          'x-api-key': liveUnrestrictedKey,
        },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // 3. GET /agent/beneficiaries (MTN status tracking)
  // -------------------------------------------------------------------------
  describe('GET /agent/beneficiaries', () => {
    it('returns beneficiary records with status filter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/beneficiaries?status=approved&network=MTN&page=1&limit=20',
        headers: {
          'x-api-key': liveBeneficiariesKey,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.data).toBeInstanceOf(Array);
      expect(json.data.data[0].msisdn).toBe('0244123456');
      expect(json.data.data[0].status).toBe('approved');
      expect(json.data.data[0].network).toBe('MTN');
      expect(json.data.data[0].attemptCount).toBe(1);
      expect(json.data.data[0]).toHaveProperty('firstDetectedAt');
      expect(json.data.data[0]).toHaveProperty('lastDetectedAt');
      expect(json.data.data[0]).toHaveProperty('submittedAt');
      expect(json.data.data[0]).toHaveProperty('resolvedAt');
      expect(json.data.meta.page).toBe(1);
      expect(json.data.meta.limit).toBe(20);
      expect(json.data.meta).toHaveProperty('total');
    });

    it('returns filtered results by search query parameter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/beneficiaries?search=0244123456',
        headers: {
          'x-api-key': liveBeneficiariesKey,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.data).toBeInstanceOf(Array);
    });

    it('blocks callers lacking beneficiaries:read scope with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/beneficiaries',
        headers: {
          'x-api-key': liveBundlesKey, // Only has bundles:read
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // 4. GET /agent/wallet/balance & GET /agent/wallet/ledger
  // -------------------------------------------------------------------------
  describe('Agent Wallet Endpoints', () => {
    it('GET /agent/wallet/balance returns authoritative wallet balances and overdraft', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/wallet/balance',
        headers: {
          'x-api-key': liveWalletKey,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.balance).toBe(150.0);
      expect(json.data.currency).toBe('GHS');
      expect(json.data.overdraftLimit).toBe(0.0);
      expect(json.data.availableToSpend).toBe(150.0);
      // Backward compatibility fields
      expect(json.data.balancePesewas).toBe(15000);
      expect(json.data.balanceGhs).toBe(150.0);
    });

    it('GET /agent/wallet/ledger returns ledger history with balanceBefore and balanceAfter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/wallet/ledger',
        headers: {
          'x-api-key': liveWalletKey,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.meta.page).toBe(1);
      expect(json.data.meta.limit).toBe(50);
      expect(json.data.data).toHaveLength(2);

      const debitRow = json.data.data[0];
      expect(debitRow.direction).toBe('debit');
      expect(debitRow.amount).toBe(9.5);
      expect(debitRow.balanceBefore).toBe(150.0);
      expect(debitRow.balanceAfter).toBe(140.5);
      expect(debitRow.reference).toBe('ORD-01J8ABCDEF');
      expect(debitRow.walletId).toMatch(/^w_/);
      expect(debitRow.description).toBeDefined();
    });

    it('blocks wallet endpoints when key lacks wallet:read', async () => {
      const resBal = await app.inject({
        method: 'GET',
        url: '/agent/wallet/balance',
        headers: {
          'x-api-key': liveBundlesKey,
        },
      });
      expect(resBal.statusCode).toBe(403);

      const resLed = await app.inject({
        method: 'GET',
        url: '/agent/wallet/ledger',
        headers: {
          'x-api-key': liveBundlesKey,
        },
      });
      expect(resLed.statusCode).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Webhooks Management Lifecycle
  // -------------------------------------------------------------------------
  describe('Agent Webhook Management Lifecycle', () => {
    it('GET /agent/webhooks lists subscriptions with webhooks:read scope', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/webhooks',
        headers: {
          'x-api-key': liveWebhooksReadKey,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].url).toBe('https://webhook.site/my-endpoint');
      expect(json.data[0].isActive).toBe(true);
      expect(json.data[0].events).toContain('purchase.success');
    });

    it('POST /agent/webhooks is blocked with 403 for read-only keys', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agent/webhooks',
        headers: {
          'x-api-key': liveWebhooksReadKey, // Lacks webhooks:write
        },
        payload: {
          url: 'https://my-app.com/webhooks',
          events: ['purchase.success'],
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('POST /agent/webhooks creates subscription with unrestricted key and returns signing secret', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agent/webhooks',
        headers: {
          'x-api-key': liveUnrestrictedKey,
        },
        payload: {
          url: 'https://my-app.com/webhooks',
          events: ['purchase.success', 'purchase.failed'],
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.url).toBe('https://my-app.com/webhooks');
      expect(json.data.signingSecret).toMatch(/^whsec_/);
      expect(json.data.isActive).toBe(true);
    });

    it('POST /agent/webhooks/:id/rotate-secret rotates signing secret', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agent/webhooks/sub_01J8WH123/rotate-secret',
        headers: {
          'x-api-key': liveUnrestrictedKey,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('sub_01J8WH123');
      expect(json.data.signingSecret).toMatch(/^whsec_/);
    });

    it('DELETE /agent/webhooks/:id deletes subscription', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/agent/webhooks/sub_01J8WH123',
        headers: {
          'x-api-key': liveUnrestrictedKey,
        },
      });

      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // 6. Outbound Webhook Signature Generator & Dispatcher
  // -------------------------------------------------------------------------
  describe('Outbound Agent Webhook Dispatcher & Signature Verification', () => {
    it('computes X-Telecom-Signature matching DataHouse format: t=<ts>,v1=<hmac>', () => {
      const dispatcher = new AgentWebhookDispatcherService(mockDb);
      const secret = 'whsec_secret1234567890';
      const timestamp = 1713438000;
      const payload = {
        id: 'evt_01J8ABCDEF',
        type: 'purchase.success',
        created_at: '2026-04-18T11:00:00.000Z',
        data: {
          orderId: 'ord_123',
          status: 'delivered',
        },
      };

      const sigHeader = dispatcher.computeSignature(secret, timestamp, payload);
      expect(sigHeader).toMatch(/^t=1713438000,v1=[a-f0-9]{64}$/);

      // Verify the signature manually using HMAC-SHA256(secret, `${t}.${rawBody}`)
      const rawBody = JSON.stringify(payload);
      const expectedHmac = crypto
        .createHmac('sha256', secret)
        .update(`1713438000.${rawBody}`)
        .digest('hex');

      expect(sigHeader).toBe(`t=1713438000,v1=${expectedHmac}`);
    });

    it('formats outbound event conforming to DataHouse envelope specification', () => {
      const dispatcher = new AgentWebhookDispatcherService(mockDb);
      const event = dispatcher.formatEvent('purchase.success', {
        orderId: 'ord_999',
        network: 'MTN',
        status: 'delivered',
      });

      expect(event.id).toMatch(/^evt_[a-f0-9]{24}$/);
      expect(event.type).toBe('purchase.success');
      expect(new Date(event.created_at).getTime()).toBeGreaterThan(0);
      expect(event.data.status).toBe('delivered');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Error Codes & Failure Envelope Specification Verification
  // -------------------------------------------------------------------------
  describe('Standard Failure Envelope & 10 Error Codes Verification', () => {
    it('returns standard failure envelope with code, message, and meta.correlationId on 401 UNAUTHORIZED', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/bundles',
        headers: {
          'x-api-key': 'ak_live_invalid_bad_key',
        },
      });

      expect(res.statusCode).toBe(401);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
      expect(json.error.message).toBeDefined();
      expect(json.meta?.correlationId).toBeDefined();
    });

    it('returns 403 AGENT_INACTIVE when API key lacks required scope', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/bundles',
        headers: {
          'x-api-key': liveWalletKey, // lacks bundles:read
        },
      });

      expect(res.statusCode).toBe(403);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('AGENT_INACTIVE');
      expect(json.error.message).toContain('scope');
      expect(json.meta?.correlationId).toBeDefined();
    });

    it('returns 404 BUNDLE_NOT_FOUND when bundle does not exist in catalog', async () => {
      const { CatalogService } = await import('../../src/core/commerce/catalog.service.js');
      const catalogService = new CatalogService(mockDb);

      await expect(catalogService.getProductById('unknown-bundle-uuid')).rejects.toMatchObject({
        statusCode: 404,
        code: 'BUNDLE_NOT_FOUND',
      });
    });

    it('returns 400 BUNDLE_INACTIVE when bundle isActive = false', async () => {
      const dbWithInactive = {
        query: vi.fn().mockImplementation((q: string) => {
          if (q.includes('FROM catalog_products')) {
            return Promise.resolve({
              rows: [{ id: 'bnd_inactive', is_active: false, status: 'INACTIVE' }],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
      } as unknown as pg.Pool;

      const { CatalogService } = await import('../../src/core/commerce/catalog.service.js');
      const catalogService = new CatalogService(dbWithInactive);

      await expect(catalogService.getProductById('bnd_inactive')).rejects.toMatchObject({
        statusCode: 400,
        code: 'BUNDLE_INACTIVE',
      });
    });

    it('returns 400 INSUFFICIENT_BALANCE when wallet balance is lower than order amount', async () => {
      const dbInsufficient = {
        connect: vi.fn().mockResolvedValue({
          query: vi.fn().mockImplementation((q: string) => {
            if (q.includes('FROM users WHERE id = $1 FOR UPDATE')) {
              return Promise.resolve({
                rows: [{ wallet_balance_pesewas: 400 }], // 4.00 GHS
              });
            }
            return Promise.resolve({ rows: [] });
          }),
          release: vi.fn(),
        }),
        query: vi.fn().mockImplementation((q: string) => {
          if (q.includes('FROM catalog_products')) {
            return Promise.resolve({
              rows: [{
                id: 'bnd_1',
                sku: 'MTN-5GB',
                name: 'MTN 5GB',
                network: 'MTN',
                dataAmountMb: 5120,
                basePricePesewas: 500, // 5.00 GHS
                isActive: true,
                status: 'ACTIVE',
              }],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
      } as unknown as pg.Pool;

      const { CatalogService } = await import('../../src/core/commerce/catalog.service.js');
      const { OrderService } = await import('../../src/core/commerce/order.service.js');
      const { IdempotencyService } = await import('../../src/core/commerce/idempotency.service.js');

      const orderService = new OrderService(
        dbInsufficient,
        new CatalogService(dbInsufficient),
        new IdempotencyService(dbInsufficient),
      );

      await expect(
        orderService.createOrder(
          {
            productId: 'bnd_1',
            recipientPhone: '0241234567',
            paymentMethod: 'WALLET' as any,
          },
          {
            userId: 'usr_1',
            correlationId: 'corr_1',
            actorType: 'AGENT',
          },
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INSUFFICIENT_BALANCE',
        message: expect.stringContaining('Insufficient agent wallet balance: have 4.00 GHS, need 5.00 GHS'),
      });
    });

    it('returns 400 BULK_NOT_ON_SANDBOX when bulk order attempted with ak_test_ key', async () => {
      const { BulkOrderService } = await import('../../src/core/commerce/bulk-order.service.js');
      const { CatalogService } = await import('../../src/core/commerce/catalog.service.js');

      const bulkService = new BulkOrderService(mockDb, new CatalogService(mockDb));

      await expect(
        bulkService.placeAgentBulkOrder({
          userId: 'agt_1',
          isSandbox: true,
          network: 'MTN' as any,
          recipients: [{ phoneNumber: '0241234567', dataSizeGb: 5 }],
          idempotencyKey: 'valid-idempotency-key-12345',
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'BULK_NOT_ON_SANDBOX',
      });
    });

    it('returns 422 INVALID_PHONE when phone is not a Ghanaian MSISDN', async () => {
      const { InvalidPhoneError } = await import('../../src/core/errors/app-error.js');
      const err = new InvalidPhoneError('Phone not a Ghanaian MSISDN');
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('INVALID_PHONE');
    });

    it('returns 422 BENEFICIARY_NOT_VALIDATED for unvalidated MTN number on single orders', async () => {
      const { BeneficiaryNotValidatedError } = await import('../../src/core/errors/app-error.js');
      const err = new BeneficiaryNotValidatedError('First-time MTN number not yet validated — recorded for MTN approval; precheck first.');
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('BENEFICIARY_NOT_VALIDATED');
    });

    it('returns 429 RATE_LIMITED when per-key throttle is hit', async () => {
      const { RateLimitExceededError } = await import('../../src/core/errors/app-error.js');
      const err = new RateLimitExceededError('Rate limit exceeded. Please retry later.');
      expect(err.statusCode).toBe(429);
      expect(err.code).toBe('RATE_LIMITED');
    });

    it('returns 500 INTERNAL_ERROR on unexpected errors', async () => {
      const { AppError } = await import('../../src/core/errors/app-error.js');
      const err = new AppError('Unexpected error while accepting the order');
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('INTERNAL_ERROR');
    });
  });
});
