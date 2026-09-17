import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Select } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import {
  Clock,
  CheckCircle2,
  AlertOctagon,
  Activity,
  RefreshCw,
  Download,
  Phone,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Zap,
  Layers,
  Trash2,
  AlertTriangle,
  X,
  Eye,
} from 'lucide-react';
import { adminApi, AdminPendingApprovalItem, AdminPendingApprovalStats, AdminPendingApprovalDetail } from '../../api/admin.api.js';
import { useToast } from '../../context/ToastContext.js';

export const AdminPendingApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toastSuccess, toastError } = useToast();

  // Query State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [networkFilter, setNetworkFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Data State
  const [items, setItems] = useState<AdminPendingApprovalItem[]>([]);
  const [stats, setStats] = useState<AdminPendingApprovalStats>({
    awaitingApproval: 0,
    approvedToday: 0,
    approvedValid: 0,
    rejected: 0,
    rejectedInvalid: 0,
    processing: 0,
    inFlightSync: 0,
    syncFailed: 0,
    totalRegistered: 0,
    excelPrechecks: 0,
    affectedOrders: 0,
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);

  // Selected Detail Modal State
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminPendingApprovalDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSyncingSingle, setIsSyncingSingle] = useState(false);

  // Reject Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Fetch summary stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await adminApi.getPendingApprovalStats();
      if (res) setStats(res);
    } catch {
      // Ignore
    }
  }, []);

  // Fetch approvals list
  const fetchApprovals = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getPendingApprovals({
        page,
        limit: pageSize,
        search: searchQuery.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
        source: sourceFilter !== 'ALL' ? sourceFilter : undefined,
      });

      if (res && Array.isArray(res.items)) {
        setItems(res.items);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalItems(res.pagination?.total || res.items.length);
      } else {
        setItems([]);
        setTotalPages(1);
        setTotalItems(0);
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to load pending beneficiary approvals');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, searchQuery, statusFilter, networkFilter, sourceFilter, toastError]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // Subscribe to real-time event when Excel uploads or new beneficiaries are recorded
  useEffect(() => {
    const handleUpdate = () => {
      fetchStats();
      fetchApprovals();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pending-approvals-updated', handleUpdate);
      return () => {
        window.removeEventListener('pending-approvals-updated', handleUpdate);
      };
    }
  }, [fetchStats, fetchApprovals]);

  // Fetch individual detail
  const fetchDetail = useCallback(async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await adminApi.getPendingApprovalDetail(id);
      if (res) setDetail(res);
    } catch (err: any) {
      toastError(err?.message || 'Failed to load beneficiary details');
      setSelectedId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, [toastError]);

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, fetchDetail]);

  // Actions
  const handleSyncSingle = async (id: string) => {
    setIsSyncingSingle(true);
    try {
      await adminApi.syncPendingApproval(id);
      toastSuccess('Background synchronization job queued for beneficiary.');
      if (selectedId === id) fetchDetail(id);
      fetchApprovals();
      fetchStats();
    } catch (err: any) {
      toastError(err?.message || 'Failed to synchronize beneficiary with DataHouse.');
    } finally {
      setIsSyncingSingle(false);
    }
  };

  const handleBulkSyncAll = async () => {
    if (items.length === 0) return;
    setIsBulkSyncing(true);
    try {
      const ids = items.map((it) => it.id);
      const res = await adminApi.bulkSyncPendingApprovals(ids);
      toastSuccess(`Queued bulk synchronization for ${res.syncedCount} beneficiaries.`);
      fetchApprovals();
      fetchStats();
    } catch {
      toastError('Failed to execute bulk synchronization.');
    } finally {
      setIsBulkSyncing(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await adminApi.approveBeneficiaryApproval(id);
      toastSuccess(`Beneficiary approved. ${res?.enqueuedOrders || 0} affected orders released to fulfillment queue.`);
      if (selectedId === id) fetchDetail(id);
      fetchApprovals();
      fetchStats();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pending-approvals-updated'));
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to approve beneficiary.');
    }
  };

  const handleReject = async () => {
    if (!selectedId) return;
    setIsRejecting(true);
    try {
      await adminApi.rejectBeneficiaryApproval(selectedId, rejectReason.trim());
      toastSuccess('Beneficiary marked as rejected.');
      setIsRejectModalOpen(false);
      setRejectReason('');
      fetchDetail(selectedId);
      fetchApprovals();
      fetchStats();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pending-approvals-updated'));
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to reject beneficiary.');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await adminApi.exportPendingApprovals();
      toastSuccess('Beneficiary approvals exported successfully.');
    } catch {
      toastError('Failed to export beneficiary approvals.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      const res = await adminApi.deleteAllPendingApprovals({
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      toastSuccess(res?.message || 'All pending beneficiary approval records deleted successfully.');
      setIsDeleteModalOpen(false);
      fetchApprovals();
      fetchStats();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pending-approvals-updated'));
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to delete pending approval records.');
    } finally {
      setIsDeletingAll(false);
    }
  };

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

  // Active Filter Chips
  const activeFilters = useMemo(() => {
    const list: Array<{ id: string; label: string; onRemove: () => void }> = [];

    if (statusFilter !== 'ALL') {
      const labels: Record<string, string> = {
        PENDING: 'Status: Awaiting Approval',
        VALID: 'Status: Approved',
        INVALID: 'Status: Rejected',
        PROCESSING: 'Status: Processing',
      };
      list.push({
        id: 'status',
        label: labels[statusFilter] || `Status: ${statusFilter}`,
        onRemove: () => { setStatusFilter('ALL'); setPage(1); },
      });
    }

    if (networkFilter !== 'ALL') {
      list.push({
        id: 'network',
        label: `Network: ${networkFilter}`,
        onRemove: () => { setNetworkFilter('ALL'); setPage(1); },
      });
    }

    if (sourceFilter !== 'ALL') {
      const labels: Record<string, string> = {
        CUSTOMER: 'Source: Customer Portal',
        AGENT: 'Source: Agent System',
        STOREFRONT: 'Source: Storefront',
        ORDERS: 'Source: Pending Orders',
        EXCEL: 'Source: Excel Uploads',
      };
      list.push({
        id: 'source',
        label: labels[sourceFilter] || `Source: ${sourceFilter}`,
        onRemove: () => { setSourceFilter('ALL'); setPage(1); },
      });
    }

    if (searchQuery.trim()) {
      list.push({
        id: 'search',
        label: `Query: "${searchQuery}"`,
        onRemove: () => { setSearchQuery(''); setPage(1); },
      });
    }

    return list;
  }, [statusFilter, networkFilter, sourceFilter, searchQuery]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setNetworkFilter('ALL');
    setSourceFilter('ALL');
    setPage(1);
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'VALID':
      case 'APPROVED':
        return <Badge variant="success" size="sm" dot>Approved</Badge>;
      case 'PENDING':
      case 'VALIDATING':
        return <Badge variant="warning" size="sm" dot>Awaiting MTN</Badge>;
      case 'PROCESSING':
        return <Badge variant="info" size="sm" dot>Syncing</Badge>;
      case 'INVALID':
      case 'REJECTED':
        return <Badge variant="danger" size="sm" dot>Rejected</Badge>;
      case 'SYNC_FAILED':
        return <Badge variant="danger" size="sm" dot>Sync Failed</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
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
      {/* 1. Header Toolbar with Standardized Tactile Action Buttons */}
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
          <TactileIcon icon={Clock} color="speed" size="lg" />
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
                Telecom Validation Operations
              </span>
              <Badge variant="brand" size="sm">Phase 11.5</Badge>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>•</span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Authoritative Carrier Whitelist
              </span>
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              Pending MTN Approvals
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Track, synchronize, and administer MTN beneficiary numbers and pending orders requiring carrier validation.
            </p>
          </div>
        </div>

        {/* Action Buttons with Real Tactile Button Styling */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => { fetchStats(); fetchApprovals(); }}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
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
            onClick={handleBulkSyncAll}
            disabled={isBulkSyncing || items.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-tactile-sm)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              cursor: isBulkSyncing || items.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Zap size={14} className={isBulkSyncing ? 'animate-spin' : ''} />
            <span>Sync Page Batch</span>
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
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
            onClick={() => setIsDeleteModalOpen(true)}
            disabled={items.length === 0 && (!stats.totalRegistered || stats.totalRegistered === 0)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              boxShadow: 'var(--shadow-tactile-sm)',
              color: 'var(--color-danger)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              cursor: (items.length === 0 && (!stats.totalRegistered || stats.totalRegistered === 0)) ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Trash2 size={14} />
            <span>Clear All Records</span>
          </button>
        </div>
      </div>

      {/* 2. Sleek, Standardized KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          title="Awaiting Approval"
          value={(stats.awaitingApproval || 0).toLocaleString()}
          subvalue="Pending MTN validation"
          icon={<TactileIcon icon={Clock} color="speed" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title="Approved / Valid"
          value={(stats.approvedValid ?? stats.approvedToday ?? 0).toLocaleString()}
          subvalue="Whitelisted beneficiaries"
          icon={<TactileIcon icon={CheckCircle2} color="security" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title="Rejected / Invalid"
          value={(stats.rejectedInvalid ?? stats.rejected ?? 0).toLocaleString()}
          subvalue="Blocked numbers"
          icon={<TactileIcon icon={AlertOctagon} color="red" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title="In-Flight Sync"
          value={(stats.inFlightSync ?? stats.processing ?? 0).toLocaleString()}
          subvalue="Carrier background check"
          icon={<TactileIcon icon={Activity} color="analytics" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title="Total Registered"
          value={(stats.totalRegistered ?? 0).toLocaleString()}
          subvalue="Known customer recipients"
          icon={<TactileIcon icon={ShieldCheck} color="security" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title="Excel Prechecks"
          value={(stats.excelPrechecks ?? 0).toLocaleString()}
          subvalue="Customer & Agent batches"
          icon={<TactileIcon icon={Zap} color="speed" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
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
          <div style={{ flex: '1 1 280px', minWidth: '240px' }}>
            <SearchInput
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search Phone (024XXXXXXX), DataHouse Ref, Name..."
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
            {/* Status */}
            <div style={{ width: '155px' }}>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Statuses', value: 'ALL' },
                  { label: 'Awaiting Approval', value: 'PENDING' },
                  { label: 'Approved (Valid)', value: 'VALID' },
                  { label: 'Rejected (Invalid)', value: 'INVALID' },
                  { label: 'Processing', value: 'PROCESSING' },
                ]}
              />
            </div>

            {/* Network */}
            <div style={{ width: '140px' }}>
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

            {/* Source */}
            <div style={{ width: '190px' }}>
              <Select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Sources & Users', value: 'ALL' },
                  { label: 'Customer Portal', value: 'CUSTOMER' },
                  { label: 'Agent System', value: 'AGENT' },
                  { label: 'Storefront (Prechecks & Orders)', value: 'STOREFRONT' },
                  { label: 'Pending Orders Only', value: 'ORDERS' },
                  { label: 'Excel Uploads Only', value: 'EXCEL' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFilters.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.4rem',
              alignItems: 'center',
              paddingTop: '0.25rem',
              borderTop: '1px solid var(--color-border-subtle)',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', marginRight: '0.25rem' }}>
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
              Clear All ({totalItems.toLocaleString()} total)
            </button>
          </div>
        )}
      </Card>

      {/* 4. Spacious, Uncompressed Approvals Table with Horizontal Breathing Room */}
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
          minWidth="1280px"
          headers={[
            'Beneficiary Number',
            'Network',
            'Data Size',
            'Detected Channel',
            'Source System',
            'Approval Status',
            'Occurrences / Orders',
            'Timestamp',
            'Actions',
          ]}
        >
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              {/* Beneficiary Number */}
              <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <button
                    onClick={() => setSelectedId(item.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-brand-primary, #0284C7)',
                      cursor: 'pointer',
                      fontWeight: 800,
                      padding: 0,
                      textDecoration: 'none',
                      textAlign: 'left',
                      fontSize: '13px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    {item.phoneNumber}
                  </button>
                  {item.isOrder && (
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Order #{item.publicId || item.orderId?.slice(0, 8)}
                    </span>
                  )}
                </div>
              </td>

              {/* Network */}
              <td style={{ padding: '0.85rem 1rem' }}>
                {renderNetworkBadge(item.network)}
              </td>

              {/* Data Size */}
              <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                {item.dataSize || '—'}
              </td>

              {/* Detected Channel */}
              <td style={{ padding: '0.85rem 1rem' }}>
                {item.isOrder ? (
                  <Badge variant="brand" size="sm">
                    {item.detectedFrom || 'Order Submission'}
                  </Badge>
                ) : (
                  <Badge variant={item.detectedFrom?.toLowerCase().includes('excel') ? 'warning' : 'neutral'} size="sm">
                    {item.detectedFrom || 'Beneficiary Precheck'}
                  </Badge>
                )}
              </td>

              {/* Source System */}
              <td style={{ padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', maxWidth: '220px' }}>
                  {item.sourceRole === 'storefront' ? (
                    <Badge variant="success" size="xs">Storefront</Badge>
                  ) : item.sourceRole === 'agent' ? (
                    <Badge variant="warning" size="xs">Agent</Badge>
                  ) : item.sourceRole === 'admin' ? (
                    <Badge variant="brand" size="xs">Admin</Badge>
                  ) : (
                    <Badge variant="neutral" size="xs">Customer</Badge>
                  )}
                  <span
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={item.sourceLabel || undefined}
                  >
                    {item.sourceLabel || 'Customer Portal'}
                  </span>
                </div>
              </td>

              {/* Approval Status */}
              <td style={{ padding: '0.85rem 1rem' }}>
                {renderStatusBadge(item.status)}
              </td>

              {/* Occurrences / Orders */}
              <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                {item.isOrder ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.2rem 0.6rem',
                      background: 'rgba(59, 130, 246, 0.08)',
                      color: 'var(--color-brand-primary, #2563EB)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                    }}
                  >
                    1 Order {item.amountPesewas ? `(GH₵ ${(item.amountPesewas / 100).toFixed(2)})` : ''}
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.2rem 0.6rem',
                      background: 'var(--color-bg-subtle)',
                      color: 'var(--color-text-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border-subtle)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      fontSize: '11px',
                    }}
                    title={`Recorded ${item.occurrences || 1} time(s)`}
                  >
                    <Layers size={11} style={{ opacity: 0.7 }} />
                    {item.occurrences || 1} {item.occurrences === 1 ? 'time' : 'times'}
                  </span>
                )}
              </td>

              {/* Timestamp */}
              <td style={{ padding: '0.85rem 1rem', fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {new Date(item.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </td>

              {/* Actions */}
              <td style={{ padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleSyncSingle(item.id)}
                    title="Queue DataHouse Sync"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border-subtle)',
                      boxShadow: 'var(--shadow-tactile-sm)',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    <Zap size={13} />
                  </button>

                  {item.status !== 'VALID' && item.status !== 'APPROVED' && (
                    <button
                      type="button"
                      onClick={() => handleApprove(item.id)}
                      title="Approve & Release Orders"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(34, 197, 94, 0.08)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        boxShadow: 'var(--shadow-tactile-sm)',
                        color: 'var(--color-status-success, #16A34A)',
                        cursor: 'pointer',
                      }}
                    >
                      <CheckCircle2 size={13} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    title="Inspect Beneficiary Dossier"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border-subtle)',
                      boxShadow: 'var(--shadow-tactile-sm)',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    <Eye size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>

        {items.length === 0 && !isLoading && (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Phone size={36} style={{ margin: '0 auto var(--space-2)' }} />
            <p style={{ fontWeight: 600, margin: 0 }}>No pending beneficiary approvals matching query.</p>
          </div>
        )}

        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-bg-surface)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Showing {items.length} of {totalItems.toLocaleString()} beneficiaries
          </span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </Card>

      {/* Beneficiary Details Modal */}
      {selectedId && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedId(null)}
          title={detail?.record?.isOrder ? `Pending MTN Order Approval — ${detail.record.phoneNumber}` : `Beneficiary Approval Details — ${detail?.record?.phoneNumber || ''}`}
        >
          {isLoadingDetail ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
              <p>Loading beneficiary record...</p>
            </div>
          ) : detail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Quick Bar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{detail.record.phoneNumber}</span>
                  {renderNetworkBadge(detail.record.network)}
                  {renderStatusBadge(detail.record.status)}
                  {detail.record.dataSize && (
                    <Badge variant="neutral" size="sm">{detail.record.dataSize}</Badge>
                  )}
                  {detail.record.isOrder ? (
                    <Badge variant="brand" size="sm">Order #{detail.record.publicId || detail.record.orderId?.slice(0, 8)}</Badge>
                  ) : detail.record.detectedFrom && (
                    <Badge variant="brand" size="sm">{detail.record.detectedFrom}</Badge>
                  )}
                  {detail.record.sourceLabel && (
                    <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                      Source: {detail.record.sourceLabel}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSyncSingle(detail.record.id)}
                    disabled={isSyncingSingle}
                  >
                    <Zap size={12} className={isSyncingSingle ? 'animate-spin' : ''} />
                    <span>Sync with DataHouse</span>
                  </Button>

                  {detail.record.status !== 'VALID' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApprove(detail.record.id)}
                      style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                    >
                      <CheckCircle2 size={12} />
                      <span>Approve & Release Orders</span>
                    </Button>
                  )}

                  {detail.record.status !== 'INVALID' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setIsRejectModalOpen(true)}
                    >
                      <AlertOctagon size={12} />
                      <span>Reject Number</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Order Information if record is an order */}
              {detail.record.isOrder && (
                <Card style={{ padding: 'var(--space-3)', background: 'rgba(255, 204, 0, 0.05)', border: '1px solid rgba(255, 204, 0, 0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block' }}>Order Reference</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                          {detail.record.publicId || detail.record.orderId}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block' }}>Order Amount</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 'var(--font-size-xs)', color: 'var(--color-brand)' }}>
                          GH₵ {((detail.record.amountPesewas || 0) / 100).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block' }}>Payment Status</span>
                        <Badge variant={detail.record.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm">
                          {detail.record.paymentStatus || 'PAID'}
                        </Badge>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block' }}>User / Origin</span>
                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                          {detail.record.sourceLabel} ({detail.record.sourceRole?.toUpperCase() || 'CUSTOMER'})
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedId(null);
                        navigate(`/admin/orders?search=${detail.record.publicId || detail.record.orderId || detail.record.phoneNumber}`);
                      }}
                    >
                      <ExternalLink size={12} />
                      <span>Inspect in Orders</span>
                    </Button>
                  </div>
                </Card>
              )}

              {/* Automatic Order Release Notice */}
              <div style={{ padding: 'var(--space-3)', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 'var(--radius-md)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <ShieldCheck size={16} color="var(--color-brand)" />
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand)', fontWeight: 600 }}>
                  Automatic Release Pipeline: When approved, blocked orders transition from AWAITING_APPROVAL $\rightarrow$ SUBMITTED and are automatically queued for fulfillment with DataHouse.
                </span>
              </div>

              {/* Affected Orders Table */}
              <Card style={{ padding: 'var(--space-4)' }}>
                <h4 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>
                  Affected Blocked Orders ({detail.affectedOrders.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                  {detail.affectedOrders.map((ord) => (
                    <div key={ord.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-xs)', padding: '0.5rem', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                      <div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, marginRight: '0.5rem' }}>{ord.id.slice(0, 10)}...</span>
                        <span>{ord.userName} ({ord.userEmail})</span>
                        <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-muted)' }}>{(ord.dataAmountMb / 1024).toFixed(1)} GB</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>GH₵ {(ord.amountPesewas / 100).toFixed(2)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedId(null);
                            navigate(`/admin/orders?search=${ord.id}`);
                          }}
                        >
                          <span>Inspect Order</span>
                          <ExternalLink size={10} />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {detail.affectedOrders.length === 0 && (
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>No active orders currently blocked by this beneficiary validation.</p>
                  )}
                </div>
              </Card>
            </div>
          ) : null}
        </Modal>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsRejectModalOpen(false)}
          title={`Reject Beneficiary — ${detail?.record?.phoneNumber}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
              Rejecting this beneficiary number prevents automatic fulfillment and allows affected orders to be evaluated for refunds.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '0.25rem' }}>
                Rejection Reason (Optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for carrier rejection..."
                rows={3}
                style={{
                  width: '100%',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  background: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="ghost" onClick={() => setIsRejectModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleReject}
                disabled={isRejecting}
              >
                {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete All Pending Approvals Confirmation Modal */}
      {isDeleteModalOpen && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => !isDeletingAll && setIsDeleteModalOpen(false)}
          title="Delete All Pending MTN Records (Platform-Wide)?"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.85rem',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
            >
              <AlertTriangle size={22} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--color-danger)', display: 'block', marginBottom: '0.25rem' }}>
                  Warning: Platform-Wide Permanent Deletion
                </strong>
                Are you sure you want to delete all beneficiary validation and pending approval records across the platform? This will clear all recorded beneficiaries for all customers and agents.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeletingAll}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteAll}
                disabled={isDeletingAll}
              >
                <Trash2 size={14} />
                <span>{isDeletingAll ? 'Deleting All...' : 'Yes, Delete All Platform Records'}</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
