import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { NetworkProvider } from '@bytebeacon/shared';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { SearchInput, Select, PhoneInput } from '../../components/ui/index.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { ResponsiveTable } from '../../components/ui/responsive/index.js';
import type { ResponsiveTableColumn } from '../../components/ui/responsive/index.js';
import {
  Clock,
  RefreshCw,
  Download,
  Plus,
  Zap,
  CheckCircle2,
  AlertOctagon,
  ChevronLeft,
  ChevronRight,
  Layers,
  Globe,
  FileSpreadsheet,
  Code2,
  Send,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  Store,
  Eye,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { beneficiaryApi } from '../../api/beneficiary.api.js';
import { ordersApi } from '../../api/orders.api.js';

export type ApprovalStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED';
export type DetectedChannel = 'Storefront' | 'Web' | 'API' | 'Single Order' | 'Bulk Order' | 'Excel Upload' | 'Manual Check';

export interface StorePendingApprovalItem {
  id: string;
  phoneNumber: string;
  network: NetworkProvider;
  dataSize?: string;
  status: ApprovalStatus;
  providerReference?: string;
  detectedFrom: DetectedChannel | string;
  createdAt: string;
  expiresAt?: string;
  validatedAt?: string;
  occurrences?: number;
}

export interface AssociatedOrderItem {
  id: string;
  recipientPhone: string;
  network: string;
  dataAmountMb: number;
  amountPesewas: number;
  orderStatus: string;
  createdAt: string;
}

export const DetectedChannelBadge: React.FC<{ source: string }> = ({ source }) => {
  const s = String(source || '').toLowerCase();
  let Icon = Globe;
  let color = 'var(--color-text-secondary)';
  let label = source || 'Unknown';

  if (s.includes('storefront')) {
    Icon = Store;
    color = '#10B981';
    label = 'Storefront';
  } else if (s.includes('excel')) {
    Icon = FileSpreadsheet;
    color = '#10B981';
    label = 'Excel Upload';
  } else if (s.includes('api')) {
    Icon = Code2;
    color = '#8B5CF6';
    label = 'API Precheck';
  } else if (s.includes('bulk')) {
    Icon = Layers;
    color = '#0EA5E9';
    label = 'Bulk Order';
  } else if (s.includes('single')) {
    Icon = Send;
    color = '#F59E0B';
    label = 'Single Order';
  } else if (s.includes('manual')) {
    Icon = Zap;
    color = '#F97316';
    label = 'Manual Check';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
      }}
    >
      <Icon size={13} color={color} />
      <span>{label}</span>
    </span>
  );
};

export const StorePendingApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const { toastSuccess, toastError, toastInfo } = useToast();

  // Data State
  const [records, setRecords] = useState<StorePendingApprovalItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Filters & Controls State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [networkFilter, setNetworkFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'phone' | 'status' | 'occurrences'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, _setItemsPerPage] = useState(10);
  const [backendCounts, setBackendCounts] = useState<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    processing: number;
  } | null>(null);

  // Details Modal State
  const [selectedRecord, setSelectedRecord] = useState<StorePendingApprovalItem | null>(null);
  const [associatedOrders, setAssociatedOrders] = useState<AssociatedOrderItem[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // Validate / Add Beneficiary Modal State
  const [isValidateModalOpen, setIsValidateModalOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testNetwork, setTestNetwork] = useState<NetworkProvider>(NetworkProvider.MTN);
  const [isPrechecking, setIsPrechecking] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    tested: boolean;
    isValid: boolean;
    accountName?: string;
    message?: string;
  } | null>(null);

  // Delete All Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Fetch approvals list
  const fetchApprovals = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = (await beneficiaryApi.listApprovals({
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        limit: 5000,
        userId: user?.id,
      })) as any;

      if (response?.counts || response?.data?.counts) {
        setBackendCounts(response?.counts || response?.data?.counts);
      }

      const rawItems =
        response?.items ||
        response?.data?.items ||
        (Array.isArray(response) ? response : []);

      if (Array.isArray(rawItems) && rawItems.length > 0) {
        const mapped: StorePendingApprovalItem[] = rawItems.map((item: any, idx: number) => {
          let mappedStatus: ApprovalStatus = 'PENDING';
          if (item.status === 'VALID' || item.status === 'APPROVED') mappedStatus = 'APPROVED';
          else if (item.status === 'INVALID' || item.status === 'REJECTED') mappedStatus = 'REJECTED';
          else if (item.status === 'PROCESSING' || item.status === 'VALIDATING') mappedStatus = 'PROCESSING';

          // Identify storefront source from metadata or detectedFrom
          let detected = item.detectedFrom || 'Storefront';
          if (item.metadata?.source === 'storefront' || item.providerResponseMetadata?.source === 'storefront') {
            detected = 'Storefront';
          }

          return {
            id: item.id || `ben-${idx + 1}`,
            phoneNumber: item.phoneNumber || item.beneficiary || '',
            network: (item.network as NetworkProvider) || NetworkProvider.MTN,
            dataSize: item.dataSize || (item.lastBundleSizeGb ? `${item.lastBundleSizeGb} GB` : '—'),
            status: mappedStatus,
            providerReference: item.providerReference || 'DH-AUTO',
            detectedFrom: detected,
            createdAt: item.createdAt || new Date().toISOString(),
            expiresAt: item.expiresAt,
            validatedAt: item.validatedAt,
            occurrences: Math.max(1, Number(item.occurrences || item.attemptCount || 1)),
          };
        });
        setRecords(mapped);
      } else {
        setRecords([]);
      }
    } catch (fetchErr) {
      console.warn('[StorePendingApprovals] Could not fetch approvals:', fetchErr);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [networkFilter, statusFilter, user?.id]);

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
  }, [fetchApprovals]);

  // Fetch associated orders for selected beneficiary
  const fetchAssociatedOrders = useCallback(async (phone: string) => {
    setIsLoadingOrders(true);
    try {
      const res = await ordersApi.listOrders({
        page: 1,
        limit: 50,
        search: phone,
      });

      if (res) {
        const orderList = Array.isArray(res) ? res : res.orders || (res as any).data || [];
        const cleanPhone = phone.replace(/\D/g, '');
        const matched = orderList.filter((o: any) => {
          const rec = (o.recipientPhone || o.phoneNumber || '').replace(/\D/g, '');
          return rec.includes(cleanPhone) || cleanPhone.includes(rec);
        });

        setAssociatedOrders(
          matched.map((o: any) => ({
            id: o.id || o.orderId,
            recipientPhone: o.recipientPhone || o.phoneNumber || phone,
            network: o.network || 'MTN',
            dataAmountMb: o.dataAmountMb || 0,
            amountPesewas: o.amountPesewas || 0,
            orderStatus: o.status || o.orderStatus || 'PENDING',
            createdAt: o.createdAt || new Date().toISOString(),
          }))
        );
      }
    } catch {
      setAssociatedOrders([]);
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  const handleOpenDetails = (record: StorePendingApprovalItem) => {
    setSelectedRecord(record);
    fetchAssociatedOrders(record.phoneNumber);
  };

  // Re-verify single beneficiary with provider
  const handleSyncRecord = async (record: StorePendingApprovalItem) => {
    setSyncingId(record.id);
    try {
      const res = await beneficiaryApi.syncBeneficiary(record.phoneNumber, record.network);
      const isKnown = res?.results?.[0]?.known || res?.results?.[0]?.valid;
      if (isKnown) {
        toastSuccess('Beneficiary Whitelisted', `${record.phoneNumber} is verified and ready for deliveries.`);
      } else {
        toastInfo('Awaiting MTN Validation', `${record.phoneNumber} remains pending provider approval.`);
      }
      fetchApprovals();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pending-approvals-updated'));
      }
    } catch {
      toastError('Carrier Sync Failed', 'Unable to check live status with the carrier provider.');
    } finally {
      setSyncingId(null);
    }
  };

  // Bulk sync all pending records
  const handleBulkSyncAll = async () => {
    setIsBulkSyncing(true);
    try {
      const res = await beneficiaryApi.syncApprovalsWithProvider({
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
        status: 'PENDING',
      });
      toastSuccess('Carrier Sync Completed', `Synchronized ${res?.synced || 0} numbers (${res?.approved || 0} approved).`);
      fetchApprovals();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pending-approvals-updated'));
      }
    } catch {
      toastError('Sync Failed', 'Could not complete batch carrier sync.');
    } finally {
      setIsBulkSyncing(false);
    }
  };

  // Delete all records confirmation
  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      await beneficiaryApi.deleteAllApprovals({
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
        userId: user?.id,
      });
      toastSuccess('All pending MTN approval records deleted successfully.');
      setIsDeleteModalOpen(false);
      fetchApprovals();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pending-approvals-updated'));
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to delete records.');
    } finally {
      setIsDeletingAll(false);
    }
  };

  // Test / Validate single phone number via modal
  const handleRunValidation = async () => {
    const clean = testPhone.trim().replace(/\s+/g, '');
    if (clean.length < 10) {
      toastError('Invalid Phone', 'Please enter a valid Ghanaian phone number.');
      return;
    }

    setIsPrechecking(true);
    setValidationResult(null);

    try {
      const res = await beneficiaryApi.precheck({
        network: testNetwork,
        phoneNumbers: [clean],
        record: true,
      });

      // Explicitly record to increment database attempt_count / occurrences
      await beneficiaryApi.recordUnapproved({
        items: [
          {
            phoneNumber: clean,
            network: testNetwork,
            detectedFrom: 'Manual Check',
          },
        ],
        userId: user?.id,
      }).catch(() => {});

      const first = res.results?.[0];
      const valid = Boolean(first?.isValid && first?.isKnown);

      setValidationResult({
        tested: true,
        isValid: valid,
        accountName: first?.accountName,
        message: valid
          ? 'Number is APPROVED and whitelisted by the carrier provider.'
          : 'Number is NOT on MTN whitelist. It has been automatically recorded to Pending Approvals.',
      });

      setRecords((prev) => {
        const existingIdx = prev.findIndex((r) => r.phoneNumber.replace(/\s+/g, '') === clean);
        if (existingIdx >= 0) {
          const updated = [...prev];
          const curr = updated[existingIdx];
          updated[existingIdx] = {
            ...curr,
            occurrences: (curr.occurrences || 1) + 1,
            status: valid ? 'APPROVED' : curr.status,
            detectedFrom: 'Manual Check',
          };
          return updated;
        }
        const newItem: StorePendingApprovalItem = {
          id: `ben-store-${Date.now()}`,
          phoneNumber: clean,
          network: testNetwork,
          status: valid ? 'APPROVED' : 'PENDING',
          providerReference: `DH-${clean.slice(-6)}`,
          detectedFrom: 'Manual Check',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          validatedAt: valid ? new Date().toISOString() : undefined,
          occurrences: 1,
        };
        return [newItem, ...prev];
      });

      fetchApprovals();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pending-approvals-updated'));
      }
    } catch (err: any) {
      setValidationResult({
        tested: true,
        isValid: false,
        message: err?.message || 'Verification failed. Number recorded to Pending Approvals.',
      });
    } finally {
      setIsPrechecking(false);
    }
  };

  // Filtered & Sorted Records
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesPhone = r.phoneNumber.includes(q);
          const matchesRef = r.providerReference?.toLowerCase().includes(q);
          if (!matchesPhone && !matchesRef) return false;
        }

        // Status Filter
        if (statusFilter !== 'ALL' && r.status !== statusFilter) {
          return false;
        }

        // Channel / Source Filter
        if (channelFilter !== 'ALL') {
          const s = String(r.detectedFrom || '').toLowerCase();
          if (channelFilter === 'STOREFRONT' && !s.includes('storefront')) return false;
          if (channelFilter === 'ORDERS' && !s.includes('order')) return false;
          if (channelFilter === 'EXCEL' && !s.includes('excel')) return false;
          if (channelFilter === 'MANUAL' && !s.includes('manual')) return false;
        }

        // Network Filter
        if (networkFilter !== 'ALL' && r.network !== networkFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortBy === 'phone') return a.phoneNumber.localeCompare(b.phoneNumber);
        if (sortBy === 'occurrences') return (b.occurrences || 1) - (a.occurrences || 1);
        if (sortBy === 'status') return a.status.localeCompare(b.status);
        return 0;
      });
  }, [records, searchQuery, statusFilter, channelFilter, networkFilter, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  // Real-time KPI Counts
  const metrics = useMemo(() => {
    const pending = backendCounts?.pending ?? records.filter((r) => r.status === 'PENDING').length;
    const approved = backendCounts?.approved ?? records.filter((r) => r.status === 'APPROVED').length;
    const rejected = backendCounts?.rejected ?? records.filter((r) => r.status === 'REJECTED').length;
    const storefrontCount = records.filter((r) => String(r.detectedFrom || '').toLowerCase().includes('storefront')).length;
    const total = backendCounts?.total ?? records.length;

    return { pending, approved, rejected, storefrontCount, total };
  }, [records, backendCounts]);

  // Export to CSV
  const handleExport = () => {
    setIsExporting(true);
    try {
      const headers = ['Phone Number', 'Network', 'Bundle Size', 'Status', 'Detected From', 'Occurrences', 'Created At', 'Provider Ref'];
      const rows = filteredRecords.map((r) => [
        r.phoneNumber,
        r.network,
        r.dataSize || '—',
        r.status,
        r.detectedFrom,
        r.occurrences || 1,
        new Date(r.createdAt).toLocaleString(),
        r.providerReference || 'DH-AUTO',
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `store-pending-approvals-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toastSuccess('Export Complete', 'Exported pending MTN records to CSV.');
    } catch {
      toastError('Export Failed', 'Could not export pending approvals CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const renderStatusBadge = (status: ApprovalStatus) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success" size="sm" dot>Approved</Badge>;
      case 'PENDING':
        return <Badge variant="warning" size="sm" dot>Awaiting MTN</Badge>;
      case 'PROCESSING':
        return <Badge variant="info" size="sm" dot>Syncing</Badge>;
      case 'REJECTED':
        return <Badge variant="danger" size="sm" dot>Rejected</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  return (
    <div className="store-page-container">
      {/* 1. Header Toolbar */}
      <div className="store-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0, flex: '1 1 300px' }}>
          <TactileIcon icon={Clock} color="speed" size="lg" />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--color-brand-primary)',
                }}
              >
                Storefront Telecom Operations
              </span>
              <Badge variant="brand" size="sm">MTN Whitelist</Badge>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>•</span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Automatic Number Recording
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Pending MTN Approvals
            </h1>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0', lineHeight: 1.4 }}>
              Monitor, test, and manage MTN recipient approvals for unapproved numbers detected across your customer storefront and agent console.
            </p>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="store-header-actions">
          <button
            type="button"
            onClick={() => {
              setTestPhone('');
              setValidationResult(null);
              setIsValidateModalOpen(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
              minHeight: '44px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#A3E635',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              boxShadow: 'var(--shadow-tactile-sm)',
              color: '#000000',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              flex: '1 1 auto',
            }}
          >
            <Plus size={14} strokeWidth={2.8} />
            <span>Validate Number</span>
          </button>

          <button
            type="button"
            onClick={fetchApprovals}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
              minHeight: '44px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-tactile-sm)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
              flex: '1 1 auto',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleBulkSyncAll}
            disabled={isBulkSyncing || records.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
              minHeight: '44px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-tactile-sm)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              cursor: isBulkSyncing || records.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
              flex: '1 1 auto',
            }}
          >
            <Zap size={14} className={isBulkSyncing ? 'animate-spin' : ''} />
            <span>Sync All</span>
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || records.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
              minHeight: '44px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-tactile-sm)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              cursor: isExporting || records.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
              flex: '1 1 auto',
            }}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            disabled={records.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
              minHeight: '44px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              boxShadow: 'var(--shadow-tactile-sm)',
              color: 'var(--color-danger)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              cursor: records.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
              flex: '1 1 auto',
            }}
          >
            <Trash2 size={14} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metric Cards */}
      <div className="store-kpis-grid">
        <MetricCard
          title="Awaiting Approval"
          value={metrics.pending.toLocaleString()}
          subvalue="Pending MTN validation"
          icon={<TactileIcon icon={Clock} color="speed" size="sm" />}
          style={{ minHeight: '90px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title="Approved / Valid"
          value={metrics.approved.toLocaleString()}
          subvalue="Whitelisted beneficiaries"
          icon={<TactileIcon icon={CheckCircle2} color="security" size="sm" />}
          style={{ minHeight: '90px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title="Rejected / Blocked"
          value={metrics.rejected.toLocaleString()}
          subvalue="Invalid or non-beneficiary"
          icon={<TactileIcon icon={AlertOctagon} color="red" size="sm" />}
          style={{ minHeight: '90px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title="Storefront Detected"
          value={metrics.storefrontCount.toLocaleString()}
          subvalue="Auto-recorded from storefront"
          icon={<TactileIcon icon={Store} color="speed" size="sm" />}
          style={{ minHeight: '90px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title="Total Scanned"
          value={metrics.total.toLocaleString()}
          subvalue="All recorded recipients"
          icon={<TactileIcon icon={ShieldCheck} color="security" size="sm" />}
          style={{ minHeight: '90px', padding: '0.85rem 1rem' }}
        />
      </div>

      {/* 3. Advanced Filter Suite */}
      <Card
        elevated
        style={{
          padding: 'var(--space-4)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-tactile-sm)',
        }}
      >
        <div className="store-filter-bar">
          {/* Search Box */}
          <div style={{ flex: '2 1 200px', minWidth: 'min(100%, 180px)' }}>
            <SearchInput
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search Phone (024XXXXXXX), ref..."
            />
          </div>

          {/* Status */}
          <div style={{ flex: '1 1 130px', minWidth: 'min(100%, 120px)' }}>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { label: 'All Statuses', value: 'ALL' },
                { label: 'Awaiting MTN', value: 'PENDING' },
                { label: 'Approved (Valid)', value: 'APPROVED' },
                { label: 'Rejected', value: 'REJECTED' },
                { label: 'Processing', value: 'PROCESSING' },
              ]}
            />
          </div>

          {/* Source Channel */}
          <div style={{ flex: '1 1 140px', minWidth: 'min(100%, 130px)' }}>
            <Select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { label: 'All Channels', value: 'ALL' },
                { label: 'Storefront Only', value: 'STOREFRONT' },
                { label: 'Store Orders', value: 'ORDERS' },
                { label: 'Excel Uploads', value: 'EXCEL' },
                { label: 'Manual Checks', value: 'MANUAL' },
              ]}
            />
          </div>

          {/* Network */}
          <div style={{ flex: '1 1 120px', minWidth: 'min(100%, 110px)' }}>
            <Select
              value={networkFilter}
              onChange={(e) => {
                setNetworkFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { label: 'All Networks', value: 'ALL' },
                { label: 'MTN Ghana', value: 'MTN' },
                { label: 'Telecel', value: 'TELECEL' },
                { label: 'AT (AirtelTigo)', value: 'AIRTELTIGO' },
              ]}
            />
          </div>

          {/* Sort */}
          <div style={{ flex: '1 1 130px', minWidth: 'min(100%, 120px)' }}>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              options={[
                { label: 'Newest First', value: 'newest' },
                { label: 'Oldest First', value: 'oldest' },
                { label: 'Phone Number', value: 'phone' },
                { label: 'Occurrences', value: 'occurrences' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* 4. Table Card */}
      <Card
        elevated
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-tactile-sm)',
        }}
      >
        {isLoading && records.length === 0 ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <RefreshCw size={24} className="animate-spin" color="var(--color-brand-primary)" />
              <span>Loading pending MTN approvals...</span>
            </div>
          </div>
        ) : paginatedRecords.length === 0 ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={32} color="var(--color-success)" />
              <strong style={{ color: 'var(--color-text-primary)' }}>No Pending Numbers Found</strong>
              <span style={{ fontSize: 'var(--font-size-xs)' }}>
                All scanned numbers are whitelisted or no numbers matched your filter.
              </span>
            </div>
          </div>
        ) : (
          <ResponsiveTable<StorePendingApprovalItem>
            columns={[
              {
                header: 'Recipient Phone',
                accessor: 'phoneNumber',
                render: (item) => (
                  <button
                    onClick={() => handleOpenDetails(item)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-brand-primary, #0284C7)',
                      cursor: 'pointer',
                      fontWeight: 800,
                      padding: 0,
                      textAlign: 'left',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                    }}
                  >
                    {item.phoneNumber}
                  </button>
                ),
                priority: 'always',
              },
              {
                header: 'Network',
                accessor: 'network',
                render: (item) => (
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
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#D97706' }} />
                    {item.network}
                  </span>
                ),
                priority: 'always',
              },
              {
                header: 'Occurrences',
                accessor: (item) => String(item.occurrences || 1),
                render: (item) => (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '11px',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: (item.occurrences || 1) > 1 ? 'rgba(255, 204, 0, 0.15)' : 'var(--color-bg-subtle)',
                      color: (item.occurrences || 1) > 1 ? '#B45309' : 'var(--color-text-secondary)',
                      border: (item.occurrences || 1) > 1 ? '1px solid rgba(255, 204, 0, 0.3)' : '1px solid var(--color-border-subtle)',
                    }}
                    title={`Recorded ${item.occurrences || 1} time(s) across order prechecks`}
                  >
                    <Layers size={11} />
                    {item.occurrences || 1} {item.occurrences === 1 ? 'time' : 'times'}
                  </span>
                ),
                priority: 'secondary',
              },
              {
                header: 'Bundle / Size',
                accessor: (item) => item.dataSize || '—',
                render: (item) => (
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                    {item.dataSize || '—'}
                  </span>
                ),
                priority: 'secondary',
              },
              {
                header: 'Source / Detected',
                accessor: (item) => item.detectedFrom,
                render: (item) => <DetectedChannelBadge source={item.detectedFrom} />,
                priority: 'secondary',
              },
              {
                header: 'Approval Status',
                accessor: 'status',
                render: (item) => renderStatusBadge(item.status),
                priority: 'always',
              },
              {
                header: 'Date Detected',
                accessor: 'createdAt',
                render: (item) => (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                ),
                priority: 'expandable',
              },
              {
                header: 'Actions',
                accessor: 'id',
                align: 'right',
                render: (item) => (
                  <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleSyncRecord(item)}
                      disabled={syncingId === item.id}
                      title="Sync with Carrier Whitelist"
                      style={{
                        padding: '0.35rem 0.55rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border-subtle)',
                        backgroundColor: 'transparent',
                        color: 'var(--color-text-primary)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: syncingId === item.id ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        minHeight: '36px',
                      }}
                    >
                      <Zap size={12} className={syncingId === item.id ? 'animate-spin' : ''} />
                      <span>Re-check</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenDetails(item)}
                      title="View Details"
                      style={{
                        padding: '0.35rem 0.55rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border-subtle)',
                        backgroundColor: 'transparent',
                        color: 'var(--color-text-primary)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        minHeight: '36px',
                      }}
                    >
                      <Eye size={12} />
                      <span>Details</span>
                    </button>
                  </div>
                ),
                priority: 'always',
              },
            ]}
            data={paginatedRecords}
            keyExtractor={(item) => item.id}
            enableCardView={true}
            cardTitle={(item) => item.phoneNumber}
            cardSubtitle={(item) => `${item.network} • ${item.dataSize || 'Pending bundle'} • ${item.occurrences || 1} scan(s)`}
            cardBadge={(item) => renderStatusBadge(item.status)}
            cardActions={(item) => (
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleSyncRecord(item)}
                  disabled={syncingId === item.id}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-primary)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: syncingId === item.id ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Zap size={14} className={syncingId === item.id ? 'animate-spin' : ''} />
                  <span>Re-check</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenDetails(item)}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    color: 'var(--color-text-primary)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Eye size={14} />
                  <span>Details</span>
                </button>
              </div>
            )}
          />
        )}

        {/* Pagination Bar */}
        {filteredRecords.length > 0 && (
          <div
            style={{
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--color-border-subtle)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <div>
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredRecords.length)} of {filteredRecords.length} records
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </Button>
              <span style={{ fontWeight: 700, padding: '0 0.5rem', color: 'var(--color-text-primary)' }}>
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ==================================================================== */}
      {/* 5. VALIDATE / TEST BENEFICIARY MODAL */}
      {/* ==================================================================== */}
      <Modal
        isOpen={isValidateModalOpen}
        onClose={() => setIsValidateModalOpen(false)}
        title="Validate MTN Beneficiary Number"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
            Query the carrier database in real time to verify whether a recipient number is approved and whitelisted for instant bundle fulfillment.
          </p>

          <PhoneInput
            label="Phone Number"
            placeholder="024XXXXXXX"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
          />

          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
              Network Provider
            </label>
            <Select
              value={testNetwork}
              onChange={(e) => setTestNetwork(e.target.value as NetworkProvider)}
              options={[
                { label: 'MTN Ghana', value: NetworkProvider.MTN },
                { label: 'Telecel Ghana', value: NetworkProvider.TELECEL },
                { label: 'AT Ghana (AirtelTigo)', value: NetworkProvider.AIRTELTIGO },
              ]}
            />
          </div>

          <Button
            variant="primary"
            fullWidth
            onClick={handleRunValidation}
            disabled={isPrechecking || !testPhone.trim()}
          >
            <Zap size={14} className={isPrechecking ? 'animate-spin' : ''} />
            <span>{isPrechecking ? 'Checking Carrier Whitelist...' : 'Verify Beneficiary Status'}</span>
          </Button>

          {validationResult && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: validationResult.isValid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${validationResult.isValid ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '13px', color: validationResult.isValid ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {validationResult.isValid ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span>{validationResult.isValid ? 'Approved & Whitelisted' : 'Not Whitelisted (Pending)'}</span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-primary)' }}>
                {validationResult.message}
              </p>
              {validationResult.accountName && (
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
                  Registered Name: <strong>{validationResult.accountName}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ==================================================================== */}
      {/* 6. DETAILS MODAL */}
      {/* ==================================================================== */}
      {selectedRecord && (
        <Modal
          isOpen={Boolean(selectedRecord)}
          onClose={() => setSelectedRecord(null)}
          title={`Beneficiary: ${selectedRecord.phoneNumber}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block' }}>Status</span>
                <div style={{ marginTop: '0.2rem' }}>{renderStatusBadge(selectedRecord.status)}</div>
              </div>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block' }}>Detected Channel</span>
                <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--color-text-primary)' }}>
                  {selectedRecord.detectedFrom}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block' }}>Occurrences</span>
                <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--color-text-primary)' }}>
                  {selectedRecord.occurrences || 1} time(s)
                </span>
              </div>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block' }}>Added On</span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                  {new Date(selectedRecord.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Associated orders */}
            <div>
              <h4 style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>
                Associated Store Orders
              </h4>
              {isLoadingOrders ? (
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '0.5rem' }}>Loading linked orders...</div>
              ) : associatedOrders.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '0.5rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                  No completed orders found for this number yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '160px', overflowY: 'auto' }}>
                  {associatedOrders.map((ord) => (
                    <div
                      key={ord.id}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-bg-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11px',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>#{ord.id.slice(0, 8)}</span>
                      <span>{(ord.dataAmountMb / 1024).toFixed(1)} GB</span>
                      <Badge variant="brand" size="sm">{ord.orderStatus}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                fullWidth
                onClick={() => handleSyncRecord(selectedRecord)}
                disabled={syncingId === selectedRecord.id}
              >
                <Zap size={14} className={syncingId === selectedRecord.id ? 'animate-spin' : ''} />
                <span>Re-check with MTN</span>
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setSelectedRecord(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ==================================================================== */}
      {/* 7. CLEAR ALL RECORDS CONFIRMATION MODAL */}
      {/* ==================================================================== */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Clear Pending MTN Approvals"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
            Are you sure you want to clear all pending MTN approval records for your store?
            Numbers that are subsequently typed on your storefront will continue to be validated and re-recorded automatically.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeletingAll}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAll}
              disabled={isDeletingAll}
            >
              <Trash2 size={14} />
              <span>{isDeletingAll ? 'Clearing...' : 'Clear All Records'}</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StorePendingApprovalsPage;
