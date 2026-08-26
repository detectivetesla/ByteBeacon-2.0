import { apiClient } from './httpClient.js';
import { CatalogProductDto, NetworkProvider } from '@bytebeacon/shared';

const BUNDLE_CACHE_TTL_MS = 30 * 1000; // 30 seconds in-memory cache for fast synchronization

interface CacheEntry {
  data: CatalogProductDto[];
  timestamp: number;
}

const catalogCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<CatalogProductDto[]>>();

function getCurrentUserId(): string | undefined {
  try {
    const stored = localStorage.getItem('bytebeacon_auth_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.id || parsed.sub || undefined;
    }
  } catch {}
  return undefined;
}

function getCacheKey(channel: string, network?: string, userId?: string): string {
  const uid = userId || getCurrentUserId() || 'anon';
  return `${uid}:${channel}:${network || 'ALL'}`;
}

export const catalogApi = {
  getBundles: async (
    network?: NetworkProvider,
    channel: 'CUSTOMER' | 'AGENT' | 'STORE' | 'API' = 'CUSTOMER',
    options: { forceRefresh?: boolean; userId?: string } = {},
  ): Promise<CatalogProductDto[]> => {
    const activeUserId = options.userId || getCurrentUserId();
    const key = getCacheKey(channel, network, activeUserId);
    const allKey = getCacheKey(channel, undefined, activeUserId);
    const now = Date.now();

    // 1. Check if specific network can be served from ALL-bundles cache
    if (!options.forceRefresh && network && network !== ('ALL' as any)) {
      const allCached = catalogCache.get(allKey);
      if (allCached && now - allCached.timestamp < BUNDLE_CACHE_TTL_MS) {
        return allCached.data.filter((p) => p.network === network);
      }
    }

    // 2. Check direct cache key
    if (!options.forceRefresh) {
      const cached = catalogCache.get(key);
      if (cached && now - cached.timestamp < BUNDLE_CACHE_TTL_MS) {
        return cached.data;
      }
    }

    // 3. Deduplicate simultaneous in-flight network requests
    if (inFlightRequests.has(key)) {
      return inFlightRequests.get(key)!;
    }

    const fetchPromise = apiClient
      .get<CatalogProductDto[]>('/catalog/bundles', {
        params: {
          network: network && network !== ('ALL' as any) ? network : undefined,
          channel,
          userId: activeUserId,
        },
      })
      .then((items) => {
        const productList = Array.isArray(items) ? items : [];
        catalogCache.set(key, { data: productList, timestamp: Date.now() });

        // If we fetched ALL networks, also seed the individual network caches for instant lookup
        if (!network || network === ('ALL' as any)) {
          const networks = [NetworkProvider.MTN, NetworkProvider.TELECEL, NetworkProvider.AIRTELTIGO];
          networks.forEach((net) => {
            const netKey = getCacheKey(channel, net, activeUserId);
            const netItems = productList.filter((p) => p.network === net);
            catalogCache.set(netKey, { data: netItems, timestamp: Date.now() });
          });
        }

        return productList;
      })
      .finally(() => {
        inFlightRequests.delete(key);
      });

    inFlightRequests.set(key, fetchPromise);
    return fetchPromise;
  },

  getAllBundles: async (
    channel: 'CUSTOMER' | 'AGENT' | 'STORE' | 'API' = 'CUSTOMER',
    options: { forceRefresh?: boolean; userId?: string } = {},
  ): Promise<CatalogProductDto[]> => {
    return catalogApi.getBundles(undefined, channel, options);
  },

  getProduct: async (id: string, options: { userId?: string } = {}): Promise<CatalogProductDto> => {
    const activeUserId = options.userId || getCurrentUserId();
    return apiClient.get<CatalogProductDto>(`/catalog/bundles/${id}`, {
      params: { userId: activeUserId },
    });
  },

  clearCache: () => {
    catalogCache.clear();
    inFlightRequests.clear();
  },
};

// Listen to custom cache clearance event if in browser
if (typeof window !== 'undefined') {
  window.addEventListener('catalog:clearcache', () => {
    catalogApi.clearCache();
  });
}

