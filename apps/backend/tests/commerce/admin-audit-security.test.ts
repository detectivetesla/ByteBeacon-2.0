import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import pg from 'pg';
import { adminAuditSecurityRoutes } from '../../src/routes/commerce/admin-audit-security.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import {
  UserRole,
  SecurityDomain,
  AdminSubRole,
  AuditSeverity,
  AuditCategory,
  AuditResult,
  SecurityIncidentStatus,
} from '@bytebeacon/shared';

describe('Phase 11.12 — Audit & Security Operations Integration Tests', () => {
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
      query: vi.fn().mockImplementation(async (sql: string) => {
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
          if (sql.includes('COUNT(*) as total') && sql.includes('critical_count')) {
            return {
              rows: [{ total: '4832', critical_count: '0', high_count: '3', warning_count: '18' }],
            };
          }
          if (sql.includes('failed_logins')) {
            return {
              rows: [{ failed_logins: '2', rate_violations: '5' }],
            };
          }
          if (sql.includes('FROM security_incidents WHERE status IN')) {
            return { rows: [{ open_incidents: '1' }] };
          }
          if (sql.includes('ORDER BY created_at ASC') && sql.includes('WHERE event_hash IS NOT NULL')) {
            return {
              rows: [
                {
                  id: 'e1',
                  correlation_id: 'req_1',
                  actor_type: 'ADMIN',
                  actor_id: '00000000-0000-0000-0000-000000000001',
                  action: 'SYSTEM_BOOT',
                  resource_type: 'system',
                  resource_id: 'bytebeacon_2.0',
                  severity: 'INFO',
                  result: 'SUCCESS',
                  event_hash: 'hash_1',
                  previous_event_hash: '0000000000000000000000000000000000000000000000000000000000000000',
                  created_at: new Date().toISOString(),
                },
                {
                  id: 'e2',
                  correlation_id: 'req_2',
                  actor_type: 'ADMIN',
                  actor_id: '00000000-0000-0000-0000-000000000001',
                  action: 'AUTH_LOGIN',
                  resource_type: 'auth',
                  resource_id: 'superadmin',
                  severity: 'INFO',
                  result: 'SUCCESS',
                  event_hash: 'hash_2',
                  previous_event_hash: 'hash_1',
                  created_at: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('SELECT event_hash FROM audit_logs')) {
            return {
              rows: [{ event_hash: '9e7b4a2c1f8e6d0a3c5b7e9f1a2d4c6e8b0a2c4e6f8a0b2d4e6f8a0b2d4e6f8a' }],
            };
          }
          if (sql.includes('FROM audit_logs l') && sql.includes('SELECT COUNT(*)')) {
            return { rows: [{ total: '1' }] };
          }
          if (sql.includes('FROM audit_logs l') && sql.includes('WHERE l.id = $1')) {
            return {
              rows: [
                {
                  id: '00000000-0000-0000-0000-000000000099',
                  correlationId: 'req_adj_1',
                  actorId: '00000000-0000-0000-0000-000000000001',
                  actorName: 'Super Admin',
                  actorEmail: 'superadmin@bytebeacon.com',
                  actorRole: 'super_admin',
                  actorType: 'ADMIN',
                  action: 'WALLET_ADJUSTMENT',
                  category: AuditCategory.FINANCIAL_SECURITY,
                  resourceType: 'wallets',
                  resourceId: 'w_123',
                  result: AuditResult.SUCCESS,
                  severity: AuditSeverity.HIGH,
                  metadata: JSON.stringify({ reason: 'Promotional adjustment', walletId: 'w_123' }),
                  beforeState: JSON.stringify({ balance: 'GH₵50.00' }),
                  afterState: JSON.stringify({ balance: 'GH₵70.00' }),
                  reason: 'Promotional credit',
                  ipAddress: '127.0.0.1',
                  userAgent: 'Postman/1.0',
                  eventHash: 'a1b2c3d4e5f6',
                  previousEventHash: '000000000000',
                  timestamp: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('FROM audit_logs l')) {
            return {
              rows: [
                {
                  id: '00000000-0000-0000-0000-000000000099',
                  correlationId: 'req_adj_1',
                  actorId: '00000000-0000-0000-0000-000000000001',
                  actorName: 'Super Admin',
                  actorEmail: 'superadmin@bytebeacon.com',
                  actorRole: 'super_admin',
                  actorType: 'ADMIN',
                  action: 'WALLET_ADJUSTMENT',
                  category: AuditCategory.FINANCIAL_SECURITY,
                  resourceType: 'wallets',
                  resourceId: 'w_123',
                  result: AuditResult.SUCCESS,
                  severity: AuditSeverity.HIGH,
                  ipAddress: '127.0.0.1',
                  userAgent: 'Mozilla/5.0',
                  reason: 'Promotional credit',
                  eventHash: 'a1b2c3d4e5f6',
                  previousEventHash: '000000000000',
                  timestamp: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('FROM security_incidents i')) {
            return {
              rows: [
                {
                  id: 'inc_1',
                  incidentNumber: 'INC-100200',
                  title: 'Repeated API Key Rate-Limit Exceeded',
                  severity: 'HIGH',
                  status: 'OPEN',
                  triggeringEventId: '00000000-0000-0000-0000-000000000099',
                  assignedAdminId: '00000000-0000-0000-0000-000000000001',
                  assignedAdminName: 'Super Admin',
                  affectedUserId: '00000000-0000-0000-0000-000000000003',
                  affectedUserEmail: 'agent.kofi@bytebeacon.com',
                  timeline: JSON.stringify([
                    {
                      timestamp: new Date().toISOString(),
                      action: 'INCIDENT_OPENED',
                      note: 'Incident opened',
                      actorName: 'Super Admin',
                    },
                  ]),
                  investigationNotes: 'Monitoring IP spikes from 197.220.10.5',
                  resolution: null,
                  resolvedBy: null,
                  resolvedAt: null,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('INSERT INTO security_incidents')) {
            return {
              rows: [
                {
                  id: 'inc_new_1',
                  incidentNumber: 'INC-999888',
                  title: 'Suspicious Admin Login',
                  status: 'OPEN',
                  createdAt: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('SELECT * FROM security_incidents WHERE id = $1')) {
            return {
              rows: [
                {
                  id: 'inc_1',
                  incident_number: 'INC-100200',
                  title: 'Repeated API Key Rate-Limit Exceeded',
                  timeline: '[]',
                },
              ],
            };
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
      getLastHash: vi.fn().mockReturnValue('9e7b4a2c1f8e6d0a3c5b7e9f1a2d4c6e8b0a2c4e6f8a0b2d4e6f8a0b2d4e6f8a'),
    } as unknown as AuditService;

    app = Fastify();
    await adminAuditSecurityRoutes(app, {
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

  // 1. Overview KPIs
  it('GET /admin/audit/overview should return high-level KPI counters, health, and cryptographic head hash', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit/overview',
      headers: { authorization: 'Bearer test-admin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.totalEvents).toBe(4832);
    expect(body.data.tamperEvidenceStatus).toBe('VERIFIED');
    expect(body.data.lastChainedHash).toBeDefined();
    expect(body.data.overallSecurityHealth).toBe('HEALTHY');
  });

  // 2. Audit Events Feed
  it('GET /admin/audit/events should return paginated audit logs with privacy redaction', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit/events',
      headers: { authorization: 'Bearer test-admin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].action).toBe('WALLET_ADJUSTMENT');
    expect(body.data.items[0].actorEmailRedacted).toBe('su***@bytebeacon.com');
  });

  // 3. Activity Dossier Detail
  it('GET /admin/audit/events/:id should return detailed activity dossier with before/after state diff', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit/events/00000000-0000-0000-0000-000000000099',
      headers: { authorization: 'Bearer test-admin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.beforeState.balance).toBe('GH₵50.00');
    expect(body.data.afterState.balance).toBe('GH₵70.00');
    expect(body.data.linkedRecords.walletId).toBe('w_123');
  });

  // 4. Cryptographic Hash-Chain Verification
  it('GET /admin/audit/integrity should verify cryptographic chaining across sequence blocks', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit/integrity',
      headers: { authorization: 'Bearer test-admin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.isTamperEvident).toBe(true);
    expect(body.data.totalChecked).toBe(2);
    expect(body.data.discrepanciesCount).toBe(0);
  });

  // 5. Non-SuperAdmin cannot run audit integrity check
  it('GET /admin/audit/integrity should forbid non-SuperAdmin users with 403 Forbidden', async () => {
    (mockTokenService.verifyAccessToken as any).mockReturnValueOnce({
      sub: '00000000-0000-0000-0000-000000000002',
      email: 'opsadmin@bytebeacon.com',
      role: UserRole.ADMIN,
      adminSubRole: AdminSubRole.OPERATIONS_ADMIN,
      domain: SecurityDomain.ADMIN,
      sessionId: 'sess_2',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit/integrity',
      headers: { authorization: 'Bearer test-ops-token' },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Only Super Administrators');
  });

  // 6. Audit Export CSV
  it('POST /admin/audit/export should stream CSV output and log AUDIT_DATA_EXPORTED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/audit/export',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: { format: 'CSV', category: 'FINANCIAL_SECURITY' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.body).toContain('Timestamp,CorrelationId,Actor');
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUDIT_DATA_EXPORTED' }),
    );
  });

  // 7. Audit Export JSON
  it('POST /admin/audit/export should return structured JSON output', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/audit/export',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: { format: 'JSON' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.format).toBe('JSON');
  });

  // 8. List Incidents
  it('GET /admin/audit/incidents should return security incident tickets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit/incidents',
      headers: { authorization: 'Bearer test-admin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].incidentNumber).toBe('INC-100200');
  });

  // 9. Create Security Incident
  it('POST /admin/audit/incidents should register new security incident', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/audit/incidents',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        title: 'Suspicious Admin Login',
        severity: AuditSeverity.HIGH,
        investigationNotes: 'Unrecognized IP from AS37105',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('Suspicious Admin Login');
  });

  // 10. Update Incident Status
  it('PATCH /admin/audit/incidents/:id should update incident status to RESOLVED', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/audit/incidents/inc_1',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        status: SecurityIncidentStatus.RESOLVED,
        resolution: 'IP address blocked on Edge Firewall.',
        timelineNote: 'Investigation closed.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('updated successfully');
  });

  // 11. Emergency Kill Switch missing step-up
  it('POST /admin/audit/emergency/toggle should reject missing step-up token with 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/audit/emergency/toggle',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        controlKey: 'MAINTENANCE_MODE',
        enabled: true,
        reason: 'Emergency database upgrade',
        stepUpConfirmation: 'WRONG_TOKEN',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Step-up confirmation token mismatch');
  });

  // 12. Emergency Kill Switch missing reason
  it('POST /admin/audit/emergency/toggle should reject missing reason with 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/audit/emergency/toggle',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        controlKey: 'MAINTENANCE_MODE',
        enabled: true,
        reason: '',
        stepUpConfirmation: 'CONFIRM_EMERGENCY_ACTION',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('justification reason is mandatory');
  });

  // 13. Emergency Kill Switch success
  it('POST /admin/audit/emergency/toggle should allow SuperAdmin with valid step-up confirmation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/audit/emergency/toggle',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        controlKey: 'MAINTENANCE_MODE',
        enabled: true,
        reason: 'Super Admin scheduled core switchboard maintenance window',
        stepUpConfirmation: 'CONFIRM_EMERGENCY_ACTION',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toContain('ACTIVATED successfully');
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SUPER_ADMIN_EMERGENCY_CONTROL_TOGGLED' }),
    );
  });

  // 14. Non-admin domain cannot access audit stream
  it('GET /admin/audit/overview should reject non-admin domain with 403 Forbidden', async () => {
    (mockTokenService.verifyAccessToken as any).mockReturnValueOnce({
      sub: '00000000-0000-0000-0000-000000000003',
      email: 'customer@bytebeacon.com',
      role: UserRole.CUSTOMER,
      domain: SecurityDomain.CUSTOMER,
      sessionId: 'sess_3',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/admin/audit/overview',
      headers: { authorization: 'Bearer test-customer-token' },
    });

    expect(res.statusCode).toBe(403);
  });
});
