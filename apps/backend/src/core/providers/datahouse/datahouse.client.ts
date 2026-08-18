import crypto from 'node:crypto';
import {
  DataHouseSubmitOrderRequest,
  DataHouseSubmitOrderResponse,
  DataHouseBulkOrderRequest,
  DataHouseBulkOrderResponse,
  DataHouseOrderStatusResponse,
  DataHouseBundlesResponse,
  DataHousePrecheckRequest,
  DataHousePrecheckResponse,
  DataHouseBeneficiariesListResponse,
  DataHouseWalletBalanceResponse,
  DataHouseWalletLedgerResponse,
} from './datahouse.types.js';
import {
  DataHouseError,
  DataHouseNetworkError,
  DataHouseTimeoutError,
  DataHouseRateLimitError,
  DataHouseAuthError,
  DataHouseRejectionError,
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

  public async submitOrder(
    req: DataHouseSubmitOrderRequest,
    correlationId: string,
  ): Promise<DataHouseSubmitOrderResponse> {
    return this.request<DataHouseSubmitOrderResponse>('/agent/orders', 'POST', req, correlationId);
  }

  public async submitBulkOrder(
    req: DataHouseBulkOrderRequest,
    correlationId: string,
  ): Promise<DataHouseBulkOrderResponse> {
    return this.request<DataHouseBulkOrderResponse>('/agent/orders/bulk', 'POST', req, correlationId);
  }

  public async getOrderStatus(
    orderIdOrReference: string,
    correlationId: string,
  ): Promise<DataHouseOrderStatusResponse> {
    return this.request<DataHouseOrderStatusResponse>(
      `/agent/orders/${encodeURIComponent(orderIdOrReference)}`,
      'GET',
      undefined,
      correlationId,
    );
  }

  public async getBundles(params: {
    network?: string;
    type?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}, correlationId = 'bundles_fetch'): Promise<DataHouseBundlesResponse> {
    const query = new URLSearchParams();
    if (params.network && params.network !== 'ALL') query.append('network', params.network.toUpperCase());
    if (params.type) query.append('type', params.type.toLowerCase());
    if (params.search) query.append('search', params.search);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<DataHouseBundlesResponse>(`/agent/bundles${qs}`, 'GET', undefined, correlationId);
  }

  public async precheckBeneficiaries(
    req: DataHousePrecheckRequest,
    correlationId: string,
  ): Promise<DataHousePrecheckResponse> {
    return this.request<DataHousePrecheckResponse>(
      '/agent/beneficiaries/precheck',
      'POST',
      req,
      correlationId,
    );
  }

  public async listBeneficiaries(params: {
    status?: string;
    network?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}, correlationId = 'beneficiaries_list'): Promise<DataHouseBeneficiariesListResponse> {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.network && params.network !== 'all') query.append('network', params.network.toUpperCase());
    if (params.search) query.append('search', params.search);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<DataHouseBeneficiariesListResponse>(
      `/agent/beneficiaries${qs}`,
      'GET',
      undefined,
      correlationId,
    );
  }

  public async getWalletBalance(correlationId = 'wallet_balance'): Promise<DataHouseWalletBalanceResponse> {
    return this.request<DataHouseWalletBalanceResponse>(
      '/agent/wallet/balance',
      'GET',
      undefined,
      correlationId,
    );
  }

  public async getWalletLedger(correlationId = 'wallet_ledger'): Promise<DataHouseWalletLedgerResponse> {
    return this.request<DataHouseWalletLedgerResponse>(
      '/agent/wallet/ledger',
      'GET',
      undefined,
      correlationId,
    );
  }

  public async checkHealth(): Promise<{ status: 'UP' | 'DOWN'; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.getWalletBalance('health_probe');
      return { status: 'UP', latencyMs: Date.now() - start };
    } catch {
      try {
        await this.getBundles({ limit: 1 }, 'health_probe');
        return { status: 'UP', latencyMs: Date.now() - start };
      } catch {
        return { status: 'DOWN', latencyMs: Date.now() - start };
      }
    }
  }

  /**
   * Cryptographically verifies incoming DataHouse webhook signature.
   * Supports t=<ts>,v1=<hex> / sha256=<hex> / raw hex.
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

      // Check 5-minute clock drift if timestamp is provided
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
          'x-api-key': this.apiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
        };

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

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

        // 401/403 Authentication Error
        if (response.status === 401 || response.status === 403) {
          throw new DataHouseAuthError();
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errorMessage = (data as any)?.error?.message || (data as any)?.message || `HTTP ${response.status} from DataHouse`;
          const errorCode = (data as any)?.error?.code || (data as any)?.code || 'DATAHOUSE_ERROR';

          if (response.status === 422 || response.status === 400) {
            throw new DataHouseRejectionError(errorMessage, errorCode, (data as any)?.details);
          }

          throw new DataHouseError(errorMessage, response.status, errorCode);
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
}
