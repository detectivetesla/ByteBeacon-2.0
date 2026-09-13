import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Gauge,
  RefreshCw,
  Key,
  Layers,
  TrendingUp,
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
    totalCalls7d: 0,
    liveCalls7d: 0,
    sandboxCalls7d: 0,
    successRatePercent: 100,
    failureRatePercent: 0,
    p95LatencyMs: 0,
    avgLatencyMs: 0,
  });

  const [dailyData, setDailyData] = useState<AgentApiDailyUsageItem[]>([]);
  const [topEndpoints, setTopEndpoints] = useState<AgentApiTopEndpointItem[]>([]);
  const [recentRequests, setRecentRequests] = useState<AgentApiRequestLogItem[]>([]);
  const [totalRequests, setTotalRequests] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

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
      // Retain clean zero state on network error
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
    1,
    ...dailyData.map((d) => d.total || 0),
  );

  // Dynamic gridline ticks that cleanly scale with the live traffic
  const yAxisTicks = useMemo(() => {
    if (maxDailyTotal <= 4) {
      return [4, 3, 2, 1, 0];
    }
    if (maxDailyTotal <= 10) {
      return [10, 8, 5, 2, 0];
    }
    if (maxDailyTotal <= 20) {
      return [20, 15, 10, 5, 0];
    }
    if (maxDailyTotal <= 100) {
      const step = Math.ceil(maxDailyTotal / 4 / 5) * 5;
      return [step * 4, step * 3, step * 2, step, 0];
    }
    const step = Math.ceil(maxDailyTotal / 4 / 100) * 100;
    return [step * 4, step * 3, step * 2, step, 0];
  }, [maxDailyTotal]);

  const chartCeiling = yAxisTicks[0] || maxDailyTotal;

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <TactileIcon icon={Activity} color="api" size="sm" />
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              API usage
            </h1>
          </div>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsageData(true)}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw size={14} />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/agent/api')}
            leftIcon={<Key size={14} />}
          >
            Manage Keys
          </Button>
        </div>
      </div>

      {/* 2. Top 4 Metric KPI Cards with ByteBeacon Tactile Hierarchy */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        {/* Card 1: TOTAL CALLS · 7D */}
        <div
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(145deg, var(--color-info-surface), var(--color-bg-surface))',
            border: '1px solid var(--color-info-border)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '130px',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>
              TOTAL CALLS · 7D
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-info-surface)',
                border: '1px solid var(--color-info-border)',
                color: 'var(--color-info)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Activity size={16} strokeWidth={2.5} />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {overview.totalCalls7d.toLocaleString()}
            </div>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700, marginTop: '2px', display: 'block' }}>
              {overview.liveCalls7d} live · {overview.sandboxCalls7d} sandbox
            </span>
          </div>
        </div>

        {/* Card 2: SUCCESS RATE */}
        <div
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(145deg, var(--color-success-surface), var(--color-bg-surface))',
            border: '1px solid var(--color-success-border)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '130px',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>
              SUCCESS RATE
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-success-surface)',
                border: '1px solid var(--color-success-border)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={16} strokeWidth={2.5} />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {overview.successRatePercent}%
            </div>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700, marginTop: '2px', display: 'block' }}>
              2xx responses
            </span>
          </div>
        </div>

        {/* Card 3: FAILURE RATE */}
        <div
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-xl)',
            background: overview.failureRatePercent > 0
              ? 'linear-gradient(145deg, var(--color-danger-surface), var(--color-bg-surface))'
              : 'linear-gradient(145deg, var(--color-warning-surface), var(--color-bg-surface))',
            border: overview.failureRatePercent > 0
              ? '1px solid var(--color-danger-border)'
              : '1px solid var(--color-warning-border)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '130px',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>
              FAILURE RATE
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: overview.failureRatePercent > 0 ? 'var(--color-danger-surface)' : 'var(--color-warning-surface)',
                border: overview.failureRatePercent > 0 ? '1px solid var(--color-danger-border)' : '1px solid var(--color-warning-border)',
                color: overview.failureRatePercent > 0 ? 'var(--color-danger)' : 'var(--color-warning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertCircle size={16} strokeWidth={2.5} />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {overview.failureRatePercent}%
            </div>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700, marginTop: '2px', display: 'block' }}>
              4xx + 5xx
            </span>
          </div>
        </div>

        {/* Card 4: LATENCY · P95 */}
        <div
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(145deg, var(--color-api-surface), var(--color-bg-surface))',
            border: '1px solid var(--color-api-border)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '130px',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>
              LATENCY · P95
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-api-surface)',
                border: '1px solid var(--color-api-border)',
                color: 'var(--color-api)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Gauge size={16} strokeWidth={2.5} />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {overview.p95LatencyMs}ms
            </div>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700, marginTop: '2px', display: 'block' }}>
              avg {overview.avgLatencyMs}ms
            </span>
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Calls per day & Top endpoints */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 'var(--space-4)' }}>
        {/* Left: Calls per day (Stacked Bar Chart) */}
        <Card
          style={{
            padding: 'var(--space-6)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={16} color="var(--color-info)" />
                <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                  Calls per day
                </h2>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
                Stacked failures (red) on top of successes (primary).
              </p>
            </div>

            {/* Legend Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Badge variant="info" size="sm" dot>
                Successes
              </Badge>
              <Badge variant="danger" size="sm" dot>
                Failures
              </Badge>
            </div>
          </div>

          {/* SVG Stacked Bar Chart */}
          <div style={{ marginTop: 'var(--space-5)', position: 'relative', height: '240px', width: '100%' }}>
            {/* Dynamic Grid line markers */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
              {yAxisTicks.map((val, i) => (
                <div key={`${val}-${i}`} style={{ display: 'flex', alignItems: 'center', width: '100%', height: 0 }}>
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
                const barHeightPercent = Math.min(100, Math.max(total > 0 ? 4 : 0, (total / chartCeiling) * 100));
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
                          color: 'var(--color-text-primary, #FFFFFF)',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border-default)',
                          fontSize: '11px',
                          boxShadow: 'var(--shadow-tactile-md, 0 4px 14px rgba(0,0,0,0.25))',
                          zIndex: 10,
                          pointerEvents: 'none',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                        }}
                      >
                        <span style={{ fontWeight: 800 }}>{d.fullDate || d.date}</span>
                        <span>Total: <strong>{total.toLocaleString()}</strong> calls</span>
                        <span style={{ color: 'var(--color-info)' }}>Successes: {successes.toLocaleString()}</span>
                        {failures > 0 && <span style={{ color: 'var(--color-danger)' }}>Failures: {failures.toLocaleString()}</span>}
                        <span style={{ color: 'var(--color-text-muted)' }}>Avg Latency: {d.avgLatencyMs}ms</span>
                      </div>
                    )}

                    {/* Stacked Vertical Bar with ByteBeacon Gradients */}
                    <div
                      style={{
                        width: '100%',
                        height: `${barHeightPercent}%`,
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: '4px 4px 0 0',
                        overflow: 'hidden',
                        transition: 'opacity 150ms ease, transform 150ms ease',
                        opacity: isHovered ? 1 : 0.9,
                        transform: isHovered ? 'scaleY(1.03)' : 'none',
                        transformOrigin: 'bottom',
                      }}
                    >
                      {/* Failure (Top Red) */}
                      {failures > 0 && (
                        <div
                          style={{
                            height: `${failureRatio * 100}%`,
                            background: 'linear-gradient(180deg, #F87171 0%, #DC2626 100%)',
                            width: '100%',
                          }}
                        />
                      )}
                      {/* Success (Bottom Primary Blue) */}
                      <div
                        style={{
                          height: `${successRatio * 100}%`,
                          background: 'linear-gradient(180deg, #3B82F6 0%, #1D4ED8 100%)',
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
                    color: hoveredBarIndex === index ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
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
        <Card
          style={{
            padding: 'var(--space-6)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-1)' }}>
            <Layers size={16} color="var(--color-api)" />
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
              Top endpoints
            </h2>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-4) 0' }}>
            Most requested routes
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {topEndpoints.length === 0 ? (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-6) 0' }}>
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
                    padding: '0.5rem 0',
                    borderBottom: idx < topEndpoints.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                    <Badge
                      variant={ep.method === 'POST' ? 'success' : ep.method === 'DELETE' ? 'danger' : 'info'}
                      size="sm"
                    >
                      {ep.method}
                    </Badge>
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
                      fontFamily: 'var(--font-data)',
                      fontSize: '12px',
                      fontWeight: 800,
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
      <Card
        style={{
          padding: 'var(--space-6)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-tactile-sm)',
        }}
      >
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
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border-default)',
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
                    padding: '5px 16px',
                    fontSize: '12px',
                    fontWeight: isActive ? 800 : 600,
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    backgroundColor: isActive ? 'var(--color-brand)' : 'transparent',
                    color: isActive ? '#FFFFFF' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                    boxShadow: isActive ? '0 2px 6px rgba(22, 163, 74, 0.3)' : 'none',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Requests Table */}
        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>WHEN</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>MODE</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>METHOD</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>PATH</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>STATUS</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em', textAlign: 'right' }}>LATENCY</th>
              </tr>
            </thead>
            <tbody>
              {recentRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
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
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontFamily: 'var(--font-data)' }}>
                        {formattedWhen}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <Badge
                          variant={req.mode === 'live' ? 'success' : 'info'}
                          size="sm"
                        >
                          {req.mode}
                        </Badge>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <Badge
                          variant={req.method === 'POST' ? 'success' : req.method === 'DELETE' ? 'danger' : 'info'}
                          size="sm"
                        >
                          {req.method}
                        </Badge>
                      </td>

                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {req.path}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <Badge
                          variant={req.statusCode < 300 ? 'success' : req.statusCode >= 400 ? 'danger' : 'warning'}
                          size="sm"
                        >
                          {req.statusCode}
                        </Badge>
                      </td>

                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-4)', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
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
