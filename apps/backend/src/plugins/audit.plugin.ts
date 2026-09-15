import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuditService } from '../core/security/audit.service.js';
import {
  AuditCategory,
  AuditSeverity,
  AuditResult,
  AuditSource,
} from '@bytebeacon/shared';

export interface AuditPluginOptions {
  auditService: AuditService;
}

/**
 * Global Real-Time Activity & Audit Telemetry Plugin
 * Automatically captures mutations, administrative operations, authentication events,
 * and security anomalies into the tamper-evident audit stream.
 */
export async function auditPlugin(
  app: FastifyInstance,
  options: AuditPluginOptions,
) {
  const { auditService } = options;

  app.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    // 1. Skip if already explicitly audited by a route handler
    if ((req as any).auditLogged) {
      return;
    }

    const url = req.url.split('?')[0];

    // 2. Skip telemetry & health polling endpoints to avoid feedback loops
    if (
      url.includes('/admin/audit') ||
      url.includes('/admin/activity') ||
      url.includes('/health') ||
      url.includes('/metrics') ||
      url.includes('/favicon.ico') ||
      url.startsWith('/docs') ||
      url.startsWith('/swagger')
    ) {
      return;
    }

    // 3. Only audit administrative routes, auth flows, mutating methods, or failed requests
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const isAdminRoute = url.includes('/admin');
    const isAuthRoute = url.includes('/auth');
    const isError = reply.statusCode >= 400;

    if (!isMutating && !isAdminRoute && !isAuthRoute && !isError) {
      return;
    }

    // Extract actor information from request
    const user = (req as any).user;
    const actorRole = (user?.role || (user ? 'user' : 'guest')).toLowerCase();
    let actorType: 'CUSTOMER' | 'ADMIN' | 'AGENT' | 'SYSTEM' = 'SYSTEM';

    if (actorRole.includes('admin')) {
      actorType = 'ADMIN';
    } else if (actorRole.includes('agent')) {
      actorType = 'AGENT';
    } else if (user) {
      actorType = 'CUSTOMER';
    }

    // Determine category from URL patterns
    let category = AuditCategory.SYSTEM;
    let resourceType = 'system';

    if (url.includes('/auth')) {
      category = AuditCategory.AUTH;
      resourceType = 'authentication';
    } else if (url.includes('/orders') || url.includes('/order')) {
      category = AuditCategory.ORDERS;
      resourceType = 'orders';
    } else if (url.includes('/catalog') || url.includes('/plans')) {
      category = AuditCategory.ADMIN_ACTION;
      resourceType = 'catalog';
    } else if (url.includes('/wallet') || url.includes('/payments') || url.includes('/ledger')) {
      category = AuditCategory.PAYMENTS;
      resourceType = 'financial';
    } else if (url.includes('/users')) {
      category = AuditCategory.USERS;
      resourceType = 'users';
    } else if (url.includes('/agents')) {
      category = AuditCategory.AGENTS;
      resourceType = 'agents';
    } else if (url.includes('/stores')) {
      category = AuditCategory.STORES;
      resourceType = 'stores';
    } else if (url.includes('/approval')) {
      category = AuditCategory.ADMIN_ACTION;
      resourceType = 'approvals';
    } else if (url.includes('/security') || url.includes('/incident')) {
      category = AuditCategory.SECURITY;
      resourceType = 'security';
    } else if (isAdminRoute) {
      category = AuditCategory.ADMIN_ACTION;
      resourceType = 'administration';
    }

    // Determine result
    let result = AuditResult.SUCCESS;
    if (reply.statusCode >= 400 && reply.statusCode < 500) {
      result = reply.statusCode === 401 || reply.statusCode === 403 ? AuditResult.DENIED : AuditResult.FAILURE;
    } else if (reply.statusCode >= 500) {
      result = AuditResult.FAILURE;
    }

    // Determine severity
    let severity = AuditSeverity.INFO;
    if (reply.statusCode >= 500) {
      severity = AuditSeverity.CRITICAL;
    } else if (reply.statusCode === 401 || reply.statusCode === 403) {
      severity = AuditSeverity.WARNING;
    } else if (isError) {
      severity = AuditSeverity.NOTICE;
    }

    // Clean Action Name
    const cleanUrl = url.replace(/^\/api\/v1/, '').replace(/^\/admin/, '');
    const cleanResource = cleanUrl.split('/').filter(Boolean).slice(0, 2).join('_').toUpperCase() || 'ROOT';
    const action = `${req.method}_${cleanResource}`;

    const actorName = user?.fullName || user?.name || user?.email || (actorType === 'ADMIN' ? 'Administrator' : 'System User');
    const description = `${actorName} performed ${req.method} ${url} [Status ${reply.statusCode}]`;

    // Fire non-blocking asynchronous audit log
    auditService
      .logEvent({
        correlationId: req.id,
        requestId: (req.headers['x-request-id'] as string) || req.id,
        sessionId: user?.sessionId,
        actorId: user?.sub || user?.id || null,
        actorName,
        actorEmail: user?.email,
        actorRole,
        actorType,
        action,
        category,
        resourceType,
        resourceId: (req.params as any)?.id || null,
        result,
        severity,
        source: (req.headers['x-api-key'] ? AuditSource.API : AuditSource.WEB),
        service: 'core-api',
        endpoint: url,
        httpMethod: req.method,
        httpStatus: reply.statusCode,
        latencyMs: Math.round(reply.elapsedTime || 0),
        description,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      })
      .catch(() => {});
  });
}
