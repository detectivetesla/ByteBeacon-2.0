import { Currency, PaymentMethod, PaymentChannel, ProviderHealth } from '@bytebeacon/shared';

export interface InitializePaymentInput {
  orderId: string;
  amountPesewas: number;
  currency: Currency;
  email: string;
  paymentMethod: PaymentMethod;
  channel?: PaymentChannel;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface InitializePaymentResult {
  provider: string;
  providerReference: string;
  authorizationUrl: string | null;
  accessCode?: string;
  rawResponse?: Record<string, unknown>;
}

export interface VerifyPaymentResult {
  provider: string;
  providerReference: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  amountPesewas: number;
  currency: Currency;
  paidAt: Date | null;
  channel?: string;
  authorizationCode?: string;
  gatewayResponse?: string;
  rawResponse?: Record<string, unknown>;
}

export interface InitiateRefundInput {
  paymentId: string;
  providerReference: string;
  amountPesewas: number;
  currency: Currency;
  reason: string;
  idempotencyKey?: string;
}

export interface InitiateRefundResult {
  provider: string;
  providerRefundReference: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  amountPesewas: number;
  rawResponse?: Record<string, unknown>;
}

export interface IPaymentProvider {
  initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  verifyPayment(providerReference: string): Promise<VerifyPaymentResult>;
  initiateRefund(input: InitiateRefundInput): Promise<InitiateRefundResult>;
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean;
  healthCheck?(): Promise<ProviderHealth>;
}
