import crypto from 'node:crypto';
import {
  GmplSubmitRequest,
  GmplSubmitResponse,
  GmplStatusResponse,
  GmplBeneficiaryResponse,
} from './gmpl.types.js';
import {
  GmplError,
  GmplNetworkError,
  GmplTimeoutError,
  GmplRateLimitError,
  GmplAuthError,
  GmplRejectionError,
} from './gmpl.errors.js';
import { logger } from '../../logging/logger.js';

export interface GmplClientConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  timeoutMs?: number;
}

export class GmplClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly timeoutMs: number;

  constructor(config: GmplClientConfig) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.timeoutMs = config.timeoutMs || 10000; // 10s default
  }

  public async submitOrder(req: GmplSubmitRequest, correlationId: string): Promise<GmplSubmitResponse> {
    return this.request<GmplSubmitResponse>('/api/v1/telecom/orders', 'POST', req, correlationId);
  }

  public async getOrderStatus(providerReference: string, correlationId: string): Promise<GmplStatusResponse> {
    return this.request<GmplStatusResponse>(
      `/api/v1/telecom/orders/${encodeURIComponent(providerReference)}`,
      'GET',
      undefined,
      correlationId,
    );
  }

  public async validateBeneficiary(
    msisdn: string,
    network: string,
    correlationId: string,
  ): Promise<GmplBeneficiaryResponse> {
    return this.request<GmplBeneficiaryResponse>(
      `/api/v1/telecom/beneficiaries/validate?msisdn=${encodeURIComponent(msisdn)}&network=${encodeURIComponent(network)}`,
      'GET',
      undefined,
      correlationId,
    );
  }

  public async checkHealth(): Promise<{ status: 'UP' | 'DOWN'; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.request<{ status: string }>('/healthz', 'GET', undefined, 'health_check');
      return { status: 'UP', latencyMs: Date.now() - start };
    } catch {
      return { status: 'DOWN', latencyMs: Date.now() - start };
    }
  }

  public verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!signature || !this.apiSecret) return false;

    const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf-8');
    const computed = crypto
      .createHmac('sha256', this.apiSecret)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(computed, 'utf-8');
    const providedBuffer = Buffer.from(signature, 'utf-8');

    if (expectedBuffer.length !== providedBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST',
    body?: unknown,
    correlationId?: string,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyString = body ? JSON.stringify(body) : '';

    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(`${method}${endpoint}${timestamp}${bodyString}`)
      .digest('hex');

    const headers: Record<string, string> = {
      'x-gmpl-api-key': this.apiKey,
      'x-gmpl-timestamp': timestamp,
      'x-gmpl-signature': signature,
      'x-correlation-id': correlationId || 'unknown',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? bodyString : undefined,
        signal: controller.signal,
      });

      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { message: responseText };
      }

      if (!response.ok) {
        this.handleErrorResponse(response.status, data);
      }

      return data as T;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new GmplTimeoutError(`GMPL request to [${endpoint}] timed out after ${this.timeoutMs}ms`);
      }
      if (err instanceof GmplError) {
        throw err;
      }
      logger.error({ err, endpoint, correlationId }, 'GMPL network connectivity error');
      throw new GmplNetworkError(`Failed to communicate with GMPL: ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private handleErrorResponse(statusCode: number, data: any): never {
    const message = data?.message || data?.error || `GMPL returned HTTP ${statusCode}`;
    const errorCode = data?.error_code || 'GMPL_ERROR';

    if (statusCode === 401 || statusCode === 403) {
      throw new GmplAuthError(message);
    }
    if (statusCode === 429) {
      throw new GmplRateLimitError(message);
    }
    if (statusCode >= 400 && statusCode < 500) {
      throw new GmplRejectionError(message, errorCode);
    }
    if (statusCode >= 500) {
      throw new GmplError(message, true, statusCode, errorCode);
    }

    throw new GmplError(message, false, statusCode, errorCode);
  }
}
