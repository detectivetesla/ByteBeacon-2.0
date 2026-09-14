import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AgentApiUsagePage } from '../pages/agent/AgentApiUsagePage.js';
import { apiKeysApi } from '../api/apiKeys.api.js';

vi.mock('../api/apiKeys.api.js', () => ({
  apiKeysApi: {
    getApiUsage: vi.fn(),
    listKeys: vi.fn(),
  },
}));

const mockUsageData = {
  overview: {
    totalCalls7d: 38920,
    liveCalls7d: 38920,
    sandboxCalls7d: 0,
    successRatePercent: 100,
    failureRatePercent: 0,
    p95LatencyMs: 245,
    avgLatencyMs: 58,
  },
  daily: [
    { date: '09-03', fullDate: '2026-09-03', successes: 0, failures: 0, total: 0, avgLatencyMs: 0 },
    { date: '09-04', fullDate: '2026-09-04', successes: 0, failures: 0, total: 0, avgLatencyMs: 0 },
    { date: '09-05', fullDate: '2026-09-05', successes: 4200, failures: 0, total: 4200, avgLatencyMs: 56 },
    { date: '09-06', fullDate: '2026-09-06', successes: 11800, failures: 0, total: 11800, avgLatencyMs: 61 },
    { date: '09-07', fullDate: '2026-09-07', successes: 11100, failures: 0, total: 11100, avgLatencyMs: 57 },
    { date: '09-08', fullDate: '2026-09-08', successes: 11400, failures: 0, total: 11400, avgLatencyMs: 59 },
    { date: '09-09', fullDate: '2026-09-09', successes: 420, failures: 0, total: 420, avgLatencyMs: 54 },
  ],
  topEndpoints: [
    { method: 'GET' as const, path: '/api/v1/agent/orders', count: 34023 },
    { method: 'GET' as const, path: '/api/v1/agent/beneficiaries', count: 4897 },
  ],
  apiKeysUsage: [
    {
      id: 'key_123',
      name: 'Agent Live Key',
      keyPrefix: 'ak_live_7xa9b8c1',
      environment: 'LIVE' as const,
      status: 'ACTIVE',
      totalCalls: 1250,
      successCount: 1245,
      failureCount: 5,
      successRatePercent: 99,
      lastUsedAt: '2026-09-09T00:49:47.000Z',
      avgLatencyMs: 42,
    },
  ],
  recentRequests: {
    items: [
      {
        id: 'req_1_1',
        timestamp: '2026-09-09T00:49:47.000Z',
        mode: 'live' as const,
        method: 'GET' as const,
        path: '/api/v1/agent/orders',
        statusCode: 200,
        latencyMs: 10,
        keyId: 'key_123',
        keyName: 'Agent Live Key',
        keyPrefix: 'ak_live_7xa9b8c1',
        ipAddress: '197.251.130.45',
        userAgent: 'ByteBeacon-SDK/2.0',
        requestHeaders: { 'content-type': 'application/json', host: 'api.bytebeacon.com' },
        requestPayload: null,
        responsePayload: '{"success":true,"orders":[]}',
      },
      {
        id: 'req_1_2',
        timestamp: '2026-09-09T00:49:46.000Z',
        mode: 'live' as const,
        method: 'GET' as const,
        path: '/api/v1/agent/beneficiaries',
        statusCode: 200,
        latencyMs: 238,
        keyId: 'key_123',
        keyName: 'Agent Live Key',
        keyPrefix: 'ak_live_7xa9b8c1',
        ipAddress: '197.251.130.45',
        userAgent: 'ByteBeacon-SDK/2.0',
      },
    ],
    total: 209111,
    page: 1,
    limit: 20,
    totalPages: 10456,
  },
};

describe('AgentApiUsagePage Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header, subtitle and Manage keys link', async () => {
    vi.mocked(apiKeysApi.getApiUsage).mockResolvedValue(mockUsageData as any);

    render(
      <MemoryRouter>
        <AgentApiUsagePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /^API usage$/i })).toBeInTheDocument();
    expect(screen.getByText(/Last 7 days of API calls against your keys/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manage keys →/i })).toBeInTheDocument();
  });

  it('renders all 4 top KPI cards with exact values', async () => {
    vi.mocked(apiKeysApi.getApiUsage).mockResolvedValue(mockUsageData as any);

    render(
      <MemoryRouter>
        <AgentApiUsagePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('38,920')).toBeInTheDocument();
    });
    expect(screen.getByText('38920 live · 0 sandbox')).toBeInTheDocument();

    // SUCCESS RATE
    expect(screen.getByText('SUCCESS RATE')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('2xx responses')).toBeInTheDocument();

    // FAILURE RATE
    expect(screen.getByText('FAILURE RATE')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('4xx + 5xx')).toBeInTheDocument();

    // LATENCY · P95
    expect(screen.getByText('LATENCY · P95')).toBeInTheDocument();
    expect(screen.getByText('245ms')).toBeInTheDocument();
    expect(screen.getByText('avg 58ms')).toBeInTheDocument();
  });

  it('renders 7-day Calls per day chart and Top endpoints', async () => {
    vi.mocked(apiKeysApi.getApiUsage).mockResolvedValue(mockUsageData as any);

    render(
      <MemoryRouter>
        <AgentApiUsagePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Calls per day')).toBeInTheDocument();
    });

    expect(screen.getByText('Stacked failures (red) on top of successes (primary).')).toBeInTheDocument();
    expect(screen.getByText('09-03')).toBeInTheDocument();
    expect(screen.getByText('09-06')).toBeInTheDocument();
    expect(screen.getByText('09-09')).toBeInTheDocument();

    // Top endpoints
    expect(screen.getByText('Top endpoints')).toBeInTheDocument();
    expect(screen.getAllByText('/api/v1/agent/orders').length).toBeGreaterThan(0);
    expect(screen.getByText('34,023')).toBeInTheDocument();
    expect(screen.getAllByText('/api/v1/agent/beneficiaries').length).toBeGreaterThan(0);
    expect(screen.getByText('4,897')).toBeInTheDocument();
  });

  it('renders Recent requests table, mode filters (All, Live, Sandbox), and pagination', async () => {
    vi.mocked(apiKeysApi.getApiUsage).mockResolvedValue(mockUsageData as any);

    render(
      <MemoryRouter>
        <AgentApiUsagePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Recent requests')).toBeInTheDocument();
    });

    expect(screen.getByText('209,111 total')).toBeInTheDocument();

    // Mode filter buttons
    const allBtn = screen.getByRole('button', { name: /^All$/i });
    const liveBtn = screen.getByRole('button', { name: /^Live$/i });
    const sandboxBtn = screen.getByRole('button', { name: /^Sandbox$/i });

    expect(allBtn).toBeInTheDocument();
    expect(liveBtn).toBeInTheDocument();
    expect(sandboxBtn).toBeInTheDocument();

    // Table columns
    expect(screen.getByText('WHEN')).toBeInTheDocument();
    expect(screen.getByText('MODE')).toBeInTheDocument();
    expect(screen.getByText('METHOD')).toBeInTheDocument();
    expect(screen.getByText('PATH')).toBeInTheDocument();
    expect(screen.getByText('STATUS')).toBeInTheDocument();
    expect(screen.getByText('LATENCY')).toBeInTheDocument();

    // Table rows
    expect(screen.getByText('10ms')).toBeInTheDocument();
    expect(screen.getByText('238ms')).toBeInTheDocument();

    // Pagination
    expect(screen.getByText(/Page 1 · 10,456 pages/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Prev$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Next$/i })).not.toBeDisabled();

    // Click Sandbox mode filter
    fireEvent.click(sandboxBtn);
    await waitFor(() => {
      expect(apiKeysApi.getApiUsage).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'sandbox' }),
      );
    });
  });

  it('renders clean zero state when no API calls have occurred', async () => {
    vi.mocked(apiKeysApi.getApiUsage).mockResolvedValue({
      overview: {
        totalCalls7d: 0,
        liveCalls7d: 0,
        sandboxCalls7d: 0,
        successRatePercent: 100,
        failureRatePercent: 0,
        p95LatencyMs: 0,
        avgLatencyMs: 0,
      },
      daily: Array.from({ length: 7 }).map((_, i) => ({
        date: `09-0${i + 1}`,
        fullDate: `2026-09-0${i + 1}`,
        successes: 0,
        failures: 0,
        total: 0,
        avgLatencyMs: 0,
      })),
      topEndpoints: [],
      recentRequests: {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    } as any);

    render(
      <MemoryRouter>
        <AgentApiUsagePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiKeysApi.getApiUsage).toHaveBeenCalled();
    });

    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getByText('0 live · 0 sandbox')).toBeInTheDocument();
    expect(screen.getByText('0 total')).toBeInTheDocument();
    expect(screen.getByText('No recent API requests found for this mode filter.')).toBeInTheDocument();
  });

  it('renders API keys attribution breakdown section and supports key filtering', async () => {
    vi.mocked(apiKeysApi.getApiUsage).mockResolvedValue(mockUsageData as any);

    render(
      <MemoryRouter>
        <AgentApiUsagePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Agent API Keys & Attribution')).toBeInTheDocument();
    });

    expect(screen.getByText('Agent Live Key')).toBeInTheDocument();
    expect(screen.getByText('ak_live_7xa9b8c1...')).toBeInTheDocument();
    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.getByText('99%')).toBeInTheDocument();

    // Click on key card to activate filter
    fireEvent.click(screen.getByText('Agent Live Key'));
    await waitFor(() => {
      expect(apiKeysApi.getApiUsage).toHaveBeenCalledWith(
        expect.objectContaining({ keyId: 'key_123' }),
      );
    });
  });

  it('opens Request & Response Inspector modal upon clicking a request row', async () => {
    vi.mocked(apiKeysApi.getApiUsage).mockResolvedValue(mockUsageData as any);

    render(
      <MemoryRouter>
        <AgentApiUsagePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('/api/v1/agent/orders').length).toBeGreaterThan(0);
    });

    // Click on inspect button
    const inspectBtn = screen.getAllByRole('button', { name: /Inspect →/i })[0];
    fireEvent.click(inspectBtn);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Request & Headers')).toBeInTheDocument();
      expect(screen.getByText('Response Payload')).toBeInTheDocument();
    });

    expect(screen.getByText('197.251.130.45')).toBeInTheDocument();
    expect(screen.getByText('ByteBeacon-SDK/2.0')).toBeInTheDocument();

    // Switch to Response tab
    fireEvent.click(screen.getByText('Response Payload'));
    expect(screen.getByText('{"success":true,"orders":[]}')).toBeInTheDocument();

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: /^Close$/i }));
    await waitFor(() => {
      expect(screen.queryByText('Response Payload')).not.toBeInTheDocument();
    });
  });
});
