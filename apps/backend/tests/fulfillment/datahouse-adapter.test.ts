import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataHouseClient } from '../../src/core/providers/datahouse/datahouse.client.js';
import { DataHouseAdapter } from '../../src/core/providers/datahouse/datahouse.adapter.js';
import { NetworkProvider, ProviderStatus } from '@bytebeacon/shared';
import crypto from 'node:crypto';

describe('DataHouseAdapter and DataHouseClient', () => {
  const mockWebhookSecret = 'test_webhook_secret_key_123';
  let mockClient: DataHouseClient;
  let adapter: DataHouseAdapter;

  beforeEach(() => {
    mockClient = new DataHouseClient({
      baseUrl: 'https://api.test-datahouse.net/api/v1',
      apiKey: 'dh_test_key_abc',
      webhookSecret: mockWebhookSecret,
      timeoutMs: 5000,
    });
    adapter = new DataHouseAdapter(mockClient);
  });

  describe('Single Order Submission', () => {
    it('should submit a single order to DataHouse and return standardized result', async () => {
      vi.spyOn(mockClient, 'submitOrder').mockResolvedValueOnce({
        id: 'ord_01J9ABCXYZ',
        referenceCode: 'TXN-DATAHOUSE-999',
        status: 'ACCEPTED',
        created_at: '2026-08-17T12:00:00Z',
      });

      const result = await adapter.submitOrder({
        orderId: 'ord_internal_1',
        clientReference: 'ref_1',
        network: NetworkProvider.MTN,
        recipientPhone: '0241234567',
        dataAmountMb: 1024,
        idempotencyKey: 'idemp_key_123',
        metadata: { bundleId: 'bdl_mtn_1gb' },
      });

      expect(result.providerOrderId).toBe('ord_01J9ABCXYZ');
      expect(result.providerReference).toBe('TXN-DATAHOUSE-999');
      expect(result.providerStatus).toBe(ProviderStatus.RECEIVED);
    });
  });

  describe('Bulk Order Submission', () => {
    it('should submit bulk orders to DataHouse and return batch details', async () => {
      vi.spyOn(mockClient, 'submitBulkOrder').mockResolvedValueOnce({
        batchId: 'batch_dh_555',
        network: 'MTN',
        status: 'SUBMITTED',
        totalRecipients: 3,
        acceptedRecipients: 3,
        queuedRecipients: 3,
        rejectedRecipients: 0,
      });

      const result = await adapter.submitBulkOrder({
        network: NetworkProvider.MTN,
        recipients: [
          { phoneNumber: '0241111111', dataSizeGb: 1 },
          { phoneNumber: '0242222222', dataSizeGb: 2 },
          { phoneNumber: '0243333333', dataSizeGb: 5 },
        ],
        idempotencyKey: 'idemp_bulk_999',
        onUnvalidated: 'set_aside',
      });

      expect(result.providerOrderId).toBe('batch_dh_555');
      expect(result.totalRecipients).toBe(3);
      expect(result.acceptedRecipients).toBe(3);
      expect(result.providerStatus).toBe(ProviderStatus.RECEIVED);
    });
  });

  describe('Order Status Query', () => {
    it('should query order status and map COMPLETED correctly', async () => {
      vi.spyOn(mockClient, 'getOrderStatus').mockResolvedValueOnce({
        id: 'ord_01J9ABCXYZ',
        referenceCode: 'TXN-DATAHOUSE-999',
        status: 'DELIVERED',
        network: 'MTN',
        phoneNumber: '233241234567',
        completed_at: '2026-08-17T12:01:00Z',
      });

      const status = await adapter.getOrderStatus({
        providerReference: 'TXN-DATAHOUSE-999',
      });

      expect(status.providerStatus).toBe(ProviderStatus.COMPLETED);
      expect(status.completedAt).toBe('2026-08-17T12:01:00Z');
    });

    it('should query order status and map FAILED correctly', async () => {
      vi.spyOn(mockClient, 'getOrderStatus').mockResolvedValueOnce({
        id: 'ord_01J9ABCXYZ',
        referenceCode: 'TXN-DATAHOUSE-999',
        status: 'FAILED',
        network: 'MTN',
        phoneNumber: '233241234567',
        error: 'Subscriber out of credit or unvalidated',
      });

      const status = await adapter.getOrderStatus({
        providerReference: 'TXN-DATAHOUSE-999',
      });

      expect(status.providerStatus).toBe(ProviderStatus.FAILED);
      expect(status.errorMessage).toBe('Subscriber out of credit or unvalidated');
    });
  });

  describe('Beneficiary Precheck & MTN Validation', () => {
    it('should validate beneficiary through precheck', async () => {
      vi.spyOn(mockClient, 'precheckBeneficiaries').mockResolvedValueOnce({
        network: 'MTN',
        enforced: true,
        summary: { total: 1, known: 1, unknown: 0 },
        results: [
          {
            phoneNumber: '233241234567',
            isKnown: true,
            isValid: true,
            accountName: 'Kofi Mensah',
          },
        ],
      });

      const res = await adapter.validateBeneficiary({
        phoneNumber: '0241234567',
        network: NetworkProvider.MTN,
      });

      expect(res.isValid).toBe(true);
      expect(res.network).toBe(NetworkProvider.MTN);
      expect(res.accountName).toBe('Kofi Mensah');
    });
  });

  describe('Wallet Balances & Catalog', () => {
    it('should fetch wallet balance and convert GHS to integer Pesewas', async () => {
      vi.spyOn(mockClient, 'getWalletBalance').mockResolvedValueOnce({
        balance: 1540.5,
        currency: 'GHS',
        overdraftLimit: 500.0,
        overdraftUsed: 100.0,
        overdraftAvailable: 400.0,
        overdraftActive: true,
        availableToSpend: 1940.5,
      });

      const wallet = await adapter.getWalletBalance();

      expect(wallet.balancePesewas).toBe(154050);
      expect(wallet.balanceGhs).toBe(1540.5);
      expect(wallet.availableToSpendPesewas).toBe(194050);
      expect(wallet.overdraftActive).toBe(true);
    });

    it('should fetch bundles and map them to standard DTOs', async () => {
      vi.spyOn(mockClient, 'getBundles').mockResolvedValueOnce({
        data: [
          {
            id: 'bdl_1',
            name: 'MTN 1GB Non-Expiry',
            network: 'MTN',
            dataSizeGb: 1,
            price: 5.5,
            validityDays: 30,
            is_active: true,
          },
          {
            id: 'bdl_2',
            name: 'Telecel 5GB',
            network: 'TELECEL',
            dataSizeGb: 5,
            price: 24.0,
            validityDays: 30,
            is_active: true,
          },
        ],
      });

      const bundles = await adapter.getBundles();

      expect(bundles).toHaveLength(2);
      expect(bundles[0].network).toBe(NetworkProvider.MTN);
      expect(bundles[0].pricePesewas).toBe(550);
      expect(bundles[1].network).toBe(NetworkProvider.TELECEL);
      expect(bundles[1].pricePesewas).toBe(2400);
    });
  });

  describe('HMAC Webhook Signature Verification', () => {
    it('should verify authentic DataHouse signature correctly', () => {
      const payload = JSON.stringify({
        id: 'evt_123',
        type: 'ORDER_STATUS_UPDATE',
        data: { id: 'ord_1', status: 'COMPLETED' },
      });

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

      const header = `t=${timestamp},v1=${signature}`;
      const isValid = adapter.verifyWebhookSignature(payload, header);

      expect(isValid).toBe(true);
    });

    it('should reject tampered payload or forged signature', () => {
      const payload = JSON.stringify({ id: 'evt_123', data: { status: 'COMPLETED' } });
      const header = `t=${Math.floor(Date.now() / 1000)},v1=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`;

      const isValid = adapter.verifyWebhookSignature(payload, header);
      expect(isValid).toBe(false);
    });

    it('should reject expired signature older than 5 minutes', () => {
      const payload = JSON.stringify({ id: 'evt_123', data: { status: 'COMPLETED' } });
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const signature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(`${expiredTimestamp}.${payload}`)
        .digest('hex');

      const header = `t=${expiredTimestamp},v1=${signature}`;
      const isValid = adapter.verifyWebhookSignature(payload, header);

      expect(isValid).toBe(false);
    });
  });
});
