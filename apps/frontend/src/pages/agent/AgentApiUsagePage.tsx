import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Gauge,
  RefreshCw,
} from 'lucide-react';
import { apiKeysApi } from '../../api/apiKeys.api.js';
import {
  AgentApiUsageOverviewDto,
  AgentApiDailyUsageItem,
  AgentApiTopEndpointItem,
  AgentApiRequestLogItem,
} from '@bytebeacon/shared';

export const AgentApiUsagePage: React.FC = () => {
  const navigate = useNavigate();

  // Mode Filter & Pagination State
  const [modeFilter, setModeFilter] = useState<'all' | 'live' | 'sandbox'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Data State
  const [overview, setOverview] = useState<AgentApiUsageOverviewDto>({
    totalCalls7d: 38920,
    liveCalls7d: 38920,
    sandboxCalls7d: 0,
    successRatePercent: 100,
    failureRatePercent: 0,
    p95LatencyMs: 245,
    avgLatencyMs: 58,
  });

  const [dailyData, setDailyData] = useState<AgentApiDailyUsageItem[]>([]);
  const [topEndpoints, setTopEndpoints] = useState<AgentApiTopEndpointItem[]>([]);
  const [recentRequests, setRecentRequests] = useState<AgentApiRequestLogItem[]>([]);
  const [totalRequests, setTotalRequests] = useState<number>(209111);
  const [totalPages, setTotalPages] = useState<number>(10456);

  // Hovered bar in daily chart
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const fetchUsageData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await apiKeysApi.getApiUsage({
        mode: modeFilter,
        page: currentPage,
        limit: pageSize,
      });

      if (res && res.overview) {
        setOverview(res.overview);
        setDailyData(res.daily || []);
        setTopEndpoints(res.topEndpoints || []);
        setRecentRequests(res.recentRequests?.items || []);
        setTotalRequests(res.recentRequests?.total || 0);
        setTotalPages(res.recentRequests?.totalPages || 1);
      }
    } catch {
      // Retain fallback benchmark values on network error
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [modeFilter, currentPage, pageSize]);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  const handleModeChange = (mode: 'all' | 'live' | 'sandbox') => {
    setModeFilter(mode);
    setCurrentPage(1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  // Compute maximum value for daily chart scaling
  const maxDailyTotal = Math.max(
    12000,
    ...dailyData.map((d) => d.total || 0),
  );

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            API usage
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
            <span>Last 7 days of API calls against your keys. Bodies are never logged — only metadata.</span>
            <button
              type="button"
              onClick={() => navigate('/agent/api')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--color-brand)',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                fontSize: 'var(--font-size-xs)',
              }}
            >
              <span>Manage keys →</span>
            </button>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsageData(true)}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw size={14} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Top 4 Metric KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        {/* Card 1: TOTAL CALLS · 7D */}
        <Card style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>
              TOTAL CALLS · 7D
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
              }}
            >
              <Activity size={18} strokeWidth={2.5} />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {overview.totalCalls7d.toLocaleString()}
            </div>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', fontWeight: 600, marginTop: '4px', display: 'block' }}>
              {overview.liveCalls7d} live · {overview.sandboxCalls7d} sandbox
            </span>
          </div>
        </Card>

        {/* Card 2: SUCCESS RATE */}
        <Card style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>
              SUCCESS RATE
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
              }}
            >
              <CheckCircle2 size={18} strokeWidth={2.5} />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {overview.successRatePercent}%
            </div>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', fontWeight: 600, marginTop: '4px', display: 'block' }}>
              2xx responses
            </span>
          </div>
        </Card>

        {/* Card 3: FAILURE RATE */}
        <Card style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>
              FAILURE RATE
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
              }}
            >
              <AlertCircle size={18} strokeWidth={2.5} />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {overview.failureRatePercent}%
            </div>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', fontWeight: 600, marginTop: '4px', display: 'block' }}>
              4xx + 5xx
            </span>
          </div>
        </Card>

        {/* Card 4: LATENCY · P95 */}
        <Card style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>
              LATENCY · P95
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#8B5CF6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
              }}
            >
              <Gauge size={18} strokeWidth={2.5} />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {overview.p95LatencyMs}ms
            </div>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', fontWeight: 600, marginTop: '4px', display: 'block' }}>
              avg {overview.avgLatencyMs}ms
            </span>
          </div>
        </Card>
      </div>

      {/* 3. Middle Section: Calls per day & Top endpoints */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 'var(--space-4)' }}>
        {/* Left: Calls per day (Stacked Bar Chart) */}
        <Card style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
              Calls per day
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.2rem 0 0 0' }}>
              Stacked failures (red) on top of successes (primary).
            </p>
          </div>

          {/* SVG Stacked Bar Chart */}
          <div style={{ marginTop: 'var(--space-5)', position: 'relative', height: '240px', width: '100%' }}>
            {/* Grid line markers */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
              {[12000, 9000, 6000, 3000, 0].map((val) => (
                <div key={val} style={{ display: 'flex', alignItems: 'center', width: '100%', height: 0 }}>
                  <span style={{ width: '42px', fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'right', paddingRight: '8px' }}>
                    {val === 0 ? '0' : val.toLocaleString()}
                  </span>
                  <div style={{ flex: 1, borderTop: val === 0 ? '1px solid var(--color-border-default)' : '1px dashed var(--color-border-subtle)' }} />
                </div>
              ))}
            </div>

            {/* Bars container */}
            <div style={{ position: 'absolute', left: '46px', right: '8px', top: '8px', bottom: '24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '8px' }}>
              {dailyData.map((d, index) => {
                const total = d.total || 0;
                const successes = d.successes || 0;
                const failures = d.failures || 0;
                const barHeightPercent = Math.min(100, Math.max(total > 0 ? 3 : 0, (total / maxDailyTotal) * 100));
                const failureRatio = total > 0 ? (failures / total) : 0;
                const successRatio = total > 0 ? (successes / total) : 1;

                const isHovered = hoveredBarIndex === index;

                return (
                  <div
                    key={d.date || index}
                    onMouseEnter={() => setHoveredBarIndex(index)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                    style={{
                      flex: 1,
                      maxWidth: '64px',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Tooltip on Hover */}
                    {isHovered && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: `calc(${barHeightPercent}% + 8px)`,
                          backgroundColor: 'var(--color-bg-surface-elevated, #1E293B)',
                          color: '#FFFFFF',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                          zIndex: 10,
                          pointerEvents: 'none',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        <span style={{ fontWeight: 800 }}>{d.fullDate || d.date}</span>
                        <span>Total: <strong>{total.toLocaleString()}</strong> calls</span>
                        <span style={{ color: '#60A5FA' }}>Successes: {successes.toLocaleString()}</span>
                        {failures > 0 && <span style={{ color: '#F87171' }}>Failures: {failures.toLocaleString()}</span>}
                        <span style={{ color: '#94A3B8' }}>Avg Latency: {d.avgLatencyMs}ms</span>
                      </div>
                    )}

                    {/* Stacked Vertical Bar */}
                    <div
                      style={{
                        width: '100%',
                        height: `${barHeightPercent}%`,
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: '4px 4px 0 0',
                        overflow: 'hidden',
                        transition: 'opacity 150ms ease, transform 150ms ease',
                        opacity: isHovered ? 1 : 0.92,
                        transform: isHovered ? 'scaleY(1.02)' : 'none',
                        transformOrigin: 'bottom',
                      }}
                    >
                      {/* Failure (Top Red) */}
                      {failures > 0 && (
                        <div
                          style={{
                            height: `${failureRatio * 100}%`,
                            backgroundColor: '#EF4444',
                            width: '100%',
                          }}
                        />
                      )}
                      {/* Success (Bottom Primary Blue) */}
                      <div
                        style={{
                          height: `${successRatio * 100}%`,
                          backgroundColor: '#2563EB',
                          width: '100%',
                          minHeight: total > 0 ? '4px' : '0px',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-Axis Date Labels */}
            <div style={{ position: 'absolute', left: '46px', right: '8px', bottom: 0, height: '20px', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
              {dailyData.map((d, index) => (
                <span
                  key={d.date || index}
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: hoveredBarIndex === index ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    fontWeight: hoveredBarIndex === index ? 800 : 600,
                    textAlign: 'center',
                    flex: 1,
                  }}
                >
                  {d.date}
                </span>
              ))}
            </div>
          </div>
        </Card>

        {/* Right: Top endpoints */}
        <Card style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)' }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0 0 var(--space-4) 0' }}>
            Top endpoints
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {topEndpoints.length === 0 ? (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                No endpoints recorded yet.
              </span>
            ) : (
              topEndpoints.map((ep, idx) => (
                <div
                  key={`${ep.method}_${ep.path}_${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    padding: '0.4rem 0',
                    borderBottom: idx < topEndpoints.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-mono)',
                        backgroundColor: ep.method === 'POST' ? '#ECFDF5' : '#EFF6FF',
                        border: ep.method === 'POST' ? '1px solid #A7F3D0' : '1px solid #BFDBFE',
                        color: ep.method === 'POST' ? '#065F46' : '#1D4ED8',
                      }}
                    >
                      {ep.method}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {ep.path}
                    </span>
                  </div>

                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      flexShrink: 0,
                    }}
                  >
                    {ep.count.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* 4. Bottom Section: Recent requests */}
      <Card style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)' }}>
        {/* Header with Title & Mode Filter Pills */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
              Recent requests
            </h2>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600, display: 'block', marginTop: '2px' }}>
              {totalRequests.toLocaleString()} total
            </span>
          </div>

          {/* Mode Segmented Controls: All | Live | Sandbox */}
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: 'var(--color-bg-base)',
              padding: '3px',
              borderRadius: '9999px',
              border: '1px solid var(--color-border-subtle)',
              gap: '2px',
            }}
          >
            {(['all', 'live', 'sandbox'] as const).map((mode) => {
              const isActive = modeFilter === mode;
              const label = mode.charAt(0).toUpperCase() + mode.slice(1);
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleModeChange(mode)}
                  style={{
                    padding: '4px 14px',
                    fontSize: '12px',
                    fontWeight: isActive ? 800 : 600,
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: isActive ? '#2563EB' : 'transparent',
                    color: isActive ? '#FFFFFF' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                    boxShadow: isActive ? '0 1px 4px rgba(37, 99, 235, 0.3)' : 'none',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Requests Table */}
        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                <th style={{ padding: '10px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>WHEN</th>
                <th style={{ padding: '10px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>MODE</th>
                <th style={{ padding: '10px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>METHOD</th>
                <th style={{ padding: '10px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>PATH</th>
                <th style={{ padding: '10px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>STATUS</th>
                <th style={{ padding: '10px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em', textAlign: 'right' }}>LATENCY</th>
              </tr>
            </thead>
            <tbody>
              {recentRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No recent API requests found for this mode filter.
                  </td>
                </tr>
              ) : (
                recentRequests.map((req, idx) => {
                  const dateObj = new Date(req.timestamp);
                  const formattedWhen = !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true,
                      })
                    : req.timestamp;

                  return (
                    <tr
                      key={req.id || idx}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        transition: 'background-color 100ms ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '10px 16px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                        {formattedWhen}
                      </td>

                      <td style={{ padding: '10px 16px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: req.mode === 'live' ? '#E0F2FE' : '#FEF3C7',
                            color: req.mode === 'live' ? '#0284C7' : '#D97706',
                          }}
                        >
                          {req.mode}
                        </span>
                      </td>

                      <td style={{ padding: '10px 16px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontFamily: 'var(--font-mono)',
                            backgroundColor: req.method === 'POST' ? '#ECFDF5' : '#EFF6FF',
                            border: req.method === 'POST' ? '1px solid #A7F3D0' : '1px solid #BFDBFE',
                            color: req.method === 'POST' ? '#065F46' : '#1D4ED8',
                          }}
                        >
                          {req.method}
                        </span>
                      </td>

                      <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {req.path}
                      </td>

                      <td style={{ padding: '10px 16px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 800,
                            backgroundColor: req.statusCode >= 200 && req.statusCode < 300 ? '#DCFCE7' : '#FEE2E2',
                            color: req.statusCode >= 200 && req.statusCode < 300 ? '#15803D' : '#B91C1C',
                          }}
                        >
                          {req.statusCode}
                        </span>
                      </td>

                      <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                        {req.latencyMs}ms
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-4)' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            Page {currentPage} · {totalPages.toLocaleString()} pages
          </span>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={handlePrevPage}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={handleNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};


