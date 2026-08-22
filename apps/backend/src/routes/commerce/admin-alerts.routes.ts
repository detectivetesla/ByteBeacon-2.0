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

interface AdminAlertsRouteOptions {
  db: pg.Pool;
  apiKeyService: ApiKeyService;
  tokenService: TokenService;
  rbacService: RbacService;
  auditService: AuditService;
}

const RESOLVABLE_STATUSES = [AlertStatus.ACKNOWLEDGED, AlertStatus.INVESTIGATING];
const OPEN_STATUSES = [AlertStatus.OPEN, AlertStatus.REOPENED, AlertStatus.DETECTED];

function mapAlertRow(row: any): AdminSystemAlertDto {
  return {
    id: row.id,
    severity: row.severity as NotificationSeverity,
    source: row.source as AlertSource,
    condition: row.condition,
    currentValue: row.current_value,
    threshold: row.threshold,
    status: row.status as AlertStatus,
    deduplicationKey: row.deduplication_key,
    firstDetectedAt: row.first_detected_at?.toISOString?.() ?? row.first_detected_at,
    lastDetectedAt: row.last_detected_at?.toISOString?.() ?? row.last_detected_at,
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
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
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
    previousStatus: row.previous_status as AlertStatus ?? undefined,
    newStatus: row.new_status as AlertStatus ?? undefined,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  };
}

export async function adminAlertsRoutes(
  app: FastifyInstance,
  opts: AdminAlertsRouteOptions,
): Promise<void> {
  const { db, apiKeyService, tokenService, rbacService, auditService } = opts;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

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

      if (req.query.severity) {
        params.push(req.query.severity);
        conditions.push(`a.severity = $${params.length}`);
      }
      if (req.query.source) {
        params.push(req.query.source);
        conditions.push(`a.source = $${params.length}`);
      }
      if (req.query.status) {
        params.push(req.query.status);
        conditions.push(`a.status = $${params.length}`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      params.push(limit);
      params.push(offset);

      const [alertsRes, countRes] = await Promise.all([
        db.query<any>(
          `SELECT
             a.*,
             assignee.full_name as assigned_to_name,
             ack_user.full_name as acknowledged_by_name,
             res_user.full_name as resolved_by_name,
             COALESCE(ev.notes_count, 0) as notes_count
           FROM system_alerts a
           LEFT JOIN users assignee ON assignee.uuid = a.assigned_to_id
           LEFT JOIN users ack_user ON ack_user.uuid = a.acknowledged_by_id
           LEFT JOIN users res_user ON res_user.uuid = a.resolved_by_id
           LEFT JOIN (
             SELECT alert_id, COUNT(*) as notes_count FROM alert_events GROUP BY alert_id
           ) ev ON ev.alert_id = a.id
           ${where}
           ORDER BY
             CASE a.severity WHEN 'CRITICAL' THEN 0 WHEN 'SECURITY' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
             a.last_detected_at DESC
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        ),
        db.query<any>(
          `SELECT COUNT(*) as total FROM system_alerts a ${where}`,
          conditions.length > 0 ? params.slice(0, params.length - 2) : [],
        ),
      ]);

      return reply.send({
        success: true,
        data: {
          items: alertsRes.rows.map(mapAlertRow),
          meta: {
            page,
            limit,
            total: Number(countRes.rows[0]?.total ?? 0),
            totalPages: Math.ceil(Number(countRes.rows[0]?.total ?? 0) / limit),
          },
        },
      });
    },
  );

  // 2. GET /admin/alerts/:id — Alert detail with timeline
  app.get<{ Params: { id: string } }>(
    '/admin/alerts/:id',
    { preHandler: [authHooks.authenticateAdmin, authHooks.requirePermission(Permission.AUDIT_READ)] },
    async (req, reply: FastifyReply) => {
      const { id } = req.params;

      const [alertRes, eventsRes] = await Promise.all([
        db.query<any>(
          `SELECT
             a.*,
             assignee.full_name as assigned_to_name,
             ack_user.full_name as acknowledged_by_name,
             res_user.full_name as resolved_by_name,
             COALESCE(ev.notes_count, 0) as notes_count
           FROM system_alerts a
           LEFT JOIN users assignee ON assignee.uuid = a.assigned_to_id
           LEFT JOIN users ack_user ON ack_user.uuid = a.acknowledged_by_id
           LEFT JOIN users res_user ON res_user.uuid = a.resolved_by_id
           LEFT JOIN (
             SELECT alert_id, COUNT(*) as notes_count FROM alert_events GROUP BY alert_id
           ) ev ON ev.alert_id = a.id
           WHERE a.id = $1`,
          [id],
        ),
        db.query<any>(
          `SELECT * FROM alert_events WHERE alert_id = $1 ORDER BY created_at DESC`,
          [id],
        ),
      ]);

      if (alertRes.rows.length === 0) {
        throw new NotFoundError(`Alert '${id}' not found.`);
      }

      return reply.send({
        success: true,
        data: {
          alert: mapAlertRow(alertRes.rows[0]),
          timeline: eventsRes.rows.map(mapEventRow),
        },
      });
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

      const alertRes = await db.query<any>('SELECT id, status FROM system_alerts WHERE id = $1', [id]);
      if (alertRes.rows.length === 0) throw new NotFoundError(`Alert '${id}' not found.`);

      const current = alertRes.rows[0];
      if (!OPEN_STATUSES.includes(current.status)) {
        throw new BadRequestError(`Alert cannot be acknowledged from status '${current.status}'.`);
      }

      const actorRes = await db.query<any>('SELECT full_name FROM users WHERE uuid = $1', [actorId]);
      const actorName = actorRes.rows[0]?.full_name ?? req.user!.email;

      await db.query(
        `UPDATE system_alerts SET status = $1, acknowledged_by_id = $2, acknowledged_at = NOW(), updated_at = NOW() WHERE id = $3`,
        [AlertStatus.ACKNOWLEDGED, actorId, id],
      );

      await db.query(
        `INSERT INTO alert_events(alert_id, action, actor_id, actor_name, note, previous_status, new_status) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [id, 'ACKNOWLEDGED', actorId, actorName, note ?? null, current.status, AlertStatus.ACKNOWLEDGED],
      );

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
    { preHandler: [authHooks.authenticateAdmin, authHooks.requirePermission(Permission.USERS_MANAGE)] },
    async (req, reply: FastifyReply) => {
      const { id } = req.params;
      const { assigneeUserId, note } = req.body;
      const actorId = req.user!.sub;

      const alertRes = await db.query<any>('SELECT id FROM system_alerts WHERE id = $1', [id]);
      if (alertRes.rows.length === 0) throw new NotFoundError(`Alert '${id}' not found.`);

      const [actorRes, assigneeRes] = await Promise.all([
        db.query<any>('SELECT full_name FROM users WHERE uuid = $1', [actorId]),
        db.query<any>('SELECT full_name FROM users WHERE uuid = $1', [assigneeUserId]),
      ]);

      if (assigneeRes.rows.length === 0) throw new NotFoundError(`Assignee user '${assigneeUserId}' not found.`);

      const actorName = actorRes.rows[0]?.full_name ?? req.user!.email;
      const assigneeName = assigneeRes.rows[0]?.full_name;

      await db.query(
        `UPDATE system_alerts SET assigned_to_id = $1, updated_at = NOW() WHERE id = $2`,
        [assigneeUserId, id],
      );

      await db.query(
        `INSERT INTO alert_events(alert_id, action, actor_id, actor_name, note) VALUES($1,$2,$3,$4,$5)`,
        [id, 'ASSIGNED', actorId, actorName, `Assigned to ${assigneeName}${note ? ': ' + note : ''}`],
      );

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
        metadata: { assigneeUserId, assigneeName, note },
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

      const alertRes = await db.query<any>('SELECT id, status FROM system_alerts WHERE id = $1', [id]);
      if (alertRes.rows.length === 0) throw new NotFoundError(`Alert '${id}' not found.`);

      const current = alertRes.rows[0];
      if (current.status !== AlertStatus.ACKNOWLEDGED) {
        throw new BadRequestError(`Alert must be ACKNOWLEDGED before investigation. Current status: '${current.status}'.`);
      }

      const actorRes = await db.query<any>('SELECT full_name FROM users WHERE uuid = $1', [actorId]);
      const actorName = actorRes.rows[0]?.full_name ?? req.user!.email;

      await db.query(
        `UPDATE system_alerts SET status = $1, updated_at = NOW() WHERE id = $2`,
        [AlertStatus.INVESTIGATING, id],
      );

      await db.query(
        `INSERT INTO alert_events(alert_id, action, actor_id, actor_name, note, previous_status, new_status) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [id, 'INVESTIGATING', actorId, actorName, note ?? null, current.status, AlertStatus.INVESTIGATING],
      );

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
        metadata: { note },
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
        throw new BadRequestError('Resolution description is required (min 5 characters).');
      }

      const alertRes = await db.query<any>('SELECT id, status FROM system_alerts WHERE id = $1', [id]);
      if (alertRes.rows.length === 0) throw new NotFoundError(`Alert '${id}' not found.`);

      const current = alertRes.rows[0];
      if (!RESOLVABLE_STATUSES.includes(current.status)) {
        throw new BadRequestError(`Alert must be ACKNOWLEDGED or INVESTIGATING to resolve. Current status: '${current.status}'.`);
      }

      const actorRes = await db.query<any>('SELECT full_name FROM users WHERE uuid = $1', [actorId]);
      const actorName = actorRes.rows[0]?.full_name ?? req.user!.email;

      await db.query(
        `UPDATE system_alerts SET status = $1, resolved_by_id = $2, resolved_at = NOW(), resolution = $3, updated_at = NOW() WHERE id = $4`,
        [AlertStatus.RESOLVED, actorId, resolution, id],
      );

      await db.query(
        `INSERT INTO alert_events(alert_id, action, actor_id, actor_name, note, previous_status, new_status) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [id, 'RESOLVED', actorId, actorName, note ?? null, current.status, AlertStatus.RESOLVED],
      );

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
        metadata: { resolution, note },
      });

      return reply.send({ success: true, data: { status: AlertStatus.RESOLVED } });
    },
  );

  // 7. POST /admin/alerts/:id/note — Add internal note
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

      const alertRes = await db.query<any>('SELECT id FROM system_alerts WHERE id = $1', [id]);
      if (alertRes.rows.length === 0) throw new NotFoundError(`Alert '${id}' not found.`);

      const actorRes = await db.query<any>('SELECT full_name FROM users WHERE uuid = $1', [actorId]);
      const actorName = actorRes.rows[0]?.full_name ?? req.user!.email;

      await db.query(
        `INSERT INTO alert_events(alert_id, action, actor_id, actor_name, note) VALUES($1,$2,$3,$4,$5)`,
        [id, 'NOTE_ADDED', actorId, actorName, note],
      );

      return reply.send({ success: true, data: { noteAdded: true } });
    },
  );
}
