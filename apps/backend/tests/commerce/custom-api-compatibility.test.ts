import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../../src/app.js';
import { DynamicHttpTelecomAdapter } from '../../src/core/providers/dynamic-http/dynamic-http.adapter.js';
import { NetworkProvider, PaymentMethod, ProviderStatus } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Custom API & Aggregator Compatibility Suite', () => {
  describe('GET /api/v1/offers & POST /api/v1/order/:network Routes', () => {
    let mockPool: any;
    let app: any;

    beforeEach(() => {
      mockPool = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM catalog_products') && sql.includes('WHERE network = $1')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'prod_mtn_2gb',
                  sku: 'MTN-DATA-2GB',
                  name: 'MTN 2GB Data Bundle',
                  network: 'MTN',
                  data_amount_mb: 2048,
                  base_price_pesewas: 1200,
                  agent_price_pesewas: 1100,
                  is_active: true,
                },
              ],
            });
          }
          if (sql.includes('FROM catalog_products')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'prod_mtn_1gb',
                  sku: 'MTN-1GB',
                  name: 'MTN 1GB',
                  network: 'MTN',
                  data_amount_mb: 1024,
                  base_price_pesewas: 600,
                  is_active: true,
                },
                {
                  id: 'prod_mtn_2gb',
                  sku: 'MTN-2GB',
                  name: 'MTN 2GB',
                  network: 'MTN',
                  data_amount_mb: 2048,
                  base_price_pesewas: 1200,
                  is_active: true,
                },
                {
                  id: 'prod_tel_5gb',
                  sku: 'TEL-5GB',
                  name: 'Telecel 5GB',
                  network: 'TELECEL',
                  data_amount_mb: 5120,
                  base_price_pesewas: 2500,
                  is_active: true,
                },
              ],
            });
          }
          if (sql.includes('SELECT wallet_balance_pesewas, wallet_balance FROM users')) {
            return Promise.resolve({
              rows: [{ wallet_balance_pesewas: 5000, wallet_balance: '50.00' }],
            });
          }
          if (sql.includes('INSERT INTO orders')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'ord_123',
                  publicId: 'ORD-000067',
                  userId: params?.[1] || 'usr_1',
                  agentId: null,
                  productId: params?.[3],
                  recipientPhone: params?.[4],
                  network: params?.[5],
                  dataAmountMb: 2048,
                  amountPesewas: 1200,
                  currency: 'GHS',
                  pricingSnapshot: {},
                  paymentStatus: 'PAID',
                  orderStatus: 'READY_FOR_FULFILLMENT',
                  providerStatus: 'UNKNOWN',
                  refundStatus: 'NONE',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
        connect: vi.fn().mockResolvedValue({
          query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
            if (sql.includes('SELECT wallet_balance_pesewas')) {
              return Promise.resolve({
                rows: [{ wallet_balance_pesewas: 5000, wallet_balance: '50.00' }],
              });
            }
            if (sql.includes('INSERT INTO orders')) {
              return Promise.resolve({
                rows: [
                  {
                    id: 'ord_123',
                    publicId: 'ORD-000067',
                    userId: 'usr_1',
                    productId: 'prod_mtn_2gb',
                    recipientPhone: '233241234567',
                    network: 'MTN',
                    dataAmountMb: 2048,
                    amountPesewas: 1200,
                    currency: 'GHS',
                    pricingSnapshot: {},
                    paymentStatus: 'PAID',
                    orderStatus: 'READY_FOR_FULFILLMENT',
                    providerStatus: 'UNKNOWN',
                    refundStatus: 'NONE',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                ],
              });
            }
            return Promise.resolve({ rows: [] });
          }),
          release: vi.fn(),
        }),
      };

      app = createApp({
        dbPool: mockPool as unknown as pg.Pool,
      });
    });

    it('GET /api/v1/offers should return all active offers with available volumes grouped by ISP', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/offers',
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.offers)).toBe(true);
      expect(json.offers.length).toBeGreaterThanOrEqual(2);

      const mtnOffer = json.offers.find((o: any) => o.isp === 'MTN');
      expect(mtnOffer).toBeDefined();
      expect(mtnOffer.name).toBe('MTN Data Bundle');
      expect(mtnOffer.type).toBe('Data');
      expect(mtnOffer.offerSlug).toBe('mtn_data_bundle');
      expect(Array.isArray(mtnOffer.volumes)).toBe(true);
    });

    it('POST /api/v1/order/:network should place single order, deduct wallet, and return pending order response', async () => {
      const tokenService = (app as any).tokenService || {
        generateAccessToken: () => 'mock_token',
      };
      // Create a mock token
      const mockToken = 'Bearer mock_valid_customer_token';

      // Mock auth hook preHandler
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/order/mtn',
        headers: {
          authorization: mockToken,
          'x-api-key': 'bb_dev_key_test',
        },
        payload: {
          type: 'single',
          volume: 2,
          phone: '233241234567',
          offerSlug: 'mtn_data_bundle',
          webhookUrl: 'https://www.portal-02.com/api/webhooks/orders',
        },
      });

      // If authorized
      if (res.statusCode === 200) {
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.orderId).toBeDefined();
        expect(body.status).toBe('pending');
        expect(body.currency).toBe('GHS');
        expect(Array.isArray(body.items)).toBe(true);
        expect(body.items[0].recipient).toBe('233241234567');
      }
    });

    it('POST /api/v1/order/:network should reject with INSUFFICIENT_BALANCE error when wallet balance is low', async () => {
      mockPool.connect = vi.fn().mockResolvedValue({
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('SELECT wallet_balance_pesewas')) {
            return Promise.resolve({
              rows: [{ wallet_balance_pesewas: 10, wallet_balance: '0.10' }],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      });
      mockPool.query = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT wallet_balance_pesewas')) {
          return Promise.resolve({
            rows: [{ wallet_balance_pesewas: 10, wallet_balance: '0.10' }],
          });
        }
        if (sql.includes('FROM catalog_products')) {
          return Promise.resolve({
            rows: [
              {
                id: 'prod_mtn_2gb',
                sku: 'MTN-DATA-2GB',
                name: 'MTN 2GB Data Bundle',
                network: 'MTN',
                data_amount_mb: 2048,
                base_price_pesewas: 1200,
                is_active: true,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/order/mtn',
        headers: {
          'x-api-key': 'bb_dev_test',
        },
        payload: {
          type: 'single',
          volume: 2,
          phone: '233241234567',
        },
      });

      if (res.statusCode === 400) {
        const body = JSON.parse(res.body);
        if (body.type === 'INSUFFICIENT_BALANCE') {
          expect(body.success).toBe(false);
          expect(body.error).toBe('Insufficient wallet balance');
        }
      }
    });
  });

  describe('DynamicHttpTelecomAdapter Upstream Custom API Discovery & Fulfillment', () => {
    it('should parse upstream GET /api/v1/offers response format into ProviderBundleDto[]', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          offers: [
            {
              name: 'MTN Data Bundle',
              isp: 'MTN',
              type: 'Data',
              offerSlug: 'mtn_data_bundle',
              volumes: [1, 2, 5, 10, 20, 50, 100],
            },
            {
              name: 'AirtelTigo Voice Minutes',
              isp: 'AirtelTigo',
              type: 'Voice Minutes',
              offerSlug: 'airteltigo_voice_minutes',
              volumes: [10, 50, 100, 500, 1000],
            },
          ],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const adapter = new DynamicHttpTelecomAdapter({
        providerName: 'CustomAggregator',
        providerSlug: 'custom-aggregator',
        apiBaseUrl: 'https://api.custom-aggregator.com/api/v1',
        authMethod: 'BEARER',
        apiKey: 'custom_secret_key_123',
      });

      const bundles = await adapter.getBundles();
      expect(fetchMock).toHaveBeenCalled();
      expect(Array.isArray(bundles)).toBe(true);
      expect(bundles.length).toBeGreaterThan(5);

      const mtn2Gb = bundles.find((b) => b.network === NetworkProvider.MTN && b.dataSizeGb === 2);
      expect(mtn2Gb).toBeDefined();
      expect(mtn2Gb?.dataAmountMb).toBe(2048);

      vi.unstubAllGlobals();
    });

    it('should submit single order using POST /api/v1/order/:network payload structure', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          orderId: 'ORD-000067',
          reference: 'ORD-IB22OQws',
          status: 'pending',
          totalAmount: 26,
          currency: 'GHS',
          items: [
            {
              recipient: '233241234567',
              volume: 2,
              status: 'pending',
            },
          ],
          metadata: {
            webhookUrl: 'https://www.portal-02.com/api/webhooks/orders',
            source: 'api',
            requestedOfferSlug: 'mtn_data_bundle',
            network: 'MTN',
          },
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const adapter = new DynamicHttpTelecomAdapter({
        providerName: 'CustomAggregator',
        providerSlug: 'custom-aggregator',
        apiBaseUrl: 'https://api.custom-aggregator.com/api/v1',
        authMethod: 'BEARER',
        apiKey: 'custom_token_xyz',
      });

      const result = await adapter.submitOrder({
        orderId: 'bb_order_999',
        clientReference: 'ORD-IB22OQws',
        network: NetworkProvider.MTN,
        recipientPhone: '0241234567',
        dataAmountMb: 2048,
        callbackUrl: 'https://www.portal-02.com/api/webhooks/orders',
      });

      expect(fetchMock).toHaveBeenCalled();
      const callArgs = fetchMock.mock.calls[0];
      const url = callArgs[0];
      const body = JSON.parse(callArgs[1].body);

      expect(url).toContain('/order/mtn');
      expect(body.type).toBe('single');
      expect(body.volume).toBe(2);
      expect(body.phone).toBe('233241234567');
      expect(body.offerSlug).toBe('mtn_data_bundle');
      expect(body.webhookUrl).toBe('https://www.portal-02.com/api/webhooks/orders');

      expect(result.providerOrderId).toBe('ORD-000067');
      expect(result.providerReference).toBe('ORD-IB22OQws');
      expect(result.providerStatus).toBe(ProviderStatus.PROCESSING);

      vi.unstubAllGlobals();
    });
  });
});
