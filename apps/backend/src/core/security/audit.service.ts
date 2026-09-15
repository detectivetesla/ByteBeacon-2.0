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
  private schemaEnsured: boolean = false;

  constructor(db: pg.Pool) {
    this.db = db;
    this.ensureSchema().catch(() => {});
  }

  public async ensureSchema(): Promise<void> {
    if (this.schemaEnsured || !this.db) return;
    try {
      await this.db.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          correlation_id VARCHAR(100) NOT NULL,
          actor_id UUID,
          actor_type VARCHAR(50) NOT NULL,
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(100),
          resource_id VARCHAR(255),
          metadata JSONB NOT NULL DEFAULT '{}',
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        DO $$ BEGIN
          ALTER TABLE audit_logs ALTER COLUMN actor_id TYPE VARCHAR(100) USING actor_id::text;
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_email VARCHAR(255);
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_name VARCHAR(255);
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
      `);

      // Initialize cryptographic chaining head from existing logs
      const headRes = await this.db.query(
        'SELECT event_hash FROM audit_logs WHERE event_hash IS NOT NULL ORDER BY created_at DESC LIMIT 1',
      ).catch(() => ({ rows: [] }));
      if (headRes.rows.length > 0 && headRes.rows[0].event_hash) {
        this.lastHash = headRes.rows[0].event_hash;
      }

      this.schemaEnsured = true;
    } catch {
      // Non-blocking schema init error
    }
  }

  public async log(params: AuditEventParams): Promise<void> {
    return this.logEvent(params);
  }

  public async logEvent(params: AuditEventParams): Promise<void> {
    if (!this.schemaEnsured) {
      await this.ensureSchema();
    }

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

    const safeActorId = params.actorId ? String(params.actorId) : null;
    const actorEmail = params.actorEmail || (params.metadata?.email ? String(params.metadata.email) : null);
    const actorName = params.actorName || (params.metadata?.name ? String(params.metadata.name) : null);

    const query = `
      INSERT INTO audit_logs (
        correlation_id, actor_id, actor_type, actor_role, actor_email, actor_name, action, resource_type, resource_id,
        metadata, ip_address, user_agent, category, severity, result,
        before_state, after_state, reason, event_hash, previous_event_hash,
        request_id, session_id, source, service, endpoint, http_method, http_status,
        latency_ms, description, created_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27,
        $28, $29, $30
      )
    `;

    try {
      await this.db.query(query, [
        correlationId,
        safeActorId,
        params.actorType,
        actorRole,
        actorEmail,
        actorName,
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
      logger.error({ error, event: params }, 'Failed to persist audit log with full telemetry, attempting fallback insert');
      try {
        // Resilient fallback query ensuring NO audit event is dropped even on older DB schemas
        await this.db.query(
          `INSERT INTO audit_logs (correlation_id, actor_id, actor_type, actor_role, actor_email, actor_name, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            correlationId,
            safeActorId,
            params.actorType,
            actorRole,
            actorEmail,
            actorName,
            params.action,
            params.resourceType || null,
            params.resourceId || null,
            JSON.stringify({
              ...sanitizedMeta,
              description: params.description,
              category,
              severity,
              result,
              actorRole,
              source,
              service,
              endpoint: params.endpoint,
              httpMethod: params.httpMethod,
              httpStatus: params.httpStatus,
              latencyMs: params.latencyMs,
            }),
            params.ipAddress || null,
            params.userAgent || null,
            now,
          ],
        );
        // Fire async schema healing
        this.schemaEnsured = false;
        this.ensureSchema().catch(() => {});
      } catch (fallbackErr) {
        logger.error({ fallbackErr }, 'Failed even fallback audit insert');
      }
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
