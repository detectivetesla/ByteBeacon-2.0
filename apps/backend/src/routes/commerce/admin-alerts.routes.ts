import { FastifyInstance, FastifyReply } from 'fastify';
import type pg from 'pg';
import {
  Permission,
  AlertStatus,
  AlertSource,
  NotificationSeverity,
  AuditSeverity,
  AuditCategory,
  AuditResult,
  AdminSystemAlertDto,
  AdminAlertEventDto,
  AdminAcknowledgeAlertRequest,
  AdminAssignAlertRequest,
  AdminResolveAlertRequest,
} from '@bytebeacon/shared';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { NotFoundError, BadRequestError } from '../../core/errors/app-error.js';
import { logger } from '../../core/logging/logger.js';

interface AdminAlertsRouteOptions {
  db: pg.Pool;
  apiKeyService: ApiKeyService;
  tokenService: TokenService;
  rbacService: RbacService;
  auditService: AuditService;
}

const OPEN_STATUSES = [AlertStatus.OPEN, AlertStatus.REOPENED, AlertStatus.DETECTED];

function mapAlertRow(row: any): AdminSystemAlertDto {
  return {
    id: row.id,
    severity: (row.severity ?? NotificationSeverity.INFO) as NotificationSeverity,
    source: (row.source ?? AlertSource.TELECOM_PROVIDER) as AlertSource,
    condition: row.condition ?? 'System Telemetry Alert',

    currentValue: row.current_value ?? undefined,
    threshold: row.threshold ?? undefined,
    status: (row.status ?? AlertStatus.OPEN) as AlertStatus,
    deduplicationKey: row.deduplication_key ?? row.id,
    firstDetectedAt: row.first_detected_at?.toISOString?.() ?? row.first_detected_at ?? new Date().toISOString(),
    lastDetectedAt: row.last_detected_at?.toISOString?.() ?? row.last_detected_at ?? new Date().toISOString(),
    assignedToId: row.assigned_to_id ?? undefined,
    assignedToName: row.assigned_to_name ?? undefined,
    acknowledgedById: row.acknowledged_by_id ?? undefined,
    acknowledgedByName: row.acknowledged_by_name ?? undefined,
    acknowledgedAt: row.acknowledged_at?.toISOString?.() ?? row.acknowledged_at ?? undefined,
    resolvedById: row.resolved_by_id ?? undefined,
    resolvedByName: row.resolved_by_name ?? undefined,
    resolvedAt: row.resolved_at?.toISOString?.() ?? row.resolved_at ?? undefined,
    resolution: row.resolution ?? undefined,
    notesCount: Number(row.notes_count ?? 0),
    createdAt: row.created_at?.toISOString?.() ?? row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at ?? new Date().toISOString(),
  };
}

function mapEventRow(row: any): AdminAlertEventDto {
  return {
    id: row.id,
    alertId: row.alert_id,
    action: row.action,
    actorId: row.actor_id,
    actorName: row.actor_name,
    note: row.note ?? undefined,
    previousStatus: (row.previous_status as AlertStatus) ?? undefined,
    newStatus: (row.new_status as AlertStatus) ?? undefined,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at ?? new Date().toISOString(),
  };
}

export async function adminAlertsRoutes(
  app: FastifyInstance,
  opts: AdminAlertsRouteOptions,
): Promise<void> {
  const { db, apiKeyService, tokenService, rbacService, auditService } = opts;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // Self-heal system_alerts and alert_events tables if missing
  const ensureAlertsTables = async () => {
    try {
      await db.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE IF NOT EXISTS system_alerts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'WARNING', 'SECURITY')),
            source VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
            condition TEXT NOT NULL,
            current_value TEXT,
            threshold TEXT,
            status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'REOPENED', 'DETECTED')),
            deduplication_key VARCHAR(255) UNIQUE,
            first_detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
            acknowledged_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
            acknowledged_at TIMESTAMPTZ,
            resolved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
            resolved_at TIMESTAMPTZ,
            resolution TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_system_alerts_status ON system_alerts(status);
        CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
        CREATE INDEX IF NOT EXISTS idx_system_alerts_created ON system_alerts(created_at DESC);

        CREATE TABLE IF NOT EXISTS alert_events (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            alert_id UUID NOT NULL REFERENCES system_alerts(id) ON DELETE CASCADE,
            action VARCHAR(50) NOT NULL,
            actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
            actor_name VARCHAR(255),
            note TEXT,
            previous_status VARCHAR(30),
            new_status VARCHAR(30),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_alert_events_alert ON alert_events(alert_id);
        CREATE INDEX IF NOT EXISTS idx_alert_events_created ON alert_events(created_at DESC);
      `);

      // Seed baseline system alerts if table is empty
      const existingAlerts = await db.query('SELECT COUNT(*) as cnt FROM system_alerts').catch(() => ({ rows: [{ cnt: '1' }] }));
      if (Number(existingAlerts.rows[0]?.cnt ?? 0) === 0) {
        await db.query(`
          INSERT INTO system_alerts (severity, source, condition, current_value, threshold, status, deduplication_key)
          VALUES
            ('WARNING', 'TELECOM_GATEWAY', 'Provider Hub Latency Threshold Exceeded', '5420ms', '5000ms', 'OPEN', 'hub_latency_telecom_01'),
            ('INFO', 'FINANCIAL_LEDGER', 'Daily Financial Ledger Verification Completed', '0 anomalies', '> 0 anomalies', 'RESOLVED', 'daily_ledger_audit_01'),
            ('SECURITY', 'SECURITY_POLICY', 'Rate Limit Velocity Threshold Monitor Active', '0 violations', '> 5 violations', 'RESOLVED', 'rate_limit_monitor_01')
          ON CONFLICT (deduplication_key) DO NOTHING
        `).catch(() => {});
      }
    } catch (err: any) {
      logger.warn({ err: err?.message }, '[ALERTS_SCHEMA] Schema self-heal notice (non-fatal)');
    }
  };
  ensureAlertsTables().catch(() => {});

  // 1. GET /admin/alerts — List alerts
  app.get<{ Querystring: { severity?: string; source?: string; status?: string; page?: string; limit?: string } }>(
    '/admin/alerts',
    { preHandler: [authHooks.authenticateAdmin, authHooks.requirePermission(Permission.AUDIT_READ)] },
    async (req, reply: FastifyReply) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
      const offset = (page - 1) * limit;

      const conditions: string[] = [];
      const params: any[] = [];

      if (req.query.severity && req.query.severity !== 'ALL') {
        params.push(req.query.severity);
        conditions.push(`a.severity = $${params.length}`);
      }
      if (req.query.source && req.query.source !== 'ALL') {
        params.push(req.query.source);
        conditions.push(`a.source = $${params.length}`);
      }
      if (req.query.status && req.query.status !== 'ALL') {
        params.push(req.query.status);
        conditions.push(`a.status = $${params.length}`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      params.push(limit);
      params.push(offset);

      try {
        const [alertsRes, countRes] = await Promise.all([
          db.query<any>(
            `SELECT
               a.*,
               assignee.full_name as assigned_to_name,
               ack_user.full_name as acknowledged_by_name,
               res_user.full_name as resolved_by_name,
               COALESCE(ev.notes_count, 0) as notes_count
             FROM system_alerts a
             LEFT JOIN users assignee ON assignee.id = a.assigned_to_id
             LEFT JOIN users ack_user ON ack_user.id = a.acknowledged_by_id
             LEFT JOIN users res_user ON res_user.id = a.resolved_by_id
             LEFT JOIN (
               SELECT alert_id, COUNT(*) as notes_count FROM alert_events GROUP BY alert_id
             ) ev ON ev.alert_id = a.id
             ${where}
             ORDER BY
               CASE a.severity WHEN 'CRITICAL' THEN 0 WHEN 'SECURITY' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
               a.last_detected_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params,
          ).catch(() => ({ rows: [] })),
          db.query<any>(
            `SELECT COUNT(*) as total FROM system_alerts a ${where}`,
            conditions.length > 0 ? params.slice(0, params.length - 2) : [],
          ).catch(() => ({ rows: [{ total: '0' }] })),
        ]);

        const total = Number(countRes.rows[0]?.total ?? 0);

        return reply.send({
          success: true,
          data: {
            items: (alertsRes.rows || []).map(mapAlertRow),
            meta: {
              page,
              limit,
              total,
              totalPages: Math.max(1, Math.ceil(total / limit)),
            },
          },
        });
      } catch (err: any) {
        logger.warn({ err: err?.message }, '[ADMIN_ALERTS] Alerts list query fallback');
        return reply.send({
          success: true,
          data: {
            items: [],
            meta: { page, limit, total: 0, totalPages: 1 },
          },
        });
      }
    },
  );

  // 2. GET /admin/alerts/:id — Alert detail with timeline
  app.get<{ Params: { id: string } }>(
    '/admin/alerts/:id',
    { preHandler: [authHooks.authenticateAdmin, authHooks.requirePermission(Permission.AUDIT_READ)] },
    async (req, reply: FastifyReply) => {
      const { id } = req.params;

      try {
        const [alertRes, eventsRes] = await Promise.all([
          db.query<any>(
            `SELECT
               a.*,
               assignee.full_name as assigned_to_name,
               ack_user.full_name as acknowledged_by_name,
               res_user.full_name as resolved_by_name,
               COALESCE(ev.notes_count, 0) as notes_count
             FROM system_alerts a
             LEFT JOIN users assignee ON assignee.id = a.assigned_to_id
             LEFT JOIN users ack_user ON ack_user.id = a.acknowledged_by_id
             LEFT JOIN users res_user ON res_user.id = a.resolved_by_id
             LEFT JOIN (
               SELECT alert_id, COUNT(*) as notes_count FROM alert_events GROUP BY alert_id
             ) ev ON ev.alert_id = a.id
             WHERE a.id = $1`,
            [id],
          ).catch(() => ({ rows: [] })),
          db.query<any>(
            `SELECT * FROM alert_events WHERE alert_id = $1 ORDER BY created_at DESC`,
            [id],
          ).catch(() => ({ rows: [] })),
        ]);

        if (alertRes.rows.length === 0) {
          throw new NotFoundError(`Alert '${id}' not found.`);
        }

        return reply.send({
          success: true,
          data: {
            alert: mapAlertRow(alertRes.rows[0]),
            timeline: (eventsRes.rows || []).map(mapEventRow),
          },
        });
      } catch (err: any) {
        if (err instanceof NotFoundError) throw err;
        logger.error({ err: err?.message, id }, '[ADMIN_ALERTS] Failed to get alert detail');
        throw new NotFoundError(`Alert '${id}' not found.`);
      }
    },
  );

  // 3. POST /admin/alerts/:id/acknowledge
  app.post<{ Params: { id: string }; Body: AdminAcknowledgeAlertRequest }>(
    '/admin/alerts/:id/acknowledge',
    { preHandler: [authHooks.authenticateAdmin, authHooks.requirePermission(Permission.AUDIT_READ)] },
    async (req, reply: FastifyReply) => {
      const { id } = req.params;
      const { note } = req.body ?? {};
      const actorId = req.user!.sub;

      const alertRes = await db.query<any>('SELECT id, status FROM system_alerts WHERE id = $1', [id]).catch(() => ({ rows: [] }));
      if (alertRes.rows.length === 0) throw new NotFoundError(`Alert '${id}' not found.`);

      const current = alertRes.rows[0];
      if (!OPEN_STATUSES.includes(current.status)) {
        throw new BadRequestError(`Alert cannot be acknowledged from status '${current.status}'.`);
      }

      const actorRes = await db.query<any>('SELECT full_name FROM users WHERE id = $1', [actorId]).catch(() => ({ rows: [] }));
      const actorName = actorRes.rows[0]?.full_name ?? req.user!.email;

      await db.query(
        `UPDATE system_alerts SET status = $1, acknowledged_by_id = $2, acknowledged_at = NOW(), updated_at = NOW() WHERE id = $3`,
        [AlertStatus.ACKNOWLEDGED, actorId, id],
      );

      await db.query(
        `INSERT INTO alert_events(alert_id, action, actor_id, actor_name, note, previous_status, new_status) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [id, 'ACKNOWLEDGED', actorId, actorName, note ?? null, current.status, AlertStatus.ACKNOWLEDGED],
      ).catch(() => {});

      auditService.logEvent({
        correlationId: req.id,
        actorId,
        actorType: 'ADMIN',
        action: 'ALERT_ACKNOWLEDGED',
        resourceType: 'system_alerts',
        resourceId: id,
        severity: AuditSeverity.INFO,
        category: AuditCategory.ADMIN_ACTION,
        result: AuditResult.SUCCESS,
        ipAddress: req.ip,
        metadata: { note, previousStatus: current.status },
      });

      return reply.send({ success: true, data: { status: AlertStatus.ACKNOWLEDGED } });
    },
  );

  // 4. POST /admin/alerts/:id/assign
  app.post<{ Params: { id: string }; Body: AdminAssignAlertRequest }>(
    '/admin/alerts/:id/assign',
    { preHandler: [authHooks.authenticateAdmin, authHooks.requirePermission(Permission.AUDIT_READ)] },
    async (req, reply: FastifyReply) => {
      const { id } = req.params;
      const { assigneeUserId, note } = req.body;
      const actorId = req.user!.sub;

      const alertRes = await db.query<any>('SELECT id, status FROM system_alerts WHERE id = $1', [id]).catch(() => ({ rows: [] }));
      if (alertRes.rows.length === 0) throw new NotFoundError(`Alert '${id}' not found.`);

      const assigneeRes = await db.query<any>('SELECT id, full_name, email FROM users WHERE id = $1', [assigneeUserId]).catch(() => ({ rows: [] }));
      if (assigneeRes.rows.length === 0) throw new NotFoundError(`User '${assigneeUserId}' not found.`);

      const assigneeName = assigneeRes.rows[0].full_name ?? assigneeRes.rows[0].email;
      const actorRes = await db.query<any>('SELECT full_name FROM users WHERE id = $1', [actorId]).catch(() => ({ rows: [] }));
      const actorName = actorRes.rows[0]?.full_name ?? req.user!.email;

      await db.query(
        `UPDATE system_alerts SET assigned_to_id = $1, updated_at = NOW() WHERE id = $2`,
        [assigneeUserId, id],
      );

      await db.query(
        `INSERT INTO alert_events(alert_id, action, actor_id, actor_name, note) VALUES($1,$2,$3,$4,$5)`,
        [id, `ASSIGNED_TO_${assigneeName}`, actorId, actorName, note ?? null],
      ).catch(() => {});

      auditService.logEvent({
        correlationId: req.id,
        actorId,
        actorType: 'ADMIN',
        action: 'ALERT_ASSIGNED',
        resourceType: 'system_alerts',
        resourceId: id,
        severity: AuditSeverity.INFO,
        category: AuditCategory.ADMIN_ACTION,
        result: AuditResult.SUCCESS,
        ipAddress: req.ip,
        metadata: { assignedToId: assigneeUserId, assigneeName, note },
      });

      return reply.send({ success: true, data: { assignedToId: assigneeUserId, assignedToName: assigneeName } });
    },
  );


  // 5. POST /admin/alerts/:id/investigate
  app.post<{ Params: { id: string }; Body: { note?: string } }>(
    '/admin/alerts/:id/investigate',
    { preHandler: [authHooks.authenticateAdmin, authHooks.requirePermission(Permission.AUDIT_READ)] },
    async (req, reply: FastifyReply) => {
      const { id } = req.params;
      const { note } = req.body ?? {};
      const actorId = req.user!.sub;

      const alertRes = await db.query<any>('SELECT id, status FROM system_alerts WHERE id = $1', [id]).catch(() => ({ rows: [] }));
      if (alertRes.rows.length === 0) throw new NotFoundError(`Alert '${id}' not found.`);

      const current = alertRes.rows[0];
      const actorRes = await db.query<any>('SELECT full_name FROM users WHERE id = $1', [actorId]).catch(() => ({ rows: [] }));
      const actorName = actorRes.rows[0]?.full_name ?? req.user!.email;

      await db.query(
        `UPDATE system_alerts SET status = $1, updated_at = NOW() WHERE id = $2`,
        [AlertStatus.INVESTIGATING, id],
      );

      await db.query(
        `INSERT INTO alert_events(alert_id, action, actor_id, actor_name, note, previous_status, new_status) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [id, 'MARKED_INVESTIGATING', actorId, actorName, note ?? null, current.status, AlertStatus.INVESTIGATING],
      ).catch(() => {});

      auditService.logEvent({
        correlationId: req.id,
        actorId,
        actorType: 'ADMIN',
        action: 'ALERT_INVESTIGATING',
        resourceType: 'system_alerts',
        resourceId: id,
        severity: AuditSeverity.INFO,
        category: AuditCategory.ADMIN_ACTION,
        result: AuditResult.SUCCESS,
        ipAddress: req.ip,
        metadata: { note, previousStatus: current.status },
      });

      return reply.send({ success: true, data: { status: AlertStatus.INVESTIGATING } });
    },
  );

  // 6. POST /admin/alerts/:id/resolve
  app.post<{ Params: { id: string }; Body: AdminResolveAlertRequest }>(
    '/admin/alerts/:id/resolve',
    { preHandler: [authHooks.authenticateAdmin, authHooks.requirePermission(Permission.AUDIT_READ)] },
    async (req, reply: FastifyReply) => {
      const { id } = req.params;
      const { resolution, note } = req.body;
      const actorId = req.user!.sub;

      if (!resolution || resolution.trim().length < 5) {
        throw new BadRequestError('Resolution reason is required (min 5 characters).');
      }

      const alertRes = await db.query<any>('SELECT id, status FROM system_alerts WHERE id = $1', [id]).catch(() => ({ rows: [] }));
      if (alertRes.rows.length === 0) throw new NotFoundError(`Alert '${id}' not found.`);

      const current = alertRes.rows[0];
      const actorRes = await db.query<any>('SELECT full_name FROM users WHERE id = $1', [actorId]).catch(() => ({ rows: [] }));
      const actorName = actorRes.rows[0]?.full_name ?? req.user!.email;

      await db.query(
        `UPDATE system_alerts
         SET status = $1, resolved_by_id = $2, resolved_at = NOW(), resolution = $3, updated_at = NOW()
         WHERE id = $4`,
        [AlertStatus.RESOLVED, actorId, resolution, id],
      );

      await db.query(
        `INSERT INTO alert_events(alert_id, action, actor_id, actor_name, note, previous_status, new_status) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [id, 'RESOLVED', actorId, actorName, note ?? resolution, current.status, AlertStatus.RESOLVED],
      ).catch(() => {});

      auditService.logEvent({
        correlationId: req.id,
        actorId,
        actorType: 'ADMIN',
        action: 'ALERT_RESOLVED',
        resourceType: 'system_alerts',
        resourceId: id,
        severity: AuditSeverity.INFO,
        category: AuditCategory.ADMIN_ACTION,
        result: AuditResult.SUCCESS,
        ipAddress: req.ip,
        metadata: { resolution, note, previousStatus: current.status },
      });

      return reply.send({ success: true, data: { status: AlertStatus.RESOLVED } });
    },
  );

  // 7. POST /admin/alerts/:id/note
  app.post<{ Params: { id: string }; Body: { note: string } }>(
    '/admin/alerts/:id/note',
    { preHandler: [authHooks.authenticateAdmin, authHooks.requirePermission(Permission.AUDIT_READ)] },
    async (req, reply: FastifyReply) => {
      const { id } = req.params;
      const { note } = req.body;
      const actorId = req.user!.sub;

      if (!note || note.trim().length < 2) {
        throw new BadRequestError('Note content is required.');
      }

      const alertRes = await db.query<any>('SELECT id FROM system_alerts WHERE id = $1', [id]).catch(() => ({ rows: [] }));
      if (alertRes.rows.length === 0) throw new NotFoundError(`Alert '${id}' not found.`);

      const actorRes = await db.query<any>('SELECT full_name FROM users WHERE id = $1', [actorId]).catch(() => ({ rows: [] }));
      const actorName = actorRes.rows[0]?.full_name ?? req.user!.email;

      await db.query(
        `INSERT INTO alert_events(alert_id, action, actor_id, actor_name, note) VALUES($1,$2,$3,$4,$5)`,
        [id, 'NOTE_ADDED', actorId, actorName, note],
      ).catch(() => {});

      return reply.send({ success: true, data: { noteAdded: true } });
    },
  );

  // 8. POST /admin/alerts/acknowledge-all — Acknowledge all active alerts
  app.post(
    '/admin/alerts/acknowledge-all',
    { preHandler: [authHooks.authenticateAdmin, authHooks.requirePermission(Permission.AUDIT_READ)] },
    async (req, reply: FastifyReply) => {
      const actorId = req.user!.sub;

      const result = await db.query(
        `UPDATE system_alerts
         SET status = $1, acknowledged_by_id = $2, acknowledged_at = NOW(), updated_at = NOW()
         WHERE status IN ('OPEN', 'DETECTED', 'REOPENED')`,
        [AlertStatus.ACKNOWLEDGED, actorId],
      ).catch(() => ({ rowCount: 0 }));

      auditService.logEvent({
        correlationId: req.id,
        actorId,
        actorType: 'ADMIN',
        action: 'ALERTS_BULK_ACKNOWLEDGED',
        resourceType: 'system_alerts',
        resourceId: 'bulk',
        severity: AuditSeverity.INFO,
        category: AuditCategory.ADMIN_ACTION,
        result: AuditResult.SUCCESS,
        ipAddress: req.ip,
        metadata: { acknowledgedCount: result.rowCount ?? 0 },
      });

      return reply.send({
        success: true,
        data: { count: result.rowCount ?? 0 },
      });
    },
  );

  // 9. POST /admin/alerts/clear — Bulk resolve acknowledged/investigating alerts
  app.post(
    '/admin/alerts/clear',
    { preHandler: [authHooks.authenticateAdmin, authHooks.requirePermission(Permission.AUDIT_READ)] },
    async (req, reply: FastifyReply) => {
      const actorId = req.user!.sub;

      const result = await db.query(
        `UPDATE system_alerts
         SET status = $1, resolved_by_id = $2, resolved_at = NOW(), resolution = 'Bulk dismissed by operator', updated_at = NOW()
         WHERE status IN ('ACKNOWLEDGED', 'INVESTIGATING')`,
        [AlertStatus.RESOLVED, actorId],
      ).catch(() => ({ rowCount: 0 }));

      auditService.logEvent({
        correlationId: req.id,
        actorId,
        actorType: 'ADMIN',
        action: 'ALERTS_BULK_CLEARED',
        resourceType: 'system_alerts',
        resourceId: 'bulk',
        severity: AuditSeverity.INFO,
        category: AuditCategory.ADMIN_ACTION,
        result: AuditResult.SUCCESS,
        ipAddress: req.ip,
        metadata: { resolvedCount: result.rowCount ?? 0 },
      });

      return reply.send({
        success: true,
        data: { count: result.rowCount ?? 0 },
      });
    },
  );
}
