import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { adminTelecomRoutes } from '../../src/routes/commerce/admin-telecom.routes.js';
import { TelecomProviderManagementService } from '../../src/core/providers/telecom-provider-management.service.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import { UserRole, SecurityDomain, NetworkProvider, TelecomProviderType, TelecomProviderStatus, TelecomEnvironment } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Phase 11.9: Network & Telecom Provider Management Routes', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTelecomService: TelecomProviderManagementService;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockAuditService: AuditService;

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('FROM users WHERE id = $1') || sql.includes('FROM users WHERE uuid = $1')) {
          return Promise.resolve({
            rows: [{ id: 'usr_admin_1', uuid: 'usr_admin_1', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'usr_admin_1',
        email: 'admin@bytebeacon.com',
        role: UserRole.SUPER_ADMIN,
        domain: SecurityDomain.ADMIN,
        status: 'ACTIVE',
        sessionId: 'sess_admin_1',
      }),
    } as unknown as TokenService;

    mockApiKeyService = {} as unknown as ApiKeyService;
    mockRbacService = {
      hasPermission: vi.fn().mockReturnValue(true),
    } as unknown as RbacService;
    mockAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
      logEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    mockTelecomService = {
      getOverview: vi.fn().mockResolvedValue({
        totalNetworks: 3,
        activeNetworks: 3,
        totalProviders: 2,
        activeProviders: 2,
        authoritativeProvider: 'DataHouse',
        systemAvailabilityPercent: 99.85,
        averageLatencyMs: 183,
        totalRequests24h: 128421,
        totalFailures24h: 231,
        openIncidentsCount: 0,
        networks: [],
        providers: [],
      }),
      getNetworks: vi.fn().mockResolvedValue([
        {
          id: 'net_mtn',
          code: NetworkProvider.MTN,
          name: 'MTN Ghana',
          slug: 'mtn-ghana',
          status: TelecomProviderStatus.ACTIVE,
          isActive: true,
          primaryProviderName: 'DataHouse',
          fallbackProviderName: 'GMPL',
          providersCount: 2,
          dailyVolumeLimitMb: 1000000000,
          dailyOrderLimit: 100000,
          minBundleMb: 50,
          maxBundleMb: 500000,
          uptimePercentage: 99.85,
          latencyMs: 183,
          successRatePercent: 99.80,
          associatedProviders: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
      updateNetwork: vi.fn().mockResolvedValue({
        code: 'MTN',
        status: 'ACTIVE',
      }),
      toggleNetwork: vi.fn().mockResolvedValue({
        code: 'MTN',
        isActive: false,
        status: 'INACTIVE',
      }),
      getProviders: vi.fn().mockResolvedValue([
        {
          id: 'p_dh',
          name: 'DataHouse',
          slug: 'datahouse',
          description: 'Primary aggregator',
          providerType: TelecomProviderType.AGGREGATOR,
          environment: TelecomEnvironment.PRODUCTION,
          status: TelecomProviderStatus.ACTIVE,
          isAuthoritative: true,
          supportedNetworks: [NetworkProvider.MTN, NetworkProvider.TELECEL, NetworkProvider.AIRTELTIGO],
          apiBaseUrl: 'https://api.datahouse.com.gh/v1',
          apiVersion: 'v1',
          authMethod: 'API_KEY',
          webhookSupport: true,
          sandboxSupport: true,
          hasCredentials: { sandbox: true, production: true },
          credentialsMasked: { apiKeyMasked: 'dh_live_••••••••3821', webhookSecretMasked: 'whsec_••••••••4912', status: 'Configured' },
          avgLatencyMs: 183,
          p95LatencyMs: 412,
          successRate: 99.82,
          totalRequestsCount: 128421,
          failedRequestsCount: 231,
          capabilities: { NETWORKS: true, SINGLE_ORDERS: true },
          networkMappings: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
      getProvider: vi.fn().mockResolvedValue({
        id: 'p_dh',
        name: 'DataHouse',
        slug: 'datahouse',
        providerType: TelecomProviderType.AGGREGATOR,
      }),
      createProvider: vi.fn().mockResolvedValue({
        id: 'p_new',
        name: 'Telecel Direct Enterprise',
        slug: 'telecel-direct',
        providerType: TelecomProviderType.DIRECT_MNO,
      }),
      updateProvider: vi.fn().mockResolvedValue({
        id: 'p_dh',
        name: 'DataHouse Updated',
      }),
      updateProviderStatus: vi.fn().mockResolvedValue({
        id: 'p_dh',
        status: 'DEGRADED',
      }),
      getCredentials: vi.fn().mockResolvedValue([
        {
          id: 'cred_1',
          providerId: 'p_dh',
          environment: 'PRODUCTION',
          apiKeyMasked: 'dh_live_••••••••3821',
          webhookSecretMasked: 'whsec_••••••••4912',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
      setCredentials: vi.fn().mockResolvedValue({
        id: 'cred_new',
        apiKeyMasked: 'live_••••••••9999',
      }),
      rotateCredentials: vi.fn().mockResolvedValue({
        id: 'cred_1',
        apiKeyMasked: 'live_••••••••1122',
      }),
      revokeCredential: vi.fn().mockResolvedValue({
        id: 'cred_1',
        status: 'REVOKED',
      }),
      testConnection: vi.fn().mockResolvedValue({
        providerId: 'p_dh',
        providerName: 'DataHouse',
        environment: 'SANDBOX',
        result: 'PASSED',
        totalLatencyMs: 142,
        steps: [
          { name: 'DNS Resolution', status: 'PASSED', latencyMs: 14 },
          { name: 'TLS Connection', status: 'PASSED', latencyMs: 28 },
          { name: 'Endpoint Reachability', status: 'PASSED', latencyMs: 42 },
          { name: 'Authentication', status: 'PASSED', latencyMs: 38 },
          { name: 'Provider Health', status: 'PASSED', latencyMs: 20 },
        ],
        timestamp: new Date().toISOString(),
      }),
      testCapabilities: vi.fn().mockResolvedValue({
        NETWORKS: true,
        SINGLE_ORDERS: true,
        BULK_ORDERS: true,
      }),
      testSandboxTransaction: vi.fn().mockResolvedValue({
        providerId: 'p_dh',
        providerName: 'DataHouse',
        result: 'PASSED',
        providerReference: 'dh_sbx_992182',
        durationMs: 342,
        network: NetworkProvider.MTN,
        recipientPhone: '0244123456',
        dataAmountMb: 1000,
        steps: [{ step: 'SUBMIT_BUNDLE', status: 'PASSED', latencyMs: 200 }],
        timestamp: new Date().toISOString(),
      }),
      getRoutingMatrix: vi.fn().mockResolvedValue([
        {
          networkCode: NetworkProvider.MTN,
          primaryProvider: 'DataHouse',
          fallbackProvider: 'GMPL',
          status: 'ACTIVE',
          availableProviders: [],
        },
      ]),
      updateRouting: vi.fn().mockResolvedValue({
        networkCode: NetworkProvider.MTN,
        primaryProvider: 'GMPL',
        fallbackProvider: 'DataHouse',
        status: 'ACTIVE',
      }),
      validateAuthoritativeSwitch: vi.fn().mockResolvedValue({
        targetProvider: 'GMPL',
        canSwitch: true,
        checks: [
          { check: 'Provider Exists', passed: true, message: 'GMPL found' },
          { check: 'Credentials Configured', passed: true, message: 'Valid' },
        ],
      }),
      switchAuthoritativeProvider: vi.fn().mockResolvedValue({
        previousProvider: 'DataHouse',
        currentAuthoritativeProvider: 'GMPL',
        switchedAt: new Date().toISOString(),
      }),
      getIncidents: vi.fn().mockResolvedValue([
        {
          id: 'inc_1',
          providerId: 'p_dh',
          providerName: 'DataHouse',
          title: 'MTN Gateway Spike',
          severity: 'HIGH',
          status: 'RESOLVED',
          affectedNetwork: 'MTN',
          failureRatePercent: 4.5,
          startedAt: new Date().toISOString(),
          resolvedAt: new Date().toISOString(),
          summary: 'Timeouts resolved',
          mitigationNotes: 'Rerouted',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
      createIncident: vi.fn().mockResolvedValue({
        id: 'inc_new',
        title: 'Telecel Route Degraded',
        severity: 'HIGH',
        status: 'INVESTIGATING',
        affectedNetwork: 'TELECEL',
        failureRatePercent: 8.5,
      }),
      updateIncident: vi.fn().mockResolvedValue({
        id: 'inc_1',
        status: 'RESOLVED',
      }),
      getHealthMetrics: vi.fn().mockResolvedValue({
        providerId: 'p_dh',
        providerName: 'DataHouse',
        averageLatencyMs: 183,
        p95LatencyMs: 412,
        successRatePercent: 99.82,
        totalRequests: 128421,
        failedRequests: 231,
        statusDistribution: { status2xx: 128190, status4xx: 150, status5xx: 81 },
      }),
    } as unknown as TelecomProviderManagementService;

    app = Fastify();
    await app.register(adminTelecomRoutes, {
      db: mockDb,
      telecomService: mockTelecomService,
      apiKeyService: mockApiKeyService,
      tokenService: mockTokenService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('1. GET /admin/telecom/overview', () => {
    it('returns aggregated control plane overview for Super Admin', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/telecom/overview',
        headers: { authorization: 'Bearer test_token' },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.totalNetworks).toBe(3);
      expect(json.data.authoritativeProvider).toBe('DataHouse');
      expect(mockTelecomService.getOverview).toHaveBeenCalled();
    });
  });

  describe('2. GET & PATCH /admin/telecom/networks', () => {
    it('returns telecom networks list', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/telecom/networks',
        headers: { authorization: 'Bearer test_token' },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
      expect(json.data[0].code).toBe('MTN');
    });

    it('toggles network active status', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/telecom/networks/MTN/toggle',
        headers: { authorization: 'Bearer test_token' },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.code).toBe('MTN');
      expect(mockTelecomService.toggleNetwork).toHaveBeenCalledWith('MTN', 'usr_admin_1', undefined);
    });
  });

  describe('3. GET & POST /admin/telecom/providers', () => {
    it('lists all telecom providers', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/telecom/providers',
        headers: { authorization: 'Bearer test_token' },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
      expect(json.data[0].name).toBe('DataHouse');
      expect(json.data[0].isAuthoritative).toBe(true);
    });

    it('creates a new telecom provider via Super Admin', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/telecom/providers',
        headers: { authorization: 'Bearer test_token' },
        payload: {
          name: 'Telecel Direct Enterprise',
          slug: 'telecel-direct',
          description: 'Direct MNO Interconnect',
          providerType: TelecomProviderType.DIRECT_MNO,
          apiBaseUrl: 'https://enterprise.telecel.com.gh/v1',
          authMethod: 'API_KEY',
          apiKey: 'sec_telecel_live_9921',
          supportedNetworks: [NetworkProvider.TELECEL],
        },
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(mockTelecomService.createProvider).toHaveBeenCalled();
    });
  });

  describe('4. Provider Credentials Vault', () => {
    it('returns masked credentials and never returns plain secrets', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/telecom/providers/p_dh/credentials',
        headers: { authorization: 'Bearer test_token' },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data[0].apiKeyMasked).toContain('••••');
    });

    it('rotates provider credentials with justification reason', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/telecom/providers/p_dh/credentials/rotate',
        headers: { authorization: 'Bearer test_token' },
        payload: {
          environment: 'PRODUCTION',
          newApiKey: 'new_secret_key_112233',
          reason: 'Scheduled quarterly key rotation policy',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.apiKeyMasked).toBeDefined();
    });
  });

  describe('5. Diagnostic & Sandbox Probes', () => {
    it('executes 5-step connection diagnostic test', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/telecom/providers/p_dh/test-connection',
        headers: { authorization: 'Bearer test_token' },
        payload: { environment: 'SANDBOX' },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.result).toBe('PASSED');
      expect(json.data.steps.length).toBe(5);
      expect(json.data.steps[0].name).toBe('DNS Resolution');
    });

    it('executes end-to-end sandbox transaction test', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/telecom/providers/p_dh/test-sandbox',
        headers: { authorization: 'Bearer test_token' },
        payload: {
          network: NetworkProvider.MTN,
          recipientPhone: '0244123456',
          dataAmountMb: 1000,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.result).toBe('PASSED');
      expect(json.data.providerReference).toBe('dh_sbx_992182');
    });
  });

  describe('6. Authoritative Provider Promotion & Switching', () => {
    it('validates pre-flight checklist for candidate provider', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/telecom/authoritative-switch/validate?targetProvider=GMPL',
        headers: { authorization: 'Bearer test_token' },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.targetProvider).toBe('GMPL');
      expect(json.data.canSwitch).toBe(true);
    });

    it('switches authoritative provider atomically', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/telecom/authoritative-switch',
        headers: { authorization: 'Bearer test_token' },
        payload: {
          newProvider: 'GMPL',
          reason: 'Migrating primary authoritative fulfillment to GMPL',
          forceSwitch: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.currentAuthoritativeProvider).toBe('GMPL');
    });
  });

  describe('7. Carrier Routing Matrix', () => {
    it('retrieves carrier routing rules', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/telecom/routing',
        headers: { authorization: 'Bearer test_token' },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
    });

    it('updates routing rule for a carrier network', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/telecom/routing',
        headers: { authorization: 'Bearer test_token' },
        payload: {
          network: NetworkProvider.MTN,
          primaryProvider: 'GMPL',
          fallbackProvider: 'DataHouse',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
    });
  });

  describe('8. Provider Incidents Log', () => {
    it('creates and retrieves provider incident', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/admin/telecom/incidents',
        headers: { authorization: 'Bearer test_token' },
        payload: {
          providerId: 'p_dh',
          title: 'Telecel Route Degraded',
          severity: 'HIGH',
          status: 'INVESTIGATING',
          affectedNetwork: 'TELECEL',
          failureRatePercent: 8.5,
          summary: 'Upstream gateway timing out on Telecel numbers',
        },
      });

      expect(createRes.statusCode).toBe(201);
      const json = createRes.json();
      expect(json.success).toBe(true);
      expect(json.data.title).toBe('Telecel Route Degraded');

      const listRes = await app.inject({
        method: 'GET',
        url: '/admin/telecom/incidents',
        headers: { authorization: 'Bearer test_token' },
      });

      expect(listRes.statusCode).toBe(200);
    });
  });
});
