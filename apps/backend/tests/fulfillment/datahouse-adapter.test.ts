import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataHouseClient } from '../../src/core/providers/datahouse/datahouse.client.js';
import { DataHouseAdapter } from '../../src/core/providers/datahouse/datahouse.adapter.js';
import {
  DataHouseInsufficientBalanceError,
  DataHouseBeneficiaryNotValidatedError,
  DataHouseBulkNotOnSandboxError,
  DataHouseBundleInactiveError,
  DataHouseAgentInactiveError,
  DataHouseBundleNotFoundError,
  DataHouseInvalidPhoneError,
  DataHouseRateLimitError,
} from '../../src/core/providers/datahouse/datahouse.errors.js';
import { NetworkProvider, ProviderStatus } from '@bytebeacon/shared';
import crypto from 'node:crypto';

describe('DataHouseAdapter and DataHouseClient', () => {
  const mockWebhookSecret = 'whsec_test_secret_key_123';
  let mockClient: DataHouseClient;
  let adapter: DataHouseAdapter;

  beforeEach(() => {
    mockClient = new DataHouseClient({
      baseUrl: 'https://api.getmorepaylessdatahouse.net/api/v1',
      apiKey: 'ak_live_test_key_abc123',
      webhookSecret: mockWebhookSecret,
      timeoutMs: 5000,
    });
    adapter = new DataHouseAdapter(mockClient);
  });

  describe('Agent Profile & Connection Verification (GET /agent/me)', () => {
    it('should retrieve agent profile and pricing tier', async () => {
      vi.spyOn(mockClient, 'getAgentProfile').mockResolvedValueOnce({
        id: '9b2e5d1a-001',
        publicId: 'agt_01J8ABCXYZ',
        businessName: 'Mensah Telecom Resellers',
        businessPhone: '+233241234567',
        address: 'Accra, Ghana',
        tier: 'standard',
        status: 'approved',
        pricePerGb: '4.20',
        apiAccessStatus: 'paid',
        userId: 'user_5f0c',
        user: {
          id: 'user_5f0c',
          name: 'Kwame Mensah',
          email: 'kwame@example.com',
          phone: '+233241234567',
        },
        createdAt: '2026-05-20T09:00:00.000Z',
      });

      const profile = await adapter.getAgentProfile();

      expect(profile.publicId).toBe('agt_01J8ABCXYZ');
      expect(profile.businessName).toBe('Mensah Telecom Resellers');
      expect(profile.pricePerGb).toBe('4.20');
      expect(profile.tier).toBe('standard');
      expect(profile.user.email).toBe('kwame@example.com');
    });

    it('should verify testConnection using agent profile probe', async () => {
      vi.spyOn(mockClient, 'getAgentProfile').mockResolvedValueOnce({
        id: '9b2e',
        publicId: 'agt_01J8',
        businessName: 'ByteBeacon Partner',
        businessPhone: '+233241234567',
        address: 'Accra',
        tier: 'vip',
        status: 'approved',
        pricePerGb: '4.00',
        apiAccessStatus: 'paid',
        userId: 'user_1',
        user: { id: 'u1', name: 'Admin', email: 'admin@bytebeacon.com', phone: '0241234567' },
        createdAt: '2026-01-01T00:00:00.000Z',
      });

      const res = await adapter.testConnection('PRODUCTION');

      expect(res.result).toBe('PASSED');
      expect(res.steps).toHaveLength(5);
      expect(res.steps[3].name).toBe('Authentication');
      expect(res.steps[3].status).toBe('PASSED');
    });
  });

  describe('Single Order Submission (POST /agent/orders)', () => {
    it('should submit a single order to DataHouse and map response fields', async () => {
      vi.spyOn(mockClient, 'submitOrder').mockResolvedValueOnce({
        id: '9c1f-internal',
        publicId: 'ord_01J8ABCXYZ',
        referenceCode: 'TXN-7GH2K9',
        idempotencyKey: 'b71b5b4a-2a8a-4b56-91a4-2e3f9a0a0c4f',
        amount: '21.00',
        network: 'MTN',
        status: 'received',
        createdAt: '2026-07-07T12:00:00.000Z',
      });

      const result = await adapter.submitOrder({
        orderId: 'ord_internal_1',
        clientReference: 'ref_1',
        network: NetworkProvider.MTN,
        recipientPhone: '0241234567',
        dataAmountMb: 5120,
        idempotencyKey: 'b71b5b4a-2a8a-4b56-91a4-2e3f9a0a0c4f',
        metadata: { bundleId: '550e8400-e29b-41d4-a716-446655440000', email: 'cust@example.com' },
      });

      expect(result.providerOrderId).toBe('ord_01J8ABCXYZ');
      expect(result.providerReference).toBe('TXN-7GH2K9');
      expect(result.providerStatus).toBe(ProviderStatus.RECEIVED);
      expect(result.acceptedAt).toBe('2026-07-07T12:00:00.000Z');
    });

    it('should test sandbox transaction and simulate failure for phone ending in 0000', async () => {
      const failRes = await adapter.testSandbox({
        network: NetworkProvider.MTN,
        recipientPhone: '0240000000',
        dataAmountMb: 1024,
      });

      expect(failRes.result).toBe('FAILED');
      expect(failRes.responsePayload?.status).toBe('fulfillment_failed');
      expect(failRes.providerReference).toMatch(/^SBX-/);

      const passRes = await adapter.testSandbox({
        network: NetworkProvider.MTN,
        recipientPhone: '0241234567',
        dataAmountMb: 1024,
      });

      expect(passRes.result).toBe('PASSED');
      expect(passRes.responsePayload?.status).toBe('fulfilled');
      expect(passRes.providerReference).toMatch(/^SBX-/);
    });
  });

  describe('Bulk Order Submission (POST /agent/orders/bulk)', () => {
    it('should submit bulk orders, map child orders and handle blocked unvalidated numbers', async () => {
      vi.spyOn(mockClient, 'submitBulkOrder').mockResolvedValueOnce({
        id: 'sub_01J8SUBMIT999',
        referenceCode: 'BLK-7GH2K9ABCDEF',
        network: 'MTN',
        amount: '48.00',
        status: 'received',
        createdAt: '2026-07-07T12:00:00.000Z',
        beneficiaryCount: 2,
        groupCount: 2,
        orders: [
          {
            id: 'ord_a1',
            publicId: 'ord_a1',
            referenceCode: 'TXN-AAA111',
            sizeGb: 2,
            beneficiaryCount: 1,
            amount: '8.40',
            status: 'received',
          },
          {
            id: 'ord_b2',
            publicId: 'ord_b2',
            referenceCode: 'TXN-BBB222',
            sizeGb: 5,
            beneficiaryCount: 1,
            amount: '21.00',
            status: 'received',
          },
        ],
        blocked: ['0559990000'],
      });

      const result = await adapter.submitBulkOrder({
        network: NetworkProvider.MTN,
        recipients: [
          { phoneNumber: '0201234567', dataSizeGb: 5 },
          { phoneNumber: '0241112222', dataSizeGb: 2 },
          { phoneNumber: '0559990000', dataSizeGb: 5 },
        ],
        idempotencyKey: '7f4c9a10-3b2e-4d5f-8a1b-2c3d4e5f6a7b',
        confirmedPorted: ['0201234567'],
        onUnvalidated: 'set_aside',
      });

      expect(result.providerOrderId).toBe('sub_01J8SUBMIT999');
      expect(result.providerReference).toBe('BLK-7GH2K9ABCDEF');
      expect(result.totalRecipients).toBe(2);
      expect(result.groupCount).toBe(2);
      expect(result.orders).toHaveLength(2);
      expect(result.orders?.[0].referenceCode).toBe('TXN-AAA111');
      expect(result.blocked).toEqual(['0559990000']);
      expect(result.providerStatus).toBe(ProviderStatus.RECEIVED);
    });
  });

  describe('Beneficiary Precheck & MTN Up2U Validation', () => {
    it('should perform keyed batch precheck with summary and recording', async () => {
      vi.spyOn(mockClient, 'precheckBeneficiaries').mockResolvedValueOnce({
        network: 'MTN',
        enforced: true,
        sandbox: false,
        recorded: true,
        summary: {
          requested: 3,
          unique: 2,
          valid: 2,
          invalid: 0,
          known: 1,
          unknown: 1,
        },
        unknown: ['0209990000'],
        results: [
          { phone: '0241234567', normalized: '0241234567', valid: true, isKnown: true, known: true },
          { phone: '0209990000', normalized: '0209990000', valid: true, isKnown: false, known: false },
        ],
      });

      const res = await adapter.precheckBeneficiaries({
        network: NetworkProvider.MTN,
        phoneNumbers: ['0241234567', '0209990000', '0209990000'],
        record: true,
      });

      expect(res.enforced).toBe(true);
      expect(res.recorded).toBe(true);
      expect(res.summary.requested).toBe(3);
      expect(res.summary.unique).toBe(2);
      expect(res.unknown).toEqual(['0209990000']);
      expect(res.results[0].isKnown).toBe(true);
      expect(res.results[1].isKnown).toBe(false);
    });

    it('should perform public precheck without API key', async () => {
      vi.spyOn(mockClient, 'precheckPublicBeneficiaries').mockResolvedValueOnce({
        network: 'MTN',
        results: [
          { phone: '0241234567', normalized: '0241234567', valid: true, known: true, isKnown: true },
          { phone: '0209990000', normalized: '0209990000', valid: true, known: false, isKnown: false },
        ],
      });

      const res = await adapter.precheckPublicBeneficiaries({
        network: NetworkProvider.MTN,
        phoneNumbers: ['0241234567', '0209990000'],
      });

      expect(res.results).toHaveLength(2);
      expect(res.results[0].isKnown).toBe(true);
    });

    it('should list MTN beneficiary approval status list', async () => {
      vi.spyOn(mockClient, 'listBeneficiaries').mockResolvedValueOnce({
        data: {
          data: [
            {
              msisdn: '0248336067',
              network: 'MTN',
              status: 'pending',
              attemptCount: 3,
              lastBundleSizeGb: '5',
              firstDetectedAt: '2026-08-10T09:15:00.000Z',
              lastDetectedAt: '2026-08-11T11:02:00.000Z',
              submittedAt: null,
              resolvedAt: null,
            },
          ],
          meta: { page: 1, limit: 30, total: 128 },
        } as any,
      });

      const list = await adapter.listBeneficiaries({ status: 'pending', network: 'MTN' });

      expect(list.items).toHaveLength(1);
      expect(list.items[0].msisdn).toBe('0248336067');
      expect(list.items[0].status).toBe('pending');
      expect(list.total).toBe(128);
    });
  });

  describe('Orders Listing & Lookup (GET /agent/orders & GET /agent/orders/:id)', () => {
    it('should list orders with delivery tallies', async () => {
      vi.spyOn(mockClient, 'listOrders').mockResolvedValueOnce({
        data: [
          {
            id: 'ord_01J8ABC',
            referenceCode: 'TXN-7GH2K9',
            network: 'MTN',
            status: 'approved',
            paymentStatus: 'paid',
            amount: '21.00',
            groupSizeGb: 5,
            delivery: { approved: 1, pending: 0, failed: 0, total: 1 },
            beneficiaries: [],
          },
        ],
        meta: { page: 1, limit: 30, total: 1, totalPages: 1 },
      });

      const list = await adapter.listOrders({ network: 'MTN' });

      expect(list.orders).toHaveLength(1);
      expect(list.orders[0].referenceCode).toBe('TXN-7GH2K9');
      expect(list.orders[0].delivery.approved).toBe(1);
    });

    it('should get full order details including beneficiaries and paymentSplit', async () => {
      vi.spyOn(mockClient, 'getOrderStatus').mockResolvedValueOnce({
        id: 'ord_01J8ABC',
        publicId: 'ord_01J8ABC',
        referenceCode: 'TXN-7GH2K9',
        network: 'MTN',
        status: 'approved',
        paymentStatus: 'paid',
        amount: '21.00',
        groupSizeGb: 5,
        paymentSplit: { fromMain: 15.0, fromOverdraft: 6.0 },
        delivery: { approved: 1, pending: 0, failed: 0, total: 1 },
        beneficiaries: [
          {
            id: 'ben_1',
            phoneNumber: '0241234567',
            dataVolumeGb: '5.00',
            amount: '21.00',
            network: 'MTN',
            status: 'approved',
            isPorted: false,
          },
        ],
      });

      const details = await adapter.getOrderDetails('ord_01J8ABC');

      expect(details.id).toBe('ord_01J8ABC');
      expect(details.paymentSplit).toEqual({ fromMain: 15.0, fromOverdraft: 6.0 });
      expect(details.beneficiaries).toHaveLength(1);
      expect(details.beneficiaries[0].phoneNumber).toBe('0241234567');
    });
  });

  describe('Wallet Balances & Ledger (GET /agent/wallet/*)', () => {
    it('should fetch wallet balance with overdraft parameters', async () => {
      vi.spyOn(mockClient, 'getWalletBalance').mockResolvedValueOnce({
        balance: 1540.75,
        currency: 'GHS',
        overdraftLimit: 500,
        overdraftUsed: 0,
        overdraftAvailable: 500,
        overdraftActive: true,
        availableToSpend: 2040.75,
      });

      const wallet = await adapter.getWalletBalance();

      expect(wallet.balancePesewas).toBe(154075);
      expect(wallet.availableToSpendPesewas).toBe(204075);
      expect(wallet.overdraftLimitPesewas).toBe(50000);
      expect(wallet.overdraftActive).toBe(true);
    });

    it('should fetch wallet ledger with balanceBefore and source split', async () => {
      vi.spyOn(mockClient, 'getWalletLedger').mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'le_01J8',
              walletId: 'w_01J',
              direction: 'debit',
              amount: '21.00',
              balanceAfter: '1540.75',
              balanceBefore: '1561.75',
              category: 'purchase',
              referenceType: 'Order',
              referenceId: 'ord_01',
              description: 'Agent purchase of bundle',
              source: 'main_balance',
              createdAt: '2026-07-07T12:00:00.000Z',
            },
          ],
          meta: { page: 1, limit: 50, total: 231 },
        } as any,
      });

      const ledger = await adapter.getWalletLedger();

      expect(ledger.entries).toHaveLength(1);
      expect(ledger.entries[0].direction).toBe('debit');
      expect(ledger.entries[0].source).toBe('main_balance');
      expect(ledger.entries[0].balanceBeforePesewas).toBe(156175);
      expect(ledger.entries[0].balanceAfterPesewas).toBe(154075);
      expect(ledger.total).toBe(231);
    });
  });

  describe('Webhook Subscriptions CRUD', () => {
    it('should create, list, rotate, and delete webhook subscriptions', async () => {
      vi.spyOn(mockClient, 'createWebhookSubscription').mockResolvedValueOnce({
        id: 'whs_01J8',
        agentId: '9b2e',
        url: 'https://reseller.example.com/webhooks/telecom',
        events: ['order.approved', 'wallet.updated'],
        isActive: true,
        createdAt: '2026-07-07T12:00:00.000Z',
        signingSecret: 'whsec_Ab3xY_secret',
      });

      const created = await adapter.createWebhookSubscription({
        url: 'https://reseller.example.com/webhooks/telecom',
        events: ['order.approved', 'wallet.updated'],
      });

      expect(created.id).toBe('whs_01J8');
      expect(created.signingSecret).toBe('whsec_Ab3xY_secret');

      vi.spyOn(mockClient, 'listWebhookSubscriptions').mockResolvedValueOnce([
        {
          id: 'whs_01J8',
          agentId: '9b2e',
          url: 'https://reseller.example.com/webhooks/telecom',
          events: ['order.approved', 'wallet.updated'],
          isActive: true,
          createdAt: '2026-07-07T12:00:00.000Z',
        },
      ]);

      const list = await adapter.listWebhookSubscriptions();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('whs_01J8');

      vi.spyOn(mockClient, 'rotateWebhookSecret').mockResolvedValueOnce({
        id: 'whs_01J8',
        url: 'https://reseller.example.com/webhooks/telecom',
        events: ['order.approved', 'wallet.updated'],
        isActive: true,
        createdAt: '2026-07-07T12:00:00.000Z',
        signingSecret: 'whsec_NEW_SECRET',
      });

      const rotated = await adapter.rotateWebhookSecret('whs_01J8');
      expect(rotated.signingSecret).toBe('whsec_NEW_SECRET');

      const delSpy = vi.spyOn(mockClient, 'deleteWebhookSubscription').mockResolvedValueOnce();
      await adapter.deleteWebhookSubscription('whs_01J8');
      expect(delSpy).toHaveBeenCalledWith('whs_01J8', expect.any(String));
    });
  });

  describe('Error Mapping & Exception Translation', () => {
    it('should map specific error codes from DataHouse gateway', () => {
      const errorMappings: Array<{ code: string; status: number; expectedErr: any }> = [
        { code: 'INSUFFICIENT_BALANCE', status: 400, expectedErr: DataHouseInsufficientBalanceError },
        { code: 'BUNDLE_INACTIVE', status: 400, expectedErr: DataHouseBundleInactiveError },
        { code: 'BULK_NOT_ON_SANDBOX', status: 400, expectedErr: DataHouseBulkNotOnSandboxError },
        { code: 'AGENT_INACTIVE', status: 403, expectedErr: DataHouseAgentInactiveError },
        { code: 'BUNDLE_NOT_FOUND', status: 404, expectedErr: DataHouseBundleNotFoundError },
        { code: 'INVALID_PHONE', status: 422, expectedErr: DataHouseInvalidPhoneError },
        { code: 'BENEFICIARY_NOT_VALIDATED', status: 422, expectedErr: DataHouseBeneficiaryNotValidatedError },
        { code: 'RATE_LIMITED', status: 429, expectedErr: DataHouseRateLimitError },
      ];

      for (const item of errorMappings) {
        expect(() => {
          (mockClient as any).handleErrorResponse(item.status, {
            error: { code: item.code, message: `Test ${item.code} message` },
          });
        }).toThrow(item.expectedErr);
      }
    });
  });

  describe('HMAC Webhook Signature Verification (X-Telecom-Signature)', () => {
    it('should verify authentic DataHouse signature correctly', () => {
      const payload = JSON.stringify({
        id: 'ord_01J8',
        type: 'order.approved',
        created_at: '2026-07-07T12:05:00.000Z',
        data: { order_id: 'ord_01J8', reference: 'TXN-7GH2K9', status: 'approved' },
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
      const payload = JSON.stringify({ id: 'evt_123', data: { status: 'approved' } });
      const header = `t=${Math.floor(Date.now() / 1000)},v1=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`;

      const isValid = adapter.verifyWebhookSignature(payload, header);
      expect(isValid).toBe(false);
    });

    it('should reject expired signature older than 5 minutes', () => {
      const payload = JSON.stringify({ id: 'evt_123', data: { status: 'approved' } });
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

  describe('Key Prefixes & Live API Access Paywall', () => {
    it('should identify ak_live_ vs ak_test_ key prefixes', () => {
      const liveClient = new DataHouseClient({
        baseUrl: 'https://api.getmorepaylessdatahouse.net/api/v1',
        apiKey: 'ak_live_abcdef1234567890',
      });
      const sandboxClient = new DataHouseClient({
        baseUrl: 'https://api.getmorepaylessdatahouse.net/api/v1',
        apiKey: 'ak_test_abcdef1234567890',
      });

      expect(liveClient.isLive()).toBe(true);
      expect(liveClient.isSandbox()).toBe(false);

      expect(sandboxClient.isLive()).toBe(false);
      expect(sandboxClient.isSandbox()).toBe(true);
    });

    it('should query live API access fee status via JWT', async () => {
      vi.spyOn(mockClient, 'getApiAccessStatus').mockResolvedValueOnce({
        access_granted: true,
        paid_at: '2026-06-01T10:00:00.000Z',
        fee_required: false,
        fee_amount: null,
        fee_label: 'Live API access',
        fee_description: null,
      });

      const status = await adapter.getApiAccessStatus('mock_jwt_token_agent_123');

      expect(status.access_granted).toBe(true);
      expect(status.fee_required).toBe(false);
      expect(status.paid_at).toBe('2026-06-01T10:00:00.000Z');
    });

    it('should initiate live API access payment when fee is unpaid', async () => {
      vi.spyOn(mockClient, 'initiateApiAccessPayment').mockResolvedValueOnce({
        access_granted: false,
        authorizationUrl: 'https://checkout.paystack.com/access_fee_xyz',
        reference: 'DH-ACC-12345',
      });

      const payment = await adapter.initiateApiAccessPayment('mock_jwt_token_agent_123');

      expect(payment.access_granted).toBe(false);
      expect(payment.authorizationUrl).toBe('https://checkout.paystack.com/access_fee_xyz');
    });
  });
});

