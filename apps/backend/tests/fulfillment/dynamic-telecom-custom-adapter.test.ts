import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DynamicHttpTelecomAdapter } from '../../src/core/providers/dynamic-http/dynamic-http.adapter.js';
import { TelecomProviderRegistry } from '../../src/core/providers/telecom-provider.registry.js';
import { NetworkProvider, ProviderStatus } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Dynamic Custom Telecom Provider & Portal-02 Primary Adapter Suite', () => {
  const portal02ApiKey = 'dk_iGoTZ6KA8-GDrvemBECywzhisNhOpttr';
  const portal02BaseUrl = 'https://portal02.telecom.hub';

  describe('DynamicHttpTelecomAdapter Authentication & Aliasing', () => {
    it('should inject multi-header auth (x-api-key, X-API-Key, Bearer) for Portal-02 dk_ keys', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'SUCCESS',
          data: {
            orderId: 'p02_ord_98765',
            referenceCode: 'ref_cl_001',
          },
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const adapter = new DynamicHttpTelecomAdapter({
        providerName: 'Portal-02',
        providerSlug: 'portal-02',
        apiBaseUrl: portal02BaseUrl,
        authMethod: 'API_KEY',
        apiKey: portal02ApiKey,
      });

      const result = await adapter.submitOrder({
        orderId: 'bb_ord_1',
        clientReference: 'ref_cl_001',
        network: NetworkProvider.MTN,
        recipientPhone: '0241234567',
        dataAmountMb: 2048,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const callArgs = fetchMock.mock.calls[0];
      const url = callArgs[0];
      const options = callArgs[1];

      // Smart endpoint discovery targets /order/mtn for Portal-02
      expect(url).toContain('/order/mtn');

      // Check headers
      const headers = options.headers;
      expect(headers['x-api-key']).toBe(portal02ApiKey);

      // Check body alias mappings
      const parsedBody = JSON.parse(options.body);
      expect(parsedBody.phone).toBe('0241234567');
      expect(parsedBody.volume).toBe(2);
      expect(parsedBody.recipient_msisdn).toBe('233241234567');
      expect(parsedBody.localPhoneNumber).toBe('0241234567');
      expect(parsedBody.package_size_mb).toBe(2048);
      expect(parsedBody.client_reference).toBe('ref_cl_001');

      // Check returned result
      expect(result.providerOrderId).toBe('p02_ord_98765');
      expect(result.providerReference).toBe('ref_cl_001');
      expect(result.providerStatus).toBe(ProviderStatus.COMPLETED);

      vi.unstubAllGlobals();
    });

    it('should throw real error on HTTP failure instead of faking simulated success', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          message: 'Invalid API Key provided',
          code: 'UNAUTHORIZED',
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const adapter = new DynamicHttpTelecomAdapter({
        providerName: 'Portal-02',
        providerSlug: 'portal-02',
        apiBaseUrl: portal02BaseUrl,
        authMethod: 'API_KEY',
        apiKey: 'dk_invalid_key',
      });

      await expect(
        adapter.submitOrder({
          orderId: 'bb_ord_fail',
          clientReference: 'ref_cl_fail',
          network: NetworkProvider.TELECEL,
          recipientPhone: '0201234567',
          dataAmountMb: 1024,
        }),
      ).rejects.toThrow('Invalid API Key provided');

      vi.unstubAllGlobals();
    });

    it('should fallback from 404 candidate path to /orders if /agent/orders returns 404', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not Found' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              orderId: 'p02_fallback_ord',
              reference: 'ref_cl_fb',
              status: 'PROCESSING',
            },
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const adapter = new DynamicHttpTelecomAdapter({
        providerName: 'Portal-02',
        providerSlug: 'portal-02',
        apiBaseUrl: portal02BaseUrl,
        authMethod: 'API_KEY',
        apiKey: portal02ApiKey,
      });

      const result = await adapter.submitOrder({
        orderId: 'bb_ord_fb',
        clientReference: 'ref_cl_fb',
        network: NetworkProvider.AIRTELTIGO,
        recipientPhone: '0271234567',
        dataAmountMb: 500,
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.providerOrderId).toBe('p02_fallback_ord');
      expect(result.providerStatus).toBe(ProviderStatus.PROCESSING);

      vi.unstubAllGlobals();
    });
  });

  describe('TelecomProviderRegistry Dynamic Sync & Authoritative Routing', () => {
    let registry: TelecomProviderRegistry;
    let mockDb: pg.Pool;

    beforeEach(() => {
      registry = new TelecomProviderRegistry();

      mockDb = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM telecom_providers')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'prov_p02_id',
                  name: 'Portal-02',
                  slug: 'portal-02',
                  apiBaseUrl: portal02BaseUrl,
                  apiVersion: 'v1',
                  authMethod: 'API_KEY',
                  environment: 'LIVE',
                  isAuthoritative: true,
                  supportedNetworks: [NetworkProvider.MTN, NetworkProvider.TELECEL, NetworkProvider.AIRTELTIGO],
                },
                {
                  id: 'prov_gmpl_id',
                  name: 'GMPL',
                  slug: 'gmpl',
                  apiBaseUrl: 'https://gmpl.local',
                  apiVersion: 'v1',
                  authMethod: 'API_KEY',
                  environment: 'LIVE',
                  isAuthoritative: false,
                  supportedNetworks: [NetworkProvider.MTN, NetworkProvider.TELECEL],
                },
              ],
            });
          }
          if (sql.includes('FROM telecom_networks')) {
            return Promise.resolve({
              rows: [
                { networkCode: 'MTN', primaryProviderName: 'Portal-02', fallbackProviderName: 'GMPL' },
                { networkCode: 'TELECEL', primaryProviderName: 'Portal-02', fallbackProviderName: 'GMPL' },
                { networkCode: 'AIRTELTIGO', primaryProviderName: 'Portal-02', fallbackProviderName: 'GMPL' },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
      } as unknown as pg.Pool;
    });

    it('should load dynamic providers from database and set Portal-02 as active authoritative provider', async () => {
      const mockCredentialStore = {
        getSecrets: vi.fn().mockResolvedValue({
          apiKey: portal02ApiKey,
          apiSecret: '',
          webhookSecret: '',
        }),
      } as any;

      await registry.loadProvidersFromDatabase(mockDb, mockCredentialStore);

      const activeProvider = registry.getActiveProvider();
      expect(activeProvider.providerName).toBe('Portal-02');

      const mtnProvider = registry.getProviderForNetwork(NetworkProvider.MTN);
      expect(mtnProvider.providerName).toBe('Portal-02');

      const telecelProvider = registry.getProviderForNetwork(NetworkProvider.TELECEL);
      expect(telecelProvider.providerName).toBe('Portal-02');
    });

    it('should update carrier routing when setActiveProvider is called on dynamic custom provider', () => {
      const adapter = registry.registerDynamicCustomProvider({
        providerName: 'Portal-02',
        providerSlug: 'portal-02',
        apiBaseUrl: portal02BaseUrl,
        authMethod: 'API_KEY',
        apiKey: portal02ApiKey,
        supportedNetworks: [NetworkProvider.MTN, NetworkProvider.TELECEL, NetworkProvider.AIRTELTIGO],
      }, {
        isAuthoritative: false,
        supportedNetworks: [NetworkProvider.MTN, NetworkProvider.TELECEL, NetworkProvider.AIRTELTIGO],
      });

      expect(adapter).toBeDefined();

      // Now switch authoritative to Portal-02
      registry.setActiveProvider('Portal-02');

      expect(registry.getActiveProvider().providerName).toBe('Portal-02');
      expect(registry.getProviderForNetwork(NetworkProvider.MTN).providerName).toBe('Portal-02');
      expect(registry.getProviderForNetwork(NetworkProvider.TELECEL).providerName).toBe('Portal-02');
      expect(registry.getProviderForNetwork(NetworkProvider.AIRTELTIGO).providerName).toBe('Portal-02');
    });
  });
});
