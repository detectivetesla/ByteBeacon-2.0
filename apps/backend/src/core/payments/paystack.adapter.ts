import crypto from 'node:crypto';
import {
  IPaymentProvider,
  InitializePaymentInput,
  InitializePaymentResult,
  VerifyPaymentResult,
  InitiateRefundInput,
  InitiateRefundResult,
} from './payment-provider.interface.js';
import { Currency } from '@bytebeacon/shared';
import { logger } from '../logging/logger.js';

export interface PaystackAdapterConfig {
  secretKey: string;
  baseUrl?: string;
}

export class PaystackAdapter implements IPaymentProvider {
  private readonly secretKey: string;
  private readonly baseUrl: string;

  constructor(config: PaystackAdapterConfig) {
    this.secretKey = config.secretKey;
    this.baseUrl = config.baseUrl || 'https://api.paystack.co';
  }

  public async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const reference = `pst_${input.orderId}_${crypto.randomBytes(8).toString('hex')}`;
    const url = `${this.baseUrl}/transaction/initialize`;

    const channels = input.channel ? [this.mapChannel(input.channel)] : ['mobile_money', 'card'];

    const payload = {
      email: input.email,
      amount: input.amountPesewas, // Paystack uses minor unit (pesewas/kobo)
      currency: input.currency,
      reference,
      callback_url: input.callbackUrl,
      channels,
      metadata: {
        orderId: input.orderId,
        ...input.metadata,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        status: boolean;
        message: string;
        data?: { authorization_url: string; access_code: string; reference: string };
      };

      if (!response.ok || !data.status || !data.data) {
        logger.error({ data, status: response.status }, 'Paystack initialize failed');
        throw new Error(`Paystack initialization error: ${data.message || 'Unknown error'}`);
      }

      return {
        provider: 'PAYSTACK',
        providerReference: data.data.reference,
        authorizationUrl: data.data.authorization_url,
        accessCode: data.data.access_code,
        rawResponse: data as Record<string, unknown>,
      };
    } catch (error) {
      logger.error({ error }, 'Paystack initialize network error');
      throw error;
    }
  }

  public async verifyPayment(providerReference: string): Promise<VerifyPaymentResult> {
    const url = `${this.baseUrl}/transaction/verify/${encodeURIComponent(providerReference)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      const data = (await response.json()) as {
        status: boolean;
        message: string;
        data?: {
          status: string;
          amount: number;
          currency: string;
          paid_at: string;
          channel: string;
          gateway_response: string;
          authorization?: { authorization_code: string };
        };
      };

      if (!response.ok || !data.status || !data.data) {
        return {
          provider: 'PAYSTACK',
          providerReference,
          status: 'FAILED',
          amountPesewas: 0,
          currency: Currency.GHS,
          paidAt: null,
          gatewayResponse: data?.message || 'Verification failed',
        };
      }

      const tx = data.data;
      const isSuccess = tx.status === 'success';

      return {
        provider: 'PAYSTACK',
        providerReference,
        status: isSuccess ? 'SUCCESS' : tx.status === 'abandoned' ? 'FAILED' : 'PENDING',
        amountPesewas: tx.amount,
        currency: tx.currency as Currency,
        paidAt: tx.paid_at ? new Date(tx.paid_at) : null,
        channel: tx.channel,
        authorizationCode: tx.authorization?.authorization_code,
        gatewayResponse: tx.gateway_response,
        rawResponse: data as Record<string, unknown>,
      };
    } catch (error) {
      logger.error({ error, providerReference }, 'Paystack verify transaction error');
      throw error;
    }
  }

  public async initiateRefund(input: InitiateRefundInput): Promise<InitiateRefundResult> {
    const url = `${this.baseUrl}/refund`;
    const payload = {
      transaction: input.providerReference,
      amount: input.amountPesewas,
      currency: input.currency,
      customer_note: input.reason,
      merchant_note: `ByteBeacon Refund for payment ${input.paymentId}`,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        status: boolean;
        message: string;
        data?: { id: number; status: string; amount: number; transaction: { reference: string } };
      };

      if (!response.ok || !data.status || !data.data) {
        logger.error({ data }, 'Paystack refund initiation failed');
        throw new Error(`Paystack refund error: ${data.message || 'Unknown refund error'}`);
      }

      return {
        provider: 'PAYSTACK',
        providerRefundReference: `pst_rf_${data.data.id}`,
        status: data.data.status === 'processed' ? 'SUCCESS' : 'PENDING',
        amountPesewas: data.data.amount,
        rawResponse: data as Record<string, unknown>,
      };
    } catch (error) {
      logger.error({ error, input }, 'Paystack refund network error');
      throw error;
    }
  }

  public verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!signature || !this.secretKey) return false;

    const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf-8');
    const computedHash = crypto
      .createHmac('sha512', this.secretKey)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(computedHash, 'utf-8');
    const providedBuffer = Buffer.from(signature, 'utf-8');

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  }

  public async healthCheck(): Promise<{ providerName: string; status: 'UP' | 'DEGRADED' | 'DOWN' | 'UNKNOWN'; latencyMs: number }> {
    const start = Date.now();
    try {
      // Light check to Paystack API
      const res = await fetch(`${this.baseUrl}/decision/bin/408408`, {
        headers: { Authorization: `Bearer ${this.secretKey}` },
      });
      return {
        providerName: 'Paystack',
        status: res.ok || res.status === 400 || res.status === 404 ? 'UP' : 'DEGRADED',
        latencyMs: Date.now() - start,
      };
    } catch {
      return {
        providerName: 'Paystack',
        status: 'DOWN',
        latencyMs: Date.now() - start,
      };
    }
  }

  private mapChannel(channel: string): string {
    switch (channel) {
      case 'MTN_MOMO':
      case 'TELECEL_CASH':
      case 'AIRTELTIGO_MONEY':
        return 'mobile_money';
      case 'VISA_MASTERCARD':
        return 'card';
      default:
        return 'mobile_money';
    }
  }
}
