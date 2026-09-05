import crypto from 'node:crypto';
import type pg from 'pg';

export const WEBHOOK_RETRY_DELAYS_SECONDS = [30, 60, 300, 1800, 7200, 21600, 43200, 86400] as const;
export const MAX_WEBHOOK_DELIVERY_ATTEMPTS = 8;

export interface AgentWebhookEvent<T = unknown> {
  id: string;
  type: string;
  created_at: string;
  data: T;
}

export interface AgentWebhookSubscriptionRow {
  id: string;
  agent_id: string;
  url: string;
  secret_hash: string;
  signing_secret?: string;
  events: string[];
  status: string;
}

export interface WebhookDispatchResult {
  webhookId: string;
  url: string;
  success: boolean;
  statusCode?: number;
  latencyMs: number;
  error?: string;
}

export class AgentWebhookDispatcherService {
  private readonly db: pg.Pool;
  private readonly timeoutMs: number;

  constructor(db: pg.Pool, timeoutMs = 8000) {
    this.db = db;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Computes the X-Telecom-Signature header:
   * t=<unix_timestamp>,v1=<hex_hmac_sha256>
   */
  public computeSignature(secret: string, timestamp: number, payload: string | object): string {
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  /**
   * Formats an outbound event payload conforming to the DataHouse envelope specification:
   * { id: "...", type: "...", created_at: "...", data: { ... } }
   */
  public formatEvent<T = unknown>(eventType: string, data: T, customId?: string): AgentWebhookEvent<T> {
    let evtId = customId;
    if (!evtId && data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      if (typeof d.order_id === 'string') {
        evtId = d.order_id;
      } else if (typeof d.ledger_entry_id === 'string') {
        evtId = d.ledger_entry_id;
      } else if (typeof d.id === 'string') {
        evtId = d.id;
      }
    }
    if (!evtId) {
      evtId = `evt_${crypto.randomBytes(12).toString('hex')}`;
    }
    return {
      id: evtId,
      type: eventType,
      created_at: new Date().toISOString(),
      data,
    };
  }

  /**
   * Sends an HTTP POST with the signed event payload to the destination webhook URL,
   * recording delivery attempts in webhook_delivery_logs.
   */
  public async dispatchSingleWebhook(
    webhookId: string,
    targetUrl: string,
    signingSecret: string,
    eventType: string,
    data: unknown,
  ): Promise<WebhookDispatchResult> {
    const envelope = this.formatEvent(eventType, data);
    const rawPayload = JSON.stringify(envelope);
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureHeader = this.computeSignature(signingSecret, timestamp, rawPayload);

    const startTime = Date.now();
    let statusCode: number | undefined;
    let responseText = '';
    let success = false;
    let errorMsg: string | undefined;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const deliveryId = `wd_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Telecom-Signature': signatureHeader,
          'X-Telecom-Event': eventType,
          'X-Telecom-Delivery-Id': deliveryId,
          'User-Agent': 'ByteBeacon-Telecom-Gateway/2.0',
        },
        body: rawPayload,
        signal: controller.signal,
      });

      statusCode = response.status;
      responseText = await response.text().catch(() => '');
      success = response.ok;
    } catch (err: any) {
      errorMsg = err?.message || 'Webhook HTTP dispatch failed';
    } finally {
      clearTimeout(timer);
    }

    const latencyMs = Date.now() - startTime;

    // Record delivery log in background (non-blocking)
    const deliveryStatus = success ? 'DELIVERED' : 'FAILED';
    const lastDeliveryStatus = statusCode ? `${statusCode} ${success ? 'OK' : 'ERR'}` : 'TIMEOUT/NETWORK_ERR';

    this.db
      .query(
        `INSERT INTO webhook_delivery_logs (
            webhook_id, event_type, payload, status_code, response_body, latency_ms, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          webhookId,
          eventType,
          rawPayload,
          statusCode || null,
          responseText.slice(0, 1000),
          latencyMs,
          deliveryStatus,
        ],
      )
      .catch(() => {});

    this.db
      .query(
        `UPDATE agent_webhooks
         SET last_delivery_at = CURRENT_TIMESTAMP,
             last_delivery_status = $1,
             failure_count = CASE WHEN $2 THEN 0 ELSE failure_count + 1 END
         WHERE id = $3`,
        [lastDeliveryStatus, success, webhookId],
      )
      .catch(() => {});

    return {
      webhookId,
      url: targetUrl,
      success,
      statusCode,
      latencyMs,
      error: errorMsg,
    };
  }

  /**
   * Dispatches an event to all active subscriptions registered by an agent.
   */
  public async dispatchAgentEvent(
    agentId: string,
    eventType: string,
    data: unknown,
  ): Promise<WebhookDispatchResult[]> {
    try {
      let rows: AgentWebhookSubscriptionRow[] = [];
      try {
        const res = await this.db.query<AgentWebhookSubscriptionRow>(
          `SELECT id, agent_id, url, secret_hash, signing_secret, events, status
           FROM agent_webhooks
           WHERE (
             agent_id = $1
             OR agent_id IN (SELECT user_id FROM agents WHERE id = $1)
             OR agent_id IN (SELECT id FROM agents WHERE user_id = $1)
           )
           AND status = 'ACTIVE'
           AND ($2 = ANY(events) OR '*' = ANY(events))`,
          [agentId, eventType],
        );
        rows = res.rows;
      } catch {
        const res = await this.db.query<AgentWebhookSubscriptionRow>(
          `SELECT id, agent_id, url, secret_hash, events, status
           FROM agent_webhooks
           WHERE (
             agent_id = $1
             OR agent_id IN (SELECT user_id FROM agents WHERE id = $1)
             OR agent_id IN (SELECT id FROM agents WHERE user_id = $1)
           )
           AND status = 'ACTIVE'
           AND ($2 = ANY(events) OR '*' = ANY(events))`,
          [agentId, eventType],
        );
        rows = res.rows;
      }

      if (rows.length === 0) {
        return [];
      }

      const results = await Promise.allSettled(
        rows.map((sub) => {
          const secret = sub.signing_secret || sub.secret_hash;
          return this.dispatchSingleWebhook(sub.id, sub.url, secret, eventType, data);
        }),
      );

      return results
        .filter((r): r is PromiseFulfilledResult<WebhookDispatchResult> => r.status === 'fulfilled')
        .map((r) => r.value);
    } catch {
      return [];
    }
  }
}
