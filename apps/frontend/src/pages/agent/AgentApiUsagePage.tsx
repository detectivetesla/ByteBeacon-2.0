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
  X,
  Copy,
  Check,
} from 'lucide-react';
import { apiKeysApi } from '../../api/apiKeys.api.js';
import {
  AgentApiUsageOverviewDto,
  AgentApiDailyUsageItem,
  AgentApiTopEndpointItem,
  AgentApiRequestLogItem,
  AgentApiKeyUsageItem,
} from '@bytebeacon/shared';

export const AgentApiUsagePage: React.FC = () => {
  const navigate = useNavigate();

  // Mode & Key Filter & Pagination State
  const [modeFilter, setModeFilter] = useState<'all' | 'live' | 'sandbox'>('all');
  const [selectedKeyId, setSelectedKeyId] = useState<string>('all');
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
  const [apiKeysUsage, setApiKeysUsage] = useState<AgentApiKeyUsageItem[]>([]);
  const [recentRequests, setRecentRequests] = useState<AgentApiRequestLogItem[]>([]);
  const [totalRequests, setTotalRequests] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Inspector Modal State
  const [selectedRequest, setSelectedRequest] = useState<AgentApiRequestLogItem | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'overview' | 'request' | 'response'>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Hovered bar in daily chart
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const fetchUsageData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await apiKeysApi.getApiUsage({
        mode: modeFilter,
        keyId: selectedKeyId === 'all' ? undefined : selectedKeyId,
        page: currentPage,
        limit: pageSize,
      });

      if (res && res.overview) {
        setOverview(res.overview);
        setDailyData(res.daily || []);
        setTopEndpoints(res.topEndpoints || []);
        setApiKeysUsage(res.apiKeysUsage || []);
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
  }, [modeFilter, selectedKeyId, currentPage, pageSize]);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  const handleModeChange = (mode: 'all' | 'live' | 'sandbox') => {
    setModeFilter(mode);
    setCurrentPage(1);
  };

  const handleKeyChange = (keyId: string) => {
    setSelectedKeyId(keyId);
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

  const copyToClipboard = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(identifier);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  // Find max daily total to scale bars proportionally
  const maxDailyTotal = useMemo(() => {
    const rawMax = Math.max(...dailyData.map((d) => d.total), 0);
    return Math.max(1, rawMax);
  }, [dailyData]);

  // Dynamic Y-axis ticks
  const yAxisTicks = useMemo(() => {
    if (maxDailyTotal <= 4) {
      return [4, 3, 2, 1, 0];
    }
    const step = Math.ceil(maxDailyTotal / 4);
    return [step * 4, step * 3, step * 2, step * 1, 0];
  }, [maxDailyTotal]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: 'var(--space-6) var(--space-4)',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
            <TactileIcon icon={Activity} color="api" size="sm" />
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 800,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              API usage
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
            Last 7 days of API calls against your keys. Real-time telemetry, error monitoring, and request/response inspection.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsageData(true)}
            disabled={isRefreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/agent/api')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Key size={14} />
            Manage keys →
          </Button>
        </div>
      </div>

      {/* 4 Top KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {/* Card 1: TOTAL CALLS · 7D */}
        <Card
          variant="default"
          style={{
            background: 'linear-gradient(145deg, var(--color-info-surface), var(--color-bg-surface))',
            borderColor: 'var(--color-info-border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-tactile-sm)',
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-info)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              TOTAL CALLS · 7D
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-info-surface)',
                border: '1px solid var(--color-info-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-info)',
              }}
            >
              <Activity size={16} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {overview.totalCalls7d.toLocaleString()}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px', fontWeight: 600 }}>
              {overview.liveCalls7d} live · {overview.sandboxCalls7d} sandbox
            </div>
          </div>
        </Card>

        {/* Card 2: SUCCESS RATE */}
        <Card
          variant="default"
          style={{
            background: 'linear-gradient(145deg, var(--color-success-surface), var(--color-bg-surface))',
            borderColor: 'var(--color-success-border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-tactile-sm)',
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-success)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              SUCCESS RATE
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-success-surface)',
                border: '1px solid var(--color-success-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-success)',
              }}
            >
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {overview.successRatePercent}%
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px', fontWeight: 600 }}>
              2xx responses
            </div>
          </div>
        </Card>

        {/* Card 3: FAILURE RATE */}
        <Card
          variant="default"
          style={{
            background: overview.failureRatePercent > 0
              ? 'linear-gradient(145deg, var(--color-danger-surface), var(--color-bg-surface))'
              : 'linear-gradient(145deg, var(--color-warning-surface), var(--color-bg-surface))',
            borderColor: overview.failureRatePercent > 0 ? 'var(--color-danger-border)' : 'var(--color-warning-border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-tactile-sm)',
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: overview.failureRatePercent > 0 ? 'var(--color-danger)' : 'var(--color-warning)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              FAILURE RATE
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: overview.failureRatePercent > 0 ? 'var(--color-danger-surface)' : 'var(--color-warning-surface)',
                border: `1px solid ${overview.failureRatePercent > 0 ? 'var(--color-danger-border)' : 'var(--color-warning-border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: overview.failureRatePercent > 0 ? 'var(--color-danger)' : 'var(--color-warning)',
              }}
            >
              <AlertCircle size={16} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {overview.failureRatePercent}%
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px', fontWeight: 600 }}>
              4xx + 5xx
            </div>
          </div>
        </Card>

        {/* Card 4: LATENCY · P95 */}
        <Card
          variant="default"
          style={{
            background: 'linear-gradient(145deg, var(--color-api-surface), var(--color-bg-surface))',
            borderColor: 'var(--color-api-border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-tactile-sm)',
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-api)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              LATENCY · P95
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-api-surface)',
                border: '1px solid var(--color-api-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-api)',
              }}
            >
              <Gauge size={16} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {overview.p95LatencyMs}ms
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px', fontWeight: 600 }}>
              avg {overview.avgLatencyMs}ms
            </div>
          </div>
        </Card>
      </div>

      {/* Individual Agent API Keys Breakdown Section */}
      {apiKeysUsage.length > 0 && (
        <Card variant="default" style={{ borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={18} style={{ color: 'var(--color-api)' }} />
                <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  Agent API Keys & Attribution
                </h2>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Track usage, latency, and success rates for each of your provisioned keys. Select a key to filter all charts and logs.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button
                variant={selectedKeyId === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => handleKeyChange('all')}
              >
                All Keys ({apiKeysUsage.length})
              </Button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            {apiKeysUsage.map((keyItem) => {
              const isSelected = selectedKeyId === keyItem.id;
              return (
                <div
                  key={keyItem.id}
                  onClick={() => handleKeyChange(isSelected ? 'all' : keyItem.id)}
                  style={{
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    border: isSelected ? '2px solid var(--color-brand)' : '1px solid var(--color-border-default)',
                    backgroundColor: isSelected ? 'var(--color-bg-surface-elevated)' : 'var(--color-bg-surface)',
                    boxShadow: isSelected ? 'var(--shadow-tactile-sm)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {keyItem.name}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        {keyItem.keyPrefix}...
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <Badge variant={keyItem.environment === 'LIVE' ? 'success' : 'info'} size="sm">
                        {keyItem.environment}
                      </Badge>
                      <Badge variant={keyItem.status === 'ACTIVE' ? 'success' : 'warning'} size="sm">
                        {keyItem.status}
                      </Badge>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: '4px',
                      backgroundColor: 'var(--color-bg-base)',
                      padding: '8px',
                      borderRadius: 'var(--radius-md)',
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>CALLS</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-text-primary)' }}>{keyItem.totalCalls.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>SUCCESS</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-success)' }}>{keyItem.successRatePercent}%</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>AVG SPEED</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-text-primary)' }}>{keyItem.avgLatencyMs}ms</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    <span>{keyItem.lastUsedAt ? `Used ${new Date(keyItem.lastUsedAt).toLocaleDateString()}` : 'Never used'}</span>
                    <span style={{ color: isSelected ? 'var(--color-brand)' : 'var(--color-text-muted)', fontWeight: 700 }}>
                      {isSelected ? '✓ Filter active' : 'Click to filter'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Middle Section: 7-day Calls per Day Chart & Top Endpoints */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-6)',
        }}
      >
        {/* Calls per day Bar Chart */}
        <Card
          variant="default"
          style={{
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={18} style={{ color: 'var(--color-info)' }} />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  Calls per day
                </h2>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                <Badge variant="info" dot size="sm">
                  Success
                </Badge>
                <Badge variant="danger" dot size="sm">
                  Failed
                </Badge>
              </div>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              Stacked failures (red) on top of successes (primary).
            </p>
          </div>

          {/* Chart Canvas */}
          <div
            style={{
              position: 'relative',
              height: '240px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              marginTop: 'var(--space-4)',
              paddingBottom: '24px',
              paddingLeft: '40px',
            }}
          >
            {/* Dynamic Y-Axis Background Grid Lines & Ticks */}
            {yAxisTicks.map((tickVal, index) => {
              const bottomPercent = (tickVal / (yAxisTicks[0] || 1)) * 100;
              return (
                <div
                  key={index}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: `${bottomPercent * 0.8 + 24}px`,
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <span
                    style={{
                      width: '35px',
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-text-muted)',
                      textAlign: 'right',
                      paddingRight: '6px',
                    }}
                  >
                    {tickVal >= 1000 ? `${(tickVal / 1000).toFixed(tickVal % 1000 === 0 ? 0 : 1)}k` : tickVal}
                  </span>
                  <div style={{ flex: 1, borderBottom: '1px dashed var(--color-border-subtle)' }} />
                </div>
              );
            })}

            {/* Bars Container */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                height: '100%',
                width: '100%',
                zIndex: 1,
              }}
            >
              {dailyData.map((item, idx) => {
                const total = item.total;
                const successes = item.successes;
                const failures = item.failures;

                const successHeightPercent = maxDailyTotal > 0 ? (successes / maxDailyTotal) * 100 : 0;
                const failureHeightPercent = maxDailyTotal > 0 ? (failures / maxDailyTotal) * 100 : 0;
                const isHovered = hoveredBarIndex === idx;

                return (
                  <div
                    key={item.fullDate || idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flex: 1,
                      height: '100%',
                      justifyContent: 'flex-end',
                      position: 'relative',
                    }}
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                  >
                    {/* Hover Tooltip */}
                    {isHovered && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '-65px',
                          backgroundColor: 'var(--color-bg-surface-elevated)',
                          border: '1px solid var(--color-border-default)',
                          boxShadow: 'var(--shadow-tactile-md)',
                          borderRadius: 'var(--radius-md)',
                          padding: '6px 10px',
                          fontSize: '11px',
                          whiteSpace: 'nowrap',
                          zIndex: 10,
                          pointerEvents: 'none',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        <div style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>{item.fullDate}</div>
                        <div style={{ color: 'var(--color-success)', fontWeight: 600 }}>{successes.toLocaleString()} successes</div>
                        {failures > 0 && <div style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{failures.toLocaleString()} failures</div>}
                      </div>
                    )}

                    {/* Stacked Bars */}
                    <div
                      style={{
                        width: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                      }}
                    >
                      {/* Failures top stack */}
                      {failures > 0 && (
                        <div
                          style={{
                            width: '100%',
                            height: `${Math.max(failureHeightPercent * 1.6, 4)}px`,
                            backgroundColor: 'var(--color-danger)',
                            borderTopLeftRadius: 'var(--radius-sm)',
                            borderTopRightRadius: 'var(--radius-sm)',
                            transition: 'height 200ms ease',
                          }}
                        />
                      )}

                      {/* Successes bottom stack */}
                      <div
                        style={{
                          width: '100%',
                          height: `${total === 0 ? 3 : Math.max(successHeightPercent * 1.6, 4)}px`,
                          background: total === 0 ? 'var(--color-border-default)' : 'linear-gradient(180deg, var(--color-info) 0%, var(--color-api) 100%)',
                          borderRadius: failures === 0 ? 'var(--radius-sm) var(--radius-sm) 0 0' : '0',
                          opacity: isHovered ? 1 : 0.85,
                          transition: 'height 200ms ease, opacity 100ms ease',
                        }}
                      />
                    </div>

                    {/* X-Axis Date Label */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '-22px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: isHovered ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {item.date}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Top Endpoints */}
        <Card
          variant="default"
          style={{
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} style={{ color: 'var(--color-api)' }} />
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                Top endpoints
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              Ranked by request volume over the last 7 days.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {topEndpoints.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                No endpoints invoked yet.
              </div>
            ) : (
              topEndpoints.map((ep, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: 'var(--color-bg-base)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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
                      }}
                    >
                      {ep.path}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-data)',
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

      {/* Recent Requests Section */}
      <Card
        variant="default"
        style={{
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-6)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-4)',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Recent requests
            </h2>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600, display: 'block', marginTop: '2px' }}>
              {totalRequests.toLocaleString()} total
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Key Filter Dropdown */}
            {apiKeysUsage.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={14} style={{ color: 'var(--color-text-secondary)' }} />
                <select
                  value={selectedKeyId}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-base)',
                    color: 'var(--color-text-primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">All API Keys</option>
                  {apiKeysUsage.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.keyPrefix})
                    </option>
                  ))}
                </select>
              </div>
            )}

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
        </div>

        {/* Requests Table */}
        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>WHEN</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>KEY</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>MODE</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>METHOD</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>PATH</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>STATUS</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em', textAlign: 'right' }}>LATENCY</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em', textAlign: 'center' }}>INSPECT</th>
              </tr>
            </thead>
            <tbody>
              {recentRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
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
                      onClick={() => setSelectedRequest(req)}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        transition: 'background-color 100ms ease',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontFamily: 'var(--font-data)' }}>
                        {formattedWhen}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          {req.keyName || req.keyPrefix ? `${req.keyName || 'Key'} (${req.keyPrefix || 'ak_...'})` : '—'}
                        </span>
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

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRequest(req);
                          }}
                        >
                          Inspect →
                        </Button>
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

      {/* Request & Response Inspector Modal */}
      {selectedRequest && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 'var(--space-4)',
          }}
          onClick={() => setSelectedRequest(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-default)',
              boxShadow: 'var(--shadow-tactile-lg)',
              width: '100%',
              maxWidth: '820px',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: 'var(--space-4) var(--space-6)',
                borderBottom: '1px solid var(--color-border-default)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--color-bg-surface-elevated)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <Badge
                  variant={selectedRequest.method === 'POST' ? 'success' : selectedRequest.method === 'DELETE' ? 'danger' : 'info'}
                  size="md"
                >
                  {selectedRequest.method}
                </Badge>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                  {selectedRequest.path}
                </span>
                <Badge
                  variant={selectedRequest.statusCode < 300 ? 'success' : 'danger'}
                  size="sm"
                >
                  {selectedRequest.statusCode}
                </Badge>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {selectedRequest.latencyMs}ms
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--color-border-default)',
                padding: '0 var(--space-6)',
                gap: 'var(--space-4)',
                backgroundColor: 'var(--color-bg-base)',
              }}
            >
              {(['overview', 'request', 'response'] as const).map((tab) => {
                const isActive = inspectorTab === tab;
                const tabTitles = {
                  overview: 'Overview',
                  request: 'Request & Headers',
                  response: 'Response Payload',
                };
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setInspectorTab(tab)}
                    style={{
                      padding: '12px 4px',
                      background: 'none',
                      border: 'none',
                      borderBottom: isActive ? '2px solid var(--color-brand)' : '2px solid transparent',
                      color: isActive ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                      fontWeight: isActive ? 800 : 600,
                      fontSize: 'var(--font-size-sm)',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    {tabTitles[tab]}
                  </button>
                );
              })}
            </div>

            {/* Modal Content */}
            <div style={{ padding: 'var(--space-6)', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {inspectorTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                  <div style={{ backgroundColor: 'var(--color-bg-base)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 800, textTransform: 'uppercase' }}>TIMESTAMP</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '4px' }}>
                      {new Date(selectedRequest.timestamp).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--color-bg-base)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 800, textTransform: 'uppercase' }}>API KEY ATTRIBUTION</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '4px' }}>
                      {selectedRequest.keyName || 'Agent Default Key'}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Prefix: {selectedRequest.keyPrefix || 'ak_live_...'}
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--color-bg-base)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 800, textTransform: 'uppercase' }}>CLIENT IP ADDRESS</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', marginTop: '4px' }}>
                      {selectedRequest.ipAddress || '127.0.0.1'}
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--color-bg-base)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 800, textTransform: 'uppercase' }}>ENVIRONMENT MODE</div>
                    <div style={{ marginTop: '4px' }}>
                      <Badge variant={selectedRequest.mode === 'live' ? 'success' : 'info'} size="sm">
                        {selectedRequest.mode.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {selectedRequest.userAgent && (
                    <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--color-bg-base)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 800, textTransform: 'uppercase' }}>USER AGENT</div>
                      <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', marginTop: '4px', wordBreak: 'break-all' }}>
                        {selectedRequest.userAgent}
                      </div>
                    </div>
                  )}

                  {selectedRequest.errorCode && (
                    <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--color-danger-surface)', border: '1px solid var(--color-danger-border)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-danger)', fontWeight: 800, textTransform: 'uppercase' }}>ERROR DETAILS</div>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-danger)', marginTop: '4px' }}>
                        Code: {selectedRequest.errorCode}
                      </div>
                      {selectedRequest.errorMessage && (
                        <div style={{ fontSize: '12px', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                          Message: {selectedRequest.errorMessage}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {inspectorTab === 'request' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text-primary)' }}>REQUEST HEADERS</span>
                      {selectedRequest.requestHeaders && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(JSON.stringify(selectedRequest.requestHeaders, null, 2), 'req-headers')}
                        >
                          {copiedKey === 'req-headers' ? <Check size={12} /> : <Copy size={12} />}
                          {copiedKey === 'req-headers' ? 'Copied' : 'Copy Headers'}
                        </Button>
                      )}
                    </div>
                    <pre
                      style={{
                        backgroundColor: 'var(--color-bg-base)',
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--color-border-subtle)',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--color-text-primary)',
                        maxHeight: '160px',
                        overflowY: 'auto',
                        margin: 0,
                      }}
                    >
                      {selectedRequest.requestHeaders ? JSON.stringify(selectedRequest.requestHeaders, null, 2) : 'No request headers logged'}
                    </pre>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text-primary)' }}>REQUEST PAYLOAD (BODY)</span>
                      {selectedRequest.requestPayload && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(selectedRequest.requestPayload || '', 'req-body')}
                        >
                          {copiedKey === 'req-body' ? <Check size={12} /> : <Copy size={12} />}
                          {copiedKey === 'req-body' ? 'Copied' : 'Copy Body'}
                        </Button>
                      )}
                    </div>
                    <pre
                      style={{
                        backgroundColor: 'var(--color-bg-base)',
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--color-border-subtle)',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--color-text-primary)',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {selectedRequest.requestPayload || 'No request payload (e.g. GET request)'}
                    </pre>
                  </div>
                </div>
              )}

              {inspectorTab === 'response' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text-primary)' }}>RESPONSE PAYLOAD</span>
                      {selectedRequest.responsePayload && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(selectedRequest.responsePayload || '', 'resp-body')}
                        >
                          {copiedKey === 'resp-body' ? <Check size={12} /> : <Copy size={12} />}
                          {copiedKey === 'resp-body' ? 'Copied' : 'Copy Response'}
                        </Button>
                      )}
                    </div>
                    <pre
                      style={{
                        backgroundColor: 'var(--color-bg-base)',
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--color-border-subtle)',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: selectedRequest.statusCode >= 400 ? 'var(--color-danger)' : 'var(--color-text-primary)',
                        maxHeight: '320px',
                        overflowY: 'auto',
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {selectedRequest.responsePayload || (selectedRequest.errorMessage ? JSON.stringify({ error: { code: selectedRequest.errorCode, message: selectedRequest.errorMessage } }, null, 2) : 'No response payload recorded')}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-6)',
                borderTop: '1px solid var(--color-border-default)',
                display: 'flex',
                justifyContent: 'flex-end',
                backgroundColor: 'var(--color-bg-surface-elevated)',
              }}
            >
              <Button variant="outline" size="sm" onClick={() => setSelectedRequest(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
