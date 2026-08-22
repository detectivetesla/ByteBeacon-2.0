import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import pg from 'pg';
import { adminSettingsRoutes } from '../../src/routes/commerce/admin-settings.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import {
  UserRole,
  SecurityDomain,
  AdminSubRole,
  ConfigScope,
  ConfigCategory,
  ConfigRiskLevel,
  FeatureFlagTargetRole,
} from '@bytebeacon/shared';

describe('Phase 11.13 — System Configuration & Global Control Center Integration Tests', () => {
  let app: FastifyInstance;
  let mockDb: any;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockAuditService: AuditService;

  beforeEach(async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };

    mockDb = {
      query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
        if (typeof sql === 'string') {
          if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
            return {
              rows: [
                {
                  id: '00000000-0000-0000-0000-000000000001',
                  uuid: '00000000-0000-0000-0000-000000000001',
                  email: 'superadmin@bytebeacon.com',
                  full_name: 'Super Admin',
                  status: 'ACTIVE',
                  is_active: true,
                  role: UserRole.SUPER_ADMIN,
                },
              ],
            };
          }
          if (sql.includes('COUNT(*) as total') && sql.includes('high_risk_count')) {
            return { rows: [{ total: '43', high_risk_count: '15' }] };
          }
          if (sql.includes('COUNT(*) as total') && sql.includes('active_count')) {
            return { rows: [{ total: '5', active_count: '4' }] };
          }
          if (sql.includes('FROM sessions WHERE expires_at > CURRENT_TIMESTAMP')) {
            return { rows: [{ total: '3' }] };
          }
          if (sql.includes('ORDER BY version DESC')) {
            return {
              rows: [
                {
                  id: 'v_1',
                  configKey: 'ratelimit_customer_rpm',
                  version: 2,
                  previousValue: 60,
                  newValue: 120,
                  changeReason: 'Increased capacity',
                  changedBy: '00000000-0000-0000-0000-000000000001',
                  changedByName: 'Super Admin',
                  createdAt: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('SELECT * FROM configuration_versions WHERE config_key = $1 AND version = $2')) {
            return {
              rows: [
                {
                  id: 'v_hist_1',
                  config_key: 'ratelimit_customer_rpm',
                  version: 1,
                  new_value: 60,
                  change_reason: 'Baseline seed',
                },
              ],
            };
          }
          if (sql.includes('SELECT * FROM system_configurations WHERE config_key = $1')) {
            const key = params?.[0];
            if (key === 'mfa_super_admin_required' || key === 'maintenance_mode') {
              return {
                rows: [
                  {
                    id: 'cfg_1',
                    scope: 'SECURITY',
                    config_key: key,
                    category: 'SECURITY',
                    value: true,
                    data_type: 'BOOLEAN',
                    is_secret: false,
                    risk_level: ConfigRiskLevel.CRITICAL,
                    requires_step_up: true,
                    description: 'Mandatory 2FA',
                    version: 1,
                  },
                ],
              };
            }
            return {
              rows: [
                {
                  id: 'cfg_2',
                  scope: 'RATE_LIMITS',
                  config_key: 'ratelimit_public_rpm',
                  category: 'SECURITY',
                  value: 60,
                  data_type: 'NUMBER',
                  is_secret: false,
                  risk_level: ConfigRiskLevel.LOW,
                  requires_step_up: false,
                  description: 'Public rate limit',
                  version: 1,
                },
              ],
            };
          }
          if (sql.includes('FROM system_configurations c')) {
            return {
              rows: [
                {
                  id: 'cfg_1',
                  scope: 'GLOBAL',
                  configKey: 'platform_name',
                  category: 'GENERAL',
                  value: 'ByteBeacon 2.0',
                  dataType: 'STRING',
                  isSecret: false,
                  riskLevel: 'LOW',
                  requiresStepUp: false,
                  description: 'Platform name',
                  version: 1,
                  lastModifiedAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                },
                {
                  id: 'cfg_2',
                  scope: 'PAYMENTS',
                  configKey: 'paystack_secret_configured',
                  category: 'PAYMENTS',
                  value: true,
                  dataType: 'BOOLEAN',
                  isSecret: true,
                  riskLevel: 'CRITICAL',
                  requiresStepUp: true,
                  description: 'Paystack Secret',
                  version: 1,
                  lastModifiedAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('FROM platform_feature_flags f')) {
            return {
              rows: [
                {
                  id: 'ff_1',
                  flagKey: 'NEW_ORDER_ENGINE',
                  name: 'Next-Gen Order Engine',
                  description: 'BullMQ fulfillment pipeline',
                  isEnabled: true,
                  targetRole: 'ALL',
                  environment: 'ALL',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('UPDATE platform_feature_flags')) {
            return {
              rows: [
                {
                  id: 'ff_1',
                  flag_key: params?.[5],
                  is_enabled: params?.[0],
                  target_role: params?.[1],
                  environment: params?.[2],
                  reason: params?.[4],
                },
              ],
            };
          }
          if (sql.includes('FROM sessions s')) {
            return {
              rows: [
                {
                  sessionId: 'sess_active_1',
                  userId: '00000000-0000-0000-0000-000000000001',
                  userName: 'Super Admin',
                  userEmail: 'superadmin@bytebeacon.com',
                  userRole: 'super_admin',
                  ipAddress: '127.0.0.1',
                  userAgent: 'Mozilla/5.0 Chrome/120',
                  lastActiveAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                  expiresAt: new Date(Date.now() + 3600000).toISOString(),
                },
              ],
            };
          }
          if (sql.includes('SELECT 1')) {
            return { rows: [{ '?column?': 1 }] };
          }
        }
        return { rows: [] };
      }),
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as pg.Pool;

    mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: '00000000-0000-0000-0000-000000000001',
        email: 'superadmin@bytebeacon.com',
        role: UserRole.SUPER_ADMIN,
        adminSubRole: AdminSubRole.SUPER_ADMIN,
        domain: SecurityDomain.ADMIN,
        sessionId: 'sess_1',
      }),
    } as unknown as TokenService;

    mockApiKeyService = {} as unknown as ApiKeyService;

    mockRbacService = {
      hasPermission: vi.fn().mockReturnValue(true),
      requirePermission: vi.fn().mockReturnValue(true),
    } as unknown as RbacService;

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    app = Fastify();
    await adminSettingsRoutes(app, {
      db: mockDb,
      apiKeyService: mockApiKeyService,
      tokenService: mockTokenService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
    });
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    vi.clearAllMocks();
  });

  // 1. Overview
  it('GET /admin/settings/overview should return platform operational status and summary metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/settings/overview',
      headers: { authorization: 'Bearer test-admin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.platformStatus).toBe('OPERATIONAL');
    expect(body.data.totalConfigSettings).toBe(43);
    expect(body.data.activeFeatureFlagsCount).toBe(4);
    expect(body.data.categoriesSummary).toHaveLength(7);
  });

  // 2. Configs List & Secret Redaction
  it('GET /admin/settings/configs should return system configurations with secret redaction', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/settings/configs',
      headers: { authorization: 'Bearer test-admin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[1].value).toBe('[CONFIGURED_SECRET]');
  });

  // 3. Update Low-Risk Config
  it('PUT /admin/settings/configs/:key should update low-risk setting and log audit record', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/admin/settings/configs/ratelimit_public_rpm',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        value: 120,
        reason: 'Increased capacity for public API campaign',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.version).toBe(2);
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SUPER_ADMIN_SYSTEM_CONFIG_UPDATED' }),
    );
  });

  // 4. Critical Setting without Super Admin
  it('PUT /admin/settings/configs/:key should reject high-risk change for non-SuperAdmin with 403 Forbidden', async () => {
    (mockTokenService.verifyAccessToken as any).mockReturnValueOnce({
      sub: '00000000-0000-0000-0000-000000000002',
      email: 'opsadmin@bytebeacon.com',
      role: UserRole.ADMIN,
      adminSubRole: AdminSubRole.OPERATIONS_ADMIN,
      domain: SecurityDomain.ADMIN,
      sessionId: 'sess_2',
    });

    const res = await app.inject({
      method: 'PUT',
      url: '/admin/settings/configs/mfa_super_admin_required',
      headers: { authorization: 'Bearer test-ops-token' },
      payload: {
        value: false,
        reason: 'Attempt to disable Super Admin MFA',
        stepUpConfirmation: 'CONFIRM_CONFIG_CHANGE',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Super Administrator privileges');
  });

  // 5. Critical Setting with Invalid Step-Up
  it('PUT /admin/settings/configs/:key should reject critical change with invalid step-up token', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/admin/settings/configs/mfa_super_admin_required',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        value: false,
        reason: 'Temporary maintenance disable',
        stepUpConfirmation: 'WRONG_TOKEN',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Step-up confirmation token mismatch');
  });

  // 6. Critical Setting Success
  it('PUT /admin/settings/configs/:key should succeed for SuperAdmin with valid step-up confirmation', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/admin/settings/configs/mfa_super_admin_required',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        value: true,
        reason: 'Reinforced 2FA policy across all Super Admins',
        stepUpConfirmation: 'CONFIRM_CONFIG_CHANGE',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });

  // 7. Missing Reason
  it('PUT /admin/settings/configs/:key should reject update if justification reason is missing', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/admin/settings/configs/ratelimit_public_rpm',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        value: 120,
        reason: '',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('mandatory justification reason');
  });

  // 8. Version History
  it('GET /admin/settings/configs/:key/versions should return version history timeline', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/settings/configs/ratelimit_customer_rpm/versions',
      headers: { authorization: 'Bearer test-admin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].version).toBe(2);
  });

  // 9. Rollback Config
  it('POST /admin/settings/configs/:key/rollback should restore historic version snapshot', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/settings/configs/ratelimit_customer_rpm/rollback',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        targetVersion: 1,
        reason: 'Reverting rate limit test',
        stepUpConfirmation: 'CONFIRM_CONFIG_CHANGE',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.version).toBe(2);
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SUPER_ADMIN_SYSTEM_CONFIG_ROLLBACK' }),
    );
  });

  // 10. List Feature Flags
  it('GET /admin/settings/feature-flags should list platform feature flags', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/settings/feature-flags',
      headers: { authorization: 'Bearer test-admin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].flagKey).toBe('NEW_ORDER_ENGINE');
  });

  // 11. Toggle Feature Flag
  it('PUT /admin/settings/feature-flags/:flagKey should toggle feature flag and log audit', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/admin/settings/feature-flags/NEW_ORDER_ENGINE',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        isEnabled: false,
        reason: 'Temporary pause of new order engine for routine maintenance',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'FEATURE_FLAG_TOGGLED' }),
    );
  });

  // 12. Active Sessions List
  it('GET /admin/settings/sessions should return active device sessions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/settings/sessions',
      headers: { authorization: 'Bearer test-admin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].sessionId).toBe('sess_active_1');
  });

  // 13. Revoke Session
  it('POST /admin/settings/sessions/:sessionId/revoke should terminate session and emit audit log', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/settings/sessions/sess_active_1/revoke',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        reason: 'Suspicious credential activity detected',
        revokeAllForUser: false,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_REVOKE_SESSION' }),
    );
  });

  // 14. Health Diagnostics
  it('GET /admin/settings/health should return complete subsystem connectivity report', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/settings/health',
      headers: { authorization: 'Bearer test-admin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.subsystems).toHaveLength(8);
    expect(body.data.subsystems[0].component).toBe('PostgreSQL Database Engine');
  });
});
