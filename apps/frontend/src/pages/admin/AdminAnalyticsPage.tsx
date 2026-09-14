import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { Select } from '../../components/ui/Select/Select.js';
import { SearchInput } from '../../components/ui/Input/SearchInput.js';
import { adminApi, AdminAnalyticsOverview, AdminAnalyticsFilterParams } from '../../api/admin.api.js';
import {
  BarChart3,
  TrendingUp,
  Package,
  Users,
  DollarSign,
  RefreshCw,
  Activity,
  Radio,
  Download,
  RotateCcw,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Filter,
  SlidersHorizontal,
} from 'lucide-react';

export const AdminAnalyticsPage: React.FC = () => {
  // Primary Filter States
  const [range, setRange] = useState<string>('30d');
  const [networkFilter, setNetworkFilter] = useState<string>('ALL');
  const [lifecycleFilter, setLifecycleFilter] = useState<string>('ALL');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Custom Date Range State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isCustomDateOpen, setIsCustomDateOpen] = useState<boolean>(false);

  // Data & Loading States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [analytics, setAnalytics] = useState<AdminAnalyticsOverview | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Fetch Analytics from Backend API with Active Filters
  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const filterParams: AdminAnalyticsFilterParams = {
        range: range === 'custom' ? undefined : range,
        startDate: range === 'custom' && startDate ? startDate : undefined,
        endDate: range === 'custom' && endDate ? endDate : undefined,
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
        orderStatus: lifecycleFilter !== 'ALL' ? lifecycleFilter : undefined,
        channel: channelFilter !== 'ALL' ? channelFilter : undefined,
        search: searchQuery.trim() || undefined,
      };

      const res = await adminApi.getAnalyticsOverview(filterParams);
      const analyticsData = (res as any)?.data || res;
      if (analyticsData) {
        setAnalytics(analyticsData);
        setLastRefreshed(new Date());
      }
    } catch (err: any) {
      console.error('[ADMIN_ANALYTICS_PAGE] Failed to fetch analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [range, startDate, endDate, networkFilter, lifecycleFilter, channelFilter, searchQuery]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Real-time synchronization: auto-refresh telemetry when order events occur
  useEffect(() => {
    const handleUpdate = () => {
      fetchAnalytics();
    };
    window.addEventListener('order-created', handleUpdate);
    window.addEventListener('orders-updated', handleUpdate);
    return () => {
      window.removeEventListener('order-created', handleUpdate);
      window.removeEventListener('orders-updated', handleUpdate);
    };
  }, [fetchAnalytics]);

  // Reset all filters to default
  const handleResetFilters = () => {
    setRange('30d');
    setNetworkFilter('ALL');
    setLifecycleFilter('ALL');
    setChannelFilter('ALL');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setIsCustomDateOpen(false);
  };

  // Handle Range Preset Change
  const handleRangeChange = (newRange: string) => {
    setRange(newRange);
    if (newRange === 'custom') {
      setIsCustomDateOpen(true);
    } else {
      setIsCustomDateOpen(false);
      setStartDate('');
      setEndDate('');
    }
  };

  // Active Filter Chips
  const activeFilters = useMemo(() => {
    const filters: Array<{ id: string; label: string; onRemove: () => void }> = [];

    if (range !== '30d') {
      const rangeLabels: Record<string, string> = {
        today: 'Today',
        yesterday: 'Yesterday',
        '7d': 'Last 7 Days',
        '90d': 'Last 90 Days',
        month: 'This Month',
        all: 'All Time',
        custom: startDate && endDate ? `${startDate} to ${endDate}` : 'Custom Range',
      };
      filters.push({
        id: 'range',
        label: `Period: ${rangeLabels[range] || range}`,
        onRemove: () => handleRangeChange('30d'),
      });
    }

    if (networkFilter !== 'ALL') {
      filters.push({
        id: 'network',
        label: `Network: ${networkFilter}`,
        onRemove: () => setNetworkFilter('ALL'),
      });
    }

    if (lifecycleFilter !== 'ALL') {
      const statusLabels: Record<string, string> = {
        COMPLETED: 'Fulfilled / Delivered',
        PROCESSING: 'Processing',
        PENDING: 'Pending',
        AWAITING_APPROVAL: 'Awaiting MTN',
        FAILED: 'Failed',
        REFUNDED: 'Refunded',
      };
      filters.push({
        id: 'lifecycle',
        label: `Status: ${statusLabels[lifecycleFilter] || lifecycleFilter}`,
        onRemove: () => setLifecycleFilter('ALL'),
      });
    }

    if (channelFilter !== 'ALL') {
      const channelLabels: Record<string, string> = {
        CUSTOMER: 'Direct Customers',
        AGENT: 'Agents / Resellers',
        STOREFRONT: 'Storefronts',
        API: 'Developer API',
      };
      filters.push({
        id: 'channel',
        label: `Channel: ${channelLabels[channelFilter] || channelFilter}`,
        onRemove: () => setChannelFilter('ALL'),
      });
    }

    if (searchQuery.trim()) {
      filters.push({
        id: 'search',
        label: `Search: "${searchQuery}"`,
        onRemove: () => setSearchQuery(''),
      });
    }

    return filters;
  }, [range, networkFilter, lifecycleFilter, channelFilter, searchQuery, startDate, endDate]);

  // Network Distribution Calculations
  const networksData = useMemo(() => {
    const rawNetworks = analytics?.networks || [];
    if (rawNetworks.length === 0) {
      return [
        { network: 'MTN', orderCount: 0, volumePesewas: 0, sharePct: 0 },
        { network: 'TELECEL', orderCount: 0, volumePesewas: 0, sharePct: 0 },
        { network: 'AIRTELTIGO', orderCount: 0, volumePesewas: 0, sharePct: 0 },
      ];
    }

    const totalVolume = rawNetworks.reduce((acc, n) => acc + (n.volumePesewas || 0), 0);
    const totalOrders = rawNetworks.reduce((acc, n) => acc + (n.orderCount || 0), 0);

    return rawNetworks.map((n) => {
      const share = totalVolume > 0 ? Math.round(((n.volumePesewas || 0) / totalVolume) * 100) : (n.sharePct || 0);
      const aovGhs = n.orderCount > 0 ? ((n.volumePesewas / n.orderCount) / 100).toFixed(2) : '0.00';
      return {
        ...n,
        sharePct: share,
        aovGhs,
      };
    });
  }, [analytics]);

  // Filtered networks (respects networkFilter if applied)
  const displayedNetworks = useMemo(() => {
    if (networkFilter === 'ALL') return networksData;
    return networksData.filter((n) => n.network.toUpperCase() === networkFilter.toUpperCase());
  }, [networksData, networkFilter]);

  // Proportional percentages for the multi-segment bar
  const networkShares = useMemo(() => {
    const totalVol = networksData.reduce((sum, item) => sum + (item.volumePesewas || 0), 0);
    const mtn = networksData.find((n) => n.network === 'MTN')?.volumePesewas || 0;
    const telecel = networksData.find((n) => n.network === 'TELECEL')?.volumePesewas || 0;
    const at = networksData.find((n) => n.network === 'AIRTELTIGO')?.volumePesewas || 0;

    if (totalVol === 0) {
      return { mtn: 70, telecel: 20, at: 10 };
    }

    return {
      mtn: Math.round((mtn / totalVol) * 100),
      telecel: Math.round((telecel / totalVol) * 100),
      at: Math.round((at / totalVol) * 100),
    };
  }, [networksData]);

  // Filtered Recent Orders Feed
  const filteredRecentOrders = useMemo(() => {
    const orders = analytics?.recentOrders || [];
    return orders.filter((o) => {
      if (networkFilter !== 'ALL' && o.network?.toUpperCase() !== networkFilter.toUpperCase()) return false;
      if (lifecycleFilter !== 'ALL' && o.orderStatus?.toUpperCase() !== lifecycleFilter.toUpperCase()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          (o.id && o.id.toLowerCase().includes(q)) ||
          (o.recipientPhone && o.recipientPhone.includes(q)) ||
          (o.userEmail && o.userEmail.toLowerCase().includes(q)) ||
          (o.userName && o.userName.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [analytics?.recentOrders, networkFilter, lifecycleFilter, searchQuery]);

  // Revenue & Metric Figures
  const periodVolumeGhs = (((analytics?.revenue?.periodPesewas ?? analytics?.revenue?.monthPesewas ?? 0)) / 100).toFixed(2);
  const totalVolumeGhs = ((analytics?.revenue?.lifetimePesewas || 0) / 100).toFixed(2);
  const todayVolumeGhs = ((analytics?.revenue?.todayPesewas || 0) / 100).toFixed(2);

  // CSV Report Generator
  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const csvRows: string[] = [];

      csvRows.push('BYTEBEACON 2.0 PLATFORM TELEMETRY & ANALYTICS REPORT');
      csvRows.push(`Exported At,${new Date().toLocaleString()}`);
      csvRows.push(`Active Period Preset,${range}`);
      csvRows.push(`Network Filter,${networkFilter}`);
      csvRows.push(`Lifecycle Filter,${lifecycleFilter}`);
      csvRows.push(`Channel Filter,${channelFilter}`);
      csvRows.push('');

      // KPI Summary
      csvRows.push('EXECUTIVE METRICS');
      csvRows.push('Metric,Value,Subtext');
      csvRows.push(`Period Gross Revenue,GH₵ ${periodVolumeGhs},Lifetime: GH₵ ${totalVolumeGhs}`);
      csvRows.push(`Today Gross Revenue,GH₵ ${todayVolumeGhs},Settled carrier volume`);
      csvRows.push(`Total Platform Orders,${analytics?.orders?.total || 0},${analytics?.orders?.completionRate || 100}% Completion Rate`);
      csvRows.push(`Completed Orders,${analytics?.orders?.completed || 0},Fulfilled dispatches`);
      csvRows.push(`Processing Orders,${analytics?.orders?.processing || 0},In-flight dispatches`);
      csvRows.push(`Failed Orders,${analytics?.orders?.failed || 0},Dispatched errors`);
      csvRows.push(`Refunded Orders,${analytics?.orders?.refunded || 0},Returned to wallets`);
      csvRows.push(`Registered User Base,${analytics?.users?.total || 0},${analytics?.users?.agents || 0} Agents / ${analytics?.users?.customers || 0} Customers`);
      csvRows.push(`Active Stores,${analytics?.stores?.active || 0},${analytics?.stores?.total || 0} Registered Stores`);
      csvRows.push('');

      // Network Distribution
      csvRows.push('TELECOM NETWORK DISTRIBUTION');
      csvRows.push('Network,Order Count,Volume (GHS),Market Share (%),AOV (GHS)');
      networksData.forEach((n) => {
        csvRows.push(`${n.network},${n.orderCount},${(n.volumePesewas / 100).toFixed(2)},${n.sharePct}%,${n.aovGhs || '0.00'}`);
      });
      csvRows.push('');

      // Recent Orders Feed
      if (filteredRecentOrders.length > 0) {
        csvRows.push('FILTERED RECENT TELEMETRY ORDERS');
        csvRows.push('Order ID,Recipient Phone,Network,Data (MB),Amount (GHS),Lifecycle Status,Payment Status,Created At');
        filteredRecentOrders.forEach((o) => {
          csvRows.push(
            `"${o.id}","${o.recipientPhone}","${o.network}",${o.dataAmountMb},${(o.amountPesewas / 100).toFixed(2)},"${o.orderStatus}","${o.paymentStatus}","${o.createdAt}"`
          );
        });
      }

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `bytebeacon-telemetry-report-${range}-${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('[ADMIN_ANALYTICS] Failed to export CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Network badge helper with platform styling
  const renderNetworkBadge = (net: string) => {
    const n = String(net || '').toUpperCase();
    if (n === 'MTN') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.6rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: '#FEF3C7',
            color: '#B45309',
            fontWeight: 800,
            fontSize: 'var(--font-size-xs)',
            letterSpacing: '0.02em',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#D97706' }} />
          MTN Ghana
        </span>
      );
    }
    if (n === 'TELECEL') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.6rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: '#FEE2E2',
            color: '#B91C1C',
            fontWeight: 800,
            fontSize: 'var(--font-size-xs)',
            letterSpacing: '0.02em',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#DC2626' }} />
          Telecel Ghana
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.25rem 0.6rem',
          borderRadius: 'var(--radius-full)',
          backgroundColor: '#E0F2FE',
          color: '#0369A1',
          fontWeight: 800,
          fontSize: 'var(--font-size-xs)',
          letterSpacing: '0.02em',
        }}
      >
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0284C7' }} />
        AT (AirtelTigo)
      </span>
    );
  };

  // Order Status Badge
  const renderStatusBadge = (status: string) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'COMPLETED':
      case 'DELIVERED':
        return <Badge variant="success" size="sm" dot>Fulfilled</Badge>;
      case 'PROCESSING':
      case 'SUBMITTED':
        return <Badge variant="info" size="sm" dot>Processing</Badge>;
      case 'PENDING':
      case 'CREATED':
        return <Badge variant="neutral" size="sm" dot>Pending</Badge>;
      case 'AWAITING_APPROVAL':
        return <Badge variant="warning" size="sm" dot>Awaiting MTN</Badge>;
      case 'FAILED':
      case 'CANCELLED':
        return <Badge variant="danger" size="sm" dot>Failed</Badge>;
      case 'REFUNDED':
        return <Badge variant="neutral" size="sm">Refunded</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  return (
    <div
      style={{
        maxWidth: '1360px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
      }}
    >
      {/* 1. Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={BarChart3} color="analytics" size="lg" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span
                style={{
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--color-brand-primary)',
                }}
              >
                Intelligence & Telemetry
              </span>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>•</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#16A34A',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  padding: '1px 8px',
                  borderRadius: '12px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#16A34A',
                    display: 'inline-block',
                  }}
                />
                Live Engine Active
              </span>
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              Platform Analytics
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Authoritative transaction volume, carrier traffic distribution, and revenue growth across ByteBeacon 2.0.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={isExporting || isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 700,
              fontSize: 'var(--font-size-xs)',
              backgroundColor: 'var(--color-bg-surface)',
              borderColor: 'var(--color-border-subtle)',
            }}
          >
            <Download size={14} />
            {isExporting ? 'Exporting...' : 'Export Report'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAnalytics}
            disabled={isLoading}
            title={`Last refreshed: ${lastRefreshed.toLocaleTimeString()}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.4rem 0.75rem',
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </Button>
        </div>
      </div>

      {/* 2. Comprehensive Filter Suite */}
      <Card
        elevated
        style={{
          padding: 'var(--space-4) var(--space-5)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-tactile-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        {/* Main Controls Row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.75rem',
            justifyContent: 'space-between',
          }}
        >
          {/* Search Box */}
          <div style={{ flex: '1 1 260px', minWidth: '220px' }}>
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Order ID, Phone, Customer..."
            />
          </div>

          {/* Filter Selects Group */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            {/* Telecom Network Select */}
            <Select
              value={networkFilter}
              onChange={(e) => setNetworkFilter(e.target.value)}
              style={{ minWidth: '150px' }}
              options={[
                { label: 'All Networks', value: 'ALL' },
                { label: 'MTN Ghana', value: 'MTN' },
                { label: 'Telecel Ghana', value: 'TELECEL' },
                { label: 'AT (AirtelTigo)', value: 'AIRTELTIGO' },
              ]}
            />

            {/* Lifecycle Status Select */}
            <Select
              value={lifecycleFilter}
              onChange={(e) => setLifecycleFilter(e.target.value)}
              style={{ minWidth: '160px' }}
              options={[
                { label: 'All Lifecycles', value: 'ALL' },
                { label: 'Fulfilled / Delivered', value: 'COMPLETED' },
                { label: 'Processing / In Flight', value: 'PROCESSING' },
                { label: 'Pending / Created', value: 'PENDING' },
                { label: 'Awaiting MTN', value: 'AWAITING_APPROVAL' },
                { label: 'Failed / Cancelled', value: 'FAILED' },
                { label: 'Refunded', value: 'REFUNDED' },
              ]}
            />

            {/* Channel / Actor Select */}
            <Select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              style={{ minWidth: '150px' }}
              options={[
                { label: 'All Channels', value: 'ALL' },
                { label: 'Direct Customers', value: 'CUSTOMER' },
                { label: 'Agents / Resellers', value: 'AGENT' },
                { label: 'Storefront Portals', value: 'STOREFRONT' },
                { label: 'Developer API', value: 'API' },
              ]}
            />

            {/* Range Preset Select */}
            <Select
              value={range}
              onChange={(e) => handleRangeChange(e.target.value)}
              style={{ minWidth: '140px' }}
              options={[
                { label: 'Today', value: 'today' },
                { label: 'Yesterday', value: 'yesterday' },
                { label: 'Last 7 Days', value: '7d' },
                { label: 'Last 30 Days', value: '30d' },
                { label: 'Last 90 Days', value: '90d' },
                { label: 'This Month', value: 'month' },
                { label: 'All Time', value: 'all' },
                { label: 'Custom Range...', value: 'custom' },
              ]}
            />

            {/* Reset All Button */}
            {activeFilters.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-muted)',
                  padding: '0.4rem 0.6rem',
                }}
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </div>

        {/* Custom Date Range Picker Accordion (Visible when custom range selected) */}
        {isCustomDateOpen && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.75rem',
              paddingTop: 'var(--space-3)',
              borderTop: '1px dashed var(--color-border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={14} color="var(--color-text-muted)" />
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                Custom Interval:
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '0.3rem 0.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface-elevated)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '0.3rem 0.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface-elevated)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={fetchAnalytics}
              disabled={!startDate || !endDate || isLoading}
              style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, padding: '0.3rem 0.75rem' }}
            >
              Apply Interval
            </Button>
          </div>
        )}

        {/* Active Filter Chips Bar */}
        {activeFilters.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.4rem',
              paddingTop: 'var(--space-2)',
              borderTop: isCustomDateOpen ? 'none' : '1px solid var(--color-border-subtle)',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginRight: '0.25rem' }}>
              Active Filters:
            </span>
            {activeFilters.map((af) => (
              <span
                key={af.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.2rem 0.55rem',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}
              >
                {af.label}
                <button
                  type="button"
                  onClick={af.onRemove}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--color-brand-primary)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                marginLeft: '0.25rem',
                textDecoration: 'underline',
              }}
            >
              Clear All
            </button>
          </div>
        )}
      </Card>

      {/* 3. Top Metrics Row (Crisp Elevated Surfaces) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {/* Period Gross Revenue */}
        <Card
          elevated
          style={{
            padding: 'var(--space-5)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '128px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
              Gross Settled Volume
            </span>
            <TactileIcon icon={DollarSign} color="security" size="sm" />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
              GH₵ {range === 'all' ? totalVolumeGhs : range === 'today' ? todayVolumeGhs : periodVolumeGhs}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'var(--space-1)', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
              <span>Lifetime: GH₵ {totalVolumeGhs}</span>
              <span>•</span>
              <span>Today: GH₵ {todayVolumeGhs}</span>
            </div>
          </div>
        </Card>

        {/* Platform Total Orders */}
        <Card
          elevated
          style={{
            padding: 'var(--space-5)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '128px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
              Platform Orders
            </span>
            <TactileIcon icon={Package} color="analytics" size="sm" />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
              {(analytics?.orders?.total || 0).toLocaleString()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'var(--space-1)', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
              <span style={{ color: '#16A34A', fontWeight: 700 }}>
                {analytics?.orders?.completionRate || 100}% Completion
              </span>
              <span>•</span>
              <span>{analytics?.orders?.completed || 0} Fulfilled</span>
            </div>
          </div>
        </Card>

        {/* Registered User Base */}
        <Card
          elevated
          style={{
            padding: 'var(--space-5)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '128px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
              Registered User Base
            </span>
            <TactileIcon icon={Users} color="api" size="sm" />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
              {(analytics?.users?.total || 0).toLocaleString()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'var(--space-1)', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
              <span>{analytics?.users?.agents || 0} Agents</span>
              <span>•</span>
              <span>{analytics?.users?.customers || 0} Customers</span>
            </div>
          </div>
        </Card>

        {/* Active Storefronts & Providers */}
        <Card
          elevated
          style={{
            padding: 'var(--space-5)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '128px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
              Active Storefronts
            </span>
            <TactileIcon icon={TrendingUp} color="speed" size="sm" />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
              {(analytics?.stores?.active || 0).toLocaleString()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'var(--space-1)', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
              <span>{analytics?.stores?.total || 0} Registered</span>
              <span>•</span>
              <span style={{ color: '#16A34A', fontWeight: 600 }}>100% Operational</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 4. Grid: Telecom Network Distribution & Order Lifecycle Breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 'var(--space-6)',
        }}
      >
        {/* Telecom Network Distribution Card (Completely Modernized, Crisp White) */}
        <Card
          elevated
          style={{
            padding: 'var(--space-5) var(--space-6)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          {/* Section Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <TactileIcon icon={Radio} color="analytics" size="sm" />
              <div>
                <h3
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 800,
                    color: 'var(--color-text-primary)',
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Telecom Network Distribution
                </h3>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                  Market traffic share and settled transaction volume by carrier.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Badge variant="brand" size="sm">
                3 Active Carriers
              </Badge>
              {networkFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setNetworkFilter('ALL')}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-brand-primary)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Reset Network
                </button>
              )}
            </div>
          </div>

          {/* Visual Market Share Progress Bar Strip */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div
              style={{
                width: '100%',
                height: '10px',
                borderRadius: '9999px',
                overflow: 'hidden',
                display: 'flex',
                backgroundColor: 'var(--color-bg-subtle)',
              }}
            >
              <div
                style={{
                  width: `${networkShares.mtn}%`,
                  backgroundColor: '#F59E0B',
                  transition: 'width 0.4s ease',
                }}
                title={`MTN: ${networkShares.mtn}%`}
              />
              <div
                style={{
                  width: `${networkShares.telecel}%`,
                  backgroundColor: '#EF4444',
                  transition: 'width 0.4s ease',
                }}
                title={`Telecel: ${networkShares.telecel}%`}
              />
              <div
                style={{
                  width: `${networkShares.at}%`,
                  backgroundColor: '#0EA5E9',
                  transition: 'width 0.4s ease',
                }}
                title={`AT: ${networkShares.at}%`}
              />
            </div>

            {/* Legend Below Progress Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              <button
                type="button"
                onClick={() => setNetworkFilter(networkFilter === 'MTN' ? 'ALL' : 'MTN')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: networkFilter === 'MTN' ? '#B45309' : 'inherit',
                  fontWeight: networkFilter === 'MTN' ? 800 : 600,
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                <span>MTN ({networkShares.mtn}%)</span>
              </button>

              <button
                type="button"
                onClick={() => setNetworkFilter(networkFilter === 'TELECEL' ? 'ALL' : 'TELECEL')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: networkFilter === 'TELECEL' ? '#B91C1C' : 'inherit',
                  fontWeight: networkFilter === 'TELECEL' ? 800 : 600,
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
                <span>Telecel ({networkShares.telecel}%)</span>
              </button>

              <button
                type="button"
                onClick={() => setNetworkFilter(networkFilter === 'AIRTELTIGO' ? 'ALL' : 'AIRTELTIGO')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: networkFilter === 'AIRTELTIGO' ? '#0369A1' : 'inherit',
                  fontWeight: networkFilter === 'AIRTELTIGO' ? 800 : 600,
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0EA5E9' }} />
                <span>AT ({networkShares.at}%)</span>
              </button>
            </div>
          </div>

          {/* Unified Carrier Distribution Table */}
          <div
            style={{
              overflowX: 'auto',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    color: 'var(--color-text-secondary)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: '11px',
                    letterSpacing: '0.04em',
                  }}
                >
                  <th style={{ padding: '0.65rem 0.85rem' }}>Carrier</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Share</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Orders</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Settled Volume</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Avg Order</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedNetworks.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No carrier orders recorded for this filter criteria.
                    </td>
                  </tr>
                ) : (
                  displayedNetworks.map((row) => {
                    const isSelected = networkFilter.toUpperCase() === row.network.toUpperCase();
                    return (
                      <tr
                        key={row.network}
                        style={{
                          borderBottom: '1px solid var(--color-border-subtle)',
                          backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                          transition: 'background-color var(--transition-fast)',
                        }}
                      >
                        <td style={{ padding: '0.75rem 0.85rem', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            {renderNetworkBadge(row.network)}
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginLeft: '0.25rem' }}>
                              {row.network === 'MTN'
                                ? '024, 054, 055, 059, 025'
                                : row.network === 'TELECEL'
                                ? '020, 050'
                                : '027, 057, 026'}
                            </span>
                          </div>
                        </td>

                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                              {row.sharePct}%
                            </span>
                            <div style={{ width: '45px', height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-bg-subtle)', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${row.sharePct}%`,
                                  height: '100%',
                                  backgroundColor:
                                    row.network === 'MTN' ? '#F59E0B' : row.network === 'TELECEL' ? '#EF4444' : '#0EA5E9',
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', verticalAlign: 'middle' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {row.orderCount.toLocaleString()}
                          </span>
                        </td>

                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', verticalAlign: 'middle' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                            GH₵ {(row.volumePesewas / 100).toFixed(2)}
                          </span>
                        </td>

                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', verticalAlign: 'middle' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                            GH₵ {row.aovGhs || '0.00'}
                          </span>
                        </td>

                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          <button
                            type="button"
                            onClick={() => setNetworkFilter(isSelected ? 'ALL' : row.network)}
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: 'var(--radius-sm)',
                              border: isSelected ? '1px solid var(--color-brand-primary)' : '1px solid var(--color-border-subtle)',
                              backgroundColor: isSelected ? 'var(--color-brand-primary)' : 'var(--color-bg-surface-elevated)',
                              color: isSelected ? '#FFFFFF' : 'var(--color-text-secondary)',
                              fontSize: '10px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)',
                            }}
                          >
                            {isSelected ? 'Active' : 'Filter'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Order Lifecycle Breakdown Card (Crisp White, System Styling) */}
        <Card
          elevated
          style={{
            padding: 'var(--space-5) var(--space-6)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <TactileIcon icon={Activity} color="orders" size="sm" />
              <div>
                <h3
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 800,
                    color: 'var(--color-text-primary)',
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Order Lifecycle Breakdown
                </h3>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                  State transition telemetry and settlement distribution.
                </p>
              </div>
            </div>
            <Badge variant="success" size="sm">
              Settled
            </Badge>
          </div>

          {/* Status Metric Tiles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {/* Completed / Delivered */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-bg-surface-elevated)',
                border: '1px solid var(--color-border-subtle)',
                borderLeft: '4px solid #10B981',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Completed / Delivered
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Authoritatively fulfilled to handset</div>
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#10B981', fontSize: 'var(--font-size-md)' }}>
                {(analytics?.orders?.completed || 0).toLocaleString()}
              </span>
            </div>

            {/* Processing / In Flight */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-bg-surface-elevated)',
                border: '1px solid var(--color-border-subtle)',
                borderLeft: '4px solid #3B82F6',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3B82F6' }} />
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Processing / In Flight
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Dispatched to carrier gateway</div>
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#3B82F6', fontSize: 'var(--font-size-md)' }}>
                {(analytics?.orders?.processing || 0).toLocaleString()}
              </span>
            </div>

            {/* Failed / Dispatched Errors */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-bg-surface-elevated)',
                border: '1px solid var(--color-border-subtle)',
                borderLeft: '4px solid #EF4444',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Failed / Dispatched Errors
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Rejected or timeout candidates</div>
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#EF4444', fontSize: 'var(--font-size-md)' }}>
                {(analytics?.orders?.failed || 0).toLocaleString()}
              </span>
            </div>

            {/* Refunded to Wallets */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-bg-surface-elevated)',
                border: '1px solid var(--color-border-subtle)',
                borderLeft: '4px solid #8B5CF6',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8B5CF6' }} />
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Refunded to Wallets
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Ledger reversed to account balance</div>
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#8B5CF6', fontSize: 'var(--font-size-md)' }}>
                {(analytics?.orders?.refunded || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* 5. Live Recent Orders Telemetry Feed (Filtered in Real Time) */}
      <Card
        elevated
        style={{
          padding: 'var(--space-5) var(--space-6)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-tactile-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <TactileIcon icon={Layers} color="orders" size="sm" />
            <div>
              <h3
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 800,
                  color: 'var(--color-text-primary)',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Live Order Telemetry Stream
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                Recent transactions matching current filters ({filteredRecentOrders.length} records).
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Badge variant="neutral" size="sm">
              Live Feed
            </Badge>
          </div>
        </div>

        <div
          style={{
            overflowX: 'auto',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-secondary)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  fontSize: '11px',
                  letterSpacing: '0.04em',
                }}
              >
                <th style={{ padding: '0.65rem 0.85rem' }}>Order ID</th>
                <th style={{ padding: '0.65rem 0.85rem' }}>Recipient</th>
                <th style={{ padding: '0.65rem 0.85rem' }}>Carrier</th>
                <th style={{ padding: '0.65rem 0.85rem' }}>Package</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertCircle size={20} color="var(--color-text-muted)" />
                      <span>No transactions match the active filter criteria.</span>
                      {activeFilters.length > 0 && (
                        <Button variant="outline" size="sm" onClick={handleResetFilters} style={{ marginTop: '0.25rem' }}>
                          Reset All Filters
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecentOrders.map((ord: any) => {
                  const dataDisplay = ord.dataAmountMb >= 1000
                    ? `${(ord.dataAmountMb / 1000).toFixed(0)} GB`
                    : `${ord.dataAmountMb} MB`;
                  const dateDisplay = ord.createdAt
                    ? new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Just now';

                  return (
                    <tr
                      key={ord.id}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        transition: 'background-color var(--transition-fast)',
                      }}
                    >
                      <td style={{ padding: '0.75rem 0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {ord.id?.slice(0, 10)}...
                      </td>

                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{ord.recipientPhone}</span>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{ord.userName || ord.userEmail}</span>
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        {renderNetworkBadge(ord.network)}
                      </td>

                      <td style={{ padding: '0.75rem 0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {dataDisplay}
                      </td>

                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        GH₵ {(Number(ord.amountPesewas || 0) / 100).toFixed(2)}
                      </td>

                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                        {renderStatusBadge(ord.orderStatus)}
                      </td>

                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {dateDisplay}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
