import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { catalogApi } from '../api/catalog.api.js';
import { apiClient } from '../api/httpClient.js';
import { BundleSelector } from '../components/commerce/BundleSelector.js';
import { NetworkProvider, CatalogProductDto } from '@bytebeacon/shared';

// Mock apiClient
vi.mock('../api/httpClient.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('Landing Page Public Pricing Isolation Suite', () => {
  const mockBundles: CatalogProductDto[] = [
    {
      id: 'prod-mtn-1gb',
      sku: 'BB-MTN-1GB',
      network: NetworkProvider.MTN,
      name: 'MTN 1GB Data Bundle',
      dataAmountMb: 1024,
      validityDays: 30,
      validityDesc: '30 Days',
      basePricePesewas: 600, // Standard retail GH₵ 6.00
      agentPricePesewas: 380, // Wholesale agent GH₵ 3.80
      effectivePricePesewas: 600,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'prod-mtn-5gb',
      sku: 'BB-MTN-5GB',
      network: NetworkProvider.MTN,
      name: 'MTN 5GB Data Bundle',
      dataAmountMb: 5120,
      validityDays: 30,
      validityDesc: '30 Days',
      basePricePesewas: 2800, // Standard retail GH₵ 28.00
      agentPricePesewas: 1900, // Wholesale agent GH₵ 19.00
      effectivePricePesewas: 2800,
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

  it('1. catalogApi.getBundles with isPublic=true never sends userId or auth tokens even when agent is logged in', async () => {
    (apiClient.get as any).mockResolvedValue(mockBundles);
    // Simulate logged in agent in localStorage
    localStorage.setItem(
      'bytebeacon_auth_user',
      JSON.stringify({ id: 'usr-agent-999', role: 'agent' }),
    );
    localStorage.setItem(
      'bytebeacon_auth_tokens',
      JSON.stringify({ accessToken: 'fake-agent-token', refreshToken: 'fake-refresh-token' }),
    );

    const bundles = await catalogApi.getBundles(NetworkProvider.MTN, 'CUSTOMER', { isPublic: true });

    // Must call with skipAuth: true and NO userId in params
    expect(apiClient.get).toHaveBeenCalledWith('/catalog/bundles', {
      skipAuth: true,
      params: {
        network: NetworkProvider.MTN,
        channel: 'CUSTOMER',
        userId: undefined,
        isPublic: 'true',
      },
    });

    expect(bundles).toHaveLength(2);
  });

  it('2. BundleSelector with isPublic=true renders strictly base retail prices (e.g. GH₵ 6.00 and GH₵ 28.00)', async () => {
    (apiClient.get as any).mockResolvedValue(mockBundles);

    render(
      <BundleSelector
        network={NetworkProvider.MTN}
        channel="CUSTOMER"
        isPublic={true}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('GH₵ 6.00')).toBeInTheDocument();
      expect(screen.getByText('GH₵ 28.00')).toBeInTheDocument();
    });

    // Verify wholesale prices (GH₵ 3.80, GH₵ 19.00) are NOT displayed on the public landing page
    expect(screen.queryByText('GH₵ 3.80')).not.toBeInTheDocument();
    expect(screen.queryByText('GH₵ 19.00')).not.toBeInTheDocument();
  });
});
