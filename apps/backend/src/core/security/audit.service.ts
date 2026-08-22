import type pg from 'pg';
import crypto from 'node:crypto';
import { logger } from '../logging/logger.js';
import {
  AuditSeverity,
  AuditCategory,
  AuditResult,
} from '@bytebeacon/shared';

export interface AuditEventParams {
  correlationId: string;
  actorId?: string;
  actorType: 'CUSTOMER' | 'ADMIN' | 'AGENT' | 'SYSTEM' | 'PROVIDER';
  actorRole?: string;
  action: string;
  category?: AuditCategory | string;
  resourceType?: string;
  resourceId?: string;
  result?: AuditResult | string;
  severity?: AuditSeverity | string;
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
  'pin',
  'cvv',
  'card_number',
  'passcode',
  'credential',
];

function sanitizeSensitiveData(obj: any): any {
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
    const severity = params.severity || AuditSeverity.INFO;
    const category = params.category || AuditCategory.ADMIN_ACTION;
    const result = params.result || AuditResult.SUCCESS;
    const sanitizedMeta = sanitizeSensitiveData(params.metadata || {});
    const sanitizedBefore = params.beforeState ? sanitizeSensitiveData(params.beforeState) : null;
    const sanitizedAfter = params.afterState ? sanitizeSensitiveData(params.afterState) : null;

    // Cryptographic hash chaining
    const prevHash = this.lastHash;
    const eventPayload = `${prevHash}|${params.correlationId}|${params.actorType}|${params.actorId || ''}|${params.action}|${params.resourceType || ''}|${params.resourceId || ''}|${severity}|${result}|${now.toISOString()}`;
    const eventHash = crypto.createHash('sha256').update(eventPayload).digest('hex');
    this.lastHash = eventHash;

    const query = `
      INSERT INTO audit_logs (
        correlation_id, actor_id, actor_type, action, resource_type, resource_id,
        metadata, ip_address, user_agent, category, severity, result,
        before_state, after_state, reason, event_hash, previous_event_hash, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `;

    try {
      await this.db.query(query, [
        params.correlationId,
        params.actorId || null,
        params.actorType,
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
        now,
      ]);

      logger.info(
        {
          correlationId: params.correlationId,
          actorId: params.actorId,
          actorType: params.actorType,
          action: params.action,
          severity,
          result,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          eventHash: eventHash.slice(0, 12),
        },
        `[AUDIT] ${params.action}`,
      );
    } catch (error) {
      logger.error({ error, event: params }, 'Failed to persist audit log event');
    }
  }

  public getLastHash(): string {
    return this.lastHash;
  }
}
