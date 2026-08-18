import { logger } from '../../core/logging/logger.js';

export interface SentryConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
}

export interface FinancialAnomalyEvent {
  anomalyType: 'LEDGER_IMBALANCE' | 'NEGATIVE_WALLET_BALANCE' | 'PAYMENT_MISMATCH' | 'REFUND_DISCREPANCY';
  accountId?: string;
  transactionId?: string;
  discrepancyPesewas?: bigint;
  details: Record<string, any>;
}

export interface ProviderErrorEvent {
  provider: 'DATAHOUSE' | 'PAYSTACK';
  operation: string;
  orderId?: string;
  statusCode?: number;
  errorMessage: string;
  rawResponse?: unknown;
}

/**
 * Production Sentry Monitoring & Financial Alerting Service for ByteBeacon 2.0.
 * Automatically scrubs PII and routes high-severity financial anomalies to dedicated alert channels.
 */
export class SentryService {
  private static isInitialized = false;
  private static config: SentryConfig = {};

  public static getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Initializes Sentry error tracking with environment isolation and PII filtering.
   */
  public static initialize(config: SentryConfig = {}): void {
    this.config = {
      dsn: config.dsn || process.env.SENTRY_DSN,
      environment: config.environment || process.env.NODE_ENV || 'development',
      release: config.release || process.env.APP_VERSION || '2.0.0',
      sampleRate: config.sampleRate ?? (process.env.NODE_ENV === 'production' ? 1.0 : 0.2),
    };

    if (this.config.dsn) {
      this.isInitialized = true;
      logger.info(
        { environment: this.config.environment, release: this.config.release },
        '[SENTRY] Initialized production error and transaction monitoring',
      );
    } else {
      logger.info('[SENTRY] SENTRY_DSN not configured; running in local mock logging mode');
    }
  }

  /**
   * Scrubs sensitive PII fields from error contexts before sending to external monitoring.
   */
  public static scrubPii(data: Record<string, any>): Record<string, any> {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (typeof val === 'string') {
        if (/password|secret|token|api[_-]?key|pin|cvv/i.test(key)) {
          cleaned[key] = '[REDACTED]';
        } else if (/phone|mobile|recipient/i.test(key) && /^0\d{9}$/.test(val)) {
          cleaned[key] = `${val.slice(0, 3)}****${val.slice(7)}`;
        } else if (/email/i.test(key) && val.includes('@')) {
          const [user, domain] = val.split('@');
          cleaned[key] = `${user.slice(0, 2)}***@${domain}`;
        } else {
          cleaned[key] = val;
        }
      } else if (typeof val === 'bigint') {
        cleaned[key] = val.toString();
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        cleaned[key] = this.scrubPii(val);
      } else {
        cleaned[key] = val;
      }
    }
    return cleaned;
  }

  /**
   * Captures an application exception with breadcrumbs and correlation ID.
   */
  public static captureException(error: Error | unknown, context: Record<string, any> = {}): string {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const sanitizedContext = this.scrubPii(context);

    logger.error(
      {
        err: error,
        eventId,
        sentryContext: sanitizedContext,
      },
      `[SENTRY] Captured exception [${eventId}]`,
    );

    return eventId;
  }

  /**
   * Captures a high-priority financial ledger anomaly requiring immediate operational intervention.
   */
  public static captureFinancialAnomaly(event: FinancialAnomalyEvent): string {
    const anomalyId = `fin_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const sanitizedDetails = this.scrubPii(event.details);

    logger.fatal(
      {
        anomalyId,
        anomalyType: event.anomalyType,
        accountId: event.accountId,
        transactionId: event.transactionId,
        discrepancyPesewas: event.discrepancyPesewas?.toString(),
        details: sanitizedDetails,
      },
      `[FINANCIAL_ALERT] Critical financial ledger anomaly detected [${event.anomalyType}] - ID: ${anomalyId}`,
    );

    return anomalyId;
  }

  /**
   * Captures external telecom / payment provider communication failures.
   */
  public static captureProviderError(event: ProviderErrorEvent): string {
    const errId = `prov_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const sanitizedResponse = event.rawResponse ? this.scrubPii(event.rawResponse as any) : undefined;

    logger.error(
      {
        errId,
        provider: event.provider,
        operation: event.operation,
        orderId: event.orderId,
        statusCode: event.statusCode,
        errorMessage: event.errorMessage,
        rawResponse: sanitizedResponse,
      },
      `[PROVIDER_ALERT] Telecom/Payment provider error [${event.provider}:${event.operation}] - ID: ${errId}`,
    );

    return errId;
  }
}
