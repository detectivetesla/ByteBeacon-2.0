import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminProviderPage } from '../pages/admin/AdminProviderPage.js';
import { adminApi } from '../api/admin.api.js';
import { NetworkProvider } from '@bytebeacon/shared';

// Mock contexts
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({
    user: { sub: 'u1', email: 'admin@bytebeacon.com', role: 'super_admin' },
    isAuthenticated: true,
  }),
}));

vi.mock('../context/ToastContext.js', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

// Mock adminApi
vi.mock('../api/admin.api.js', () => ({
  adminApi: {
    getTelecomOverview: vi.fn(),
    getTelecomNetworks: vi.fn(),
    getTelecomProviders: vi.fn(),
    getTelecomRoutingMatrix: vi.fn(),
    getProviderIncidents: vi.fn(),
    toggleTelecomNetwork: vi.fn(),
    updateTelecomRouting: vi.fn(),
    validateAuthoritativeSwitch: vi.fn(),
    switchAuthoritativeProvider: vi.fn(),
    testProviderConnection: vi.fn(),
    testProviderSandboxTransaction: vi.fn(),
  },
}));

describe('Phase 11.9: AdminProviderPage 7-Tab Telecom Control Plane', () => {
  const mockOverview = {
    totalNetworks: 3,
    activeNetworks: 3,
    totalProviders: 2,
    activeProviders: 2,
    authoritativeProvider: 'DataHouse',
    systemAvailabilityPercent: 99.85,
    averageLatencyMs: 183,
    totalRequests24h: 128421,
    totalFailures24h: 231,
    openIncidentsCount: 0,
    networks: [],
    providers: [],
  };

  const mockNetworks = [
    {
      id: 'net_mtn',
      code: NetworkProvider.MTN,
      name: 'MTN Ghana',
      slug: 'mtn-ghana',
      status: 'ACTIVE',
      isActive: true,
      primaryProviderName: 'DataHouse',
      fallbackProviderName: 'GMPL',
      providersCount: 2,
      dailyVolumeLimitMb: 1000000000,
      dailyOrderLimit: 100000,
      minBundleMb: 50,
      maxBundleMb: 500000,
      uptimePercentage: 99.85,
      latencyMs: 183,
      successRatePercent: 99.80,
      associatedProviders: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'net_telecel',
      code: NetworkProvider.TELECEL,
      name: 'Telecel Ghana',
      slug: 'telecel-ghana',
      status: 'ACTIVE',
      isActive: true,
      primaryProviderName: 'DataHouse',
      fallbackProviderName: 'GMPL',
      providersCount: 2,
      dailyVolumeLimitMb: 1000000000,
      dailyOrderLimit: 100000,
      minBundleMb: 50,
      maxBundleMb: 500000,
      uptimePercentage: 99.90,
      latencyMs: 175,
      successRatePercent: 99.70,
      associatedProviders: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockProviders = [
    {
      id: 'p_dh',
      name: 'DataHouse',
      slug: 'datahouse',
      description: 'Primary aggregator',
      providerType: 'AGGREGATOR',
      environment: 'PRODUCTION',
      status: 'ACTIVE',
      isAuthoritative: true,
      supportedNetworks: [NetworkProvider.MTN, NetworkProvider.TELECEL, NetworkProvider.AIRTELTIGO],
      apiBaseUrl: 'https://api.datahouse.com.gh/v1',
      apiVersion: 'v1',
      authMethod: 'API_KEY',
      webhookSupport: true,
      sandboxSupport: true,
      hasCredentials: { sandbox: true, production: true },
      credentialsMasked: { apiKeyMasked: 'dh_live_••••••••3821', webhookSecretMasked: 'whsec_••••••••4912', status: 'Configured' },
      avgLatencyMs: 183,
      p95LatencyMs: 412,
      successRate: 99.82,
      totalRequestsCount: 128421,
      failedRequestsCount: 231,
      capabilities: { NETWORKS: true, SINGLE_ORDERS: true },
      networkMappings: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'p_gmpl',
      name: 'GMPL',
      slug: 'gmpl',
      description: 'Secondary carrier bridge',
      providerType: 'AGGREGATOR',
      environment: 'PRODUCTION',
      status: 'ACTIVE',
      isAuthoritative: false,
      supportedNetworks: [NetworkProvider.MTN, NetworkProvider.TELECEL, NetworkProvider.AIRTELTIGO],
      apiBaseUrl: 'https://api.gmpl.com.gh/v2',
      apiVersion: 'v2',
      authMethod: 'BEARER',
      webhookSupport: true,
      sandboxSupport: true,
      hasCredentials: { sandbox: true, production: true },
      credentialsMasked: { apiKeyMasked: 'gmpl_live_••••••••9102', webhookSecretMasked: 'gmpl_wh_••••••••1144', status: 'Configured' },
      avgLatencyMs: 210,
      p95LatencyMs: 480,
      successRate: 98.60,
      totalRequestsCount: 42100,
      failedRequestsCount: 580,
      capabilities: { NETWORKS: true, SINGLE_ORDERS: true },
      networkMappings: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockRouting = [
    {
      networkCode: NetworkProvider.MTN,
      primaryProvider: 'DataHouse',
      fallbackProvider: 'GMPL',
      status: 'ACTIVE',
      availableProviders: [],
    },
    {
      networkCode: NetworkProvider.TELECEL,
      primaryProvider: 'DataHouse',
      fallbackProvider: 'GMPL',
      status: 'ACTIVE',
      availableProviders: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (adminApi.getTelecomOverview as any).mockResolvedValue(mockOverview);
    (adminApi.getTelecomNetworks as any).mockResolvedValue(mockNetworks);
    (adminApi.getTelecomProviders as any).mockResolvedValue(mockProviders);
    (adminApi.getTelecomRoutingMatrix as any).mockResolvedValue(mockRouting);
    (adminApi.getProviderIncidents as any).mockResolvedValue([]);
  });

  it('renders top telemetry metrics and carrier networks tab by default', async () => {
    render(<AdminProviderPage />);

    await waitFor(() => {
      expect(screen.getByText('TELECOM CONTROL PLANE')).toBeInTheDocument();
      expect(screen.getByText('Carrier Networks')).toBeInTheDocument();
      expect(screen.getByText('MTN Ghana')).toBeInTheDocument();
      expect(screen.getByText('Telecel Ghana')).toBeInTheDocument();
    });
  });

  it('switches between 7 tabs properly', async () => {
    render(<AdminProviderPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Provider Registry/i })).toBeInTheDocument();
    });

    // Click Provider Registry tab
    fireEvent.click(screen.getByRole('button', { name: /Provider Registry/i }));

    await waitFor(() => {
      expect(screen.getAllByText('DataHouse').length).toBeGreaterThan(0);
      expect(screen.getAllByText('GMPL').length).toBeGreaterThan(0);
      expect(screen.getByText('AUTHORITATIVE')).toBeInTheDocument();
    });

    // Click Routing tab
    fireEvent.click(screen.getByRole('button', { name: /Routing & Authoritative Switch/i }));

    await waitFor(() => {
      expect(screen.getByText('Carrier Fulfillment Routing Rules')).toBeInTheDocument();
      expect(screen.getByText('Authoritative Provider Switch Safeguard')).toBeInTheDocument();
    });
  });


  it('opens Add Telecom Provider 9-step wizard modal', async () => {
    render(<AdminProviderPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ Add Telecom Provider/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /\+ Add Telecom Provider/i }));

    await waitFor(() => {
      expect(screen.getByText('Add Telecom Provider Wizard')).toBeInTheDocument();
      expect(screen.getByText(/Step 1 of 9/i)).toBeInTheDocument();
    });
  });

  it('toggles network active state when button is clicked', async () => {
    (adminApi.toggleTelecomNetwork as any).mockResolvedValue({
      code: 'MTN',
      isActive: false,
      status: 'INACTIVE',
    });

    render(<AdminProviderPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Disable/i })[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Disable/i })[0]);

    await waitFor(() => {
      expect(adminApi.toggleTelecomNetwork).toHaveBeenCalledWith('MTN');
    });
  });
});

