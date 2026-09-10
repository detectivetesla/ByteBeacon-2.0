import React, { useState, useMemo, useEffect } from 'react';
import { NetworkProvider } from '@bytebeacon/shared';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { SearchInput, Select } from '../../components/ui/index.js';
import { NetworkBadge, ApprovalStatusBadge } from '../../components/ui/Badge/Badge.js';
import {
  Clock,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Layers,
  Globe,
  FileSpreadsheet,
  Code2,
  Send,
  UserX,
  ArrowUpDown,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { beneficiaryApi } from '../../api/beneficiary.api.js';

export type ApprovalStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED';
export type DetectedChannel = 'Web' | 'API' | 'Single Order' | 'Bulk Order' | 'Excel Upload' | 'Paste/Bulk Entry';

export interface PendingMtnApprovalItem {
  id: string;
  beneficiary: string;
  network: NetworkProvider;
  dataSize: string;
  status: ApprovalStatus;
  detectedFrom: DetectedChannel;
  timestamp: string;
  rawDate: string;
  occurrences?: number;
}

export const DetectedFromIndicator: React.FC<{ source: DetectedChannel }> = ({ source }) => {
  let Icon = Globe;
  let color = 'var(--color-text-secondary)';

  if (source === 'API') {
    Icon = Code2;
    color = 'var(--color-api)';
  } else if (source === 'Excel Upload') {
    Icon = FileSpreadsheet;
    color = 'var(--color-success)';
  } else if (source.includes('Bulk')) {
    Icon = Layers;
    color = 'var(--color-info)';
  } else if (source.includes('Single')) {
    Icon = Send;
    color = 'var(--color-brand)';
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
      <Icon size={13} color={color} />
      <span>{source}</span>
    </span>
  );
};

export const AgentPendingOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const { toastSuccess, toastInfo } = useToast();

  const [records, setRecords] = useState<PendingMtnApprovalItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('30d');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest' | 'status' | 'data_desc' | 'data_asc' | 'occurrences'>('newest');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Verify agent profile state
  const isAgentProfileMissing = user && user.role === 'agent' && !user.id;

  // Helper to parse data size into numerical MB for sorting
  const parseDataSizeMb = (sizeStr: string): number => {
    const match = sizeStr.match(/([\d.]+)\s*(GB|MB)/i);
    if (!match) return 0;
    const val = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    return unit === 'GB' ? val * 1024 : val;
  };

  // Filter & Sort logic (Sorting full dataset before pagination)
  const filteredRecords = useMemo(() => {
    let result = records.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

      // Date Filter
      if (dateFilter && dateFilter !== 'all') {
        const itemTime = new Date(item.rawDate).getTime();
        if (!isNaN(itemTime)) {
          const now = Date.now();
          if (dateFilter === 'today') {
            const startOfToday = new Date().setHours(0, 0, 0, 0);
            if (itemTime < startOfToday) return false;
          } else if (dateFilter === '7d') {
            if (now - itemTime > 7 * 24 * 60 * 60 * 1000) return false;
          } else if (dateFilter === '30d') {
            if (now - itemTime > 30 * 24 * 60 * 60 * 1000) return false;
          } else if (dateFilter === '90d') {
            if (now - itemTime > 90 * 24 * 60 * 60 * 1000) return false;
          } else if (dateFilter === '1y') {
            if (now - itemTime > 365 * 24 * 60 * 60 * 1000) return false;
          }
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesPhone = item.beneficiary.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''));
        const matchesSource = item.detectedFrom.toLowerCase().includes(q);
        if (!matchesPhone && !matchesSource) return false;
      }
      return true;
    });

    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime();
      }
      if (sortBy === 'highest' || (sortBy as string) === 'data_desc') {
        return parseDataSizeMb(b.dataSize) - parseDataSizeMb(a.dataSize);
      }
      if (sortBy === 'lowest' || (sortBy as string) === 'data_asc') {
        return parseDataSizeMb(a.dataSize) - parseDataSizeMb(b.dataSize);
      }
      if (sortBy === 'occurrences') {
        return (b.occurrences || 1) - (a.occurrences || 1);
      }
      if (sortBy === 'status') {
        const statusOrder: Record<ApprovalStatus, number> = {
          PENDING: 1,
          PROCESSING: 2,
          APPROVED: 3,
          REJECTED: 4,
        };
        return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      }
      return 0;
    });

    return result;
  }, [records, statusFilter, searchQuery, sortBy, dateFilter]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  const fetchApprovals = async () => {
    setIsRefreshing(true);
    try {
      const response = await beneficiaryApi.listApprovals({
        network: 'MTN',
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        limit: 5000,
      }) as any;

      const rawItems = response?.items || response?.data?.items || (Array.isArray(response) ? response : []);

      if (Array.isArray(rawItems) && rawItems.length > 0) {
        const mapped: PendingMtnApprovalItem[] = rawItems.map((item: any, idx: number) => ({
          id: item.id || String(idx + 1),
          beneficiary: item.phoneNumber || item.beneficiary || '—',
          network: NetworkProvider.MTN,
          dataSize: item.dataSize || (item.lastBundleSizeGb ? `${item.lastBundleSizeGb} GB` : '5 GB'),
          status: item.status === 'VALID' || item.status === 'APPROVED' ? 'APPROVED' : item.status === 'INVALID' || item.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
          detectedFrom: (item.detectedFrom as DetectedChannel) || 'Excel Upload',
          timestamp: item.createdAt ? new Date(item.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently',
          rawDate: item.createdAt || new Date().toISOString(),
          occurrences: Math.max(1, Number(item.occurrences || item.attemptCount || 1)),
        }));
        setRecords(mapped);
      } else {
        setRecords([]);
      }
    } catch {
      setRecords([]);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
    const handleUpdated = () => {
      fetchApprovals();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pending-approvals-updated', handleUpdated);
      return () => {
        window.removeEventListener('pending-approvals-updated', handleUpdated);
      };
    }
  }, [statusFilter]);

  const handleRefresh = () => {
    fetchApprovals();
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      const csvHeader = 'Beneficiary,Network,Data Size,Status,Detected From,Timestamp\n';
      const rows = filteredRecords
        .map((r) => `${r.beneficiary.replace(/\s+/g, '')},${r.network},${r.dataSize},${r.status},${r.detectedFrom},${r.timestamp}`)
        .join('\n');
      const blob = new Blob([csvHeader + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `mtn_pending_approvals_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toastSuccess('Export Complete', `Exported ${filteredRecords.length} records in MTN format.`);
    }, 700);
  };

  const handleApprove = async (id: string) => {
    try {
      await beneficiaryApi.approveBeneficiary(id);
      toastSuccess('Approved', 'Beneficiary approved for MTN fulfillment.');
      fetchApprovals();
    } catch {
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'APPROVED' } : r))
      );
    }
  };

  const handleReject = async (id: string) => {
    try {
      await beneficiaryApi.rejectBeneficiary(id);
      toastInfo('Rejected', 'Beneficiary marked as rejected.');
      fetchApprovals();
    } catch {
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'REJECTED' } : r))
      );
    }
  };

  if (isAgentProfileMissing) {
    return (
      <div style={{ maxWidth: '800px', margin: 'var(--space-12) auto', width: '100%', textAlign: 'center' }}>
        <Card style={{ padding: 'var(--space-10)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-warning-surface)', border: '1px solid var(--color-warning-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-warning)' }}>
            <UserX size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Agent profile unavailable
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.35rem', lineHeight: 1.5 }}>
              Your agent account needs to be completed before pending network approvals can be displayed. Please contact support.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => (window.location.href = 'mailto:support@bytebeacon.com')}>
            Contact Support
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 204, 0, 0.15)',
                border: '1px solid rgba(255, 204, 0, 0.4)',
                color: '#FFCC00',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={18} strokeWidth={2.6} />
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              Pending MTN Approvals
            </h1>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Beneficiary numbers awaiting MTN validation are shown here.
          </p>
        </div>

        {/* Top Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={handleRefresh} isLoading={isRefreshing} leftIcon={<RefreshCw size={14} />}>
            Refresh
          </Button>

          <Button variant="outline" size="sm" onClick={handleExport} isLoading={isExporting} leftIcon={<Download size={14} />}>
            Export (MTN Format)
          </Button>
        </div>
      </div>

      {/* 2. Summary Status, Date & Sort Controls */}
      <Card style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-subtle)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
            {/* Search Input */}
            <div style={{ minWidth: '200px', flex: 1, maxWidth: '280px' }}>
              <SearchInput
                placeholder="Search beneficiary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status Segmented Tabs */}
            <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: 'var(--color-bg-base)', padding: '2px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
              {[
                { label: 'All', value: 'ALL', aria: 'All' },
                { label: 'Unapproved / Pending', value: 'PENDING', aria: 'Pending' },
                { label: 'Processing', value: 'PROCESSING', aria: 'Processing' },
                { label: 'Approved', value: 'APPROVED', aria: 'Approved' },
                { label: 'Rejected', value: 'REJECTED', aria: 'Rejected' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  aria-label={tab.aria}
                  onClick={() => {
                    setStatusFilter(tab.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '0.25rem 0.65rem',
                    fontSize: 'var(--font-size-3xs)',
                    fontWeight: statusFilter === tab.value ? 800 : 600,
                    borderRadius: 'var(--radius-xs)',
                    border: 'none',
                    backgroundColor: statusFilter === tab.value ? 'var(--color-bg-surface)' : 'transparent',
                    color: statusFilter === tab.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    boxShadow: statusFilter === tab.value ? 'var(--shadow-tactile-sm)' : 'none',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Date Filter Dropdown */}
            <div style={{ minWidth: '120px' }}>
              <Select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { label: 'Today', value: 'today' },
                  { label: '7 days', value: '7d' },
                  { label: '30 days', value: '30d' },
                  { label: '90 days', value: '90d' },
                  { label: '1 year', value: '1y' },
                ]}
              />
            </div>
          </div>

          {/* Right: Sort By Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: '160px' }}>
            <ArrowUpDown size={13} color="var(--color-text-muted)" />
            <Select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setCurrentPage(1);
              }}
              options={[
                { label: 'Newest First', value: 'newest' },
                { label: 'Oldest First', value: 'oldest' },
                { label: 'Most Occurrences', value: 'occurrences' },
                { label: 'Data Size (High to Low)', value: 'data_desc' },
                { label: 'Data Size (Low to High)', value: 'data_asc' },
                { label: 'Status', value: 'status' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* 3. Authoritative Approval Table / Mobile Card List */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {filteredRecords.length === 0 ? (
          <Card style={{ padding: 'var(--space-12)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
              <Clock size={24} color="#FFCC00" />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                No pending approvals
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                Beneficiary numbers awaiting network validation will appear here.
              </p>
            </div>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
              0 numbers · Page 1 of 1
            </span>
          </Card>
        ) : (
          <>            {/* Authoritative Table View (Horizontal scroll on smaller viewports) */}
            <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-default)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)', minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Beneficiary</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Network</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Occurrences</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Data Size</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Status</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Detected From</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Timestamp</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((item) => (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        transition: 'background-color 120ms ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {item.beneficiary}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <NetworkBadge network={item.network} size="sm" />
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--font-size-3xs)',
                            fontWeight: 800,
                            fontFamily: 'var(--font-mono)',
                            backgroundColor: (item.occurrences || 1) > 1 ? 'rgba(255, 204, 0, 0.15)' : 'var(--color-bg-subtle)',
                            color: (item.occurrences || 1) > 1 ? '#FFCC00' : 'var(--color-text-secondary)',
                            border: (item.occurrences || 1) > 1 ? '1px solid rgba(255, 204, 0, 0.3)' : '1px solid var(--color-border-subtle)',
                          }}
                          title={`Recorded ${item.occurrences || 1} time(s)`}
                        >
                          <Layers size={11} />
                          {item.occurrences || 1} {item.occurrences === 1 ? 'time' : 'times'}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {item.dataSize}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <ApprovalStatusBadge status={item.status} size="sm" />
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <DetectedFromIndicator source={item.detectedFrom} />
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>
                        {item.timestamp}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                        {item.status === 'PENDING' ? (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                            <Button variant="outline" size="sm" onClick={() => handleApprove(item.id)}>
                              Approve
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleReject(item.id)}>
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                            {item.status === 'APPROVED' ? 'Validated' : 'Dismissed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 4. Pagination Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: 'var(--space-3) 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ width: '130px' }}>
                  <Select
                    value={String(itemsPerPage)}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    options={[
                      { label: '10 / page', value: '10' },
                      { label: '20 / page', value: '20' },
                      { label: '50 / page', value: '50' },
                      { label: '100 / page', value: '100' },
                    ]}
                  />
                </div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Showing {filteredRecords.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}–
                  {Math.min(currentPage * itemsPerPage, filteredRecords.length)} of {filteredRecords.length} numbers · Page {currentPage} of {totalPages}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-secondary)',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  <ChevronLeft size={13} />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-secondary)',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
