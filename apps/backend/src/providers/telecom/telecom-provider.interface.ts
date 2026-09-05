import { ProviderResult } from '@bytebeacon/shared';

/**
 * Telecom Provider Contract
 *
 * NOTE: DataHouse specific API behavior, status codes, payload structures,
 * authentication headers, and webhook verification are:
 * CONFIRMED EXTERNAL REQUIREMENT (Authoritative Vendor Specification: https://api.getmorepaylessdatahouse.net/api/v1).
 *
 * This interface defines generic abstract capabilities. Concrete implementation
 * is provided by DataHouseAdapter / DynamicHttpAdapter.
 */

export interface TelecomOrderDispatchParams {
  recipientPhoneNumber: string;
  network: 'MTN' | 'TELECEL' | 'AIRTELTIGO';
  volumeMb: number;
  clientReference: string;
}

export interface TelecomOrderDispatchData {
  providerReference: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

export interface TelecomOrderStatusData {
  providerReference: string;
  clientReference: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  completedAt?: string;
}

export interface ITelecomProvider {
  readonly providerName: string;
  dispatchOrder(params: TelecomOrderDispatchParams): Promise<ProviderResult<TelecomOrderDispatchData>>;
  checkOrderStatus(providerReference: string): Promise<ProviderResult<TelecomOrderStatusData>>;
  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean;
}
