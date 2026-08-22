import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import pg from 'pg';
import { adminNotificationsRoutes } from '../../src/routes/commerce/admin-notifications.routes.js';
import { adminAlertsRoutes } from '../../src/routes/commerce/admin-alerts.routes.js';
import { userNotificationsRoutes } from '../../src/routes/commerce/user-notifications.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import {
  UserRole,
  SecurityDomain,
  AdminSubRole,
  NotificationSeverity,
  NotificationType,
  AlertStatus,
  AlertSource,
  CommunicationChannel,
  CommunicationDeliveryStatus,
  CommunicationTargetType,
} from '@bytebeacon/shared';

describe('Phase 11.15 — Notifications, Alerts & System Communications Administration Tests', () => {
  let app: FastifyInstance;
  let mockDb: any;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockAuditService: AuditService;

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
        if (typeof sql === 'string') {
          // Users lookup
          if (sql.includes('FROM users') && (sql.includes('WHERE uuid = $1') || sql.includes('WHERE id = $1'))) {
            const requestedId = params?.[0];
            if (requestedId === '00000000-0000-0000-0000-000000000002') {
              return {
                rows: [
                  {
                    id: '00000000-0000-0000-0000-000000000002',
                    uuid: '00000000-0000-0000-0000-000000000002',
                    email: 'admin.ops@bytebeacon.com',
                    full_name: 'Operations Admin',
                    status: 'ACTIVE',
                    is_active: true,
                    role: UserRole.ADMIN,
                    admin_sub_role: AdminSubRole.OPERATIONS,
                  },
                ],
              };
            }
            if (requestedId === '00000000-0000-0000-0000-000000000099') {
              return {
                rows: [
                  {
                    id: '00000000-0000-0000-0000-000000000099',
                    uuid: '00000000-0000-0000-0000-000000000099',
                    email: 'customer@bytebeacon.com',
                    full_name: 'Yaw Omao',
                    status: 'ACTIVE',
                    is_active: true,
                    role: UserRole.CUSTOMER,
                  },
                ],
              };
            }
            // Default: Super Admin
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

          // 1. Overview counts
          if (sql.includes('SELECT COUNT(*) as cnt FROM notifications WHERE is_read = false')) {
            return { rows: [{ cnt: '12' }] };
          }
          if (sql.includes('SELECT COUNT(*) as cnt FROM notifications')) {
            return { rows: [{ cnt: '250' }] };
          }
          if (sql.includes("SELECT COUNT(*) as cnt FROM system_alerts WHERE severity = 'CRITICAL'")) {
            return { rows: [{ cnt: '1' }] };
          }
          if (sql.includes("SELECT COUNT(*) as cnt FROM system_alerts WHERE status NOT IN ('RESOLVED')")) {
            return { rows: [{ cnt: '3' }] };
          }
          if (sql.includes("SELECT COUNT(*) as cnt FROM communication_delivery_logs WHERE status = 'FAILED'")) {
            return { rows: [{ cnt: '5' }] };
          }
          if (sql.includes("SELECT COUNT(*) as cnt FROM communication_delivery_logs WHERE status IN ('CREATED','QUEUED','PROCESSING')")) {
            return { rows: [{ cnt: '2' }] };
          }
          if (sql.includes("SELECT COUNT(*) as cnt FROM communication_campaigns WHERE status = 'SCHEDULED'")) {
            return { rows: [{ cnt: '1' }] };
          }
          if (sql.includes('SELECT COUNT(*) as cnt FROM notification_rules WHERE is_active = true')) {
            return { rows: [{ cnt: '8' }] };
          }
          if (sql.includes("SELECT COUNT(*) as cnt FROM communication_delivery_logs WHERE created_at >= CURRENT_DATE")) {
            return { rows: [{ cnt: '45' }] };
          }
          if (sql.includes("SELECT COUNT(*) as cnt FROM communication_delivery_logs WHERE status = 'DELIVERED'")) {
            return { rows: [{ cnt: '240' }] };
          }
          if (sql.includes('SELECT id, type, severity, title, created_at FROM notifications ORDER BY created_at DESC LIMIT 10')) {
            return {
              rows: [
                {
                  id: '00000000-0000-0000-0000-000000000101',
                  type: NotificationType.ORDER_COMPLETED,
                  severity: NotificationSeverity.INFO,
                  title: 'Order Completed',
                  created_at: new Date().toISOString(),
                },
              ],
            };
          }

          // 2. Notification rules
          if (sql.includes('FROM notification_rules r')) {
            return {
              rows: [
                {
                  id: '00000000-0000-0000-0000-000000000201',
                  name: 'High-Value Withdrawal Warning',
                  description: 'Alerts operations when withdrawal exceeds 5000 GHS',
                  event_condition: 'WITHDRAWAL_SUBMITTED',
                  condition_value: 'amount >= 5000',
                  notify_roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
                  notify_user_ids: [],
                  channels: [CommunicationChannel.IN_APP, CommunicationChannel.EMAIL],
                  severity: NotificationSeverity.WARNING,
                  template_id: null,
                  is_active: true,
                  version: 1,
                  status: 'ACTIVE',
                  created_by: '00000000-0000-0000-0000-000000000001',
                  creator_name: 'Super Admin',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('INSERT INTO notification_rules')) {
            return {
              rows: [{ id: '00000000-0000-0000-0000-000000000202', version: 1 }],
            };
          }
          if (sql.includes('SELECT * FROM notification_rules WHERE id = $1')) {
            return {
              rows: [
                {
                  id: params?.[0] || '00000000-0000-0000-0000-000000000201',
                  name: 'Existing Rule',
                  version: 1,
                },
              ],
            };
          }

          // 3. Analytics
          if (sql.includes('SELECT channel, COUNT(*) as sent')) {
            return {
              rows: [
                { channel: CommunicationChannel.IN_APP, sent: '150', delivered: '150', failed: '0' },
                { channel: CommunicationChannel.EMAIL, sent: '100', delivered: '90', failed: '5' },
              ],
            };
          }
          if (sql.includes('SELECT COUNT(*) as cnt FROM communication_delivery_logs WHERE attempts > 1')) {
            return { rows: [{ cnt: '8' }] };
          }

          // 4. Alerts
          if (sql.includes('FROM system_alerts a WHERE a.id = $1')) {
            return {
              rows: [
                {
                  id: params?.[0] || '00000000-0000-0000-0000-000000000301',
                  severity: NotificationSeverity.CRITICAL,
                  source: AlertSource.PROVIDER_HEALTH,
                  condition: 'DataHouse Upstream Error Rate > 15%',
                  current_value: '22.4%',
                  threshold: '15%',
                  status: AlertStatus.OPEN,
                  deduplication_key: 'provider:datahouse:error_spike',
                  first_detected_at: new Date().toISOString(),
                  last_detected_at: new Date().toISOString(),
                  assigned_to_id: null,
                  assigned_to_name: null,
                  acknowledged_by_id: null,
                  acknowledged_by_name: null,
                  acknowledged_at: null,
                  resolved_by_id: null,
                  resolved_by_name: null,
                  resolved_at: null,
                  resolution: null,
                  notes_count: 0,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('SELECT id, status FROM system_alerts WHERE id = $1')) {
            const alertId = params?.[0];
            let status = AlertStatus.OPEN;
            if (alertId === '00000000-0000-0000-0000-000000000302') {
              status = AlertStatus.ACKNOWLEDGED;
            } else if (alertId === '00000000-0000-0000-0000-000000000303') {
              status = AlertStatus.INVESTIGATING;
            }
            return {
              rows: [
                {
                  id: alertId,
                  status,
                },
              ],
            };
          }
          if (sql.includes('SELECT id FROM system_alerts WHERE id = $1')) {
            return {
              rows: [{ id: params?.[0] }],
            };
          }
          if (sql.includes('SELECT * FROM alert_events WHERE alert_id = $1')) {
            return { rows: [] };
          }
          if (sql.includes('FROM system_alerts a') && sql.includes('SELECT COUNT(*)')) {
            return { rows: [{ total: '1' }] };
          }
          if (sql.includes('FROM system_alerts a')) {
            return {
              rows: [
                {
                  id: '00000000-0000-0000-0000-000000000301',
                  severity: NotificationSeverity.CRITICAL,
                  source: AlertSource.PROVIDER_HEALTH,
                  condition: 'DataHouse Upstream Error Rate > 15%',
                  current_value: '22.4%',
                  threshold: '15%',
                  status: AlertStatus.OPEN,
                  deduplication_key: 'provider:datahouse:error_spike',
                  first_detected_at: new Date().toISOString(),
                  last_detected_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
            };
          }

          // 5. History & Deliveries
          if (sql.includes('FROM communication_delivery_logs l WHERE l.id = $1')) {
            return {
              rows: [
                {
                  id: params?.[0],
                  recipient_user_id: '00000000-0000-0000-0000-000000000099',
                  recipient_name: 'Yaw Omao',
                  recipient_email: 'yaw@example.com',
                  recipient_role: 'CUSTOMER',
                  subject: 'Security Alert: Password Changed',
                  body: 'Your account password was updated successfully.',
                  channel: 'EMAIL',
                  status: 'DELIVERED',
                  attempts: 1,
                  error_message: null,
                  created_at: new Date().toISOString(),
                  sent_at: new Date().toISOString(),
                  delivered_at: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('FROM communication_delivery_logs l') && sql.includes('SELECT COUNT(*)')) {
            return { rows: [{ total: '1' }] };
          }
          if (sql.includes('FROM communication_delivery_logs l')) {
            return {
              rows: [
                {
                  id: '00000000-0000-0000-0000-000000000401',
                  recipient_user_id: '00000000-0000-0000-0000-000000000099',
                  recipient_name: 'Yaw Omao',
                  recipient_role: 'CUSTOMER',
                  type: 'ORDER_COMPLETED',
                  severity: 'INFO',
                  subject: 'Order Completed',
                  body: 'Your order was fulfilled.',
                  channel: 'IN_APP',
                  status: 'DELIVERED',
                  attempts: 1,
                  created_at: new Date().toISOString(),
                },
              ],
            };
          }

          // 6. User notifications (per-user inbox)
          if (sql.includes('FROM notifications') && sql.includes('SELECT id, type, severity')) {
            return {
              rows: [
                {
                  id: '00000000-0000-0000-0000-000000000501',
                  type: NotificationType.ORDER_COMPLETED,
                  severity: NotificationSeverity.INFO,
                  title: 'Order Completed',
                  body: 'MTN 10GB Data has been delivered to 0244123456.',
                  action_url: '/app/orders/ord_123',
                  is_read: false,
                  channel: CommunicationChannel.IN_APP,
                  created_at: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('FROM notifications') && sql.includes('SELECT COUNT(*) as total')) {
            return { rows: [{ total: '1' }] };
          }
          if (sql.includes('FROM notifications') && sql.includes('COUNT(*) FILTER')) {
            return { rows: [{ total: '5', unread: '2' }] };
          }
          if (sql.includes('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2')) {
            return { rowCount: 1 };
          }
          if (sql.includes('UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false')) {
            return { rowCount: 2 };
          }
        }
        return { rows: [], rowCount: 1 };
      }),
    };

    mockTokenService = {
      verifyAccessToken: vi.fn().mockImplementation((token: string) => {
        if (token === 'valid_admin_token') {
          return {
            sub: '00000000-0000-0000-0000-000000000002',
            email: 'admin.ops@bytebeacon.com',
            role: UserRole.ADMIN,
            domain: SecurityDomain.ADMIN,
            sessionId: 'sess-admin',
            adminSubRole: AdminSubRole.OPERATIONS,
          };
        }
        if (token === 'valid_customer_token') {
          return {
            sub: '00000000-0000-0000-0000-000000000099',
            email: 'customer@bytebeacon.com',
            role: UserRole.CUSTOMER,
            domain: SecurityDomain.CUSTOMER,
            sessionId: 'sess-customer',
          };
        }
        // Default: Super Admin
        return {
          sub: '00000000-0000-0000-0000-000000000001',
          email: 'superadmin@bytebeacon.com',
          role: UserRole.SUPER_ADMIN,
          domain: SecurityDomain.ADMIN,
          sessionId: 'sess-superadmin',
        };
      }),
    } as any;

    mockApiKeyService = {
      validateApiKey: vi.fn(),
    } as any;

    mockRbacService = new RbacService(mockDb);

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue({ id: 'audit_01' }),
    } as any;

    app = Fastify({ logger: false });

    await adminNotificationsRoutes(app, {
      db: mockDb,
      apiKeyService: mockApiKeyService,
      tokenService: mockTokenService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
    });

    await adminAlertsRoutes(app, {
      db: mockDb,
      apiKeyService: mockApiKeyService,
      tokenService: mockTokenService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
    });

    await userNotificationsRoutes(app, {
      db: mockDb,
      apiKeyService: mockApiKeyService,
      tokenService: mockTokenService,
      rbacService: mockRbacService,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // 1. Overview KPIs
  it('GET /admin/notifications/overview — returns system communication KPIs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/notifications/overview',
      headers: { authorization: 'Bearer valid_superadmin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.totalNotifications).toBe(250);
    expect(body.data.unreadNotifications).toBe(12);
    expect(body.data.systemAlerts).toBe(3);
    expect(body.data.criticalAlerts).toBe(1);
    expect(body.data.deliverySuccessRate).toBeGreaterThan(0);
    expect(body.data.recentSystemEvents).toHaveLength(1);
  });

  // 2. Notification Rules
  it('GET /admin/notifications/rules — lists active notification rules', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/notifications/rules',
      headers: { authorization: 'Bearer valid_superadmin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('High-Value Withdrawal Warning');
  });

  it('POST /admin/notifications/rules — creates new versioned notification rule', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/notifications/rules',
      headers: { authorization: 'Bearer valid_superadmin_token' },
      payload: {
        name: 'Provider Latency Alert Rule',
        description: 'Notify when latency exceeds threshold',
        eventCondition: 'PROVIDER_LATENCY_HIGH',
        conditionValue: 'latency_ms > 2000',
        notifyRoles: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
        channels: [CommunicationChannel.IN_APP],
        severity: NotificationSeverity.WARNING,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(mockAuditService.logEvent).toHaveBeenCalled();
  });

  it('PUT /admin/notifications/rules/:id — updates rule with incremented version', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/admin/notifications/rules/00000000-0000-0000-0000-000000000201',
      headers: { authorization: 'Bearer valid_superadmin_token' },
      payload: {
        name: 'Updated High-Value Withdrawal Rule',
        isActive: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.version).toBe(2);
  });

  // 3. Analytics
  it('GET /admin/notifications/analytics — returns delivery analytics breakdown', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/notifications/analytics',
      headers: { authorization: 'Bearer valid_superadmin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.byChannel).toHaveLength(2);
    expect(body.data.avgLatencyMs).toBeDefined();
  });

  // 4. Emergency Broadcasts
  it('POST /admin/notifications/emergency-broadcast — Super Admin allows dispatch with justification', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/notifications/emergency-broadcast',
      headers: { authorization: 'Bearer valid_superadmin_token' },
      payload: {
        subject: 'Scheduled Maintenance Advisory',
        body: 'Upstream gateway maintenance will occur tonight from 2AM to 3AM GMT.',
        severity: NotificationSeverity.CRITICAL,
        audience: CommunicationTargetType.BROADCAST,
        channels: [CommunicationChannel.IN_APP],
        justificationReason: 'Scheduled upstream core network maintenance window.',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('DISPATCHED');
  });

  it('POST /admin/notifications/emergency-broadcast — rejects non-SuperAdmin with 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/notifications/emergency-broadcast',
      headers: { authorization: 'Bearer valid_admin_token' },
      payload: {
        subject: 'Unauthorized Emergency Notice',
        body: 'Testing role guard.',
        severity: NotificationSeverity.CRITICAL,
        audience: CommunicationTargetType.BROADCAST,
        channels: [CommunicationChannel.IN_APP],
        justificationReason: 'Operations test broadcast justification.',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('POST /admin/notifications/emergency-broadcast — rejects missing justification reason with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/notifications/emergency-broadcast',
      headers: { authorization: 'Bearer valid_superadmin_token' },
      payload: {
        subject: 'No Justification Notice',
        body: 'Testing missing justification.',
        severity: NotificationSeverity.CRITICAL,
        audience: CommunicationTargetType.BROADCAST,
        channels: [CommunicationChannel.IN_APP],
        justificationReason: '',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  // 5. System Alerts & Lifecycle Management
  it('GET /admin/alerts — lists alerts with severity and source metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/alerts',
      headers: { authorization: 'Bearer valid_superadmin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].source).toBe(AlertSource.PROVIDER_HEALTH);
  });

  it('GET /admin/alerts/:id — returns alert details and timeline events', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/alerts/00000000-0000-0000-0000-000000000301',
      headers: { authorization: 'Bearer valid_superadmin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.alert.condition).toContain('DataHouse');
    expect(body.data.timeline).toBeDefined();
  });

  it('POST /admin/alerts/:id/acknowledge — transitions alert OPEN -> ACKNOWLEDGED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/alerts/00000000-0000-0000-0000-000000000301/acknowledge',
      headers: { authorization: 'Bearer valid_superadmin_token' },
      payload: { note: 'Operations team has been paged and is reviewing upstream status.' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe(AlertStatus.ACKNOWLEDGED);
  });

  it('POST /admin/alerts/:id/assign — assigns alert to an administrator', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/alerts/00000000-0000-0000-0000-000000000301/assign',
      headers: { authorization: 'Bearer valid_superadmin_token' },
      payload: {
        assigneeUserId: '00000000-0000-0000-0000-000000000002',
        note: 'Assigned to Ops Admin for telecom provider failover review.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.assignedToId).toBe('00000000-0000-0000-0000-000000000002');
  });

  it('POST /admin/alerts/:id/investigate — transitions alert ACKNOWLEDGED -> INVESTIGATING', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/alerts/00000000-0000-0000-0000-000000000302/investigate',
      headers: { authorization: 'Bearer valid_superadmin_token' },
      payload: { note: 'Reviewing DataHouse gateway circuit breaker status.' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe(AlertStatus.INVESTIGATING);
  });

  it('POST /admin/alerts/:id/resolve — transitions alert to RESOLVED with required resolution note', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/alerts/00000000-0000-0000-0000-000000000303/resolve',
      headers: { authorization: 'Bearer valid_superadmin_token' },
      payload: {
        resolution: 'Switched authoritative provider route to GMPL fallback; error rate normalized to 0.1%.',
        note: 'Resolution verified via provider reconciliation check.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe(AlertStatus.RESOLVED);
  });

  it('POST /admin/alerts/:id/note — adds internal note to timeline', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/alerts/00000000-0000-0000-0000-000000000301/note',
      headers: { authorization: 'Bearer valid_superadmin_token' },
      payload: { note: 'Upstream vendor acknowledged ticket #98231.' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.noteAdded).toBe(true);
  });

  // 6. User Inbox (Anti-IDOR)
  it('GET /notifications — per-user inbox retrieves authenticated user notifications only', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { authorization: 'Bearer valid_customer_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].title).toBe('Order Completed');
  });

  it('GET /notifications/counts — retrieves user unread notification count badge', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/notifications/counts',
      headers: { authorization: 'Bearer valid_customer_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.unread).toBe(2);
    expect(body.data.total).toBe(5);
  });

  it('POST /notifications/:id/read — marks notification as read', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/notifications/00000000-0000-0000-0000-000000000501/read',
      headers: { authorization: 'Bearer valid_customer_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.isRead).toBe(true);
  });

  it('POST /notifications/read-all — marks all notifications as read for current user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/notifications/read-all',
      headers: { authorization: 'Bearer valid_customer_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.markedCount).toBe(2);
  });

  // 7. Security & Authorization Boundary Checks
  it('GET /admin/alerts — rejects customer role with 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/alerts',
      headers: { authorization: 'Bearer valid_customer_token' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('GET /admin/notifications/overview — rejects unauthenticated requests with 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/notifications/overview',
    });

    expect(res.statusCode).toBe(401);
  });
});
