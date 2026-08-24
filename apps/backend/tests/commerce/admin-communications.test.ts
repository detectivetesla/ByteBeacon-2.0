import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import pg from 'pg';
import { adminCommunicationsRoutes } from '../../src/routes/commerce/admin-communications.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import {
  UserRole,
  SecurityDomain,
  AdminSubRole,
  CommunicationChannel,
  CommunicationPriority,
  CommunicationTargetType,
} from '@bytebeacon/shared';

describe('Phase 11.11 — Communication Center & System Messaging Administration Integration Tests', () => {
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
          if (sql.includes('COUNT(*) as total FROM communication_delivery_logs')) {
            return { rows: [{ total: '1420' }] };
          }
          if (sql.includes('COUNT(*) as today FROM communication_delivery_logs')) {
            return { rows: [{ today: '128' }] };
          }
          if (sql.includes('COUNT(*) FILTER (WHERE status = \'DELIVERED\')')) {
            return {
              rows: [
                {
                  delivered: '1410',
                  failed: '4',
                  pending: '6',
                  email_delivered: '500',
                  email_total: '503',
                  in_app_delivered: '910',
                  in_app_total: '910',
                },
              ],
            };
          }
          if (sql.includes('COUNT(*) as scheduled FROM communication_campaigns')) {
            return { rows: [{ scheduled: '2' }] };
          }
          if (sql.includes('FROM communication_campaigns') && sql.includes('SELECT COUNT(*)')) {
            return { rows: [{ total: '1' }] };
          }
          if (sql.includes('FROM communication_campaigns')) {
            return {
              rows: [
                {
                  id: '00000000-0000-0000-0000-000000000010',
                  title: 'MTN Service Maintenance Notice',
                  description: 'Telecom upgrade advisory',
                  channels: ['IN_APP', 'EMAIL'],
                  targetType: 'ROLE',
                  segment: 'CUSTOMERS',
                  audienceCount: 2183,
                  subject: 'Important Maintenance Notice',
                  body: 'Upstream gateway maintenance.',
                  priority: 'HIGH',
                  status: 'COMPLETED',
                  scheduledAt: null,
                  sentAt: new Date().toISOString(),
                  deliveredCount: 2180,
                  failedCount: 3,
                  createdBy: '00000000-0000-0000-0000-000000000001',
                  createdByName: 'Super Admin',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('FROM notification_templates WHERE id = $1')) {
            return {
              rows: [
                {
                  id: 'tpl_1',
                  slug: 'ORDER_COMPLETED',
                  name: 'Order Fulfillment Completed',
                  is_system_critical: true,
                  version: 1,
                },
              ],
            };
          }
          if (sql.includes('FROM notification_templates')) {
            return {
              rows: [
                {
                  id: 'tpl_1',
                  slug: 'ORDER_COMPLETED',
                  name: 'Order Fulfillment Completed',
                  category: 'ORDERS',
                  channels: ['IN_APP', 'EMAIL'],
                  subjectTemplate: 'Order {{order_id}} Completed',
                  bodyTemplate: 'Your data package has been dispatched.',
                  actionUrlTemplate: '/orders/{{order_id}}',
                  availableVariables: ['user_name', 'order_id'],
                  version: 1,
                  status: 'ACTIVE',
                  isSystemCritical: true,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('FROM communication_delivery_logs') && sql.includes('SELECT COUNT(*)')) {
            return { rows: [{ total: '1' }] };
          }
          if (sql.includes('FROM communication_delivery_logs')) {
            return {
              rows: [
                {
                  id: 'log_1',
                  messageId: 'msg_1',
                  recipientName: 'Yaw Mensah',
                  recipientEmail: 'yaw.mensah@gmail.com',
                  recipientPhone: '0241234567',
                  recipientRole: 'customer',
                  channel: 'EMAIL',
                  priority: 'NORMAL',
                  subject: 'Order Completed',
                  bodyPreview: 'Fulfillment completed successfully.',
                  status: 'DELIVERED',
                  attempts: 1,
                  sentAt: new Date().toISOString(),
                  deliveredAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('FROM users WHERE email = $1')) {
            return {
              rows: [
                {
                  uuid: '00000000-0000-0000-0000-000000000003',
                  full_name: 'Yaw Mensah',
                  email: 'yaw.mensah@gmail.com',
                  phone: '0241234567',
                  role: 'customer',
                },
              ],
            };
          }
          if (sql.includes('FROM users WHERE is_active = true')) {
            return {
              rows: [
                { uuid: 'u1', email: 'u1@test.com', phone: '0241111111', role: 'customer' },
                { uuid: 'u2', email: 'u2@test.com', phone: '0242222222', role: 'agent' },
              ],
            };
          }
          if (sql.includes('INSERT INTO communication_campaigns')) {
            return {
              rows: [
                {
                  id: '00000000-0000-0000-0000-000000000011',
                  title: 'Mass Announcement',
                  status: 'COMPLETED',
                  createdAt: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('UPDATE communication_campaigns SET status = \'CANCELLED\'')) {
            return {
              rows: [{ id: 'cmp_123', title: 'Pending Promo' }],
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
    } as unknown as AuditService;

    app = Fastify();
    await adminCommunicationsRoutes(app, {
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
  it('GET /admin/communication/overview should return high-level message metrics and channel health', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/communication/overview',
      headers: { authorization: 'Bearer test-admin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.totalMessages).toBe(1420);
    expect(body.data.todayMessages).toBe(128);
    expect(body.data.deliveredCount).toBe(1410);
    expect(body.data.channelsHealth).toHaveLength(4);
    expect(body.data.channelsHealth.find((c: any) => c.channel === 'SMS').status).toBe('NOT_CONFIGURED');
  });

  // 2. Health Center
  it('GET /admin/communication/health should return operational subsystem status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/communication/health',
      headers: { authorization: 'Bearer test-admin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('HEALTHY');
    expect(body.data.subsystems.inAppGateway.status).toBe('OPERATIONAL');
    expect(body.data.subsystems.smsGateway.status).toBe('NOT_CONFIGURED');
  });

  // 3. Dispatch Unicast Message
  it('POST /admin/communication/send should dispatch unicast message to individual recipient', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/communication/send',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        channels: [CommunicationChannel.IN_APP],
        targetType: CommunicationTargetType.INDIVIDUAL,
        recipientEmails: ['yaw.mensah@gmail.com'],
        subject: 'Important Order Update',
        body: 'Your data package has been dispatched.',
        priority: CommunicationPriority.NORMAL,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.recipientCount).toBe(1);
  });

  // 4. Reject unconfigured SMS / Push channels
  it('POST /admin/communication/send should reject unconfigured SMS channel with a clear error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/communication/send',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        channels: [CommunicationChannel.SMS],
        targetType: CommunicationTargetType.ROLE,
        subject: 'SMS Test',
        body: 'Testing SMS',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('SMS channel is not configured');
  });

  // 5. Elevated permission check: Non-SuperAdmin cannot send CRITICAL priority or BROADCAST without authorization
  it('POST /admin/communication/send should forbid non-SuperAdmin from sending CRITICAL broadcast without SuperAdmin rights', async () => {
    (mockTokenService.verifyAccessToken as any).mockReturnValueOnce({
      sub: '00000000-0000-0000-0000-000000000002',
      email: 'opsadmin@bytebeacon.com',
      role: UserRole.ADMIN,
      adminSubRole: AdminSubRole.OPERATIONS_ADMIN,
      domain: SecurityDomain.ADMIN,
      sessionId: 'sess_2',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/admin/communication/send',
      headers: { authorization: 'Bearer test-ops-token' },
      payload: {
        channels: [CommunicationChannel.IN_APP],
        targetType: CommunicationTargetType.BROADCAST,
        subject: 'Platform Emergency',
        body: 'All systems restarting.',
        priority: CommunicationPriority.CRITICAL,
        justificationReason: 'Emergency maintenance',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Only Super Administrators are permitted');
  });

  // 6. SuperAdmin can send CRITICAL broadcast with mandatory justification
  it('POST /admin/communication/send should allow SuperAdmin to send CRITICAL broadcast when justification is provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/communication/send',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        channels: [CommunicationChannel.IN_APP],
        targetType: CommunicationTargetType.BROADCAST,
        subject: 'Emergency Maintenance Notice',
        body: 'Scheduled core infrastructure upgrade.',
        priority: CommunicationPriority.CRITICAL,
        justificationReason: 'Super Admin scheduled core switchboard maintenance window',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.recipientCount).toBe(2);
  });

  // 7. Campaigns CRUD
  it('GET /admin/communication/campaigns should return list of campaigns', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/communication/campaigns',
      headers: { authorization: 'Bearer test-admin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].title).toBe('MTN Service Maintenance Notice');
  });

  // 8. Create Campaign with Large Audience warning
  it('POST /admin/communication/campaigns should reject large audience (>1000) without step-up confirmation', async () => {
    const prevImpl = mockDb.query;
    mockDb.query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
        return {
          rows: [
            {
              id: '00000000-0000-0000-0000-000000000001',
              uuid: '00000000-0000-0000-0000-000000000001',
              status: 'ACTIVE',
              is_active: true,
              role: UserRole.SUPER_ADMIN,
            },
          ],
        };
      }
      if (sql.includes('SELECT COUNT(*) as count FROM users')) {
        return { rows: [{ count: '2500' }] };
      }
      return { rows: [] };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/admin/communication/campaigns',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        title: 'Mass Announcement',
        subject: 'Welcome',
        body: 'Welcome to ByteBeacon 2.0',
        channels: [CommunicationChannel.IN_APP],
        targetType: CommunicationTargetType.ROLE,
        stepUpConfirmed: false,
      },
    });

    mockDb.query = prevImpl;

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Large Audience Warning');
  });

  // 9. Create Campaign with step-up confirmation
  it('POST /admin/communication/campaigns should create campaign when step-up is confirmed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/communication/campaigns',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: {
        title: 'Mass Announcement',
        subject: 'Welcome',
        body: 'Welcome to ByteBeacon 2.0',
        channels: [CommunicationChannel.IN_APP],
        targetType: CommunicationTargetType.ROLE,
        stepUpConfirmed: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('00000000-0000-0000-0000-000000000011');
  });

  // 10. Cancel scheduled campaign
  it('POST /admin/communication/campaigns/:id/cancel should cancel a scheduled campaign', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/communication/campaigns/cmp_123/cancel',
      headers: { authorization: 'Bearer test-admin-token' },
      payload: { reason: 'Campaign cancelled due to postponed promotion.' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toContain('cancelled successfully');
  });

  // 11. Notification Templates Repository
  it('GET /admin/communication/templates should return all notification templates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/communication/templates',
      headers: { authorization: 'Bearer test-admin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].slug).toBe('ORDER_COMPLETED');
  });

  // 12. Modifying system-critical templates requires SuperAdmin
  it('PUT /admin/communication/templates/:id should forbid non-SuperAdmin from editing critical templates', async () => {
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
      url: '/admin/communication/templates/tpl_1',
      headers: { authorization: 'Bearer test-ops-token' },
      payload: { name: 'Modified Template Name' },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Super Administrator privileges');
  });

  // 13. Delivery Tracking Logs with Sensitive Data Redaction
  it('GET /admin/communication/delivery-logs should return privacy-redacted delivery logs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/communication/delivery-logs',
      headers: { authorization: 'Bearer test-admin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.items[0].recipientEmailRedacted).toBe('ya***@gmail.com');
    expect(body.data.items[0].recipientPhoneRedacted).toBe('024****567');
  });

  // 14. Customer role cannot access communication center
  it('GET /admin/communication/overview should reject non-admin domain with 403 Forbidden', async () => {
    (mockTokenService.verifyAccessToken as any).mockReturnValueOnce({
      sub: '00000000-0000-0000-0000-000000000003',
      email: 'customer@bytebeacon.com',
      role: UserRole.CUSTOMER,
      domain: SecurityDomain.CUSTOMER,
      sessionId: 'sess_3',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/admin/communication/overview',
      headers: { authorization: 'Bearer test-customer-token' },
    });

    expect(res.statusCode).toBe(403);
  });
});
