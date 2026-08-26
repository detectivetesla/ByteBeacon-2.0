import { describe, it, expect, vi, beforeEach } from 'vitest';
import { catalogApi } from '../api/catalog.api.js';
import { adminApi } from '../api/admin.api.js';
import { apiClient } from '../api/httpClient.js';
import { NetworkProvider, CatalogProductDto } from '@bytebeacon/shared';

// Mock apiClient
vi.mock('../api/httpClient.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('Frontend Custom Pricing Reflection & Cache Invalidation Suite', () => {
  const mockBundles: CatalogProductDto[] = [
    {
      id: 'prod-mtn-1gb',
      sku: 'BB-MTN-1GB',
      network: NetworkProvider.MTN,
      name: 'MTN 1GB Data Bundle',
      dataAmountMb: 1024,
      validityDays: 30,
      validityDesc: '30 Days',
      basePricePesewas: 500, // Standard retail GH₵ 5.00
      agentPricePesewas: 450, // Standard agent GH₵ 4.50
      customPricePesewas: 420, // Custom override GH₵ 4.20
      effectivePricePesewas: 420,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    catalogApi.clearCache();
    localStorage.clear();
  });

  it('1. Fetches bundles with user context and reflects effective price', async () => {
    (apiClient.get as any).mockResolvedValue(mockBundles);
    localStorage.setItem('bytebeacon_auth_user', JSON.stringify({ id: 'usr-customer-123' }));

    const bundles = await catalogApi.getBundles(NetworkProvider.MTN, 'CUSTOMER');

    expect(apiClient.get).toHaveBeenCalledWith('/catalog/bundles', {
      params: {
        network: NetworkProvider.MTN,
        channel: 'CUSTOMER',
        userId: 'usr-customer-123',
      },
    });

    expect(bundles).toHaveLength(1);
    expect(bundles[0].effectivePricePesewas).toBe(420);
    expect(bundles[0].customPricePesewas).toBe(420);
  });

  it('2. Invalidates cache when admin updates user pricing', async () => {
    (apiClient.get as any).mockResolvedValue(mockBundles);
    (apiClient.put as any).mockResolvedValue({ success: true });

    // Initial fetch to populate cache
    await catalogApi.getBundles(NetworkProvider.MTN, 'CUSTOMER');
    expect(apiClient.get).toHaveBeenCalledTimes(1);

    // Subsequent fetch without forceRefresh hits cache
    await catalogApi.getBundles(NetworkProvider.MTN, 'CUSTOMER');
    expect(apiClient.get).toHaveBeenCalledTimes(1);

    // Admin updates user pricing
    await adminApi.updateUserPricing('usr-customer-123', {
      pricing: [{ productId: 'prod-mtn-1gb', customPricePesewas: 380 }],
    });

    // Next fetch must bypass old cache and hit API again
    await catalogApi.getBundles(NetworkProvider.MTN, 'CUSTOMER');
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('3. Invalidates cache when admin updates agent wholesale custom pricing', async () => {
    (apiClient.get as any).mockResolvedValue(mockBundles);
    (apiClient.put as any).mockResolvedValue({ success: true });

    // Initial fetch to populate cache
    await catalogApi.getBundles(NetworkProvider.MTN, 'AGENT');
    expect(apiClient.get).toHaveBeenCalledTimes(1);

    // Admin updates agent pricing
    await adminApi.updateAgentCustomPricing('agt-agent-123', {
      pricing: [{ productId: 'prod-mtn-1gb', customPricePesewas: 390 }],
    });

    // Next fetch must make a fresh request
    await catalogApi.getBundles(NetworkProvider.MTN, 'AGENT');
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });
});
