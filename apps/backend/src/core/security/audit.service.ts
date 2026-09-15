import type pg from 'pg';
import crypto from 'node:crypto';
import { logger } from '../logging/logger.js';
import {
  AuditSeverity,
  AuditCategory,
  AuditResult,
  AuditSource,
} from '@bytebeacon/shared';

export interface AuditEventParams {
  correlationId?: string;
  requestId?: string;
  sessionId?: string;
  actorId?: string | null;
  actorName?: string;
  actorEmail?: string;
  actorType: 'CUSTOMER' | 'ADMIN' | 'AGENT' | 'SYSTEM' | 'PROVIDER' | 'API_CLIENT' | 'WORKER' | 'WEBHOOK';
  actorRole?: string;
  action: string;
  category?: AuditCategory | string;
  resourceType?: string;
  resourceId?: string | null;
  result?: AuditResult | string;
  status?: string; // alias for result
  severity?: AuditSeverity | string;
  source?: AuditSource | 'WEB' | 'API' | 'WORKER' | 'WEBHOOK' | 'SYSTEM' | 'CLI' | string;
  service?: string;
  endpoint?: string;
  httpMethod?: string;
  httpStatus?: number;
  latencyMs?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

const SENSITIVE_KEY_PATTERNS = [
  'password',
  'token',
  'secret',
  'key_secret',
  'api_key',
  'apikey',
  'authorization',
  'bearer',
  'pin',
  'cvv',
  'card_number',
  'passcode',
  'credential',
  'webhooksecret',
  'paystack_secret',
  'datahouse_key',
];

export function sanitizeSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeSensitiveData);

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) =>
      key.toLowerCase().includes(pattern),
    );

    if (isSensitive && typeof value === 'string') {
      clean[key] = '[REDACTED_SENSITIVE_CREDENTIAL]';
    } else if (value && typeof value === 'object') {
      clean[key] = sanitizeSensitiveData(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export class AuditService {
  private readonly db: pg.Pool;
  private lastHash: string = '0000000000000000000000000000000000000000000000000000000000000000';

  constructor(db: pg.Pool) {
    this.db = db;
  }

  public async log(params: AuditEventParams): Promise<void> {
    return this.logEvent(params);
  }

  public async logEvent(params: AuditEventParams): Promise<void> {
    const now = new Date();
    const correlationId = params.correlationId || params.requestId || `corr_${crypto.randomUUID()}`;
    const severity = params.severity || AuditSeverity.INFO;
    const category = params.category || AuditCategory.ADMIN_ACTION;
    const result = params.status || params.result || AuditResult.SUCCESS;
    const source = params.source || (params.actorType === 'SYSTEM' ? 'SYSTEM' : 'WEB');
    const service = params.service || 'core-api';

    // Derive actorRole if not explicitly supplied
    let actorRole = params.actorRole;
    if (!actorRole) {
      if (params.actorType === 'ADMIN') actorRole = 'admin';
      else if (params.actorType === 'CUSTOMER') actorRole = 'customer';
      else if (params.actorType === 'AGENT') actorRole = 'agent';
      else actorRole = params.actorType.toLowerCase();
    }

    const sanitizedMeta = sanitizeSensitiveData(params.metadata || {});
    const sanitizedBefore = params.beforeState ? sanitizeSensitiveData(params.beforeState) : null;
    const sanitizedAfter = params.afterState ? sanitizeSensitiveData(params.afterState) : null;

    // Cryptographic hash chaining
    const prevHash = this.lastHash;
    const eventPayload = `${prevHash}|${correlationId}|${params.actorType}|${params.actorId || ''}|${params.action}|${params.resourceType || ''}|${params.resourceId || ''}|${severity}|${result}|${now.toISOString()}`;
    const eventHash = crypto.createHash('sha256').update(eventPayload).digest('hex');
    this.lastHash = eventHash;

    const query = `
      INSERT INTO audit_logs (
        correlation_id, actor_id, actor_type, actor_role, action, resource_type, resource_id,
        metadata, ip_address, user_agent, category, severity, result,
        before_state, after_state, reason, event_hash, previous_event_hash,
        request_id, session_id, source, service, endpoint, http_method, http_status,
        latency_ms, description, created_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25,
        $26, $27, $28
      )
    `;

    try {
      await this.db.query(query, [
        correlationId,
        params.actorId || null,
        params.actorType,
        actorRole,
        params.action,
        params.resourceType || null,
        params.resourceId || null,
        JSON.stringify(sanitizedMeta),
        params.ipAddress || null,
        params.userAgent || null,
        category,
        severity,
        result,
        sanitizedBefore ? JSON.stringify(sanitizedBefore) : null,
        sanitizedAfter ? JSON.stringify(sanitizedAfter) : null,
        params.reason || null,
        eventHash,
        prevHash,
        params.requestId || null,
        params.sessionId || null,
        source,
        service,
        params.endpoint || null,
        params.httpMethod || null,
        params.httpStatus ?? null,
        params.latencyMs ?? null,
        params.description || null,
        now,
      ]);

      logger.info(
        {
          correlationId,
          actorId: params.actorId,
          actorType: params.actorType,
          actorRole,
          action: params.action,
          severity,
          result,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          source,
          eventHash: eventHash.slice(0, 12),
        },
        `[AUDIT] ${params.action}`,
      );
    } catch (error) {
      logger.error({ error, event: params }, 'Failed to persist audit log event');
    }
  }

  // Specialized helpers for high readability across modules
  public async logCustomer(params: Omit<AuditEventParams, 'actorType'>): Promise<void> {
    return this.logEvent({ ...params, actorType: 'CUSTOMER' });
  }

  public async logAgent(params: Omit<AuditEventParams, 'actorType'>): Promise<void> {
    return this.logEvent({ ...params, actorType: 'AGENT' });
  }

  public async logAdmin(params: Omit<AuditEventParams, 'actorType'>): Promise<void> {
    return this.logEvent({ ...params, actorType: 'ADMIN' });
  }

  public async logApi(params: Omit<AuditEventParams, 'actorType' | 'source'>): Promise<void> {
    return this.logEvent({
      ...params,
      actorType: 'API_CLIENT',
      source: 'API',
      category: params.category || AuditCategory.API,
    });
  }

  public async logSystem(params: Omit<AuditEventParams, 'actorType' | 'source'>): Promise<void> {
    return this.logEvent({
      ...params,
      actorType: 'SYSTEM',
      source: 'SYSTEM',
      category: params.category || AuditCategory.SYSTEM,
    });
  }

  public async logFinancial(params: AuditEventParams): Promise<void> {
    return this.logEvent({
      ...params,
      category: params.category || AuditCategory.FINANCIAL_SECURITY,
    });
  }

  public async logSecurity(params: AuditEventParams): Promise<void> {
    return this.logEvent({
      ...params,
      category: params.category || AuditCategory.SECURITY,
      severity: params.severity || AuditSeverity.HIGH,
    });
  }

  public getLastHash(): string {
    return this.lastHash;
  }
}
