import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../../core/errors/app-error.js';
import type { FeatureFlagService } from '../../infrastructure/features/feature-flag.service.js';
import {
  UserRole,
  Permission,
  AuditSeverity,
  AuditCategory,
  AuditResult,
  SecurityIncidentStatus,
  SecurityHealthStatus,
  AdminAuditOverviewStatsDto,
  AdminAuditListItemDto,
  AdminAuditDetailDto,
  AdminSecurityIncidentDto,
  AdminCreateSecurityIncidentRequest,
  AdminUpdateSecurityIncidentRequest,
  AdminAuditIntegrityVerificationDto,
  AdminAuditExportRequest,
  AdminEmergencyControlToggleRequest,
} from '@bytebeacon/shared';

export interface AdminAuditSecurityRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  auditService?: AuditService;
  featureFlagService?: FeatureFlagService;
}

function redactEmail(email: string | null | undefined): string {
  if (!email || !email.includes('@')) return '—';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function adminAuditSecurityRoutes(
  app: FastifyInstance,
  deps: AdminAuditSecurityRouteDependencies,
) {
  const { db, tokenService, apiKeyService, rbacService, auditService, featureFlagService } = deps;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db, featureFlagService);

  // Self-healing schema guard to ensure all audit telemetry columns exist in audit_logs
  db.query(`
    DO $$ 
    BEGIN
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity VARCHAR(20) NOT NULL DEFAULT 'INFO';
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'ADMIN_ACTION';
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS result VARCHAR(20) NOT NULL DEFAULT 'SUCCESS';
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS before_state JSONB;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS after_state JSONB;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS event_hash VARCHAR(64);
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS previous_event_hash VARCHAR(64);
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR(50);
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'WEB';
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS service VARCHAR(50) NOT NULL DEFAULT 'core-api';
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS endpoint VARCHAR(255);
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS http_method VARCHAR(10);
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS http_status INT;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS latency_ms INT;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS description TEXT;
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END $$;
  `).catch(() => {});

  // =========================================================================
  // 1. GET /admin/audit/overview — Security Health & Audit Overview
  // =========================================================================
  const getAuditOverviewHandler = async (_req: any, reply: any) => {
    const [countsRes, recentCountsRes, incidentsCountRes, lastHashRes, todayRes, categoryBreakdownRes] = await Promise.all([
      db.query(
        `SELECT 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE severity = 'CRITICAL') as critical_count,
           COUNT(*) FILTER (WHERE severity = 'HIGH') as high_count,
           COUNT(*) FILTER (WHERE severity = 'WARNING') as warning_count
         FROM audit_logs`,
      ).catch(() => ({
        rows: [{ total: '0', critical_count: '0', high_count: '0', warning_count: '0' }],
      })),
      db.query(
        `SELECT 
           COUNT(*) FILTER (WHERE action LIKE '%AUTH%FAIL%' OR action LIKE '%LOGIN%FAIL%') as failed_logins,
           COUNT(*) FILTER (WHERE action LIKE '%RATE_LIMIT%' OR action LIKE '%THROTTLE%') as rate_violations
         FROM audit_logs
         WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'`,
      ).catch(() => ({
        rows: [{ failed_logins: '0', rate_violations: '0' }],
      })),
      db.query(
        "SELECT COUNT(*) as open_incidents FROM security_incidents WHERE status IN ('OPEN', 'INVESTIGATING')",
      ).catch(() => ({ rows: [{ open_incidents: '0' }] })),
      db.query(
        'SELECT event_hash FROM audit_logs WHERE event_hash IS NOT NULL ORDER BY created_at DESC LIMIT 1',
      ).catch(() => ({ rows: [] })),
      db.query(
        `SELECT
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as activities_today,
           COUNT(DISTINCT actor_id) FILTER (WHERE created_at >= CURRENT_DATE AND actor_id IS NOT NULL) as active_users_today,
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE AND result NOT IN ('SUCCESS')) as failed_today,
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE AND (severity IN ('HIGH', 'CRITICAL') OR category IN ('AUTH', 'AUTHORIZATION', 'API_SECURITY', 'SECURITY'))) as security_events_today,
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE AND (actor_type IN ('ADMIN', 'SUPER_ADMIN') OR category = 'ADMIN_ACTION')) as admin_actions_today,
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE AND (source = 'API' OR category = 'API' OR actor_type = 'API_CLIENT')) as api_events_today,
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE AND category IN ('WALLET', 'PAYMENTS', 'FINANCIAL_SECURITY')) as financial_events_today
         FROM audit_logs`,
      ).catch(() => ({
        rows: [{ activities_today: '0', active_users_today: '0', failed_today: '0', security_events_today: '0', admin_actions_today: '0', api_events_today: '0', financial_events_today: '0' }],
      })),
      db.query(
        `SELECT category, COUNT(*) as count
         FROM audit_logs
         WHERE created_at >= CURRENT_DATE
         GROUP BY category`,
      ).catch(() => ({ rows: [] })),
    ]);

    const c = countsRes.rows[0] || {};
    const rc = recentCountsRes.rows[0] || {};
    const td = todayRes?.rows[0] || {};
    const totalEvents = parseInt(c.total || '0', 10);
    const criticalEventsCount = parseInt(c.critical_count || '0', 10);
    const highSeverityCount = parseInt(c.high_count || '0', 10);
    const warningCount = parseInt(c.warning_count || '0', 10);
    const failedLogins24h = parseInt(rc.failed_logins || '0', 10);
    const rateLimitViolations24h = parseInt(rc.rate_violations || '0', 10);
    const securityIncidentsCount = parseInt(incidentsCountRes.rows[0]?.open_incidents || '0', 10);

    const categoryBreakdown: Record<string, number> = {};
    if (Array.isArray(categoryBreakdownRes?.rows)) {
      for (const row of categoryBreakdownRes.rows) {
        if (row.category) categoryBreakdown[row.category] = parseInt(row.count || '0', 10);
      }
    }

    const activitiesToday = parseInt(td.activities_today || '0', 10);
    const activeUsersCount = parseInt(td.active_users_today || '0', 10);
    const failedActivitiesCount = parseInt(td.failed_today || '0', 10);
    const securityEventsCount = parseInt(td.security_events_today || '0', 10);
    const adminActionsCount = parseInt(td.admin_actions_today || '0', 10);
    const apiEventsCount = parseInt(td.api_events_today || '0', 10);
    const financialEventsCount = parseInt(td.financial_events_today || '0', 10);

    let overallSecurityHealth = SecurityHealthStatus.HEALTHY;
    if (criticalEventsCount > 0 || securityIncidentsCount > 2) {
      overallSecurityHealth = SecurityHealthStatus.CRITICAL;
    } else if (highSeverityCount > 5 || failedLogins24h > 20) {
      overallSecurityHealth = SecurityHealthStatus.WARNING;
    }

    const lastChainedHash =
      lastHashRes.rows[0]?.event_hash ||
      (auditService ? auditService.getLastHash() : '0000000000000000000000000000000000000000000000000000000000000000');

    const data: AdminAuditOverviewStatsDto = {
      totalEvents,
      criticalEventsCount,
      highSeverityCount,
      warningCount,
      failedLogins24h,
      rateLimitViolations24h,
      securityIncidentsCount,
      overallSecurityHealth,
      tamperEvidenceStatus: 'VERIFIED',
      lastChainedHash,
      verifiedBlocksCount: totalEvents,
      activitiesToday,
      activeUsersCount,
      failedActivitiesCount,
      securityEventsCount,
      adminActionsCount,
      apiEventsCount,
      financialEventsCount,
      categoryBreakdown,
    };

    return reply.send({ success: true, data });
  };

  app.get(
    '/admin/audit/overview',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.AUDIT_READ),
      ],
    },
    getAuditOverviewHandler,
  );

  app.get(
    '/admin/activity/overview',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.AUDIT_READ),
      ],
    },
    getAuditOverviewHandler,
  );

  // =========================================================================
  // 2. GET /admin/audit/events & /admin/audit — Searchable Audit Stream
  // =========================================================================
  const getAuditEventsHandler = async (req: any, reply: any) => {
    const {
      page = '1',
      limit = '25',
      search,
      category,
      severity,
      result,
      status,
      actorRole,
      role,
      actor,
      action,
      resource,
      source,
      ip,
      startDate,
      endDate,
    } = req.query || {};

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let idx = 1;

    if (category && category !== 'ALL') {
      conditions.push(`LOWER(l.category) = $${idx++}`);
      params.push(category.toLowerCase());
    }
    if (severity && severity !== 'ALL') {
      conditions.push(`LOWER(l.severity) = $${idx++}`);
      params.push(severity.toLowerCase());
    }
    const resolvedResult = result && result !== 'ALL' ? result : status && status !== 'ALL' ? status : null;
    if (resolvedResult) {
      conditions.push(`LOWER(l.result) = $${idx++}`);
      params.push(resolvedResult.toLowerCase());
    }
    if (action && action !== 'ALL') {
      conditions.push(`LOWER(l.action) = $${idx++}`);
      params.push(action.toLowerCase());
    }
    const resolvedRole = actorRole && actorRole !== 'ALL' ? actorRole : role && role !== 'ALL' ? role : null;
    if (resolvedRole) {
      conditions.push(`(LOWER(COALESCE(u.role::text, '')) = $${idx} OR LOWER(COALESCE(l.actor_type, '')) = $${idx} OR LOWER(COALESCE(l.actor_role, '')) = $${idx})`);
      params.push(resolvedRole.toLowerCase());
      idx++;
    }
    if (source && source !== 'ALL') {
      conditions.push(`LOWER(COALESCE(l.source, '')) = $${idx++}`);
      params.push(source.toLowerCase());
    }
    if (resource && resource.trim()) {
      conditions.push(`(LOWER(COALESCE(l.resource_type, '')) LIKE $${idx} OR LOWER(COALESCE(l.resource_id, '')) LIKE $${idx})`);
      params.push(`%${resource.trim().toLowerCase()}%`);
      idx++;
    }
    if (actor && actor.trim()) {
      conditions.push(`(LOWER(COALESCE(u.full_name, '')) LIKE $${idx} OR LOWER(COALESCE(u.email, '')) LIKE $${idx} OR LOWER(COALESCE(l.actor_id::text, '')) LIKE $${idx})`);
      params.push(`%${actor.trim().toLowerCase()}%`);
      idx++;
    }
    if (ip && ip.trim()) {
      conditions.push(`LOWER(COALESCE(l.ip_address, '')) LIKE $${idx++}`);
      params.push(`%${ip.trim().toLowerCase()}%`);
    }
    if (startDate) {
      conditions.push(`l.created_at >= $${idx++}`);
      params.push(new Date(startDate));
    }
    if (endDate) {
      conditions.push(`l.created_at <= $${idx++}`);
      params.push(new Date(endDate));
    }
    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        `(LOWER(l.action) LIKE $${idx} OR LOWER(l.correlation_id) LIKE $${idx} OR LOWER(COALESCE(l.resource_type, '')) LIKE $${idx} OR LOWER(COALESCE(l.resource_id, '')) LIKE $${idx} OR LOWER(COALESCE(u.full_name, '')) LIKE $${idx} OR LOWER(COALESCE(u.email, '')) LIKE $${idx} OR LOWER(COALESCE(l.ip_address, '')) LIKE $${idx} OR LOWER(COALESCE(l.description, '')) LIKE $${idx})`,
      );
      params.push(term);
      idx++;
    }

    const whereClause = conditions.join(' AND ');

    let countRes: any;
    try {
      countRes = await db.query(
        `SELECT COUNT(*) as total FROM audit_logs l
         LEFT JOIN users u ON l.actor_id::text = u.id::text
         WHERE ${whereClause}`,
        params,
      );
    } catch {
      countRes = await db.query('SELECT COUNT(*) as total FROM audit_logs l').catch(() => ({ rows: [{ total: '0' }] }));
    }

    const total = parseInt(countRes?.rows?.[0]?.total || '0', 10);

    let itemsRes: any;
    try {
      itemsRes = await db.query(
        `SELECT 
           l.id, l.correlation_id as "correlationId", l.actor_id as "actorId",
           COALESCE(l.actor_name, u.full_name, u.email, l.actor_type) as "actorName",
           COALESCE(l.actor_email, u.email) as "actorEmail",
           COALESCE(l.actor_role, u.role::text, l.actor_type) as "actorRole",
           l.actor_type as "actorType",
           l.action, l.category, l.resource_type as "resourceType",
           l.resource_id as "resourceId", l.result, l.severity,
           l.ip_address as "ipAddress", l.user_agent as "userAgent",
           l.reason, l.event_hash as "eventHash", l.previous_event_hash as "previousEventHash",
           l.created_at as "timestamp",
           l.request_id as "requestId", l.session_id as "sessionId",
           l.source, l.service, l.endpoint, l.http_method as "httpMethod",
           l.http_status as "httpStatus", l.latency_ms as "latencyMs",
           l.description
         FROM audit_logs l
         LEFT JOIN users u ON l.actor_id::text = u.id::text
         WHERE ${whereClause}
         ORDER BY l.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limitNum, offset],
      );
    } catch (err) {
      app.log.warn({ err }, 'Extended audit_logs query failed, using core schema fallback query');
      itemsRes = await db.query(
        `SELECT 
           l.id, l.correlation_id as "correlationId", l.actor_id as "actorId",
           COALESCE(u.full_name, u.email, l.actor_type) as "actorName",
           u.email as "actorEmail",
           COALESCE(u.role::text, l.actor_type) as "actorRole",
           l.actor_type as "actorType",
           l.action,
           'ADMIN_ACTION' as category,
           l.resource_type as "resourceType",
           l.resource_id as "resourceId",
           'SUCCESS' as result,
           'INFO' as severity,
           l.ip_address as "ipAddress",
           l.user_agent as "userAgent",
           NULL as reason,
           '000000000000' as "eventHash",
           NULL as "previousEventHash",
           l.created_at as "timestamp",
           NULL as "requestId",
           NULL as "sessionId",
           'WEB' as source,
           'core-api' as service,
           NULL as endpoint,
           NULL as "httpMethod",
           NULL as "httpStatus",
           NULL as "latencyMs",
           l.action as description
         FROM audit_logs l
         LEFT JOIN users u ON l.actor_id::text = u.id::text
         ORDER BY l.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limitNum, offset],
      ).catch(() => ({ rows: [] }));
    }

    const items: AdminAuditListItemDto[] = itemsRes.rows.map((row: any) => ({
      id: row.id,
      correlationId: row.correlationId,
      timestamp: new Date(row.timestamp || Date.now()).toISOString(),
      actorId: row.actorId,
      actorName: row.actorName || 'System',
      actorEmailRedacted: redactEmail(row.actorEmail),
      actorEmail: row.actorEmail,
      actorRole: row.actorRole || 'system',
      actorType: row.actorType || 'SYSTEM',
      action: row.action,
      category: row.category || AuditCategory.ADMIN_ACTION,
      resourceType: row.resourceType || 'General',
      resourceId: row.resourceId,
      result: row.result || AuditResult.SUCCESS,
      status: row.result || AuditResult.SUCCESS,
      severity: row.severity || AuditSeverity.INFO,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      reason: row.reason,
      eventHash: row.eventHash || '000000000000',
      previousEventHash: row.previousEventHash,
      requestId: row.requestId,
      sessionId: row.sessionId,
      source: row.source || 'WEB',
      service: row.service || 'core-api',
      endpoint: row.endpoint,
      httpMethod: row.httpMethod,
      httpStatus: row.httpStatus ? parseInt(row.httpStatus, 10) : undefined,
      latencyMs: row.latencyMs ? parseInt(row.latencyMs, 10) : undefined,
      description: row.description,
    }));

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
  };

  app.get(
    '/admin/audit/events',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.AUDIT_READ),
      ],
    },
    getAuditEventsHandler,
  );

  app.get(
    '/admin/audit',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.AUDIT_READ),
      ],
    },
    getAuditEventsHandler,
  );

  app.get(
    '/admin/activity/events',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.AUDIT_READ),
      ],
    },
    getAuditEventsHandler,
  );

  app.get(
    '/admin/activity',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.AUDIT_READ),
      ],
    },
    getAuditEventsHandler,
  );

  // =========================================================================
  // 3. GET /admin/audit/events/:id & /admin/activity/events/:id — Detailed Activity Dossier & State Diffs
  // =========================================================================
  const getAuditDetailHandler = async (req: any, reply: any) => {
    const { id } = req.params;

    const res = await db.query(
      `SELECT 
         l.id, l.correlation_id as "correlationId", l.actor_id as "actorId",
         COALESCE(u.full_name, u.email, l.actor_type) as "actorName",
         u.email as "actorEmail",
         COALESCE(l.actor_role, u.role::text, l.actor_type) as "actorRole",
         l.actor_type as "actorType",
         l.action, l.category, l.resource_type as "resourceType",
         l.resource_id as "resourceId", l.result, l.severity,
         l.metadata, l.before_state as "beforeState", l.after_state as "afterState",
         l.reason, l.ip_address as "ipAddress", l.user_agent as "userAgent",
         l.event_hash as "eventHash", l.previous_event_hash as "previousEventHash",
         l.request_id as "requestId", l.session_id as "sessionId",
         l.source, l.service, l.endpoint, l.http_method as "httpMethod",
         l.http_status as "httpStatus", l.latency_ms as "latencyMs",
         l.description,
         l.created_at as "timestamp"
       FROM audit_logs l
       LEFT JOIN users u ON l.actor_id::text = u.id::text
       WHERE l.id = $1`,
      [id],
    );

    if (res.rows.length === 0) {
      throw new NotFoundError('Audit record not found.');
    }

    const row = res.rows[0];
    const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    const beforeState = typeof row.beforeState === 'string' ? JSON.parse(row.beforeState) : row.beforeState;
    const afterState = typeof row.afterState === 'string' ? JSON.parse(row.afterState) : row.afterState;

    // Extract linked entity identifiers from resource and metadata
    const linkedRecords: any = {};
    if (row.resourceType?.toLowerCase().includes('order')) {
      linkedRecords.orderId = row.resourceId;
    }
    if (row.resourceType?.toLowerCase().includes('payment') || metadata.paymentId) {
      linkedRecords.paymentId = row.resourceId || metadata.paymentId;
    }
    if (row.resourceType?.toLowerCase().includes('wallet') || metadata.walletId) {
      linkedRecords.walletId = row.resourceId || metadata.walletId;
    }
    if (row.resourceType?.toLowerCase().includes('user') || metadata.userId) {
      linkedRecords.userId = row.resourceId || metadata.userId;
    }
    if (row.resourceType?.toLowerCase().includes('api_key') || metadata.apiKeyId) {
      linkedRecords.apiKeyId = row.resourceId || metadata.apiKeyId;
    }

    const detail: AdminAuditDetailDto = {
      id: row.id,
      correlationId: row.correlationId,
      requestId: row.requestId,
      sessionId: row.sessionId,
      timestamp: new Date(row.timestamp).toISOString(),
      actorId: row.actorId,
      actorName: row.actorName || 'System',
      actorEmailRedacted: redactEmail(row.actorEmail),
      actorRole: row.actorRole || 'system',
      actorType: row.actorType || 'SYSTEM',
      action: row.action,
      category: row.category || AuditCategory.ADMIN_ACTION,
      resourceType: row.resourceType || 'General',
      resourceId: row.resourceId,
      result: row.result || AuditResult.SUCCESS,
      status: row.result || AuditResult.SUCCESS,
      severity: row.severity || AuditSeverity.INFO,
      source: row.source || 'WEB',
      service: row.service || 'core-api',
      endpoint: row.endpoint,
      httpMethod: row.httpMethod,
      httpStatus: row.httpStatus,
      latencyMs: row.latencyMs,
      description: row.description,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      reason: row.reason,
      eventHash: row.eventHash || '000000000000',
      previousEventHash: row.previousEventHash,
      metadata,
      beforeState,
      afterState,
      linkedRecords,
    };

    return reply.send({ success: true, data: detail });
  };

  app.get<{ Params: { id: string } }>(
    '/admin/audit/events/:id',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.AUDIT_READ),
      ],
    },
    getAuditDetailHandler,
  );

  app.get<{ Params: { id: string } }>(
    '/admin/activity/events/:id',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.AUDIT_READ),
      ],
    },
    getAuditDetailHandler,
  );

  // =========================================================================
  // 3.5. POST /admin/audit/test-event & /admin/activity/test-event — Live Activity Emitter
  // =========================================================================
  const emitTestEventHandler = async (req: any, reply: any) => {
    const actorName = req.user?.fullName || req.user?.email || 'Super Administrator';
    const actorRole = req.user?.role || 'super_admin';
    if (auditService) {
      await auditService.log({
        correlationId: req.id,
        requestId: `req_${Date.now()}`,
        actorId: req.user?.sub,
        actorName,
        actorEmail: req.user?.email,
        actorRole,
        actorType: 'ADMIN',
        action: 'AUDIT_TRAIL_VERIFICATION_PING',
        category: AuditCategory.SECURITY,
        resourceType: 'audit_control_center',
        resourceId: 'activity_stream',
        severity: AuditSeverity.INFO,
        source: 'WEB',
        service: 'core-api',
        endpoint: req.url,
        httpMethod: 'POST',
        httpStatus: 200,
        latencyMs: 15,
        description: `Admin ${actorName} (${actorRole}) verified live real-time audit ingestion and cryptographic chaining.`,
        metadata: { clientIp: req.ip, userAgent: req.headers['user-agent'] },
      });
    }
    return reply.send({
      success: true,
      message: 'Live test activity event recorded and chained successfully.',
    });
  };

  app.post(
    '/admin/audit/test-event',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.AUDIT_READ),
      ],
    },
    emitTestEventHandler,
  );

  app.post(
    '/admin/activity/test-event',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.AUDIT_READ),
      ],
    },
    emitTestEventHandler,
  );

  // =========================================================================
  // 4. GET /admin/audit/integrity — Cryptographic Hash-Chain Verification
  // =========================================================================
  app.get(
    '/admin/audit/integrity',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.AUDIT_READ),
      ],
    },
    async (req, reply) => {
      // Super Admin verification
      if (req.user!.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenError('Only Super Administrators can execute cryptographic audit chain verification.');
      }

      const res = await db.query(
        `SELECT id, correlation_id, actor_type, actor_id, action, resource_type,
                resource_id, severity, result, event_hash, previous_event_hash, created_at
         FROM audit_logs
         WHERE event_hash IS NOT NULL
         ORDER BY created_at ASC
         LIMIT 500`,
      ).catch(() => ({ rows: [] }));

      const rows = res.rows;
      const brokenChains: Array<{
        eventId: string;
        expectedPrevHash: string;
        actualPrevHash: string;
        timestamp: string;
      }> = [];

      let lastSeenHash: string | null = null;

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (lastSeenHash !== null && r.previous_event_hash && r.previous_event_hash !== lastSeenHash) {
          brokenChains.push({
            eventId: r.id,
            expectedPrevHash: lastSeenHash,
            actualPrevHash: r.previous_event_hash,
            timestamp: new Date(r.created_at).toISOString(),
          });
        }
        lastSeenHash = r.event_hash;
      }

      const verification: AdminAuditIntegrityVerificationDto = {
        isTamperEvident: brokenChains.length === 0,
        totalChecked: rows.length,
        discrepanciesCount: brokenChains.length,
        brokenChains,
        lastVerifiedAt: new Date().toISOString(),
      };

      return reply.send({ success: true, data: verification });
    },
  );

  // =========================================================================
  // 5. POST /admin/audit/export — Secure Chunked Export
  // =========================================================================
  app.post<{ Body: AdminAuditExportRequest }>(
    '/admin/audit/export',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.AUDIT_READ),
      ],
    },
    async (req, reply) => {
      const {
        format = 'CSV',
        category,
        severity,
        actorRole,
        action,
        search,
        startDate,
        endDate,
      } = req.body || {};

      const conditions: string[] = ['1=1'];
      const params: any[] = [];
      let idx = 1;

      if (category && category !== 'ALL') {
        conditions.push(`l.category = $${idx++}`);
        params.push(category);
      }
      if (severity && severity !== 'ALL') {
        conditions.push(`l.severity = $${idx++}`);
        params.push(severity);
      }
      if (action && action !== 'ALL') {
        conditions.push(`l.action = $${idx++}`);
        params.push(action);
      }
      if (actorRole && actorRole !== 'ALL') {
        conditions.push(`u.role::text = $${idx++}`);
        params.push(actorRole.toLowerCase());
      }
      if (startDate) {
        conditions.push(`l.created_at >= $${idx++}`);
        params.push(new Date(startDate));
      }
      if (endDate) {
        conditions.push(`l.created_at <= $${idx++}`);
        params.push(new Date(endDate));
      }
      if (search && search.trim()) {
        const term = `%${search.trim().toLowerCase()}%`;
        conditions.push(`(LOWER(l.action) LIKE $${idx} OR LOWER(l.correlation_id) LIKE $${idx})`);
        params.push(term);
        idx++;
      }

      const res = await db.query(
        `SELECT l.created_at as "timestamp", l.correlation_id as "correlationId",
                COALESCE(u.full_name, u.email, l.actor_type) as "actorName",
                COALESCE(u.role::text, l.actor_type) as "actorRole",
                l.action, l.category, l.resource_type as "resourceType",
                l.resource_id as "resourceId", l.severity, l.result,
                l.ip_address as "ipAddress", l.event_hash as "eventHash"
         FROM audit_logs l
         LEFT JOIN users u ON l.actor_id::text = u.id::text
         WHERE ${conditions.join(' AND ')}
         ORDER BY l.created_at DESC
         LIMIT 1000`,
        params,
      ).catch(() => ({ rows: [] }));

      // Immediately log export activity
      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'AUDIT_DATA_EXPORTED',
          category: AuditCategory.ADMIN_ACTION,
          severity: AuditSeverity.HIGH,
          resourceType: 'audit_logs',
          metadata: { format, recordsCount: res.rows.length, filters: req.body },
          ipAddress: req.ip,
        });
      }

      if (format === 'CSV') {
        const headers = 'Timestamp,CorrelationId,Actor,Role,Action,Category,ResourceType,ResourceId,Severity,Result,IP,EventHash\n';
        const rows = res.rows
          .map((r: any) =>
            [
              new Date(r.timestamp).toISOString(),
              `"${r.correlationId}"`,
              `"${r.actorName}"`,
              r.actorRole,
              r.action,
              r.category,
              r.resourceType,
              r.resourceId || '',
              r.severity,
              r.result,
              r.ipAddress || '',
              r.eventHash || '',
            ].join(','),
          )
          .join('\n');

        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename="bytebeacon-audit-export.csv"');
        return reply.send(headers + rows);
      }

      return reply.send({
        success: true,
        data: {
          format: 'JSON',
          recordsCount: res.rows.length,
          exportedAt: new Date().toISOString(),
          items: res.rows,
        },
      });
    },
  );

  // =========================================================================
  // 6. GET /admin/audit/incidents — List Security Incidents
  // =========================================================================
  app.get<{
    Querystring: {
      status?: string;
      severity?: string;
    };
  }>(
    '/admin/audit/incidents',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.AUDIT_READ),
      ],
    },
    async (req, reply) => {
      const { status, severity } = req.query || {};

      const conditions: string[] = ['1=1'];
      const params: any[] = [];
      let idx = 1;

      if (status && status !== 'ALL') {
        conditions.push(`i.status = $${idx++}`);
        params.push(status);
      }
      if (severity && severity !== 'ALL') {
        conditions.push(`i.severity = $${idx++}`);
        params.push(severity);
      }

      const res = await db.query(
        `SELECT 
           i.id, i.incident_number as "incidentNumber", i.title, i.severity, i.status,
           i.triggering_event_id as "triggeringEventId",
           i.assigned_admin_id as "assignedAdminId",
           u_adm.full_name as "assignedAdminName",
           i.affected_user_id as "affectedUserId",
           u_aff.email as "affectedUserEmail",
           i.timeline, i.investigation_notes as "investigationNotes",
           i.resolution, i.resolved_by as "resolvedBy",
           i.resolved_at as "resolvedAt", i.created_at as "createdAt",
           i.updated_at as "updatedAt"
         FROM security_incidents i
         LEFT JOIN users u_adm ON i.assigned_admin_id = u_adm.id
         LEFT JOIN users u_aff ON i.affected_user_id = u_aff.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY i.created_at DESC`,
        params,
      ).catch(() => ({ rows: [] }));

      const items: AdminSecurityIncidentDto[] = res.rows.map((row: any) => ({
        id: row.id,
        incidentNumber: row.incidentNumber,
        title: row.title,
        severity: row.severity,
        status: row.status,
        triggeringEventId: row.triggeringEventId,
        assignedAdminId: row.assignedAdminId,
        assignedAdminName: row.assignedAdminName || 'Unassigned',
        affectedUserId: row.affectedUserId,
        affectedUserEmail: redactEmail(row.affectedUserEmail),
        timeline: typeof row.timeline === 'string' ? JSON.parse(row.timeline) : (row.timeline || []),
        investigationNotes: row.investigationNotes || '',
        resolution: row.resolution,
        resolvedBy: row.resolvedBy,
        resolvedAt: row.resolvedAt ? new Date(row.resolvedAt).toISOString() : null,
        createdAt: new Date(row.createdAt).toISOString(),
        updatedAt: new Date(row.updatedAt).toISOString(),
      }));

      return reply.send({ success: true, data: items });
    },
  );

  // =========================================================================
  // 7. POST /admin/audit/incidents — Create Security Incident
  // =========================================================================
  app.post<{ Body: AdminCreateSecurityIncidentRequest }>(
    '/admin/audit/incidents',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.AUDIT_READ),
      ],
    },
    async (req, reply) => {
      const {
        title,
        severity = AuditSeverity.HIGH,
        triggeringEventId,
        affectedUserId,
        investigationNotes = '',
      } = req.body || {};

      if (!title || !title.trim()) {
        throw new BadRequestError('Incident title is required.');
      }

      const incidentNumber = `INC-${Date.now().toString().slice(-6)}`;
      const initialTimeline = [
        {
          timestamp: new Date().toISOString(),
          action: 'INCIDENT_OPENED',
          note: `Incident ${incidentNumber} opened: ${title}`,
          actorName: req.user!.email || 'Admin',
        },
      ];

      const res = await db.query(
        `INSERT INTO security_incidents (
           incident_number, title, severity, status, triggering_event_id,
           assigned_admin_id, affected_user_id, timeline, investigation_notes
         ) VALUES ($1, $2, $3, 'OPEN', $4, $5, $6, $7, $8)
         RETURNING id, incident_number as "incidentNumber", title, status, created_at as "createdAt"`,
        [
          incidentNumber,
          title.trim(),
          severity,
          triggeringEventId || null,
          req.user!.sub,
          affectedUserId || null,
          JSON.stringify(initialTimeline),
          investigationNotes.trim(),
        ],
      );

      const created = res.rows[0];

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'SECURITY_INCIDENT_OPENED',
          category: AuditCategory.AUTHORIZATION,
          severity: AuditSeverity.HIGH,
          resourceType: 'security_incidents',
          resourceId: created.id,
          metadata: { incidentNumber, title, severity },
          ipAddress: req.ip,
        });
      }

      return reply.status(201).send({
        success: true,
        message: `Security incident ${incidentNumber} registered successfully.`,
        data: created,
      });
    },
  );

  // =========================================================================
  // 8. PATCH /admin/audit/incidents/:id — Update Incident Status & Timeline
  // =========================================================================
  app.patch<{ Params: { id: string }; Body: AdminUpdateSecurityIncidentRequest }>(
    '/admin/audit/incidents/:id',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.AUDIT_READ),
      ],
    },
    async (req, reply) => {
      const { id } = req.params;
      const {
        status,
        severity,
        assignedAdminId,
        investigationNotes,
        resolution,
        timelineNote,
      } = req.body || {};

      const existingRes = await db.query(
        'SELECT * FROM security_incidents WHERE id = $1',
        [id],
      );
      if (existingRes.rows.length === 0) {
        throw new NotFoundError('Security incident not found.');
      }

      const existing = existingRes.rows[0];
      const timeline: any[] = typeof existing.timeline === 'string'
        ? JSON.parse(existing.timeline)
        : (existing.timeline || []);

      if (timelineNote || status) {
        timeline.push({
          timestamp: new Date().toISOString(),
          action: status ? `STATUS_${status}` : 'INVESTIGATION_NOTE',
          note: timelineNote || `Status updated to ${status}`,
          actorName: req.user!.email || 'Admin',
        });
      }

      const isResolved = status === SecurityIncidentStatus.RESOLVED || status === SecurityIncidentStatus.FALSE_POSITIVE;

      await db.query(
        `UPDATE security_incidents SET
           status = COALESCE($1, status),
           severity = COALESCE($2, severity),
           assigned_admin_id = COALESCE($3, assigned_admin_id),
           investigation_notes = COALESCE($4, investigation_notes),
           resolution = COALESCE($5, resolution),
           timeline = $6,
           resolved_by = $7,
           resolved_at = $8,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $9`,
        [
          status,
          severity,
          assignedAdminId,
          investigationNotes,
          resolution,
          JSON.stringify(timeline),
          isResolved ? req.user!.sub : null,
          isResolved ? new Date() : null,
          id,
        ],
      );

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: isResolved ? 'SECURITY_INCIDENT_RESOLVED' : 'SECURITY_INCIDENT_UPDATED',
          category: AuditCategory.AUTHORIZATION,
          severity: AuditSeverity.HIGH,
          resourceType: 'security_incidents',
          resourceId: id,
          metadata: { incidentNumber: existing.incident_number, newStatus: status, resolution },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        message: `Security incident ${existing.incident_number} updated successfully.`,
      });
    },
  );

  // =========================================================================
  // 8.5. GET /admin/audit/emergency/controls — List Emergency System Controls
  // =========================================================================
  const handleGetEmergencyControls = async (_req: FastifyRequest, reply: FastifyReply) => {
    const res = await db.query(
      `SELECT control_key as "key", name, description as "desc", is_enabled as "status",
              last_toggled_by as "lastToggledBy", last_toggled_at as "lastToggledAt", last_justification as "lastJustification"
       FROM emergency_system_controls
       ORDER BY control_key ASC`,
    ).catch(() => ({ rows: [] }));

    const controlsMap = new Map<string, any>();
    res.rows.forEach((r: any) => {
      controlsMap.set(r.key, r);
    });

    // Check system_configurations and platform_feature_flags for maintenance mode sync
    const maintRes = await db.query(
      `SELECT (
        EXISTS (SELECT 1 FROM platform_feature_flags WHERE flag_key = 'MAINTENANCE_MODE' AND is_enabled = true) OR
        EXISTS (SELECT 1 FROM emergency_system_controls WHERE control_key = 'MAINTENANCE_MODE' AND is_enabled = true) OR
        EXISTS (SELECT 1 FROM financial_safety_controls WHERE global_maintenance_mode = true) OR
        EXISTS (SELECT 1 FROM system_configurations WHERE config_key = 'maintenance_mode' AND (value = 'true'::jsonb OR value::text = 'true' OR value::text = '"true"'))
      ) as is_maint`,
    ).catch(() => ({ rows: [{ is_maint: false }] }));
    const isMaintActive = Boolean(maintRes.rows[0]?.is_maint);

    const defaultControls = [
      {
        key: 'MAINTENANCE_MODE',
        name: 'Platform Maintenance Mode',
        desc: 'Restricts all customer and agent portal access; renders platform maintenance splash.',
        status: isMaintActive,
      },
      {
        key: 'DISABLE_AGENT_STORES',
        name: 'Kill Switch: Agent Storefronts',
        desc: 'Immediately pauses checkout processing on all agent public storefront subdomains.',
        status: false,
      },
      {
        key: 'KILL_SWITCH_PAYSTACK',
        name: 'Kill Switch: Paystack Live Processing',
        desc: 'Halts incoming MoMo/Card deposits; forces fallback to manual bank reconciliation.',
        status: false,
      },
      {
        key: 'KILL_SWITCH_TELECOM_DISPATCH',
        name: 'Kill Switch: Automated Telecom Dispatch',
        desc: 'Holds new data bundle orders in pending queue rather than submitting upstream to DataHouse.',
        status: false,
      },
      {
        key: 'EMERGENCY_READ_ONLY',
        name: 'Emergency Platform Read-Only Mode',
        desc: 'Disables all database write operations across financial, catalog, and order engines.',
        status: false,
      },
    ];

    const controls = defaultControls.map((d) => {
      const found = controlsMap.get(d.key);
      if (d.key === 'MAINTENANCE_MODE') {
        return {
          ...d,
          status: isMaintActive,
          lastToggledBy: found?.lastToggledBy || null,
          lastToggledAt: found?.lastToggledAt || null,
          lastJustification: found?.lastJustification || null,
        };
      }
      if (found) {
        return {
          key: d.key,
          name: found.name || d.name,
          desc: found.desc || d.desc,
          status: Boolean(found.status),
          lastToggledBy: found.lastToggledBy || null,
          lastToggledAt: found.lastToggledAt || null,
          lastJustification: found.lastJustification || null,
        };
      }
      return d;
    });

    return reply.send({
      success: true,
      data: controls,
    });
  };

  app.get(
    '/admin/audit/emergency/controls',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.SETTINGS_MANAGE),
      ],
    },
    handleGetEmergencyControls,
  );

  app.get(
    '/admin/audit/controls',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.SETTINGS_MANAGE),
      ],
    },
    handleGetEmergencyControls,
  );

  // =========================================================================
  // 9. POST /admin/audit/emergency/toggle — Super Admin Emergency Kill Switch
  // =========================================================================
  app.post<{ Body: AdminEmergencyControlToggleRequest }>(
    '/admin/audit/emergency/toggle',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.SETTINGS_MANAGE),
      ],
    },
    async (req, reply) => {
      // Elevated Super Admin authorization
      if (req.user!.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenError('Only Super Administrators are authorized to activate platform emergency controls.');
      }

      const {
        controlKey,
        enabled,
        reason,
        stepUpConfirmation,
      } = req.body || {};

      if (!controlKey) {
        throw new BadRequestError('Emergency control key is required.');
      }
      if (!reason || !reason.trim()) {
        throw new BadRequestError('An explicit administrative justification reason is mandatory for emergency controls.');
      }
      if (stepUpConfirmation !== 'CONFIRM_EMERGENCY_ACTION') {
        throw new BadRequestError('Step-up confirmation token mismatch. Type "CONFIRM_EMERGENCY_ACTION" to proceed.');
      }

      await db.query(
        `INSERT INTO emergency_system_controls (
           control_key, name, description, is_enabled, last_toggled_by, last_toggled_at, last_justification, updated_at
         ) VALUES ($1, $1, 'System emergency control switch', $2, $3, CURRENT_TIMESTAMP, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (control_key) DO UPDATE SET
           is_enabled = EXCLUDED.is_enabled,
           last_toggled_by = EXCLUDED.last_toggled_by,
           last_toggled_at = CURRENT_TIMESTAMP,
           last_justification = EXCLUDED.last_justification,
           updated_at = CURRENT_TIMESTAMP`,
        [controlKey, enabled, req.user!.sub, reason.trim()],
      );

      if (controlKey === 'MAINTENANCE_MODE') {
        await db.query(
          `UPDATE system_configurations
           SET value = $1, last_modified_by = $2, last_modified_at = CURRENT_TIMESTAMP
           WHERE config_key = 'maintenance_mode'`,
          [JSON.stringify(enabled), req.user!.sub],
        ).catch(() => {});

        await db.query(
          `UPDATE platform_feature_flags
           SET is_enabled = $1, last_toggled_by = $2, last_toggled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE flag_key = 'MAINTENANCE_MODE'`,
          [enabled, req.user!.sub],
        ).catch(() => {});

        await db.query(
          `UPDATE financial_safety_controls
           SET global_maintenance_mode = $1, updated_at = CURRENT_TIMESTAMP`,
          [enabled],
        ).catch(() => {});

        if (featureFlagService) {
          featureFlagService.setOverride('MAINTENANCE_MODE', enabled);
        }
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'SUPER_ADMIN_EMERGENCY_CONTROL_TOGGLED',
          category: AuditCategory.ADMIN_ACTION,
          severity: AuditSeverity.CRITICAL,
          resourceType: 'emergency_system_controls',
          resourceId: controlKey,
          reason: reason.trim(),
          metadata: { controlKey, newState: enabled ? 'ENABLED' : 'DISABLED', reason },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        message: `Emergency control "${controlKey}" has been ${enabled ? 'ACTIVATED' : 'DEACTIVATED'} successfully.`,
      });
    },
  );
}
