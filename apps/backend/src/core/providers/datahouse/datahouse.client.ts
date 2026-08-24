import crypto from 'node:crypto';
import {
  DataHouseAgentProfile,
  DataHouseSubmitOrderRequest,
  DataHouseSubmitOrderResponse,
  DataHouseBulkOrderRequest,
  DataHouseBulkOrderResponse,
  DataHouseOrderStatusResponse,
  DataHouseBundlesResponse,
  DataHousePublicPrecheckRequest,
  DataHousePrecheckRequest,
  DataHousePrecheckResponse,
  DataHouseBeneficiariesListResponse,
  DataHouseWalletBalanceResponse,
  DataHouseWalletLedgerResponse,
  DataHouseWebhookSubscription,
  DataHouseWebhookCreateRequest,
  DataHouseWebhookCreateResponse,
} from './datahouse.types.js';
import {
  DataHouseError,
  DataHouseNetworkError,
  DataHouseTimeoutError,
  DataHouseRateLimitError,
  DataHouseAuthError,
  DataHouseRejectionError,
  DataHouseInsufficientBalanceError,
  DataHouseBundleInactiveError,
  DataHouseBulkNotOnSandboxError,
  DataHouseAgentInactiveError,
  DataHouseBundleNotFoundError,
  DataHouseInvalidPhoneError,
  DataHouseBeneficiaryNotValidatedError,
} from './datahouse.errors.js';
import { logger } from '../../logging/logger.js';

export interface DataHouseClientConfig {
  baseUrl: string;
  apiKey: string;
  webhookSecret?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class DataHouseClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config: DataHouseClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey.trim();
    this.webhookSecret = (config.webhookSecret || '').trim();
    this.timeoutMs = config.timeoutMs || 15000;
    this.maxRetries = config.maxRetries ?? 2;
  }

  /**
   * Fetches the agent profile associated with this API key.
   * GET /agent/me
   */
  public async getAgentProfile(correlationId = 'agent_me'): Promise<DataHouseAgentProfile> {
    const resp = await this.request<{ success?: boolean; data?: DataHouseAgentProfile } | DataHouseAgentProfile>(
      '/agent/me',
      'GET',
      undefined,
      correlationId,
    );
    return (resp as any)?.data || resp;
  }

  /**
   * Places a single data-bundle order against the agent wallet.
   * POST /agent/orders
   */
  public async submitOrder(
    req: DataHouseSubmitOrderRequest,
    correlationId: string,
  ): Promise<DataHouseSubmitOrderResponse> {
    const resp = await this.request<{ success?: boolean; data?: DataHouseSubmitOrderResponse } | DataHouseSubmitOrderResponse>(
      '/agent/orders',
      'POST',
      req,
      correlationId,
    );
    return (resp as any)?.data || resp;
  }

  /**
   * Places a JSON bulk order across many recipients on one network.
   * POST /agent/orders/bulk
   */
  public async submitBulkOrder(
    req: DataHouseBulkOrderRequest,
    correlationId: string,
  ): Promise<DataHouseBulkOrderResponse> {
    const resp = await this.request<{ success?: boolean; data?: DataHouseBulkOrderResponse } | DataHouseBulkOrderResponse>(
      '/agent/orders/bulk',
      'POST',
      req,
      correlationId,
    );
    return (resp as any)?.data || resp;
  }

  /**
   * Lists orders for this agent with optional filters.
   * GET /agent/orders
   */
  public async listOrders(
    params: {
      status?: string;
      network?: string;
      paymentStatus?: string;
      after?: string;
      before?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
    correlationId = 'orders_list',
  ): Promise<{ data: any[]; meta?: { page: number; limit: number; total: number; totalPages?: number } }> {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.network) query.append('network', params.network.toUpperCase());
    if (params.paymentStatus) query.append('paymentStatus', params.paymentStatus);
    if (params.after) query.append('after', params.after);
    if (params.before) query.append('before', params.before);
    if (params.search) query.append('search', params.search);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    const resp = await this.request<any>(`/agent/orders${qs}`, 'GET', undefined, correlationId);
    return resp?.data || resp;
  }

  /**
   * Looks up one order's status and recipient list by public ID or reference.
   * GET /agent/orders/:id
   */
  public async getOrderStatus(
    orderIdOrReference: string,
    correlationId: string,
  ): Promise<DataHouseOrderStatusResponse> {
    const resp = await this.request<{ success?: boolean; data?: DataHouseOrderStatusResponse } | DataHouseOrderStatusResponse>(
      `/agent/orders/${encodeURIComponent(orderIdOrReference)}`,
      'GET',
      undefined,
      correlationId,
    );
    return (resp as any)?.data || resp;
  }

  /**
   * Lists active data bundles priced for this key's tier.
   * GET /agent/bundles
   */
  public async getBundles(
    params: {
      network?: string;
      type?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
    correlationId = 'bundles_fetch',
  ): Promise<DataHouseBundlesResponse> {
    const query = new URLSearchParams();
    if (params.network && params.network !== 'ALL') query.append('network', params.network.toUpperCase());
    if (params.type) query.append('type', params.type.toUpperCase());
    if (params.search) query.append('search', params.search);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    const resp = await this.request<DataHouseBundlesResponse>(`/agent/bundles${qs}`, 'GET', undefined, correlationId);
    return (resp as any)?.data || resp;
  }

  /**
   * Public precheck of up to 10 beneficiary numbers (no API key).
   * POST /orders/beneficiaries/precheck
   */
  public async precheckPublicBeneficiaries(
    req: DataHousePublicPrecheckRequest,
    correlationId = 'public_precheck',
  ): Promise<DataHousePrecheckResponse> {
    const resp = await this.request<{ success?: boolean; data?: DataHousePrecheckResponse } | DataHousePrecheckResponse>(
      '/orders/beneficiaries/precheck',
      'POST',
      req,
      correlationId,
      false, // Omit API key for public endpoint
    );
    return (resp as any)?.data || resp;
  }

  /**
   * Keyed batch precheck of up to 1000 numbers with opt-in recording.
   * POST /agent/beneficiaries/precheck
   */
  public async precheckBeneficiaries(
    req: DataHousePrecheckRequest,
    correlationId: string,
  ): Promise<DataHousePrecheckResponse> {
    const resp = await this.request<{ success?: boolean; data?: DataHousePrecheckResponse } | DataHousePrecheckResponse>(
      '/agent/beneficiaries/precheck',
      'POST',
      req,
      correlationId,
    );
    return (resp as any)?.data || resp;
  }

  /**
   * Checks MTN approval status of submitted/recorded numbers.
   * GET /agent/beneficiaries
   */
  public async listBeneficiaries(
    params: {
      status?: string;
      network?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
    correlationId = 'beneficiaries_list',
  ): Promise<DataHouseBeneficiariesListResponse> {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.network && params.network !== 'all') query.append('network', params.network.toUpperCase());
    if (params.search) query.append('search', params.search);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    const resp = await this.request<DataHouseBeneficiariesListResponse>(
      `/agent/beneficiaries${qs}`,
      'GET',
      undefined,
      correlationId,
    );
    return (resp as any)?.data || resp;
  }

  /**
   * Retrieves agent wallet balance and overdraft limits.
   * GET /agent/wallet/balance
   */
  public async getWalletBalance(correlationId = 'wallet_balance'): Promise<DataHouseWalletBalanceResponse> {
    const resp = await this.request<{ success?: boolean; data?: DataHouseWalletBalanceResponse } | DataHouseWalletBalanceResponse>(
      '/agent/wallet/balance',
      'GET',
      undefined,
      correlationId,
    );
    return (resp as any)?.data || resp;
  }

  /**
   * Retrieves agent wallet ledger history (fixed page=1, limit=50 on x-api-key surface).
   * GET /agent/wallet/ledger
   */
  public async getWalletLedger(correlationId = 'wallet_ledger'): Promise<DataHouseWalletLedgerResponse> {
    const resp = await this.request<DataHouseWalletLedgerResponse>(
      '/agent/wallet/ledger',
      'GET',
      undefined,
      correlationId,
    );
    return (resp as any)?.data || resp;
  }

  /**
   * Subscribes an HTTPS URL to event webhooks. Returns signing secret ONCE.
   * POST /agent/webhooks
   */
  public async createWebhookSubscription(
    req: DataHouseWebhookCreateRequest,
    correlationId = 'webhook_create',
  ): Promise<DataHouseWebhookCreateResponse> {
    const resp = await this.request<{ success?: boolean; data?: DataHouseWebhookCreateResponse } | DataHouseWebhookCreateResponse>(
      '/agent/webhooks',
      'POST',
      req,
      correlationId,
    );
    return (resp as any)?.data || resp;
  }

  /**
   * Lists configured webhook subscriptions.
   * GET /agent/webhooks
   */
  public async listWebhookSubscriptions(
    correlationId = 'webhook_list',
  ): Promise<DataHouseWebhookSubscription[]> {
    const resp = await this.request<{ success?: boolean; data?: DataHouseWebhookSubscription[] } | DataHouseWebhookSubscription[]>(
      '/agent/webhooks',
      'GET',
      undefined,
      correlationId,
    );
    const data = (resp as any)?.data || resp;
    return Array.isArray(data) ? data : (data as any)?.data || [];
  }

  /**
   * Rotates a subscription's HMAC signing secret; returns new secret ONCE.
   * POST /agent/webhooks/:id/rotate-secret
   */
  public async rotateWebhookSecret(
    subscriptionId: string,
    correlationId = 'webhook_rotate',
  ): Promise<DataHouseWebhookCreateResponse> {
    const resp = await this.request<{ success?: boolean; data?: DataHouseWebhookCreateResponse } | DataHouseWebhookCreateResponse>(
      `/agent/webhooks/${encodeURIComponent(subscriptionId)}/rotate-secret`,
      'POST',
      undefined,
      correlationId,
    );
    return (resp as any)?.data || resp;
  }

  /**
   * Deletes a webhook subscription.
   * DELETE /agent/webhooks/:id
   */
  public async deleteWebhookSubscription(
    subscriptionId: string,
    correlationId = 'webhook_delete',
  ): Promise<void> {
    await this.request<void>(
      `/agent/webhooks/${encodeURIComponent(subscriptionId)}`,
      'DELETE',
      undefined,
      correlationId,
    );
  }

  /**
   * Probes integration health via /agent/me or /agent/wallet/balance.
   */
  public async checkHealth(): Promise<{ status: 'UP' | 'DOWN'; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.getAgentProfile('health_probe');
      return { status: 'UP', latencyMs: Date.now() - start };
    } catch {
      try {
        await this.getWalletBalance('health_probe');
        return { status: 'UP', latencyMs: Date.now() - start };
      } catch {
        return { status: 'DOWN', latencyMs: Date.now() - start };
      }
    }
  }

  /**
   * Cryptographically verifies incoming DataHouse webhook signature.
   * Supports X-Telecom-Signature format: t=<ts>,v1=<hex>.
   */
  public verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string): boolean {
    const secret = this.webhookSecret;
    if (!signatureHeader || !secret) {
      return false;
    }

    try {
      let timestamp: number | null = null;
      let signatureHex = '';

      if (signatureHeader.includes('=')) {
        const parts = signatureHeader.split(',');
        for (const part of parts) {
          const [k, v] = part.trim().split('=');
          if (k === 't') timestamp = parseInt(v, 10);
          if (k === 'v1' || k === 'sha256') signatureHex = v;
        }
      }

      if (!signatureHex) {
        signatureHex = signatureHeader.trim();
      }

      // 5-minute replay window check
      if (timestamp) {
        const nowSec = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSec - timestamp) > 300) {
          logger.warn({ timestamp, nowSec }, 'DataHouse webhook timestamp expired');
          return false;
        }
      }

      const rawString = Buffer.isBuffer(rawBody)
        ? rawBody.toString('utf8')
        : typeof rawBody === 'string'
        ? rawBody
        : JSON.stringify(rawBody);

      const payloadToSign = timestamp ? `${timestamp}.${rawString}` : rawString;

      const expectedSignatureHex = crypto
        .createHmac('sha256', secret)
        .update(payloadToSign)
        .digest('hex');

      const sigBuffer = Buffer.from(signatureHex, 'hex');
      const expectedBuffer = Buffer.from(expectedSignatureHex, 'hex');

      if (sigBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch (err: any) {
      logger.error({ err: err?.message }, 'Error during DataHouse webhook signature verification');
      return false;
    }
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: unknown,
    correlationId = 'req_internal',
    includeApiKey = true,
  ): Promise<T> {
    const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanPath}`;

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const headers: Record<string, string> = {
          Accept: 'application/json',
          'x-correlation-id': correlationId,
        };

        if (includeApiKey && this.apiKey) {
          headers['x-api-key'] = this.apiKey;
        }

        if (body) {
          headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 204 No Content Handling
        if (response.status === 204) {
          return undefined as unknown as T;
        }

        // 429 Rate Limiting Backoff
        if (response.status === 429) {
          if (attempt <= this.maxRetries) {
            const backoffMs = Math.min(1000 * Math.pow(2, attempt), 4000);
            logger.warn(
              { endpoint, attempt, backoffMs, correlationId },
              'DataHouse 429 Rate Limit encountered. Backing off before retry...',
            );
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
          throw new DataHouseRateLimitError();
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          this.handleErrorResponse(response.status, data);
        }

        return data as T;
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (err instanceof DataHouseError) {
          throw err;
        }

        if (err?.name === 'AbortError') {
          throw new DataHouseTimeoutError(this.timeoutMs);
        }

        if (attempt <= this.maxRetries) {
          const delayMs = 1000 * attempt;
          logger.warn(
            { err: err?.message, attempt, delayMs, correlationId },
            'DataHouse request network error. Retrying...',
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        throw new DataHouseNetworkError(err?.message || 'Network communication error', err);
      }
    }

    throw new DataHouseNetworkError('Exceeded maximum retry attempts');
  }

  private handleErrorResponse(statusCode: number, data: any): never {
    const errorMessage = data?.error?.message || data?.message || `HTTP ${statusCode} from DataHouse`;
    const errorCode = (data?.error?.code || data?.code || 'DATAHOUSE_ERROR').toUpperCase();

    if (errorCode === 'INSUFFICIENT_BALANCE') {
      throw new DataHouseInsufficientBalanceError(errorMessage);
    }
    if (errorCode === 'BUNDLE_INACTIVE') {
      throw new DataHouseBundleInactiveError(errorMessage);
    }
    if (errorCode === 'BULK_NOT_ON_SANDBOX') {
      throw new DataHouseBulkNotOnSandboxError(errorMessage);
    }
    if (errorCode === 'AGENT_INACTIVE') {
      throw new DataHouseAgentInactiveError(errorMessage);
    }
    if (errorCode === 'BUNDLE_NOT_FOUND') {
      throw new DataHouseBundleNotFoundError(errorMessage);
    }
    if (errorCode === 'INVALID_PHONE') {
      throw new DataHouseInvalidPhoneError(errorMessage);
    }
    if (errorCode === 'BENEFICIARY_NOT_VALIDATED') {
      throw new DataHouseBeneficiaryNotValidatedError(errorMessage);
    }
    if (statusCode === 401 || (statusCode === 403 && errorCode === 'UNAUTHORIZED')) {
      throw new DataHouseAuthError(errorMessage);
    }
    if (statusCode === 403) {
      throw new DataHouseAgentInactiveError(errorMessage);
    }
    if (statusCode === 429) {
      throw new DataHouseRateLimitError();
    }
    if (statusCode === 400 || statusCode === 422) {
      throw new DataHouseRejectionError(errorMessage, errorCode, data?.details);
    }

    throw new DataHouseError(errorMessage, statusCode, errorCode);
  }
}

