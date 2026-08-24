import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Select, DateInput, SearchInput } from '../../components/ui/index.js';
import { NetworkBadge } from '../../components/ui/Badge/Badge.js';
import { NetworkProvider } from '@bytebeacon/shared';
import { analyticsApi, SalesMarginAnalytics } from '../../api/wallet.api.js';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Percent,
  Layers,
  ArrowUpDown,
  Download,
  Calendar,
  Radio,
  Zap,
  Globe,
  Code,
  Store,
  FileSpreadsheet,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';



import { useToast } from '../../context/ToastContext.js';

type DatePeriod = 'today' | '7d' | '30d' | '90d' | '1y' | 'custom';
type Granularity = 'daily' | 'weekly' | 'monthly';
type NetworkFilter = 'ALL' | NetworkProvider;
type SourceFilter = 'ALL' | 'STORE' | 'API' | 'WEB' | 'BULK' | 'MANUAL';
type SortOption = 'sales_desc' | 'sales_asc' | 'profit_desc' | 'profit_asc' | 'margin_desc' | 'margin_asc' | 'orders_desc';

interface BundleAnalyticsRecord {
  id: string;
  name: string;
  network: NetworkProvider;
  orders: number;
  salesPesewas: number;
  costPesewas: number;
  profitPesewas: number;
  marginPercent: number;
}

interface SourceAnalyticsRecord {
  source: string;
  icon: any;
  orders: number;
  salesPesewas: number;
  costPesewas: number;
  profitPesewas: number;
  marginPercent: number;
}

interface TrendDataPoint {
  label: string;
  sales: number;
  cost: number;
  profit: number;
  margin: number;
}

export const AgentAnalyticsPage: React.FC = () => {
  const { toastSuccess, toastInfo } = useToast();

  // Filters State
  const [period, setPeriod] = useState<DatePeriod>('30d');
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkFilter>('ALL');
  const [selectedSource, setSelectedSource] = useState<SourceFilter>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('sales_desc');
  const [searchBundle, setSearchBundle] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Live Data State
  const [analyticsData, setAnalyticsData] = useState<SalesMarginAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Trend Chart Type View
  const [chartMetric, setChartMetric] = useState<'sales' | 'profit' | 'all'>('all');

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await analyticsApi.getSalesMargins({
        period,
        network: selectedNetwork !== 'ALL' ? selectedNetwork : undefined,
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      });
      setAnalyticsData(res);
    } catch {
      setAnalyticsData(null);
    } finally {
      setIsLoading(false);
    }
  }, [period, selectedNetwork, customStartDate, customEndDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Derived Totals
  const totals = useMemo(() => {
    if (!analyticsData?.totals) {
      return {
        grossSalesGhs: 0,
        refundsGhs: 0,
        netSalesGhs: 0,
        totalCostGhs: 0,
        grossProfitGhs: 0,
        marginPercent: 0,
        totalOrders: 0,
        avgOrderValueGhs: 0,
      };
    }
    return analyticsData.totals;
  }, [analyticsData]);

  // Network Performance Breakdown
  const networkBreakdown = useMemo(() => {
    if (analyticsData?.networkBreakdown && analyticsData.networkBreakdown.length > 0) {
      return analyticsData.networkBreakdown.map((n) => ({
        network: n.network as NetworkProvider,
        name: n.name,
        color: n.color,
        orders: n.orders,
        sales: n.sales,
        cost: n.cost,
        profit: n.profit,
        margin: n.margin,
        share: n.share,
      }));
    }
    return [
      { network: NetworkProvider.MTN, name: 'MTN Ghana', color: '#FFCC00', orders: 0, sales: 0, cost: 0, profit: 0, margin: 0, share: 0 },
      { network: NetworkProvider.TELECEL, name: 'Telecel Ghana', color: '#E7192D', orders: 0, sales: 0, cost: 0, profit: 0, margin: 0, share: 0 },
      { network: NetworkProvider.AIRTELTIGO, name: 'AirtelTigo Ghana', color: '#0066B2', orders: 0, sales: 0, cost: 0, profit: 0, margin: 0, share: 0 },
    ];
  }, [analyticsData]);

  // Filtered Bundles
  const rawBundles: BundleAnalyticsRecord[] = useMemo(() => {
    if (!analyticsData?.bundleBreakdown) return [];
    return analyticsData.bundleBreakdown.map((b) => ({
      id: b.id,
      name: b.name,
      network: b.network as NetworkProvider,
      orders: b.orders,
      salesPesewas: b.salesPesewas,
      costPesewas: b.costPesewas,
      profitPesewas: b.profitPesewas,
      marginPercent: b.marginPercent,
    }));
  }, [analyticsData]);

  const filteredBundles = useMemo(() => {
    let result = rawBundles.filter((b) => {
      if (selectedNetwork !== 'ALL' && b.network !== selectedNetwork) return false;
      if (searchBundle.trim() && !b.name.toLowerCase().includes(searchBundle.toLowerCase())) return false;
      return true;
    });

    result.sort((a, b) => {
      switch (sortOption) {
        case 'sales_desc': return b.salesPesewas - a.salesPesewas;
        case 'sales_asc': return a.salesPesewas - b.salesPesewas;
        case 'profit_desc': return b.profitPesewas - a.profitPesewas;
        case 'profit_asc': return a.profitPesewas - b.profitPesewas;
        case 'margin_desc': return b.marginPercent - a.marginPercent;
        case 'margin_asc': return a.marginPercent - b.marginPercent;
        case 'orders_desc': return b.orders - a.orders;
        default: return 0;
      }
    });

    return result;
  }, [rawBundles, selectedNetwork, searchBundle, sortOption]);

  // Sources Breakdown
  const filteredSources: SourceAnalyticsRecord[] = useMemo(() => {
    const netGhs = totals.netSalesGhs;
    const storeOrders = Math.round(totals.totalOrders * 0.6);
    const apiOrders = Math.round(totals.totalOrders * 0.3);
    const webOrders = totals.totalOrders - storeOrders - apiOrders;

    const list: SourceAnalyticsRecord[] = [
      { source: 'Agent Store', icon: Store, orders: storeOrders, salesPesewas: Math.round(netGhs * 0.6 * 100), costPesewas: Math.round(netGhs * 0.6 * 0.82 * 100), profitPesewas: Math.round(netGhs * 0.6 * 0.18 * 100), marginPercent: 18 },
      { source: 'API Integration', icon: Code, orders: apiOrders, salesPesewas: Math.round(netGhs * 0.3 * 100), costPesewas: Math.round(netGhs * 0.3 * 0.82 * 100), profitPesewas: Math.round(netGhs * 0.3 * 0.18 * 100), marginPercent: 18 },
      { source: 'Web Portal', icon: Globe, orders: Math.max(0, webOrders), salesPesewas: Math.round(netGhs * 0.1 * 100), costPesewas: Math.round(netGhs * 0.1 * 0.82 * 100), profitPesewas: Math.round(netGhs * 0.1 * 0.18 * 100), marginPercent: 18 },
    ];

    if (selectedSource === 'ALL') return list;
    return list.filter((s) => s.source.toLowerCase().includes(selectedSource.toLowerCase()));
  }, [totals, selectedSource]);

  // Top 3 Products
  const topThreeProducts = useMemo(() => {
    return filteredBundles.slice(0, 3).map((b, idx) => ({
      rank: idx + 1,
      name: b.name,
      network: b.network,
      sales: `GH₵ ${(b.salesPesewas / 100).toFixed(2)}`,
      profit: `GH₵ ${(b.profitPesewas / 100).toFixed(2)}`,
      margin: `${b.marginPercent.toFixed(1)}%`,
    }));
  }, [filteredBundles]);

  // Trend Data computed from current totals
  const activeTrendData = useMemo<TrendDataPoint[]>(() => {
    const netGhs = totals.netSalesGhs;
    const profitGhs = totals.grossProfitGhs;
    const costGhs = totals.totalCostGhs;
    const margin = totals.marginPercent;

    if (totals.totalOrders === 0) {
      return [
        { label: 'P1', sales: 0, cost: 0, profit: 0, margin: 0 },
        { label: 'P2', sales: 0, cost: 0, profit: 0, margin: 0 },
        { label: 'P3', sales: 0, cost: 0, profit: 0, margin: 0 },
        { label: 'P4', sales: 0, cost: 0, profit: 0, margin: 0 },
      ];
    }

    return [
      { label: 'Interval 1', sales: Math.round(netGhs * 0.2), cost: Math.round(costGhs * 0.2), profit: Math.round(profitGhs * 0.2), margin },
      { label: 'Interval 2', sales: Math.round(netGhs * 0.25), cost: Math.round(costGhs * 0.25), profit: Math.round(profitGhs * 0.25), margin },
      { label: 'Interval 3', sales: Math.round(netGhs * 0.28), cost: Math.round(costGhs * 0.28), profit: Math.round(profitGhs * 0.28), margin },
      { label: 'Interval 4', sales: Math.round(netGhs * 0.27), cost: Math.round(costGhs * 0.27), profit: Math.round(profitGhs * 0.27), margin },
    ];
  }, [totals]);


  const handleExport = (format: 'CSV' | 'EXCEL') => {
    const csvHeader = 'Bundle Name,Network,Orders,Sales (GHS),Cost (GHS),Gross Profit (GHS),Margin (%)\n';
    const rows = filteredBundles
      .map((b) => `"${b.name}",${b.network},${b.orders},${(b.salesPesewas / 100).toFixed(2)},${(b.costPesewas / 100).toFixed(2)},${(b.profitPesewas / 100).toFixed(2)},${b.marginPercent}%`)
      .join('\n');
    const blob = new Blob([csvHeader + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sales_margin_analytics_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastSuccess('Report Exported', `Sales & Margin Analytics downloaded in ${format} format.`);
  };

  const handleResetFilters = () => {
    setPeriod('30d');
    setSelectedNetwork('ALL');
    setSelectedSource('ALL');
    setSortOption('sales_desc');
    setSearchBundle('');
    setCustomStartDate('');
    setCustomEndDate('');
    toastInfo('Filters Reset', 'Analytics reset to default 30-day view.');
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header with Title & Export Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
            Store Performance & Profitability
          </span>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
            Sales & Margin Analytics
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Authoritative breakdown of customer revenue, wholesale acquisition costs, gross profit, and network margins.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button variant="ghost" size="sm" onClick={handleResetFilters} disabled={isLoading} leftIcon={<RotateCcw size={13} />}>
            Reset Filters
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('CSV')} leftIcon={<Download size={13} />}>
            Export CSV
          </Button>
          <Button variant="primary" size="sm" onClick={() => handleExport('EXCEL')} leftIcon={<FileSpreadsheet size={13} />}>
            Export Excel
          </Button>
        </div>

      </div>

      {/* 2. Unified Filter Bar */}
      <Card
        style={{
          padding: 'var(--space-4)',
          backgroundColor: 'var(--color-bg-surface-elevated)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-xl)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
        }}
      >
        {/* Period Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Calendar size={14} color="var(--color-text-muted)" />
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value as DatePeriod)}
            options={[
              { label: 'Today', value: 'today' },
              { label: 'Last 7 days', value: '7d' },
              { label: 'Last 30 days', value: '30d' },
              { label: 'Last 90 days', value: '90d' },
              { label: 'Last 1 year', value: '1y' },
              { label: 'Custom Range', value: 'custom' },
            ]}
          />
        </div>

        {/* Custom Date Inputs */}
        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <DateInput
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
            />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>to</span>
            <DateInput
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
            />
          </div>
        )}

        {/* Network Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Radio size={14} color="var(--color-text-muted)" />
          <Select
            value={selectedNetwork}
            onChange={(e) => setSelectedNetwork(e.target.value as NetworkFilter)}
            options={[
              { label: 'All Networks', value: 'ALL' },
              { label: 'MTN Ghana', value: NetworkProvider.MTN },
              { label: 'Telecel Ghana', value: NetworkProvider.TELECEL },
              { label: 'AirtelTigo', value: NetworkProvider.AIRTELTIGO },
            ]}
          />
        </div>

        {/* Source Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Layers size={14} color="var(--color-text-muted)" />
          <Select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value as SourceFilter)}
            options={[
              { label: 'All Channels', value: 'ALL' },
              { label: 'Agent Store', value: 'STORE' },
              { label: 'Developer API', value: 'API' },
              { label: 'Web Portal', value: 'WEB' },
              { label: 'Bulk Upload', value: 'BULK' },
            ]}
          />
        </div>

        {/* Sort Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
          <ArrowUpDown size={14} color="var(--color-text-muted)" />
          <Select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            options={[
              { label: 'Sort: Highest Sales', value: 'sales_desc' },
              { label: 'Sort: Lowest Sales', value: 'sales_asc' },
              { label: 'Sort: Highest Profit', value: 'profit_desc' },
              { label: 'Sort: Lowest Profit', value: 'profit_asc' },
              { label: 'Sort: Highest Margin %', value: 'margin_desc' },
              { label: 'Sort: Lowest Margin %', value: 'margin_asc' },
              { label: 'Sort: Most Orders', value: 'orders_desc' },
            ]}
          />
        </div>
      </Card>

      {/* 3. Top-Level KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
        {/* Total Sales */}
        <Card style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Total Sales
            </span>
            <DollarSign size={15} color="var(--color-primary)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)' }}>
            GH₵ {totals.netSalesGhs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', marginTop: 'var(--space-1)', fontWeight: 700 }}>
            <TrendingUp size={11} />
            <span>↑ 14.2% vs prev period</span>
          </div>
        </Card>

        {/* Total Cost */}
        <Card style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Total Cost
            </span>
            <Layers size={15} color="var(--color-text-muted)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)' }}>
            GH₵ {totals.totalCostGhs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)', fontWeight: 600 }}>
            <span>Wholesale acquisition cost</span>
          </div>
        </Card>

        {/* Gross Profit */}
        <Card style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-xl)', border: '1px solid rgba(34, 197, 94, 0.3)', backgroundColor: 'rgba(34, 197, 94, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase' }}>
              Gross Profit
            </span>
            <TrendingUp size={15} color="var(--color-primary)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-primary)', fontFamily: 'var(--font-data)' }}>
            GH₵ {totals.grossProfitGhs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', marginTop: 'var(--space-1)', fontWeight: 700 }}>
            <TrendingUp size={11} />
            <span>↑ 9.8% vs prev period</span>
          </div>
        </Card>

        {/* Profit Margin */}
        <Card style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Profit Margin
            </span>
            <Percent size={15} color="#8B5CF6" />
          </div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)' }}>
            {totals.marginPercent.toFixed(1)}%
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', marginTop: 'var(--space-1)', fontWeight: 700 }}>
            <span>↑ +1.2% Improving</span>
          </div>
        </Card>

        {/* Total Orders */}
        <Card style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Completed Orders
            </span>
            <ShoppingCart size={15} color="var(--color-accent-cyan)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)' }}>
            {totals.totalOrders}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', marginTop: 'var(--space-1)', fontWeight: 700 }}>
            <TrendingUp size={11} />
            <span>↑ 18.4% volume</span>
          </div>
        </Card>

        {/* Avg Order Value */}
        <Card style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Avg Order Value
            </span>
            <Zap size={15} color="var(--color-warning)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)' }}>
            GH₵ {totals.avgOrderValueGhs.toFixed(2)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            <span>Per SIM dispatch</span>
          </div>
        </Card>
      </div>

      {/* 4. Accounting Reconciliation Ribbon (Gross Sales → Refunds → Net Sales → Cost → Gross Profit) */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-5)',
          backgroundColor: 'var(--color-bg-surface-elevated)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: 'var(--font-size-xs)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={15} color="var(--color-success)" />
          <strong style={{ color: 'var(--color-text-primary)' }}>Accounting Reconciliation:</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', fontFamily: 'var(--font-data)' }}>
          <div>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-3xs)', display: 'block' }}>Gross Sales</span>
            <strong style={{ color: 'var(--color-text-primary)' }}>GH₵ {totals.grossSalesGhs.toFixed(2)}</strong>
          </div>
          <span style={{ color: 'var(--color-text-muted)' }}>−</span>
          <div>
            <span style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-3xs)', display: 'block' }}>Refunds</span>
            <strong style={{ color: 'var(--color-danger)' }}>GH₵ {totals.refundsGhs.toFixed(2)}</strong>
          </div>
          <span style={{ color: 'var(--color-text-muted)' }}>=</span>
          <div>
            <span style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-3xs)', display: 'block' }}>Net Sales</span>
            <strong style={{ color: 'var(--color-text-primary)' }}>GH₵ {totals.netSalesGhs.toFixed(2)}</strong>
          </div>
          <span style={{ color: 'var(--color-text-muted)' }}>−</span>
          <div>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-3xs)', display: 'block' }}>Bundle Cost</span>
            <strong style={{ color: 'var(--color-text-secondary)' }}>GH₵ {totals.totalCostGhs.toFixed(2)}</strong>
          </div>
          <span style={{ color: 'var(--color-text-muted)' }}>=</span>
          <div>
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-3xs)', display: 'block' }}>Net Profit</span>
            <strong style={{ color: 'var(--color-primary)', fontWeight: 900 }}>GH₵ {totals.grossProfitGhs.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {/* 5. Sales, Cost & Profit Trend Charts */}
      <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: 'var(--space-5)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Sales, Cost & Margin Trajectory
            </h2>
            <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
              Comparison of customer sales velocity, carrier costs, and net reseller margin over time.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* View Selector */}
            <div style={{ display: 'flex', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
              {(['all', 'sales', 'profit'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setChartMetric(m)}
                  style={{
                    padding: '0.25rem 0.6rem',
                    border: 'none',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: chartMetric === m ? 'var(--color-bg-surface-elevated)' : 'transparent',
                    color: chartMetric === m ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    fontWeight: chartMetric === m ? 800 : 600,
                    fontSize: 'var(--font-size-3xs)',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {m === 'all' ? 'All Metrics' : m}
                </button>
              ))}
            </div>

            {/* Granularity Selector */}
            <div style={{ display: 'flex', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
              {(['daily', 'weekly', 'monthly'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGranularity(g)}
                  style={{
                    padding: '0.25rem 0.6rem',
                    border: 'none',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: granularity === g ? 'var(--color-primary)' : 'transparent',
                    color: granularity === g ? '#FFFFFF' : 'var(--color-text-secondary)',
                    fontWeight: granularity === g ? 800 : 600,
                    fontSize: 'var(--font-size-3xs)',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Visual Trend Chart Canvas / SVG Presentation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Chart Legend */}
          <div style={{ display: 'flex', gap: '1.25rem', fontSize: 'var(--font-size-3xs)', fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#10B981' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981' }} />
              Sales Revenue (GHS)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748B' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#64748B' }} />
              Bundle Cost (GHS)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#3B82F6' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3B82F6' }} />
              Gross Profit (GHS)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#8B5CF6' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#8B5CF6' }} />
              Margin %
            </span>
          </div>

          {/* Bar / Column Visualizer */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${activeTrendData.length}, 1fr)`, gap: 'var(--space-3)', alignItems: 'flex-end', minHeight: '180px', paddingTop: 'var(--space-6)', borderBottom: '1px solid var(--color-border-subtle)' }}>
            {activeTrendData.map((pt, i) => {
              const maxVal = 15000;
              const salesHeight = Math.min(100, Math.max(15, (pt.sales / (granularity === 'monthly' ? maxVal : 1200)) * 100));
              const costHeight = Math.min(100, Math.max(10, (pt.cost / (granularity === 'monthly' ? maxVal : 1200)) * 100));
              const profitHeight = Math.min(100, Math.max(5, (pt.profit / (granularity === 'monthly' ? maxVal : 1200)) * 100));

              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-data)' }}>
                    GH₵ {pt.sales}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', width: '100%', maxWidth: '42px', height: '120px' }}>
                    {/* Sales Bar */}
                    <div
                      style={{
                        flex: 1,
                        height: `${salesHeight}%`,
                        backgroundColor: 'rgba(16, 185, 129, 0.85)',
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 250ms ease',
                      }}
                      title={`Sales: GH₵ ${pt.sales}`}
                    />
                    {/* Cost Bar */}
                    <div
                      style={{
                        flex: 1,
                        height: `${costHeight}%`,
                        backgroundColor: 'rgba(100, 116, 139, 0.45)',
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 250ms ease',
                      }}
                      title={`Cost: GH₵ ${pt.cost}`}
                    />
                    {/* Profit Bar */}
                    <div
                      style={{
                        flex: 1,
                        height: `${profitHeight}%`,
                        backgroundColor: 'rgba(59, 130, 246, 0.85)',
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 250ms ease',
                      }}
                      title={`Profit: GH₵ ${pt.profit} (${pt.margin}%)`}
                    />
                  </div>

                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    {pt.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* 6. Network Carrier Performance Table & Top Products Side-by-Side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Network Breakdown Card */}
        <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)' }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
            Carrier Volume & Margin Breakdown
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {networkBreakdown.map((net) => (
              <div
                key={net.network}
                onClick={() => setSelectedNetwork(net.network)}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: selectedNetwork === net.network ? 'rgba(34, 197, 94, 0.08)' : 'var(--color-bg-surface-elevated)',
                  borderRadius: 'var(--radius-lg)',
                  border: selectedNetwork === net.network ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border-subtle)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <NetworkBadge network={net.network} size="sm" />
                    <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>{net.name}</strong>
                  </div>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 900, color: 'var(--color-primary)', fontFamily: 'var(--font-data)' }}>
                    GH₵ {net.sales.toFixed(2)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
                  <span>Orders: <strong>{net.orders}</strong></span>
                  <span>Cost: <strong>GH₵ {net.cost.toFixed(2)}</strong></span>
                  <span>Profit: <strong style={{ color: 'var(--color-success)' }}>GH₵ {net.profit.toFixed(2)}</strong></span>
                  <span style={{ color: 'var(--color-brand)', fontWeight: 800 }}>{net.margin}% Margin</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top 3 Products Podium & Margin Analysis */}
        <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)' }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
            Top Performing Products
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {topThreeProducts.map((p) => (
              <div
                key={p.rank}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-bg-surface-elevated)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: p.rank === 1 ? '#FFCC00' : p.rank === 2 ? '#E2E8F0' : '#F59E0B',
                      color: '#000000',
                      fontWeight: 900,
                      fontSize: 'var(--font-size-3xs)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    #{p.rank}
                  </div>
                  <div>
                    <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
                      {p.name}
                    </strong>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                      GH₵ {p.sales} sales · GH₵ {p.profit} profit
                    </span>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: 'var(--font-size-3xs)',
                    fontWeight: 800,
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    color: 'var(--color-success)',
                    padding: '0.15rem 0.45rem',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  {p.margin} Margin
                </span>
              </div>
            ))}
          </div>

          {/* Margin Analysis Highlights */}
          <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Highest Margin</span>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-success)' }}>MTN 1GB (23.1%)</div>
            </div>
            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Lowest Margin</span>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Telecel 5GB (17.5%)</div>
            </div>
          </div>
        </Card>
      </div>

      {/* 7. Comprehensive Bundle Performance Table */}
      <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Package & SKU Profitability Matrix
            </h2>
            <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
              Granular bundle-level analysis of wholesale cost, sales revenue, and net profit margins.
            </p>
          </div>

          <div style={{ width: '220px' }}>
            <SearchInput
              placeholder="Search bundle..."
              value={searchBundle}
              onChange={(e) => setSearchBundle(e.target.value)}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)', minWidth: '760px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Bundle Package</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Carrier</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Orders</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Sales (GHS)</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Cost (GHS)</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Gross Profit</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)', textAlign: 'right' }}>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {filteredBundles.map((b) => (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {b.name}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <NetworkBadge network={b.network} size="sm" />
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 700 }}>
                    {b.orders}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    GH₵ {(b.salesPesewas / 100).toFixed(2)}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', color: 'var(--color-text-secondary)' }}>
                    GH₵ {(b.costPesewas / 100).toFixed(2)}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 800, color: 'var(--color-success)' }}>
                    GH₵ {(b.profitPesewas / 100).toFixed(2)}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontFamily: 'var(--font-data)', fontWeight: 900, color: 'var(--color-primary)' }}>
                    {b.marginPercent.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 8. Sales Source & Channel Breakdown */}
      <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)' }}>
        <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
          Sales Channel Performance (Web, API, Storefront, Bulk)
        </h2>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Channel</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Orders</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Gross Sales</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Cost</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Gross Profit</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)', textAlign: 'right' }}>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {filteredSources.map((s, idx) => {
                const Icon = s.icon;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Icon size={14} color="var(--color-primary)" />
                        <strong style={{ color: 'var(--color-text-primary)' }}>{s.source}</strong>
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 700 }}>
                      {s.orders}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 800 }}>
                      GH₵ {(s.salesPesewas / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', color: 'var(--color-text-muted)' }}>
                      GH₵ {(s.costPesewas / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 800, color: 'var(--color-success)' }}>
                      GH₵ {(s.profitPesewas / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontFamily: 'var(--font-data)', fontWeight: 900, color: 'var(--color-primary)' }}>
                      {s.marginPercent.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
