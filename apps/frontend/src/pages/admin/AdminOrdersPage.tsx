import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Select } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import {
  Download,
  RefreshCw,
  Package,
  CheckCircle2,
  Activity,
  AlertOctagon,
  Clock,
  RotateCcw,
  ShieldCheck,
  ExternalLink,
  Server,
  Zap,
  Copy,
  Check,
  Calendar,
  X,
  Eye,
  Phone,
  DollarSign,
  Radio,
  FileText,
  PauseCircle,
  PlayCircle,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';
import { adminApi, AdminOrderListItem, AdminOrderStats, AdminOrderDetail, AdminOrderProcessingStatusDto } from '../../api/admin.api.js';
import { useToast } from '../../context/ToastContext.js';

export const AdminOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toastSuccess, toastError } = useToast();

  // Query state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [lifecycleFilter, setLifecycleFilter] = useState(searchParams.get('lifecycle') || 'ALL');
  const [paymentFilter, setPaymentFilter] = useState(searchParams.get('payment') || 'ALL');
  const [networkFilter, setNetworkFilter] = useState(searchParams.get('network') || 'ALL');
  const [sourceFilter, setSourceFilter] = useState(searchParams.get('source') || 'ALL');
  const [periodFilter, setPeriodFilter] = useState(searchParams.get('period') || 'ALL');
  const [operationalStateFilter, setOperationalStateFilter] = useState(searchParams.get('state') || 'ALL');
  
  // Custom Date Range State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Data state
  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [stats, setStats] = useState<AdminOrderStats>({
    totalOrders: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    refunded: 0,
    awaitingApproval: 0,
    syncIssues: 0,
    reconciliationRequired: 0,
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [_lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Selected Order Drawer State
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(searchParams.get('orderId') || null);
  const [orderDetail, setOrderDetail] = useState<AdminOrderDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Refund Modal State
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);

  // Reconcile & Retry loading
  const [isReconciling, setIsReconciling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Operational Pause / Resume State
  const [orderProcessingStatus, setOrderProcessingStatus] = useState<AdminOrderProcessingStatusDto | null>(null);
  const [isLoadingProcessingStatus, setIsLoadingProcessingStatus] = useState(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [isPausing, setIsPausing] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [resumeReason, setResumeReason] = useState('');
  const [resumeAutoReenqueue, setResumeAutoReenqueue] = useState(true);
  const [isResuming, setIsResuming] = useState(false);
  const [isExportingPaused, setIsExportingPaused] = useState(false);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Fetch summary stats with active filters applied
  const fetchStats = useCallback(async () => {
    try {
      const res = await adminApi.getOrderStats({
        search: searchQuery.trim() || undefined,
        lifecycle: lifecycleFilter !== 'ALL' ? lifecycleFilter : undefined,
        paymentStatus: paymentFilter !== 'ALL' ? paymentFilter : undefined,
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
        source: sourceFilter !== 'ALL' ? sourceFilter : undefined,
        period: periodFilter !== 'ALL' && periodFilter !== 'CUSTOM' ? periodFilter : undefined,
        startDate: periodFilter === 'CUSTOM' && startDate ? startDate : undefined,
        endDate: periodFilter === 'CUSTOM' && endDate ? endDate : undefined,
        operationalState: operationalStateFilter !== 'ALL' ? operationalStateFilter : undefined,
      });
      if (res) setStats(res);
    } catch {
      // Ignore
    }
  }, [searchQuery, lifecycleFilter, paymentFilter, networkFilter, sourceFilter, periodFilter, startDate, endDate, operationalStateFilter]);

  // Fetch orders list
  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getOrders({
        page,
        limit: pageSize,
        search: searchQuery.trim() || undefined,
        lifecycle: lifecycleFilter !== 'ALL' ? lifecycleFilter : undefined,
        paymentStatus: paymentFilter !== 'ALL' ? paymentFilter : undefined,
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
        source: sourceFilter !== 'ALL' ? sourceFilter : undefined,
        period: periodFilter !== 'ALL' && periodFilter !== 'CUSTOM' ? periodFilter : undefined,
        startDate: periodFilter === 'CUSTOM' && startDate ? startDate : undefined,
        endDate: periodFilter === 'CUSTOM' && endDate ? endDate : undefined,
        operationalState: operationalStateFilter !== 'ALL' ? operationalStateFilter : undefined,
      });

      if (res && Array.isArray(res.orders)) {
        setOrders(res.orders);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalOrders(res.pagination?.total || res.orders.length);
        setLastRefreshed(new Date());
      } else {
        setOrders([]);
        setTotalPages(1);
        setTotalOrders(0);
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to load platform orders');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, searchQuery, lifecycleFilter, paymentFilter, networkFilter, sourceFilter, periodFilter, startDate, endDate, operationalStateFilter, toastError]);

  // Fetch platform order processing & pause status
  const fetchProcessingStatus = useCallback(async () => {
    setIsLoadingProcessingStatus(true);
    try {
      const res = await adminApi.getOrderProcessingStatus();
      if (res) setOrderProcessingStatus(res);
    } catch {
      // Non-fatal
    } finally {
      setIsLoadingProcessingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchProcessingStatus();
  }, [fetchProcessingStatus]);

  // Real-time synchronization
  useEffect(() => {
    const handleUpdate = () => {
      fetchOrders();
      fetchStats();
      fetchProcessingStatus();
    };
    window.addEventListener('order-created', handleUpdate);
    window.addEventListener('orders-updated', handleUpdate);
    window.addEventListener('platform-status-check', handleUpdate);
    window.addEventListener('order-processing-pause-active', handleUpdate);
    return () => {
      window.removeEventListener('order-created', handleUpdate);
      window.removeEventListener('orders-updated', handleUpdate);
      window.removeEventListener('platform-status-check', handleUpdate);
      window.removeEventListener('order-processing-pause-active', handleUpdate);
    };
  }, [fetchOrders, fetchStats, fetchProcessingStatus]);

  // Fetch individual order detail
  const fetchOrderDetail = useCallback(async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await adminApi.getOrderDetail(id);
      if (res) setOrderDetail(res);
    } catch (err: any) {
      toastError(err?.message || 'Failed to load order dossier.');
      setSelectedOrderId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, [toastError]);

  useEffect(() => {
    if (selectedOrderId) {
      fetchOrderDetail(selectedOrderId);
    } else {
      setOrderDetail(null);
    }
  }, [selectedOrderId, fetchOrderDetail]);

  // Handle Export
  const handleExport = async (format: 'CSV' | 'JSON') => {
    setIsExporting(true);
    try {
      const res = await adminApi.exportOrders({
        search: searchQuery.trim() || undefined,
        lifecycle: lifecycleFilter !== 'ALL' ? lifecycleFilter : undefined,
        paymentStatus: paymentFilter !== 'ALL' ? paymentFilter : undefined,
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
        source: sourceFilter !== 'ALL' ? sourceFilter : undefined,
        period: periodFilter !== 'ALL' && periodFilter !== 'CUSTOM' ? periodFilter : undefined,
        operationalState: operationalStateFilter !== 'ALL' ? operationalStateFilter : undefined,
        format,
      } as any);

      if (format === 'JSON') {
        const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bytebeacon-orders-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([res as any], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bytebeacon-orders-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toastSuccess(`Exported platform orders as ${format}.`);
    } catch (err: any) {
      toastError(err?.message || 'Failed to export orders.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleReconcileOrder = async () => {
    if (!selectedOrderId) return;
    setIsReconciling(true);
    try {
      await adminApi.reconcileOrder(selectedOrderId);
      toastSuccess(`Reconciliation completed for Order [${selectedOrderId}].`);
      fetchOrderDetail(selectedOrderId);
      fetchOrders();
      fetchStats();
    } catch (err: any) {
      toastError(err?.message || 'Order reconciliation failed.');
    } finally {
      setIsReconciling(false);
    }
  };

  const handleRetryOrder = async () => {
    if (!selectedOrderId) return;
    setIsRetrying(true);
    try {
      await adminApi.retryOrder(selectedOrderId);
      toastSuccess(`Order [${selectedOrderId}] queued for fulfillment retry.`);
      fetchOrderDetail(selectedOrderId);
      fetchOrders();
      fetchStats();
    } catch (err: any) {
      toastError(err?.message || 'Failed to retry order fulfillment.');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRefundOrder = async () => {
    if (!selectedOrderId || !refundReason.trim()) return;
    setIsRefunding(true);
    try {
      await adminApi.refundOrder(selectedOrderId, refundReason.trim());
      toastSuccess(`Order [${selectedOrderId}] successfully refunded.`);
      setIsRefundModalOpen(false);
      setRefundReason('');
      fetchOrderDetail(selectedOrderId);
      fetchOrders();
      fetchStats();
    } catch (err: any) {
      toastError(err?.message || 'Failed to issue refund.');
    } finally {
      setIsRefunding(false);
    }
  };

  const handlePauseOperations = async () => {
    if (!pauseReason.trim()) {
      toastError('Mandatory Reason', 'Please provide a justification for pausing order operations.');
      return;
    }
    setIsPausing(true);
    try {
      const res = await adminApi.pauseOrderOperations({
        reason: pauseReason.trim(),
      });
      toastSuccess(`Order operations paused. ${res.heldOrdersCount || 0} active processing order(s) held in PAUSED status.`);
      setOrderProcessingStatus(res);
      setIsPauseModalOpen(false);
      setPauseReason('');
      fetchOrders();
      fetchStats();
      window.dispatchEvent(new CustomEvent('platform-status-check'));
    } catch (err: any) {
      toastError(err?.message || 'Failed to pause order operations.');
    } finally {
      setIsPausing(false);
    }
  };

  const handleResumeOperations = async () => {
    setIsResuming(true);
    try {
      const res = await adminApi.resumeOrderOperations({
        reason: resumeReason.trim() || undefined,
        autoReenqueue: resumeAutoReenqueue,
      });
      toastSuccess(`Order operations resumed. ${res.heldOrdersCount || 0} held order(s) restored.`);
      setOrderProcessingStatus(res);
      setIsResumeModalOpen(false);
      setResumeReason('');
      fetchOrders();
      fetchStats();
      window.dispatchEvent(new CustomEvent('platform-status-check'));
    } catch (err: any) {
      toastError(err?.message || 'Failed to resume order operations.');
    } finally {
      setIsResuming(false);
    }
  };

  const handleExportPausedOrders = async (format: 'XLSX' | 'CSV' = 'XLSX') => {
    setIsExportingPaused(true);
    try {
      const blob = await adminApi.exportPausedOrders({ format });
      const mimeType = format === 'XLSX'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv;charset=utf-8;';
      const fileBlob = new Blob([blob], { type: mimeType });
      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bytebeacon-paused-orders-${new Date().toISOString().slice(0, 10)}.${format.toLowerCase()}`;
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess(`Exported paused orders as ${format}.`);
    } catch (err: any) {
      toastError(err?.message || 'Failed to export paused orders.');
    } finally {
      setIsExportingPaused(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setLifecycleFilter('ALL');
    setPaymentFilter('ALL');
    setNetworkFilter('ALL');
    setSourceFilter('ALL');
    setPeriodFilter('ALL');
    setOperationalStateFilter('ALL');
    setStartDate('');
    setEndDate('');
    setIsCustomDateOpen(false);
    setPage(1);
  };

  // Active filters list
  const activeFilters = useMemo(() => {
    const list: Array<{ id: string; label: string; onRemove: () => void }> = [];

    if (networkFilter !== 'ALL') {
      list.push({ id: 'net', label: `Network: ${networkFilter}`, onRemove: () => { setNetworkFilter('ALL'); setPage(1); } });
    }
    if (lifecycleFilter !== 'ALL') {
      list.push({ id: 'lc', label: `Lifecycle: ${lifecycleFilter}`, onRemove: () => { setLifecycleFilter('ALL'); setPage(1); } });
    }
    if (paymentFilter !== 'ALL') {
      list.push({ id: 'pmt', label: `Payment: ${paymentFilter}`, onRemove: () => { setPaymentFilter('ALL'); setPage(1); } });
    }
    if (sourceFilter !== 'ALL') {
      list.push({ id: 'src', label: `Source: ${sourceFilter}`, onRemove: () => { setSourceFilter('ALL'); setPage(1); } });
    }
    if (operationalStateFilter !== 'ALL') {
      list.push({ id: 'st', label: `State: ${operationalStateFilter}`, onRemove: () => { setOperationalStateFilter('ALL'); setPage(1); } });
    }
    if (periodFilter !== 'ALL') {
      const label = periodFilter === 'CUSTOM' && startDate && endDate ? `${startDate} to ${endDate}` : periodFilter;
      list.push({ id: 'prd', label: `Period: ${label}`, onRemove: () => { setPeriodFilter('ALL'); setStartDate(''); setEndDate(''); setIsCustomDateOpen(false); setPage(1); } });
    }
    if (searchQuery.trim()) {
      list.push({ id: 'q', label: `Query: "${searchQuery}"`, onRemove: () => { setSearchQuery(''); setPage(1); } });
    }

    return list;
  }, [networkFilter, lifecycleFilter, paymentFilter, sourceFilter, operationalStateFilter, periodFilter, startDate, endDate, searchQuery]);

  // Network badge renderer
  const renderNetworkBadge = (net: string | null | undefined) => {
    const n = String(net || '').toUpperCase();
    if (n === 'MTN') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.2rem 0.55rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: '#FEF3C7',
            color: '#B45309',
            fontWeight: 800,
            fontSize: '11px',
            letterSpacing: '0.02em',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#D97706' }} />
          MTN
        </span>
      );
    }
    if (n === 'TELECEL') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.2rem 0.55rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: '#FEE2E2',
            color: '#B91C1C',
            fontWeight: 800,
            fontSize: '11px',
            letterSpacing: '0.02em',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#DC2626' }} />
          Telecel
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.2rem 0.55rem',
          borderRadius: 'var(--radius-full)',
          backgroundColor: '#E0F2FE',
          color: '#0369A1',
          fontWeight: 800,
          fontSize: '11px',
          letterSpacing: '0.02em',
        }}
      >
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0284C7' }} />
        AT
      </span>
    );
  };

  const renderOrderStatusBadge = (status: any) => {
    const s = typeof status === 'object' ? String(status?.orderStatus || status?.status || 'UNKNOWN') : String(status || '');
    switch (s.toUpperCase()) {
      case 'COMPLETED':
      case 'DELIVERED':
      case 'FULFILLED':
        return <Badge variant="success" size="sm" dot>Fulfilled</Badge>;
      case 'PROCESSING':
      case 'SUBMITTED':
        return <Badge variant="info" size="sm" dot>Processing</Badge>;
      case 'READY_FOR_FULFILLMENT':
      case 'PENDING':
      case 'CREATED':
        return <Badge variant="neutral" size="sm" dot>Pending</Badge>;
      case 'AWAITING_APPROVAL':
        return <Badge variant="warning" size="sm" dot>Awaiting MTN</Badge>;
      case 'FAILED':
      case 'CANCELLED':
        return <Badge variant="danger" size="sm" dot>Failed</Badge>;
      case 'PAUSED':
        return <Badge variant="warning" size="sm" dot>Paused</Badge>;
      case 'REFUNDED':
        return <Badge variant="neutral" size="sm" dot>Refunded</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{s || 'Unknown'}</Badge>;
    }
  };

  const renderPaymentBadge = (status: any) => {
    const s = typeof status === 'object' ? String(status?.paymentStatus || status?.status || 'UNKNOWN') : String(status || '');
    switch (s.toUpperCase()) {
      case 'PAID':
      case 'VERIFIED':
      case 'SUCCESS':
        return <Badge variant="success" size="sm">Paid</Badge>;
      case 'INITIATED':
      case 'AUTHORIZED':
      case 'PENDING':
      case 'PROCESSING':
        return <Badge variant="warning" size="sm">Pending</Badge>;
      case 'FAILED':
        return <Badge variant="danger" size="sm">Failed</Badge>;
      case 'REFUNDED':
        return <Badge variant="neutral" size="sm">Refunded</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{s || 'Unpaid'}</Badge>;
    }
  };

  const renderProviderStatusBadge = (status: string | null | undefined) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'COMPLETED':
      case 'FULFILLED':
      case 'DELIVERED':
      case 'SUCCESS':
        return <Badge variant="success" size="sm" dot>Fulfilled</Badge>;
      case 'PROCESSING':
      case 'RECEIVED':
      case 'SUBMITTED':
        return <Badge variant="info" size="sm" dot>In Flight</Badge>;
      case 'FAILED':
      case 'REJECTED':
      case 'VALIDATION_FAILED':
        return <Badge variant="danger" size="sm" dot>Rejected</Badge>;
      case 'PENDING_APPROVAL':
      case 'AWAITING_APPROVAL':
        return <Badge variant="warning" size="sm" dot>Awaiting ACK</Badge>;
      case 'PENDING':
      case 'PENDING_DISPATCH':
        return <Badge variant="neutral" size="sm" dot>Pending Dispatch</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status || 'Unsynced'}</Badge>;
    }
  };

  return (
    <div
      style={{
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
      }}
    >
      {/* 1. Header Toolbar with Prominent, Styled Action Buttons */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Package} color="orders" size="lg" />
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
                Operations Control Plane
              </span>
              <Badge variant="brand" size="sm">Phase 11.5</Badge>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>•</span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Authoritative Master Ledger
              </span>
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              All System Orders
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Investigate, reconcile, dispatch, and audit every telecom data bundle transaction across ByteBeacon 2.0.
            </p>
          </div>
        </div>

        {/* Action Buttons with Real Button Styling */}
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => { fetchStats(); fetchOrders(); }}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-tactile-sm)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => handleExport('CSV')}
            disabled={isExporting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-tactile-sm)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              cursor: isExporting ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => handleExport('JSON')}
            disabled={isExporting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-tactile-sm)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              cursor: isExporting ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Download size={14} />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* 1.5. Operational Control Banner: Pause / Resume & Emergency Export */}
      <div
        style={{
          borderRadius: 'var(--radius-xl)',
          padding: '1rem 1.35rem',
          backgroundColor: orderProcessingStatus?.isPaused
            ? 'rgba(239, 68, 68, 0.08)'
            : 'rgba(16, 185, 129, 0.06)',
          border: orderProcessingStatus?.isPaused
            ? '1.5px solid rgba(239, 68, 68, 0.35)'
            : '1px solid rgba(16, 185, 129, 0.25)',
          boxShadow: 'var(--shadow-tactile-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          transition: 'all var(--transition-fast)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {orderProcessingStatus?.isPaused ? (
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <PauseCircle size={22} color="#EF4444" />
            </div>
          ) : (
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <PlayCircle size={22} color="#10B981" />
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 800,
                  color: orderProcessingStatus?.isPaused ? '#EF4444' : 'var(--color-text-primary)',
                  letterSpacing: '-0.01em',
                }}
              >
                {orderProcessingStatus?.isPaused
                  ? 'ORDER PROCESSING & EXCEL UPLOADS PAUSED'
                  : 'Order Processing & Bulk Uploads: ACTIVE'}
              </span>
              <Badge
                variant={orderProcessingStatus?.isPaused ? 'danger' : 'success'}
                size="sm"
                dot
              >
                {orderProcessingStatus?.isPaused ? 'RESTRICTED' : 'OPERATIONAL'}
              </Badge>
              {orderProcessingStatus?.heldOrdersCount ? (
                <Badge variant="warning" size="sm">
                  {orderProcessingStatus.heldOrdersCount} in-flight order(s) held
                </Badge>
              ) : null}
            </div>

            <p
              style={{
                margin: '0.2rem 0 0 0',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.4,
              }}
            >
              {orderProcessingStatus?.isPaused
                ? `Operations frozen${orderProcessingStatus.reason ? `: "${orderProcessingStatus.reason}"` : ''} • Paused by: ${orderProcessingStatus.pausedBy || 'Admin'}${orderProcessingStatus.pausedAt ? ` at ${new Date(orderProcessingStatus.pausedAt).toLocaleTimeString()}` : ''}. All customer checkouts, agent storefront orders, and Excel uploads are held.`
                : 'All customer checkouts, agent storefront orders, Excel bulk uploads, and automated telecom dispatches are running normally.'}
            </p>
          </div>
        </div>

        {/* Operational Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {orderProcessingStatus?.isPaused ? (
            <>
              <button
                type="button"
                onClick={() => handleExportPausedOrders('XLSX')}
                disabled={isExportingPaused}
                title="Export all orders that were in processing when paused into a native Excel spreadsheet"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#1E293B',
                  border: '1px solid #334155',
                  color: '#38BDF8',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  cursor: isExportingPaused ? 'not-allowed' : 'pointer',
                  boxShadow: 'var(--shadow-tactile-sm)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <FileSpreadsheet size={14} />
                <span>{isExportingPaused ? 'Exporting...' : 'Export Paused Orders (Excel)'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportPausedOrders('CSV')}
                disabled={isExportingPaused}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  cursor: isExportingPaused ? 'not-allowed' : 'pointer',
                  boxShadow: 'var(--shadow-tactile-sm)',
                }}
              >
                <Download size={14} />
                <span>CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setIsResumeModalOpen(true)}
                disabled={isResuming}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#10B981',
                  border: '1px solid #059669',
                  color: '#FFFFFF',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <PlayCircle size={15} />
                <span>Resume Order Operations</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsPauseModalOpen(true)}
              disabled={isPausing || isLoadingProcessingStatus}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.5rem 0.95rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#EF4444',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-tactile-sm)',
                transition: 'all var(--transition-fast)',
              }}
            >
              <PauseCircle size={14} />
              <span>Pause Order Operations</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Responsive Operational Summary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        <MetricCard
          title="Total Orders"
          value={(stats.totalOrders || 0).toLocaleString()}
          subvalue={activeFilters.length > 0 ? "Filtered count" : "Recorded in platform"}
          accent="blue"
          icon={<TactileIcon icon={Package} color="orders" size="sm" />}
        />
        <MetricCard
          title="In-Flight Processing"
          value={(stats.processing || 0).toLocaleString()}
          subvalue={activeFilters.length > 0 ? "Filtered in-flight" : "Awaiting telecom ACK"}
          accent="cyan"
          icon={<TactileIcon icon={Activity} color="analytics" size="sm" />}
        />
        <MetricCard
          title="Paused in Flight"
          value={(stats.paused || 0).toLocaleString()}
          subvalue={activeFilters.length > 0 ? "Filtered paused" : "Orders frozen during pause"}
          accent={(stats.paused || 0) > 0 ? 'amber' : 'green'}
          icon={<TactileIcon icon={PauseCircle} color={(stats.paused || 0) > 0 ? 'speed' : 'security'} size="sm" />}
        />
        <MetricCard
          title="Completed Deliveries"
          value={(stats.completed || 0).toLocaleString()}
          subvalue={activeFilters.length > 0 ? "Filtered completed" : "Authoritative fulfillment"}
          accent="green"
          icon={<TactileIcon icon={CheckCircle2} color="security" size="sm" />}
        />
        <MetricCard
          title="Failed Dispatches"
          value={(stats.failed || 0).toLocaleString()}
          subvalue={activeFilters.length > 0 ? "Filtered failed" : "DLQ / Retry candidates"}
          accent="red"
          icon={<TactileIcon icon={AlertOctagon} color="red" size="sm" />}
        />
        <MetricCard
          title="Resolved Refunds"
          value={(stats.refunded || 0).toLocaleString()}
          subvalue={activeFilters.length > 0 ? "Filtered refunded" : "Ledger reversed"}
          accent="purple"
          icon={<TactileIcon icon={RotateCcw} color="orders" size="sm" />}
        />
        <MetricCard
          title="Awaiting MTN Approvals"
          value={(stats.awaitingApproval || 0).toLocaleString()}
          subvalue={activeFilters.length > 0 ? "Filtered approvals" : "Beneficiary validation"}
          accent="orange"
          icon={<TactileIcon icon={Clock} color="speed" size="sm" />}
        />
        <MetricCard
          title="Sync Issues"
          value={(stats.syncIssues || 0).toLocaleString()}
          subvalue={activeFilters.length > 0 ? "Filtered sync issues" : "Provider lag detected"}
          accent="orange"
          icon={<TactileIcon icon={Server} color="speed" size="sm" />}
        />
        <MetricCard
          title="Recon Required"
          value={(stats.reconciliationRequired || 0).toLocaleString()}
          subvalue={activeFilters.length > 0 ? "Filtered recon" : "State divergence detected"}
          accent={(stats.reconciliationRequired || 0) > 0 ? 'red' : 'green'}
          icon={<TactileIcon icon={ShieldCheck} color={(stats.reconciliationRequired || 0) > 0 ? 'red' : 'security'} size="sm" />}
        />
      </div>

      {/* 3. Compact, Standard Horizontal Advanced Filter Suite */}
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
        {/* Main Controls Row: Horizontal and Compact */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.65rem',
            justifyContent: 'space-between',
          }}
        >
          {/* Search Box (Takes flexible space) */}
          <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
            <SearchInput
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search Order ID, Phone, Customer, Ref..."
            />
          </div>

          {/* Horizontal Dropdowns: Compact, Constrained Widths */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.45rem',
              alignItems: 'center',
            }}
          >
            {/* Network */}
            <div style={{ width: '135px' }}>
              <Select
                value={networkFilter}
                onChange={(e) => {
                  setNetworkFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Networks', value: 'ALL' },
                  { label: 'MTN Ghana', value: 'MTN' },
                  { label: 'Telecel Ghana', value: 'TELECEL' },
                  { label: 'AT (AirtelTigo)', value: 'AIRTELTIGO' },
                ]}
              />
            </div>

            {/* Lifecycle */}
            <div style={{ width: '150px' }}>
              <Select
                value={lifecycleFilter}
                onChange={(e) => {
                  setLifecycleFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Lifecycles', value: 'ALL' },
                  { label: 'Fulfilled / Completed', value: 'COMPLETED' },
                  { label: 'Processing / In Flight', value: 'PROCESSING' },
                  { label: 'Paused / Operations Freeze', value: 'PAUSED' },
                  { label: 'Submitted', value: 'SUBMITTED' },
                  { label: 'Pending', value: 'PENDING' },
                  { label: 'Awaiting MTN', value: 'AWAITING_APPROVAL' },
                  { label: 'Failed', value: 'FAILED' },
                  { label: 'Refunded', value: 'REFUNDED' },
                ]}
              />
            </div>

            {/* Payment */}
            <div style={{ width: '135px' }}>
              <Select
                value={paymentFilter}
                onChange={(e) => {
                  setPaymentFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Payments', value: 'ALL' },
                  { label: 'Paid / Verified', value: 'PAID' },
                  { label: 'Unpaid / Pending', value: 'UNPAID' },
                  { label: 'Failed', value: 'FAILED' },
                  { label: 'Refunded', value: 'REFUNDED' },
                ]}
              />
            </div>

            {/* Channel / Actor Source */}
            <div style={{ width: '135px' }}>
              <Select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Channels', value: 'ALL' },
                  { label: 'Direct Customers', value: 'CUSTOMER' },
                  { label: 'Agents / Resellers', value: 'AGENT' },
                ]}
              />
            </div>

            {/* Operational State */}
            <div style={{ width: '155px' }}>
              <Select
                value={operationalStateFilter}
                onChange={(e) => {
                  setOperationalStateFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All States', value: 'ALL' },
                  { label: '⚠ Recon Required', value: 'RECONCILIATION_REQUIRED' },
                  { label: '⌛ Awaiting Approval', value: 'AWAITING_APPROVAL' },
                  { label: '❌ Failed Queue', value: 'FAILED_QUEUE' },
                  { label: '↺ Refund Pending', value: 'REFUND_PENDING' },
                ]}
              />
            </div>

            {/* Period / Date Range Selector */}
            <div style={{ width: '140px' }}>
              <Select
                value={periodFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setPeriodFilter(val);
                  if (val === 'CUSTOM') {
                    setIsCustomDateOpen(true);
                  } else {
                    setIsCustomDateOpen(false);
                    setStartDate('');
                    setEndDate('');
                  }
                  setPage(1);
                }}
                options={[
                  { label: 'All Time', value: 'ALL' },
                  { label: 'Today', value: 'TODAY' },
                  { label: 'Yesterday', value: 'YESTERDAY' },
                  { label: 'Last 7 Days', value: '7D' },
                  { label: 'Last 30 Days', value: '30D' },
                  { label: 'Last 90 Days', value: '90D' },
                  { label: 'This Month', value: 'MONTH' },
                  { label: 'Custom Range...', value: 'CUSTOM' },
                ]}
              />
            </div>

            {/* Quick Reset Action */}
            {activeFilters.length > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.5rem 0.65rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-surface-elevated)',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Range Picker Accordion (Expandable) */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={14} color="var(--color-text-muted)" />
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                Custom Date Filter:
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '0.35rem 0.6rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface-elevated)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '0.35rem 0.6rem',
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
              onClick={() => { setPage(1); fetchOrders(); }}
              disabled={!startDate || !endDate || isLoading}
              style={{ fontSize: '11px', fontWeight: 700, padding: '0.35rem 0.8rem' }}
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
              Clear All ({totalOrders.toLocaleString()} total)
            </button>
          </div>
        )}
      </Card>

      {/* 4. Spacious, Uncompressed Orders Table with Horizontal Breathing Room */}
      <Card
        elevated
        style={{
          padding: 0,
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-tactile-sm)',
          overflow: 'hidden',
        }}
      >
        <Table
          minWidth="1360px"
          headers={[
            'Order ID',
            'Customer',
            'Recipient Phone',
            'Network',
            'Data Size',
            'Amount (GHS)',
            'Payment',
            'Order Status',
            'Provider Status',
            'Created At',
            'Action',
          ]}
        >
          {orders.map((order) => {
            const amountGhs = ((order.amountPesewas || 0) / 100).toFixed(2);
            const bundleGb = order.dataAmountMb >= 1024
              ? `${(order.dataAmountMb / 1024).toFixed(1)} GB`
              : `${order.dataAmountMb} MB`;

            return (
              <tr
                key={order.id}
                style={{
                  borderBottom: '1px solid var(--color-border-subtle)',
                  transition: 'background-color var(--transition-fast)',
                }}
              >
                {/* Order ID */}
                <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                  <button
                    onClick={() => setSelectedOrderId(order.id)}
                    style={{
                      background: 'var(--color-bg-subtle)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.25rem 0.5rem',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--color-brand-primary)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                    title="Click to inspect order"
                  >
                    <span>{order.id.slice(0, 10)}...</span>
                  </button>
                </td>

                {/* Customer */}
                <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <button
                      onClick={() => navigate(`/admin/users/${order.userId}`)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-primary)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        padding: 0,
                        textAlign: 'left',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    >
                      <span>{order.userName || 'Customer'}</span>
                      <ExternalLink size={10} color="var(--color-text-muted)" />
                    </button>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {order.userEmail || '—'}
                    </span>
                  </div>
                </td>

                {/* Recipient Phone */}
                <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                  {order.recipientPhone}
                </td>

                {/* Network */}
                <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                  {renderNetworkBadge(order.network)}
                </td>

                {/* Data Size */}
                <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                  {bundleGb}
                </td>

                {/* Amount (GHS) */}
                <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                  GH₵ {amountGhs}
                </td>

                {/* Payment */}
                <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                  {renderPaymentBadge(order.paymentStatus)}
                </td>

                {/* Order Status */}
                <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                    {renderOrderStatusBadge(order.orderStatus)}
                    {(order.isPaused || order.orderStatus === 'PAUSED') && order.pausedFromStatus && (
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        (held: {order.pausedFromStatus})
                      </span>
                    )}
                  </div>
                </td>

                {/* Provider Status */}
                <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                  {renderProviderStatusBadge(order.providerStatus)}
                </td>

                {/* Created At */}
                <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                  {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>

                {/* Action */}
                <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-bg-surface-elevated)',
                      border: '1px solid var(--color-border-subtle)',
                      color: 'var(--color-brand-primary)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <Eye size={12} />
                    <span>Inspect</span>
                  </button>
                </td>
              </tr>
            );
          })}
        </Table>

        {orders.length === 0 && !isLoading && (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Package size={36} style={{ margin: '0 auto var(--space-2)', color: 'var(--color-text-muted)' }} />
            <p style={{ fontWeight: 700, margin: 0, fontSize: 'var(--font-size-sm)' }}>No orders matching query criteria.</p>
            <p style={{ fontSize: 'var(--font-size-xs)', margin: '0.25rem 0 0 0' }}>Try broadening your search term or clearing active filters.</p>
            {activeFilters.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleResetFilters} style={{ marginTop: 'var(--space-3)' }}>
                Reset All Filters
              </Button>
            )}
          </div>
        )}

        {/* Footer with Pagination and Counter */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-5)',
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Showing {orders.length} of {totalOrders.toLocaleString()} orders (Page {page} of {totalPages})
          </span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </Card>

      {/* 5. Executive Order Investigation Dossier Modal */}
      {selectedOrderId && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedOrderId(null)}
          title={`Order Control Center — #${selectedOrderId}`}
        >
          {isLoadingDetail ? (
            <div style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
              <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto var(--space-3)', color: 'var(--color-brand-primary)' }} />
              <p style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Loading authoritative order dossier...</p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Querying ledger records, carrier status, and validation logs.</p>
            </div>
          ) : orderDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Order Quick Action Toolbar & Status Bar */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--color-bg-subtle)',
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {renderOrderStatusBadge(orderDetail.order.orderStatus)}
                  {renderPaymentBadge(orderDetail.order.paymentStatus)}
                  {renderNetworkBadge(orderDetail.order.network)}
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Created {new Date(orderDetail.order.createdAt).toLocaleString()}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReconcileOrder}
                    disabled={isReconciling}
                    style={{ fontSize: '11px', fontWeight: 700 }}
                  >
                    <ShieldCheck size={13} className={isReconciling ? 'animate-spin' : ''} />
                    <span>Reconcile State</span>
                  </Button>

                  {orderDetail.order.orderStatus !== 'COMPLETED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetryOrder}
                      disabled={isRetrying}
                      style={{ fontSize: '11px', fontWeight: 700 }}
                    >
                      <Zap size={13} className={isRetrying ? 'animate-spin' : ''} />
                      <span>Retry Fulfillment</span>
                    </Button>
                  )}

                  {orderDetail.order.refundStatus !== 'COMPLETED' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setIsRefundModalOpen(true)}
                      style={{ fontSize: '11px', fontWeight: 700 }}
                    >
                      <RotateCcw size={13} />
                      <span>Issue Refund</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* 4 Mini Executive Metric Highlights */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Carrier</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.2rem' }}>
                    {orderDetail.order.network}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Data Package</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.2rem' }}>
                    {(orderDetail.order.dataAmountMb / 1024).toFixed(1)} GB
                  </div>
                </div>

                <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Amount Paid</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.2rem' }}>
                    GH₵ {((orderDetail.order.amountPesewas || 0) / 100).toFixed(2)}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Provider ACK</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.2rem' }}>
                    {String(orderDetail.providerOrder?.providerStatus || orderDetail.order.providerStatus || 'UNKNOWN')}
                  </div>
                </div>
              </div>

              {/* Lifecycle Visual Stepper */}
              <div
                style={{
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                    Order Lifecycle Progression
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-brand-primary)', fontWeight: 700 }}>
                    Current: {String(orderDetail.order.orderStatus)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                  {['CREATED', 'PENDING', 'SUBMITTED', 'PROCESSING', 'COMPLETED'].map((step, idx) => {
                    const statusOrder = ['CREATED', 'PENDING', 'SUBMITTED', 'PROCESSING', 'COMPLETED'];
                    const currentIdx = statusOrder.indexOf(String(orderDetail.order.orderStatus));
                    const isDone = currentIdx >= idx || orderDetail.order.orderStatus === 'COMPLETED';
                    const isCurrent = orderDetail.order.orderStatus === step;

                    return (
                      <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            background: isDone ? 'var(--color-brand-primary)' : 'var(--color-bg-subtle)',
                            color: isDone ? '#fff' : 'var(--color-text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 800,
                            border: `2px solid ${isCurrent ? 'var(--color-brand-primary)' : 'var(--color-border-subtle)'}`,
                          }}
                        >
                          {isDone ? <Check size={13} /> : idx + 1}
                        </div>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: isCurrent ? 800 : 600,
                            color: isCurrent ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
                            marginTop: '0.25rem',
                          }}
                        >
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DataHouse Authority Notice */}
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.22)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                }}
              >
                <ShieldCheck size={16} color="#16A34A" />
                <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600, lineHeight: 1.4 }}>
                  Authoritative Dispatch Invariant: Local order state reflects verifiable telecom carrier ACK receipts. Manual status overrides are disabled to preserve double-entry reconciliation integrity.
                </span>
              </div>

              {/* Operations Freeze Callout */}
              {(orderDetail.order.orderStatus === 'PAUSED' || orderDetail.order.isPaused) && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    gap: '0.6rem',
                    alignItems: 'center',
                  }}
                >
                  <AlertOctagon size={18} color="#D97706" />
                  <div style={{ fontSize: '11px', color: '#B45309', lineHeight: 1.4 }}>
                    <strong>Operations Freeze / Paused:</strong> This order is held in <strong>PAUSED</strong> status while in <strong>{orderDetail.order.pausedFromStatus || 'PROCESSING'}</strong>. It will be re-enqueued when operations resume.
                    {orderDetail.order.pauseReason && <div>Reason: <em>{orderDetail.order.pauseReason}</em></div>}
                  </div>
                </div>
              )}

              {/* 3-Column Info Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 'var(--space-4)',
                }}
              >
                {/* Beneficiary & Customer */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 'var(--space-3)' }}>
                    <Phone size={14} color="var(--color-text-muted)" />
                    <h4 style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
                      Beneficiary & Customer
                    </h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: 'var(--font-size-xs)' }}>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Recipient: </span>
                      <strong style={{ fontFamily: 'var(--font-mono)' }}>{orderDetail.order.recipientPhone}</strong>
                      <button
                        type="button"
                        onClick={() => handleCopy(orderDetail.order.recipientPhone, 'phone')}
                        style={{ marginLeft: '0.35rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                      >
                        {copiedField === 'phone' ? <Check size={11} color="#16A34A" /> : <Copy size={11} />}
                      </button>
                    </div>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Carrier: </span>{orderDetail.order.network}</div>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Bundle: </span>{(orderDetail.order.dataAmountMb / 1024).toFixed(1)} GB ({orderDetail.order.dataAmountMb} MB)</div>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Amount: </span>GH₵ {((orderDetail.order.amountPesewas || 0) / 100).toFixed(2)}</div>
                    
                    {orderDetail.customer && (
                      <div style={{ marginTop: '0.4rem', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.4rem' }}>
                        <div><span style={{ color: 'var(--color-text-muted)' }}>Customer: </span><strong>{orderDetail.customer.fullName}</strong></div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{orderDetail.customer.email}</div>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/users/${orderDetail.customer?.id}`)}
                          style={{
                            marginTop: '0.35rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--color-brand-primary)',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                          }}
                        >
                          <span>View User Dossier</span>
                          <ExternalLink size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Telecom Provider Dispatch Details */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 'var(--space-3)' }}>
                    <Radio size={14} color="var(--color-text-muted)" />
                    <h4 style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
                      Carrier Gateway Telemetry
                    </h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: 'var(--font-size-xs)' }}>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Provider: </span>{orderDetail.providerOrder?.providerName || 'Telecom Carrier Hub'}</div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Reference: </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                        {orderDetail.providerOrder?.providerReference || orderDetail.providerOrder?.providerOrderId || 'Pending Carrier ACK'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Status: </span>
                      {renderProviderStatusBadge(orderDetail.providerOrder?.providerStatus || orderDetail.order.providerStatus)}
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Last Synced: </span>
                      <span style={{ fontSize: '11px' }}>
                        {orderDetail.providerOrder?.lastSyncedAt ? new Date(orderDetail.providerOrder.lastSyncedAt).toLocaleString() : 'Live'}
                      </span>
                    </div>
                    {orderDetail.dlq && (
                      <div style={{ color: '#EF4444', marginTop: '0.25rem', fontSize: '11px', fontWeight: 600 }}>
                        <span>DLQ: {orderDetail.dlq.status} (Attempts: {orderDetail.dlq.attemptCount})</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial Ledger & Payment */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 'var(--space-3)' }}>
                    <DollarSign size={14} color="var(--color-text-muted)" />
                    <h4 style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
                      Financial Ledger State
                    </h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: 'var(--font-size-xs)' }}>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Payment Status: </span>
                      <strong>{String(orderDetail.order.paymentStatus || 'PAID')}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Reference: </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                        {orderDetail.payment?.reference || orderDetail.order.id.slice(0, 16)}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Refund Status: </span>
                      <span>{String(orderDetail.order.refundStatus || 'NONE')}</span>
                    </div>
                    {orderDetail.refund && (
                      <div style={{ color: '#8B5CF6', fontWeight: 700 }}>
                        Refunded: GH₵ {((orderDetail.refund.amountPesewas || 0) / 100).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Order Event Timeline Stream */}
              <div
                style={{
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FileText size={14} color="var(--color-text-muted)" />
                    <h4 style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
                      Order Audit Trail & Event Stream
                    </h4>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {orderDetail.events.length} logged events
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '220px', overflowY: 'auto' }}>
                  {orderDetail.events.map((ev) => {
                    const prevStr = typeof ev.previousState === 'object' ? JSON.stringify(ev.previousState) : String(ev.previousState || '');
                    const newStr = typeof ev.newState === 'object' ? JSON.stringify(ev.newState) : String(ev.newState || '');

                    return (
                      <div
                        key={ev.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: 'var(--font-size-xs)',
                          padding: '0.4rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--color-bg-subtle)',
                        }}
                      >
                        <div>
                          <strong style={{ color: 'var(--color-brand-primary)' }}>{String(ev.eventType)}</strong>
                          <span style={{ color: 'var(--color-text-muted)', marginLeft: '0.35rem', fontSize: '11px' }}>({String(ev.actorType)})</span>
                          {ev.previousState && (
                            <span style={{ marginLeft: '0.35rem', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                              : {prevStr} → {newStr}
                            </span>
                          )}
                        </div>
                        <span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                          {new Date(ev.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                  {orderDetail.events.length === 0 && (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', padding: '0.5rem 0' }}>
                      No discrete audit events logged for this order.
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </Modal>
      )}

      {/* 6. Double-Entry Refund Modal */}
      {isRefundModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsRefundModalOpen(false)}
          title={`Issue Double-Entry Refund — Order #${selectedOrderId}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
              This will execute a double-entry ledger refund voucher paired against <code>PLATFORM_ESCROW</code> and update the order state to <strong>REFUNDED</strong>.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '0.25rem' }}>
                Mandatory Audit Reason (min 5 characters)
              </label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Reason for refunding this order..."
                rows={3}
                style={{
                  width: '100%',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  background: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-xs)',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="ghost" onClick={() => setIsRefundModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleRefundOrder}
                disabled={isRefunding || refundReason.trim().length < 5}
              >
                {isRefunding ? 'Processing Refund...' : 'Confirm Double-Entry Refund'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 7. Pause Order Operations Modal */}
      {isPauseModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsPauseModalOpen(false)}
          title="⚠️ Pause Platform Order Operations & Excel Uploads"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div
              style={{
                padding: '0.85rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#EF4444',
                fontSize: 'var(--font-size-xs)',
                lineHeight: 1.5,
              }}
            >
              <strong>Caution — Platform Operational Freeze:</strong>
              <ul style={{ margin: '0.4rem 0 0 1.1rem', padding: 0 }}>
                <li>Customer checkouts and agent storefront purchases will be halted immediately.</li>
                <li>Excel spreadsheet bulk uploads will be rejected with an informative notice.</li>
                <li>All in-flight orders in <code>PROCESSING</code>, <code>SUBMITTED</code>, or <code>READY_FOR_FULFILLMENT</code> will be held in <code>PAUSED</code> status so upstream telecom APIs are not invoked.</li>
                <li>You can export all paused orders into Excel (.xlsx) or CSV while paused.</li>
              </ul>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '0.25rem' }}>
                Mandatory Operational Justification
              </label>
              <textarea
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder="Reason for pausing order operations (e.g. upstream telecom network downtime, reconciliation audit, maintenance)..."
                rows={3}
                style={{
                  width: '100%',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  background: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-xs)',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="ghost" onClick={() => setIsPauseModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handlePauseOperations}
                disabled={isPausing || !pauseReason.trim()}
              >
                {isPausing ? 'Pausing Operations...' : 'Confirm & Pause Order Operations'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 8. Resume Order Operations Modal */}
      {isResumeModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsResumeModalOpen(false)}
          title="▶️ Resume Platform Order Operations & Excel Uploads"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div
              style={{
                padding: '0.85rem 1rem',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#059669',
                fontSize: 'var(--font-size-xs)',
                lineHeight: 1.5,
              }}
            >
              <strong>Resuming Order Operations:</strong>
              <p style={{ margin: '0.35rem 0 0 0' }}>
                This will clear the operational freeze flag. Customer checkouts, agent storefront orders, and Excel uploads will resume immediately.
              </p>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-subtle)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <input
                type="checkbox"
                checked={resumeAutoReenqueue}
                onChange={(e) => setResumeAutoReenqueue(e.target.checked)}
                style={{ marginTop: '0.15rem' }}
              />
              <div>
                <strong style={{ display: 'block', color: 'var(--color-text-primary)' }}>
                  Automatically re-enqueue held orders
                </strong>
                <span style={{ color: 'var(--color-text-muted)' }}>
                  Restores held orders back to their previous status (<code>paused_from_status</code>) so background fulfillment queues process them upstream.
                </span>
              </div>
            </label>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '0.25rem' }}>
                Resumption Notes (Optional)
              </label>
              <textarea
                value={resumeReason}
                onChange={(e) => setResumeReason(e.target.value)}
                placeholder="Optional notes or operational clearance reference..."
                rows={2}
                style={{
                  width: '100%',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  background: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-xs)',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="ghost" onClick={() => setIsResumeModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleResumeOperations}
                disabled={isResuming}
              >
                {isResuming ? 'Resuming Operations...' : 'Confirm & Resume Operations'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
