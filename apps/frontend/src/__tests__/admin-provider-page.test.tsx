import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { AdminProviderPage } from '../pages/admin/AdminProviderPage.js';
import { adminApi } from '../api/admin.api.js';
import { NetworkProvider } from '@bytebeacon/shared';

// Mock contexts
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

let mockCurrentUser = { sub: 'u1', email: 'admin@bytebeacon.com', role: 'super_admin' };

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
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
    testProviderCapabilities: vi.fn(),
    testProviderSandboxTransaction: vi.fn(),
    getProviderCredentials: vi.fn(),
    rotateProviderCredential: vi.fn(),
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

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = { sub: 'u1', email: 'admin@bytebeacon.com', role: 'super_admin' };
    (adminApi.getTelecomOverview as any).mockResolvedValue(mockOverview);
    (adminApi.getTelecomNetworks as any).mockResolvedValue(mockNetworks);
    (adminApi.getTelecomProviders as any).mockResolvedValue(mockProviders);
    (adminApi.getTelecomRoutingMatrix as any).mockResolvedValue(mockRouting);
    (adminApi.getProviderIncidents as any).mockResolvedValue([]);
  });

  it('renders top telemetry metrics and carrier networks tab by default', async () => {
    render(<AdminProviderPage />);

    expect(await screen.findByText('TELECOM CONTROL PLANE')).toBeDefined();
    expect(await screen.findByText('Carrier Networks')).toBeDefined();
    expect(await screen.findByText('MTN Ghana')).toBeDefined();
    expect(await screen.findByText('Telecel Ghana')).toBeDefined();
  });

  it('switches between 7 tabs properly', async () => {
    render(<AdminProviderPage />);

    const registryTab = await screen.findByRole('button', { name: /Provider Registry/i });
    expect(registryTab).toBeDefined();

    // Click Provider Registry tab
    fireEvent.click(registryTab);

    expect(await screen.findAllByText('DataHouse')).toBeDefined();
    expect(await screen.findAllByText('GMPL')).toBeDefined();
    expect(await screen.findByText('AUTHORITATIVE')).toBeDefined();

    // Click Routing tab
    const routingTab = await screen.findByRole('button', { name: /Routing & Authoritative Switch/i });
    fireEvent.click(routingTab);

    expect(await screen.findByText('Carrier Fulfillment Routing Rules')).toBeDefined();
    expect(await screen.findByText('Authoritative Provider Switch Safeguard')).toBeDefined();

    // Click Health tab
    const healthTab = await screen.findByRole('button', { name: /Provider Health & Telemetry/i });
    fireEvent.click(healthTab);
    expect(await screen.findByText('Provider Telemetry & Health Monitoring')).toBeDefined();

    // Click Webhooks tab
    const webhooksTab = await screen.findByRole('button', { name: /Webhooks & Callbacks/i });
    fireEvent.click(webhooksTab);
    expect(await screen.findByText('Inbound Webhooks & Delivery Endpoints')).toBeDefined();

    // Click Diagnostics tab
    const testsTab = await screen.findByRole('button', { name: /Diagnostics & Sandbox/i });
    fireEvent.click(testsTab);
    expect(await screen.findByText('3-Tier Diagnostic & Testing Suite')).toBeDefined();

    // Click Incidents tab
    const incidentsTab = await screen.findByRole('button', { name: /Incidents & Status/i });
    fireEvent.click(incidentsTab);
    expect(await screen.findByText('Provider Incidents & Outage Log')).toBeDefined();
  }, 15000);

  it('opens Add Telecom Provider 9-step wizard modal', async () => {
    render(<AdminProviderPage />);

    const addBtn = await screen.findByText(/Add Telecom Provider/);
    expect(addBtn).toBeDefined();

    fireEvent.click(addBtn);

    expect(await screen.findByText(/Add Telecom Provider Wizard/)).toBeDefined();
    expect(await screen.findByText(/Architecture Preset/)).toBeDefined();
  });

  it('toggles network active state when button is clicked', async () => {
    (adminApi.toggleTelecomNetwork as any).mockResolvedValue({
      code: 'MTN',
      isActive: false,
      status: 'INACTIVE',
    });

    render(<AdminProviderPage />);

    expect(await screen.findByText('MTN Ghana')).toBeDefined();

    const disableButtons = await screen.findAllByText(/^Disable$/);
    expect(disableButtons.length).toBeGreaterThan(0);

    fireEvent.click(disableButtons[0]);

    await waitFor(() => {
      expect(adminApi.toggleTelecomNetwork).toHaveBeenCalledWith('MTN');
    });
  });

  it('runs pre-flight authoritative switch validation', async () => {
    (adminApi.validateAuthoritativeSwitch as any).mockResolvedValue({
      canSwitch: true,
      targetProvider: 'GMPL',
      currentProvider: 'DataHouse',
      checks: [
        { check: 'Target is not currently authoritative', passed: true, message: 'Ready' },
        { check: 'Credentials valid & configured', passed: true, message: 'Active' },
      ],
      timestamp: new Date().toISOString(),
    });

    render(<AdminProviderPage />);

    const routingTab = await screen.findByRole('button', { name: /Routing & Authoritative Switch/i });
    fireEvent.click(routingTab);

    const validateBtn = await screen.findByRole('button', { name: /Run Pre-Flight Validation/i });
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(adminApi.validateAuthoritativeSwitch).toHaveBeenCalledWith('GMPL');
    });

    expect(await screen.findByText('ALL CHECKS PASSED')).toBeDefined();
  });
});
