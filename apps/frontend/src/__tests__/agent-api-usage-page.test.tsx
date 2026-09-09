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
      },
      {
        id: 'req_1_2',
        timestamp: '2026-09-09T00:49:46.000Z',
        mode: 'live' as const,
        method: 'GET' as const,
        path: '/api/v1/agent/beneficiaries',
        statusCode: 200,
        latencyMs: 238,
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
      expect(apiKeysApi.getApiUsage).toHaveBeenCalled();
    });

    // TOTAL CALLS · 7D
    expect(screen.getByText('TOTAL CALLS · 7D')).toBeInTheDocument();
    expect(screen.getByText('38,920')).toBeInTheDocument();
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
});
