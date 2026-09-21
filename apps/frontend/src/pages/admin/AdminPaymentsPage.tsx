import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Modal } from '../../components/ui/index.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useToast } from '../../context/ToastContext.js';
import {
  CreditCard,
  RefreshCw,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Download,
  ShieldAlert,
  ArrowUpRight,
  Settings,
  Sliders,
  FileSpreadsheet,
  Eye,
  Check,
  X,
  ExternalLink,
  Copy,
  CheckCircle2,
  Clock,
  Store,
  Layers,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import {
  adminApi,
  AdminFinanceStats,
  AdminTransactionListItem,
  AdminTransactionDetailDto,
  AdminRefundListItemDto,
  FinancialSafetySettingsDto,
  ReprocessPreviewDto,
} from '../../api/admin.api.js';

// Standardized Tactile Button & Input Styles
const tactileButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.45rem',
  padding: '0.45rem 0.85rem',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-subtle)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  transition: 'all var(--transition-fast)',
  boxShadow: 'var(--shadow-tactile-sm)',
};

const primaryButtonStyle: React.CSSProperties = {
  ...tactileButtonStyle,
  background: 'linear-gradient(180deg, var(--color-primary-bright, #22C55E) 0%, var(--color-primary, #16A34A) 100%)',
  backgroundColor: 'var(--color-brand, #16A34A)',
  color: '#FFFFFF',
  border: '1px solid rgba(255, 255, 255, 0.25)',
  boxShadow: 'var(--shadow-tactile-btn, 0 4px 14px rgba(22, 163, 74, 0.35))',
  fontWeight: 700,
};

const dangerButtonStyle: React.CSSProperties = {
  ...tactileButtonStyle,
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  color: 'var(--color-danger, #EF4444)',
  border: '1px solid rgba(239, 68, 68, 0.25)',
  fontWeight: 700,
};

const selectStyle: React.CSSProperties = {
  padding: '0.45rem 0.75rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-subtle)',
  backgroundColor: 'var(--color-bg-surface)',
  color: 'var(--color-text-primary)',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
  outline: 'none',
  minWidth: '135px',
  boxShadow: 'var(--shadow-tactile-sm)',
};

export const AdminPaymentsPage: React.FC = () => {
  const { toastSuccess, toastError, toastWarning, toastInfo } = useToast();

  const [activeTab, setActiveTab] = useState<'PAYMENTS' | 'REFUNDS' | 'WITHDRAWALS' | 'SAFETY' | 'REPROCESS' | 'REPORTS'>('PAYMENTS');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<AdminFinanceStats | null>(null);

  // --- Payments State ---
  const [payPage, setPayPage] = useState(1);
  const [paySearch, setPaySearch] = useState('');
  const [payStatus, setPayStatus] = useState('ALL');
  const [payments, setPayments] = useState<AdminTransactionListItem[]>([]);
  const [payTotalPages, setPayTotalPages] = useState(1);
  const [payTotal, setPayTotal] = useState(0);

  // --- Refunds State ---
  const [refPage, setRefPage] = useState(1);
  const [refStatus, setRefStatus] = useState('ALL');
  const [refRisk, setRefRisk] = useState('ALL');
  const [refunds, setRefunds] = useState<AdminRefundListItemDto[]>([]);
  const [refTotalPages, setRefTotalPages] = useState(1);
  const [refTotal, setRefTotal] = useState(0);

  // --- Withdrawals (Agent Payouts) State ---
  const [wdPage, setWdPage] = useState(1);
  const [wdSearch, setWdSearch] = useState('');
  const [wdStatus, setWdStatus] = useState('ALL');
  const [wdDateRange, setWdDateRange] = useState('all');
  const [wdStartDate, setWdStartDate] = useState('');
  const [wdEndDate, setWdEndDate] = useState('');
  const [wdSortBy, setWdSortBy] = useState('newest');
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [wdTotalPages, setWdTotalPages] = useState(1);
  const [wdTotal, setWdTotal] = useState(0);
  const [wdSummary, setWdSummary] = useState<{
    pendingCount: number; pendingAmountPesewas: number;
    scheduledCount: number; scheduledAmountPesewas: number;
    heldCount: number; paidCount: number; paidAmountPesewas: number;
    rejectedCount: number;
  } | null>(null);
  const [scheduleMode, setScheduleMode] = useState<'immediate' | 'schedule'>('immediate');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');

  // --- Safety Settings State ---
  const [safety, setSafety] = useState<FinancialSafetySettingsDto | null>(null);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetySaving, setSafetySaving] = useState(false);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [safetyReason, setSafetyReason] = useState('');

  // --- Reprocess Failed State ---
  const [reprocessPreview, setReprocessPreview] = useState<ReprocessPreviewDto | null>(null);
  const [reprocessLoading, setReprocessLoading] = useState(false);
  const [reprocessExecuting, setReprocessExecuting] = useState(false);
  const [isReprocessModalOpen, setIsReprocessModalOpen] = useState(false);
  const [reprocessReason, setReprocessReason] = useState('');

  // --- Export Reports State ---
  const [reportType, setReportType] = useState('REVENUE');
  const [reportFormat, setReportFormat] = useState('csv');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  // --- Dossier Drawers State ---
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [txDetail, setTxDetail] = useState<AdminTransactionDetailDto | null>(null);
  const [txDetailLoading, setTxDetailLoading] = useState(false);
  const [txDossierTab, setTxDossierTab] = useState<'OVERVIEW' | 'FINANCIAL' | 'GATEWAY' | 'ORDER_AUDIT'>('OVERVIEW');

  const [selectedPayout, setSelectedPayout] = useState<any | null>(null);

  // --- Interactive Modals State ---
  const [refundModalTarget, setRefundModalTarget] = useState<{ id: string; ref: AdminRefundListItemDto; action: 'APPROVE' | 'REJECT' } | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  const [withdrawalModalTarget, setWithdrawalModalTarget] = useState<{ id: string; item: any; action: 'PAID' | 'REJECT' | 'HOLD' | 'SCHEDULE' } | null>(null);
  const [withdrawalNote, setWithdrawalNote] = useState('');
  const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toastSuccess('Copied', text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const setPresetDate = (type: 'today' | 'tomorrow' | 'saturday' | 'monday') => {
    const d = new Date();
    if (type === 'today') {
      setScheduledDate(d.toISOString().slice(0, 10));
      setScheduledTime('18:00');
    } else if (type === 'tomorrow') {
      d.setDate(d.getDate() + 1);
      setScheduledDate(d.toISOString().slice(0, 10));
      setScheduledTime('09:00');
    } else if (type === 'saturday') {
      const day = d.getDay();
      const diff = (6 - day + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      setScheduledDate(d.toISOString().slice(0, 10));
      setScheduledTime('10:00');
    } else if (type === 'monday') {
      const day = d.getDay();
      const diff = (1 - day + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      setScheduledDate(d.toISOString().slice(0, 10));
      setScheduledTime('09:00');
    }
  };

  // 1. Fetch Overview Stats
  const fetchOverview = useCallback(async () => {
    try {
      const res = await adminApi.getFinanceOverview();
      setStats(res);
    } catch {
      // Fallback
    }
  }, []);

  // 2. Fetch Payments List
  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getFinanceTransactions({
        page: payPage,
        limit: 20,
        search: paySearch.trim() || undefined,
        status: payStatus !== 'ALL' ? payStatus : undefined,
        type: 'DEPOSIT',
      });
      if (res && Array.isArray(res.items)) {
        setPayments(res.items);
        setPayTotalPages(res.pagination?.totalPages || 1);
        setPayTotal(res.pagination?.total || res.items.length);
      }
    } catch {
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  }, [payPage, paySearch, payStatus]);

  // 3. Fetch Refunds List
  const fetchRefunds = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getFinanceRefunds({
        page: refPage,
        limit: 20,
        status: refStatus !== 'ALL' ? refStatus : undefined,
        riskLevel: refRisk !== 'ALL' ? refRisk : undefined,
      });
      if (res && Array.isArray(res.items)) {
        setRefunds(res.items);
        setRefTotalPages(res.pagination?.totalPages || 1);
        setRefTotal(res.pagination?.total || res.items.length);
      }
    } catch {
      setRefunds([]);
    } finally {
      setIsLoading(false);
    }
  }, [refPage, refStatus, refRisk]);

  // 4. Fetch Withdrawals (Agent Payouts) with Full Admin Filters
  const fetchWithdrawals = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getFinanceWithdrawals({
        page: wdPage,
        limit: 20,
        status: wdStatus !== 'ALL' ? wdStatus : undefined,
        search: wdSearch.trim() || undefined,
        dateRange: wdDateRange !== 'all' ? wdDateRange : undefined,
        startDate: wdDateRange === 'custom' && wdStartDate ? wdStartDate : undefined,
        endDate: wdDateRange === 'custom' && wdEndDate ? wdEndDate : undefined,
        sortBy: wdSortBy !== 'newest' ? wdSortBy : undefined,
      });
      if (res && Array.isArray(res.items)) {
        setWithdrawals(res.items);
        setWdTotalPages(res.pagination?.totalPages || 1);
        setWdTotal(res.pagination?.total || res.items.length);
        if (res.summary) {
          setWdSummary(res.summary);
        }
      }
    } catch {
      setWithdrawals([]);
    } finally {
      setIsLoading(false);
    }
  }, [wdPage, wdStatus, wdSearch, wdDateRange, wdStartDate, wdEndDate, wdSortBy]);

  // 5. Fetch Safety Controls
  const fetchSafetyControls = useCallback(async () => {
    setSafetyLoading(true);
    try {
      const res = await adminApi.getFinancialSafetySettings();
      setSafety(res);
    } catch {
      // Fallback
    } finally {
      setSafetyLoading(false);
    }
  }, []);

  // 6. Fetch Reprocess Preview
  const fetchReprocessPreview = useCallback(async () => {
    setReprocessLoading(true);
    try {
      const res = await adminApi.getReprocessPreview();
      setReprocessPreview(res);
    } catch {
      toastError('DLQ Scan Failed', 'Failed to scan Dead Letter Queue for failed transactions.');
    } finally {
      setReprocessLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (activeTab === 'PAYMENTS') fetchPayments();
    if (activeTab === 'REFUNDS') fetchRefunds();
    if (activeTab === 'WITHDRAWALS') fetchWithdrawals();
    if (activeTab === 'SAFETY') fetchSafetyControls();
    if (activeTab === 'REPROCESS') fetchReprocessPreview();
  }, [activeTab, fetchPayments, fetchRefunds, fetchWithdrawals, fetchSafetyControls, fetchReprocessPreview]);

  // Open Transaction Dossier
  const openTransactionDossier = async (txId: string) => {
    setSelectedTxId(txId);
    setTxDossierTab('OVERVIEW');
    setTxDetailLoading(true);
    try {
      const detail = await adminApi.getFinanceTransactionDetail(txId);
      setTxDetail(detail);
    } catch (err: any) {
      toastError('Failed to load transaction dossier', err.message || 'Error fetching transaction details');
    } finally {
      setTxDetailLoading(false);
    }
  };

  // Handle Refund Action Confirmation
  const handleConfirmRefundAction = async () => {
    if (!refundModalTarget) return;
    if (!refundReason.trim() || refundReason.trim().length < 4) {
      toastError('Reason Required', 'Please enter a clear audit justification (min 4 characters).');
      return;
    }
    setRefundSubmitting(true);
    try {
      await adminApi.processRefundAction(refundModalTarget.id, {
        action: refundModalTarget.action,
        reason: refundReason.trim(),
      });
      toastSuccess(
        `Refund ${refundModalTarget.action === 'APPROVE' ? 'Approved' : 'Rejected'}`,
        `Successfully processed reversal for order ${refundModalTarget.ref.orderPublicId}.`
      );
      setRefundModalTarget(null);
      setRefundReason('');
      fetchRefunds();
      fetchOverview();
    } catch (err: any) {
      toastError('Action Failed', err.response?.data?.message || err.message || 'Action failed.');
    } finally {
      setRefundSubmitting(false);
    }
  };

  // Handle Withdrawal Action Confirmation (Settle / Reject / Hold / Schedule)
  const handleConfirmWithdrawalAction = async () => {
    if (!withdrawalModalTarget) return;
    if (withdrawalModalTarget.action === 'REJECT' && (!withdrawalNote.trim() || withdrawalNote.trim().length < 4)) {
      toastError('Reason Required', 'A rejection reason is required (min 4 characters).');
      return;
    }

    // Build scheduledAt ISO string if scheduling
    let scheduledAtIso: string | undefined;
    if ((withdrawalModalTarget.action === 'PAID' || withdrawalModalTarget.action === 'SCHEDULE') && scheduleMode === 'schedule') {
      if (!scheduledDate) {
        toastError('Date Required', 'Please select a settlement date for scheduling.');
        return;
      }
      scheduledAtIso = `${scheduledDate}T${scheduledTime || '09:00'}:00`;
    }

    setWithdrawalSubmitting(true);
    try {
      // Determine the backend action: if scheduling with PAID action, send APPROVE + scheduledAt
      let backendAction: 'PAID' | 'APPROVE' | 'REJECT' | 'HOLD' | 'SCHEDULE' = withdrawalModalTarget.action;
      if (withdrawalModalTarget.action === 'PAID' && scheduleMode === 'schedule' && scheduledAtIso) {
        backendAction = 'APPROVE'; // APPROVE + scheduledAt = SCHEDULED
      } else if (withdrawalModalTarget.action === 'SCHEDULE') {
        backendAction = 'SCHEDULE';
      }

      await adminApi.processWithdrawalAction(withdrawalModalTarget.id, {
        action: backendAction,
        reason: withdrawalNote.trim() || undefined,
        notes: withdrawalNote.trim() || undefined,
        scheduledAt: scheduledAtIso,
      });

      const actionLabels: Record<string, [string, string]> = {
        PAID: ['Payout Settled', 'Withdrawal marked as Settled (PAID).'],
        REJECT: ['Payout Rejected', 'Withdrawal marked as REJECTED.'],
        HOLD: ['Payout On Hold', 'Withdrawal placed on administrative hold.'],
        SCHEDULE: ['Settlement Scheduled', `Withdrawal scheduled for ${scheduledDate} at ${scheduledTime}.`],
      };
      const isScheduled = scheduleMode === 'schedule' && scheduledAtIso;
      const label = isScheduled
        ? ['Settlement Scheduled', `Withdrawal scheduled for ${scheduledDate} at ${scheduledTime}.`]
        : (actionLabels[withdrawalModalTarget.action] || ['Updated', 'Withdrawal updated.']);

      toastSuccess(label[0], label[1]);
      setWithdrawalModalTarget(null);
      setWithdrawalNote('');
      setScheduleMode('immediate');
      setScheduledDate('');
      setScheduledTime('09:00');
      fetchWithdrawals();
      fetchOverview();
      if (selectedPayout?.id === withdrawalModalTarget.id) {
        setSelectedPayout(null);
      }
    } catch (err: any) {
      toastError('Action Failed', err.response?.data?.message || err.message || 'Failed to update withdrawal.');
    } finally {
      setWithdrawalSubmitting(false);
    }
  };

  // Handle Save Safety Controls Confirmation
  const handleConfirmSaveSafety = async () => {
    if (!safety) return;
    if (!safetyReason.trim() || safetyReason.trim().length < 4) {
      toastError('Justification Required', 'A justification rationale is mandatory to change safety controls.');
      return;
    }
    setSafetySaving(true);
    try {
      await adminApi.updateFinancialSafetySettings({
        settings: safety,
        reason: safetyReason.trim(),
      });
      toastSuccess('Safety Controls Committed', 'Financial safety controls and velocity rules updated successfully.');
      setIsSafetyModalOpen(false);
      setSafetyReason('');
      fetchSafetyControls();
    } catch (err: any) {
      toastError('Update Failed', err.response?.data?.message || err.message || 'Failed to update safety controls.');
    } finally {
      setSafetySaving(false);
    }
  };

  // Handle Batch Reprocess Confirmation
  const handleConfirmExecuteReprocess = async () => {
    if (!reprocessPreview || reprocessPreview.eligibleCount === 0) {
      toastWarning('No Eligible Items', 'No eligible items to reprocess.');
      return;
    }
    if (!reprocessReason.trim() || reprocessReason.trim().length < 4) {
      toastError('Justification Required', 'A justification reason is mandatory to authorize batch reprocessing.');
      return;
    }
    setReprocessExecuting(true);
    try {
      await adminApi.executeReprocessBatch({
        reprocessAllEligible: true,
        reason: reprocessReason.trim(),
      });
      toastSuccess('Batch Enqueued', `Enqueued ${reprocessPreview.eligibleCount} transactions for re-execution.`);
      setIsReprocessModalOpen(false);
      setReprocessReason('');
      fetchReprocessPreview();
      fetchOverview();
    } catch (err: any) {
      toastError('Reprocess Failed', err.response?.data?.message || err.message || 'Failed to execute reprocess batch.');
    } finally {
      setReprocessExecuting(false);
    }
  };

  // Export Financial Report
  const handleExportReport = async () => {
    setExportLoading(true);
    try {
      toastInfo('Generating Dataset', `Exporting ${reportType} financial report...`);
      const blob = await adminApi.exportFinancialReport({
        reportType,
        format: reportFormat,
        startDate: reportStartDate || undefined,
        endDate: reportEndDate || undefined,
      });
      const url = window.URL.createObjectURL(new Blob([blob as any]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `financial-report-${reportType.toLowerCase()}-${Date.now()}.${reportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toastSuccess('Export Downloaded', `${reportType} report successfully generated.`);
    } catch {
      toastError('Export Failed', 'Failed to generate report export.');
    } finally {
      setExportLoading(false);
    }
  };

  // Withdrawals now filtered server-side; displayedWithdrawals is the direct backend result
  const displayedWithdrawals = withdrawals;

  // Helper: parse scheduledAt from adminNotes JSON
  const parseScheduledAt = (w: any): string | null => {
    if (w.scheduledAt) return w.scheduledAt;
    if (w.adminNotes && w.status === 'SCHEDULED') {
      try {
        const parsed = JSON.parse(w.adminNotes);
        return parsed.scheduledAt || null;
      } catch { return null; }
    }
    return null;
  };

  // Active filter chips for Payments
  const activePayFilters = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];
    if (paySearch.trim()) {
      chips.push({ id: 'search', label: `Search: "${paySearch}"`, onRemove: () => { setPaySearch(''); setPayPage(1); } });
    }
    if (payStatus !== 'ALL') {
      chips.push({ id: 'status', label: `Status: ${payStatus}`, onRemove: () => { setPayStatus('ALL'); setPayPage(1); } });
    }
    return chips;
  }, [paySearch, payStatus]);

  // Active filter chips for Refunds
  const activeRefFilters = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];
    if (refStatus !== 'ALL') {
      chips.push({ id: 'status', label: `Status: ${refStatus}`, onRemove: () => { setRefStatus('ALL'); setRefPage(1); } });
    }
    if (refRisk !== 'ALL') {
      chips.push({ id: 'risk', label: `Risk: ${refRisk === 'HIGH_RISK' ? 'High Risk' : 'Standard'}`, onRemove: () => { setRefRisk('ALL'); setRefPage(1); } });
    }
    return chips;
  }, [refStatus, refRisk]);

  // Active filter chips for Withdrawals
  const activeWdFilters = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];
    if (wdSearch.trim()) {
      chips.push({ id: 'search', label: `Search: "${wdSearch}"`, onRemove: () => { setWdSearch(''); setWdPage(1); } });
    }
    if (wdStatus !== 'ALL') {
      chips.push({ id: 'status', label: `Status: ${wdStatus}`, onRemove: () => { setWdStatus('ALL'); setWdPage(1); } });
    }
    if (wdDateRange !== 'all') {
      const dateLabels: Record<string, string> = { today: 'Today', yesterday: 'Yesterday', '7d': '7 Days', '14d': '14 Days', '30d': '30 Days', custom: 'Custom Range' };
      chips.push({ id: 'dateRange', label: `Date: ${dateLabels[wdDateRange] || wdDateRange}`, onRemove: () => { setWdDateRange('all'); setWdStartDate(''); setWdEndDate(''); setWdPage(1); } });
    }
    if (wdSortBy !== 'newest') {
      const sortLabels: Record<string, string> = { oldest: 'Oldest First', highest: 'Highest Amount', lowest: 'Lowest Amount' };
      chips.push({ id: 'sort', label: `Sort: ${sortLabels[wdSortBy] || wdSortBy}`, onRemove: () => { setWdSortBy('newest'); setWdPage(1); } });
    }
    return chips;
  }, [wdSearch, wdStatus, wdDateRange, wdSortBy]);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header (Standardized with Tactile Buttons) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={CreditCard} color="payments" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-brand-bright)' }}>
              Payment Operations & Safety
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
              Payments, Refunds & Financial Controls
            </h1>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Gateway settlement verification, two-person refund authorization, agent payouts, and safety circuit breakers.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              fetchOverview();
              if (activeTab === 'PAYMENTS') fetchPayments();
              else if (activeTab === 'REFUNDS') fetchRefunds();
              else if (activeTab === 'WITHDRAWALS') fetchWithdrawals();
              else if (activeTab === 'SAFETY') fetchSafetyControls();
              else if (activeTab === 'REPROCESS') fetchReprocessPreview();
            }}
            disabled={isLoading}
            style={tactileButtonStyle}
            title="Refresh active dataset"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('REPROCESS')}
            style={tactileButtonStyle}
            title="Scan Dead Letter Queue"
          >
            <RotateCcw size={14} />
            <span>Reprocess Failed</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('REPORTS')}
            style={tactileButtonStyle}
            title="Export financial reports"
          >
            <Download size={14} />
            <span>Export Reports</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SAFETY')}
            style={{
              ...dangerButtonStyle,
              backgroundColor: safety?.emergencyPaymentsDisabled || safety?.emergencyWithdrawalsDisabled || safety?.globalMaintenanceMode
                ? 'var(--color-danger)'
                : 'rgba(239, 68, 68, 0.12)',
              color: safety?.emergencyPaymentsDisabled || safety?.emergencyWithdrawalsDisabled || safety?.globalMaintenanceMode
                ? '#FFFFFF'
                : 'var(--color-danger, #EF4444)',
            }}
            title="Emergency Financial Circuit Breakers"
          >
            <ShieldAlert size={14} />
            <span>Safety Controls</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Cards (Standard Auto-fit Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          title="Total Inflow"
          value={`GHS ${(((stats?.totalDepositsPesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          subvalue="Verified gateway settlements"
          accent="green"
          icon={<TactileIcon icon={DollarSign} color="security" size="sm" />}
        />
        <MetricCard
          title="Processing Inflows"
          value={String(stats?.processingPaymentsCount || 0)}
          subvalue={`GHS ${(((stats?.processingPaymentsPesewas || 0) / 100).toFixed(2))} awaiting confirmation`}
          accent="amber"
          icon={<TactileIcon icon={CreditCard} color="orders" size="sm" />}
        />
        <MetricCard
          title="Failed Payments"
          value={String(stats?.failedPaymentsCount || 0)}
          subvalue={`GHS ${(((stats?.failedPaymentsPesewas || 0) / 100).toFixed(2))} requiring review`}
          accent="red"
          icon={<TactileIcon icon={AlertTriangle} color="red" size="sm" />}
        />
        <MetricCard
          title="Pending Refunds"
          value={String(stats?.pendingRefundsCount || 0)}
          subvalue={`GHS ${(((stats?.pendingRefundsPesewas || 0) / 100).toFixed(2))} in approval queue`}
          accent="purple"
          icon={<TactileIcon icon={RotateCcw} color="payments" size="sm" />}
        />
        <MetricCard
          title="Settled Withdrawals"
          value={`GHS ${(((stats?.totalWithdrawalsPesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          subvalue="Agent & merchant payouts"
          accent="blue"
          icon={<TactileIcon icon={ArrowUpRight} color="api" size="sm" />}
        />
      </div>

      {/* 3. Segmented Tactile Tab Switcher */}
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          padding: '0.25rem',
          backgroundColor: 'var(--color-bg-subtle)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-subtle)',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'PAYMENTS', label: 'Gateway Payments & Inflows', icon: <CreditCard size={13} />, count: stats?.totalDepositsCount ?? (payments.length ? payTotal : undefined) },
          { id: 'REFUNDS', label: 'Refund Administration', icon: <RotateCcw size={13} />, count: stats?.pendingRefundsCount ?? refunds.filter(r => r.status === 'PENDING' || r.status === 'REQUESTED').length },
          { id: 'WITHDRAWALS', label: 'Agent Payouts', icon: <ArrowUpRight size={13} />, count: stats?.pendingWithdrawalsCount ?? withdrawals.filter(w => w.status === 'PENDING').length },
          { id: 'SAFETY', label: 'Safety & Kill Switches', icon: <ShieldAlert size={13} />, badge: (safety?.emergencyPaymentsDisabled || safety?.emergencyWithdrawalsDisabled || safety?.globalMaintenanceMode) ? 'ACTIVE' : undefined },
          { id: 'REPROCESS', label: 'Mass Reprocess Failed', icon: <Sliders size={13} />, count: reprocessPreview?.eligibleCount },
          { id: 'REPORTS', label: 'Reports & Export', icon: <FileSpreadsheet size={13} /> },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id as any); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                border: isActive ? '1px solid var(--color-border-subtle)' : '1px solid transparent',
                backgroundColor: isActive ? 'var(--color-bg-surface)' : 'transparent',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? 'var(--shadow-tactile-sm)' : 'none',
                transition: 'all var(--transition-fast)',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.1rem 0.4rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: isActive ? 'var(--color-bg-subtle)' : 'rgba(255,255,255,0.05)',
                    color: isActive ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  {tab.count}
                </span>
              )}
              {tab.badge && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.1rem 0.4rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '9px',
                    fontWeight: 800,
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    color: 'var(--color-danger)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* --- TAB 1: GATEWAY PAYMENTS & INFLOWS --- */}
      {activeTab === 'PAYMENTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Compact Filter Toolbar */}
          <Card
            elevated
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: '1 1 280px', maxWidth: '420px' }}>
                <SearchInput
                  value={paySearch}
                  onChange={(e) => { setPaySearch(e.target.value); setPayPage(1); }}
                  placeholder="Reference, transaction ID, email, phone..."
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                <select
                  value={payStatus}
                  onChange={(e) => { setPayStatus(e.target.value); setPayPage(1); }}
                  style={selectStyle}
                  aria-label="Filter by Payment Status"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PAID">PAID / Settled</option>
                  <option value="PROCESSING">PROCESSING</option>
                  <option value="FAILED">FAILED</option>
                </select>

                <button
                  type="button"
                  onClick={() => fetchPayments()}
                  disabled={isLoading}
                  style={{ ...tactileButtonStyle, padding: '0.45rem 0.6rem', color: 'var(--color-text-muted)' }}
                  title="Refresh Payments"
                >
                  <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Active Filter Chips */}
            {activePayFilters.length > 0 && (
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
                {activePayFilters.map((chip) => (
                  <span
                    key={chip.id}
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
                    {chip.label}
                    <button
                      type="button"
                      onClick={chip.onRemove}
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
                      title="Remove filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => { setPaySearch(''); setPayStatus('ALL'); setPayPage(1); }}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-brand-primary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.2rem 0.4rem',
                  }}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </Card>

          {/* Payments Table Card */}
          <Card
            elevated
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              overflow: 'hidden',
              padding: 0,
            }}
          >
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
                  Gateway Settlement Inflow Ledger
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
                  Live settlement entries from Paystack, Mobile Money networks, and wallet funding.
                </p>
              </div>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                Showing {payments.length} of {payTotal} settlements
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Reference & ID</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Customer / Agent</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Amount</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Channel</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Status</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Timestamp</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
                        <span>Loading payment settlements...</span>
                      </td>
                    </tr>
                  ) : payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <span>No gateway payment transactions found matching the filter.</span>
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => openTransactionDossier(p.id)}
                        style={{
                          borderBottom: '1px solid var(--color-border-subtle)',
                          cursor: 'pointer',
                          transition: 'background-color var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-primary)' }}>
                                {p.reference.length > 28 ? `${p.reference.slice(0, 16)}...${p.reference.slice(-8)}` : p.reference}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleCopy(p.reference, `ref_${p.id}`); }}
                                style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: copiedKey === `ref_${p.id}` ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                                title="Copy reference"
                              >
                                {copiedKey === `ref_${p.id}` ? <Check size={11} /> : <Copy size={11} />}
                              </button>
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                              ID: {p.id.slice(0, 12)}...
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor: 'var(--color-bg-subtle)',
                                border: '1px solid var(--color-border-subtle)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'var(--color-brand-primary)',
                              }}
                            >
                              {(p.userName || 'U')[0].toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                              <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                                {p.userName}
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                {p.userEmail || p.userPhone || '—'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontWeight: 800, fontFamily: 'var(--font-data)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                            GH₵ {(p.amountPesewas / 100).toFixed(2)}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <Badge variant="neutral" size="sm">
                            {p.currency || 'GHS'} • Paystack
                          </Badge>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <Badge variant={p.status === 'PAID' ? 'success' : p.status === 'PROCESSING' ? 'warning' : 'danger'} size="sm">
                            {p.status}
                          </Badge>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {new Date(p.createdAt).toLocaleString()}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openTransactionDossier(p.id); }}
                            style={{ ...tactileButtonStyle, padding: '0.35rem 0.65rem', fontSize: '11px' }}
                            title="Inspect Settlement Dossier"
                          >
                            <Eye size={12} />
                            <span>Dossier</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
              <Pagination
                currentPage={payPage}
                totalPages={payTotalPages}
                totalItems={payTotal}
                onPageChange={(p) => setPayPage(p)}
              />
            </div>
          </Card>
        </div>
      )}

      {/* --- TAB 2: REFUND ADMINISTRATION --- */}
      {activeTab === 'REFUNDS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Compact Filter Toolbar */}
          <Card
            elevated
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Refund Status:
                </span>
                <select
                  value={refStatus}
                  onChange={(e) => { setRefStatus(e.target.value); setRefPage(1); }}
                  style={selectStyle}
                  aria-label="Filter Refund Status"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Approval</option>
                  <option value="COMPLETED">Completed / Reversed</option>
                  <option value="REJECTED">Rejected</option>
                </select>

                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginLeft: '0.5rem' }}>
                  Risk Class:
                </span>
                <select
                  value={refRisk}
                  onChange={(e) => { setRefRisk(e.target.value); setRefPage(1); }}
                  style={selectStyle}
                  aria-label="Filter Risk Level"
                >
                  <option value="ALL">All Risk Levels</option>
                  <option value="STANDARD">Standard Risk (&lt; GHS 500)</option>
                  <option value="HIGH_RISK">High Risk (Requires Super Admin)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => fetchRefunds()}
                disabled={isLoading}
                style={{ ...tactileButtonStyle, padding: '0.45rem 0.6rem', color: 'var(--color-text-muted)' }}
                title="Refresh Refunds"
              >
                <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Active Filter Chips */}
            {activeRefFilters.length > 0 && (
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
                {activeRefFilters.map((chip) => (
                  <span
                    key={chip.id}
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
                    {chip.label}
                    <button
                      type="button"
                      onClick={chip.onRemove}
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
                  onClick={() => { setRefStatus('ALL'); setRefRisk('ALL'); setRefPage(1); }}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-brand-primary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.2rem 0.4rem',
                  }}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </Card>

          {/* Refunds Table Card */}
          <Card
            elevated
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              overflow: 'hidden',
              padding: 0,
            }}
          >
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
                  Refund & Reversal Authorization Queue
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
                  Two-person verified reversal authorization for telecom fulfillment dropouts and failed deliveries.
                </p>
              </div>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                Showing {refunds.length} of {refTotal} requests
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Order #</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Customer</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Amount</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Reason</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Risk Class</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Status</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Requested</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
                        <span>Loading refund requests...</span>
                      </td>
                    </tr>
                  ) : refunds.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <span>No refund requests found matching the filter.</span>
                      </td>
                    </tr>
                  ) : (
                    refunds.map((ref) => (
                      <tr key={ref.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-brand-primary)' }}>
                            {ref.orderPublicId}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{ref.customerName}</span>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{ref.customerEmail}</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontWeight: 800, fontFamily: 'var(--font-data)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                            GH₵ {(ref.amountPesewas / 100).toFixed(2)}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', maxWidth: '220px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ref.reason}>
                            {ref.reason}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <Badge variant={ref.riskLevel === 'HIGH_RISK' ? 'danger' : 'neutral'} size="sm">
                            {ref.riskLevel === 'HIGH_RISK' ? 'HIGH RISK' : 'STANDARD'}
                          </Badge>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <Badge variant={ref.status === 'COMPLETED' ? 'success' : ref.status === 'REJECTED' ? 'danger' : 'warning'} size="sm">
                            {ref.status}
                          </Badge>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {new Date(ref.requestedAt).toLocaleString()}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                            {ref.status === 'PENDING' || ref.status === 'REQUESTED' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRefundModalTarget({ id: ref.id, ref, action: 'APPROVE' });
                                    setRefundReason(`Approved refund reversal for order ${ref.orderPublicId}`);
                                  }}
                                  style={{ ...primaryButtonStyle, padding: '0.35rem 0.6rem', fontSize: '11px' }}
                                  title="Approve Refund Reversal"
                                >
                                  <Check size={12} />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRefundModalTarget({ id: ref.id, ref, action: 'REJECT' });
                                    setRefundReason('');
                                  }}
                                  style={{ ...dangerButtonStyle, padding: '0.35rem 0.6rem', fontSize: '11px' }}
                                  title="Reject Refund"
                                >
                                  <X size={12} />
                                  <span>Reject</span>
                                </button>
                              </>
                            ) : (
                              <Badge variant="neutral" size="sm">
                                {ref.status === 'COMPLETED' ? 'Reversed' : 'Dismissed'}
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
              <Pagination
                currentPage={refPage}
                totalPages={refTotalPages}
                totalItems={refTotal}
                onPageChange={(p) => setRefPage(p)}
              />
            </div>
          </Card>
        </div>
      )}

      {/* --- TAB 3: AGENT PAYOUTS (WITHDRAWALS) --- */}
      {activeTab === 'WITHDRAWALS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Compact Filter Toolbar */}
          <Card
            elevated
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: '1 1 280px', maxWidth: '420px' }}>
                <SearchInput
                  value={wdSearch}
                  onChange={(e) => { setWdSearch(e.target.value); setWdPage(1); }}
                  placeholder="Store name, agent, account number, reference..."
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                <select
                  value={wdStatus}
                  onChange={(e) => { setWdStatus(e.target.value); setWdPage(1); }}
                  style={selectStyle}
                  aria-label="Filter Payout Status"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Approval</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="HELD">On Hold</option>
                  <option value="PAID">Settled / Paid</option>
                  <option value="REJECTED">Rejected</option>
                </select>

                <select
                  value={wdDateRange}
                  onChange={(e) => { setWdDateRange(e.target.value); setWdPage(1); }}
                  style={selectStyle}
                  aria-label="Filter Date Range"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="7d">7 Days</option>
                  <option value="14d">14 Days</option>
                  <option value="30d">30 Days</option>
                  <option value="custom">Custom Range</option>
                </select>

                {wdDateRange === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input type="date" value={wdStartDate} onChange={(e) => { setWdStartDate(e.target.value); setWdPage(1); }}
                      style={{ ...selectStyle, padding: '0.35rem 0.5rem', minWidth: '120px' }} />
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>to</span>
                    <input type="date" value={wdEndDate} onChange={(e) => { setWdEndDate(e.target.value); setWdPage(1); }}
                      style={{ ...selectStyle, padding: '0.35rem 0.5rem', minWidth: '120px' }} />
                  </div>
                )}

                <select
                  value={wdSortBy}
                  onChange={(e) => { setWdSortBy(e.target.value); setWdPage(1); }}
                  style={selectStyle}
                  aria-label="Sort Order"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest">Highest Amount</option>
                  <option value="lowest">Lowest Amount</option>
                </select>

                <button
                  type="button"
                  onClick={() => fetchWithdrawals()}
                  disabled={isLoading}
                  style={{ ...tactileButtonStyle, padding: '0.45rem 0.6rem', color: 'var(--color-text-muted)' }}
                  title="Refresh Payouts"
                >
                  <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Summary KPI Badges */}
            {wdSummary && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', paddingTop: '0.25rem', borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginRight: '0.25rem' }}>Queue:</span>
                <Badge variant="warning" size="sm">{wdSummary.pendingCount} Pending · GH₵ {(wdSummary.pendingAmountPesewas / 100).toFixed(2)}</Badge>
                {wdSummary.scheduledCount > 0 && <Badge variant="info" size="sm">{wdSummary.scheduledCount} Scheduled</Badge>}
                {wdSummary.heldCount > 0 && <Badge variant="neutral" size="sm">{wdSummary.heldCount} Held</Badge>}
                <Badge variant="success" size="sm">{wdSummary.paidCount} Paid · GH₵ {(wdSummary.paidAmountPesewas / 100).toFixed(2)}</Badge>
                {wdSummary.rejectedCount > 0 && <Badge variant="danger" size="sm">{wdSummary.rejectedCount} Rejected</Badge>}
              </div>
            )}

            {/* Active Filter Chips */}
            {activeWdFilters.length > 0 && (
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
                {activeWdFilters.map((chip) => (
                  <span
                    key={chip.id}
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
                    {chip.label}
                    <button
                      type="button"
                      onClick={chip.onRemove}
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
                  onClick={() => { setWdSearch(''); setWdStatus('ALL'); setWdDateRange('all'); setWdStartDate(''); setWdEndDate(''); setWdSortBy('newest'); setWdPage(1); }}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-brand-primary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.2rem 0.4rem',
                  }}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </Card>

          {/* Agent Payouts Table Card */}
          <Card
            elevated
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              overflow: 'hidden',
              padding: 0,
            }}
          >
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
                  Agent Store Payout Administration
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
                  Direct Mobile Money disbursement & bank payout settlement requests from agent storefronts.
                </p>
              </div>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                Showing {displayedWithdrawals.length} of {wdTotal} payout requests
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Store Name</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Agent</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Amount</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Destination Account</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Status</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Requested / Schedule</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
                        <span>Loading store payout requests...</span>
                      </td>
                    </tr>
                  ) : displayedWithdrawals.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <span>No agent store withdrawal records found matching the filter.</span>
                      </td>
                    </tr>
                  ) : (
                    displayedWithdrawals.map((w) => {
                      const schedAt = parseScheduledAt(w);
                      return (
                        <tr key={w.id || w.storeName} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: 'var(--radius-md)',
                                  backgroundColor: 'var(--color-bg-subtle)',
                                  border: '1px solid var(--color-border-subtle)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--color-brand-primary)',
                                }}
                              >
                                <Store size={14} />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                                  {w.storeName || 'Agent Direct'}
                                </span>
                                {w.storeSlug && (
                                  <span style={{ fontSize: '10px', color: 'var(--color-brand)', fontFamily: 'var(--font-mono)' }}>
                                    /{w.storeSlug}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{w.agentName}</span>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{w.agentEmail}</span>
                            </div>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span style={{ fontWeight: 800, fontFamily: 'var(--font-data)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                              GH₵ {(w.amountPesewas / 100).toFixed(2)}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Badge variant="neutral" size="xs">
                                  {w.bankName || w.destinationProvider || 'MOMO'}
                                </Badge>
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-primary)' }}>
                                  {w.destinationAccount}
                                </span>
                              </div>
                              {w.accountName && (
                                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                  {w.accountName}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <Badge
                              variant={
                                w.status === 'PAID'
                                  ? 'success'
                                  : w.status === 'SCHEDULED'
                                  ? 'info'
                                  : w.status === 'HELD'
                                  ? 'neutral'
                                  : w.status === 'REJECTED'
                                  ? 'danger'
                                  : 'warning'
                              }
                              size="sm"
                            >
                              {w.status}
                            </Badge>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {new Date(w.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                              {w.status === 'SCHEDULED' && schedAt && (
                                <span style={{ fontSize: '10px', color: 'var(--color-brand-primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <Clock size={10} /> Sched: {new Date(schedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              )}
                              {w.status === 'PAID' && w.paidAt && (
                                <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 600 }}>
                                  Paid: {new Date(w.paidAt).toLocaleDateString()}
                                </span>
                              )}
                              {w.status === 'HELD' && (
                                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                  Admin Hold
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => setSelectedPayout(w)}
                                style={{ ...tactileButtonStyle, padding: '0.35rem 0.6rem', fontSize: '11px' }}
                                title="View Payout Dossier"
                              >
                                <Eye size={12} />
                                <span>Dossier</span>
                              </button>
                              {(w.status === 'PENDING' || w.status === 'PROCESSING' || w.status === 'SCHEDULED' || w.status === 'HELD') ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWithdrawalModalTarget({ id: w.id, item: w, action: 'PAID' });
                                      if (w.status === 'SCHEDULED' && schedAt) {
                                        setScheduleMode('schedule');
                                        const d = new Date(schedAt);
                                        setScheduledDate(d.toISOString().slice(0, 10));
                                        setScheduledTime(d.toTimeString().slice(0, 5));
                                      } else {
                                        setScheduleMode('immediate');
                                        setScheduledDate(new Date().toISOString().slice(0, 10));
                                        setScheduledTime('10:00');
                                      }
                                      setWithdrawalNote('');
                                    }}
                                    style={{ ...primaryButtonStyle, padding: '0.35rem 0.6rem', fontSize: '11px' }}
                                    title={w.status === 'SCHEDULED' ? 'Reschedule or Settle Immediately' : 'Settle Immediately or Schedule'}
                                  >
                                    <Calendar size={12} />
                                    <span>{w.status === 'SCHEDULED' ? 'Reschedule' : w.status === 'HELD' ? 'Release / Settle' : 'Settle / Schedule'}</span>
                                  </button>
                                  {w.status !== 'HELD' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setWithdrawalModalTarget({ id: w.id, item: w, action: 'HOLD' });
                                        setWithdrawalNote('');
                                      }}
                                      style={{ ...tactileButtonStyle, padding: '0.35rem 0.55rem', fontSize: '11px', color: 'var(--color-warning)' }}
                                      title="Place on Administrative Hold"
                                    >
                                      <span>Hold</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWithdrawalModalTarget({ id: w.id, item: w, action: 'REJECT' });
                                      setWithdrawalNote('');
                                    }}
                                    style={{ ...dangerButtonStyle, padding: '0.35rem 0.6rem', fontSize: '11px' }}
                                    title="Reject Payout Request"
                                  >
                                    <X size={12} />
                                    <span>Reject</span>
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
              <Pagination
                currentPage={wdPage}
                totalPages={wdTotalPages}
                totalItems={wdTotal}
                onPageChange={(p) => setWdPage(p)}
              />
            </div>
          </Card>
        </div>
      )}

      {/* --- TAB 4: SAFETY CONTROLS & KILL SWITCHES --- */}
      {activeTab === 'SAFETY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Header Card with Danger Notice */}
          <Card
            elevated
            style={{
              padding: 'var(--space-4) var(--space-5)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <TactileIcon icon={ShieldAlert} color="red" size="md" />
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-danger)' }}>
                  Emergency Financial Circuit Breakers
                </h3>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  High-authority operational toggles. Modifying these immediately arrests financial movement across platform rails.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSafetyReason('Routine financial security threshold update');
                setIsSafetyModalOpen(true);
              }}
              disabled={safetySaving || !safety}
              style={{
                ...primaryButtonStyle,
                background: 'linear-gradient(180deg, #EF4444 0%, #DC2626 100%)',
                backgroundColor: 'var(--color-danger, #EF4444)',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
              }}
            >
              <ShieldAlert size={14} />
              <span>Commit Safety Controls</span>
            </button>
          </Card>

          {safetyLoading || !safety ? (
            <Card style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
              <span>Loading financial safety controls...</span>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
              {/* Emergency Kill Switches Card */}
              <Card
                elevated
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: 'var(--shadow-tactile-sm)',
                  padding: 'var(--space-5)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
                  <ShieldAlert size={16} color="var(--color-danger)" />
                  <h4 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Emergency Circuit Switches
                  </h4>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {[
                    {
                      key: 'globalMaintenanceMode',
                      title: 'Global Maintenance Mode',
                      desc: 'Blocks all customer checkouts and wallet top-ups platform-wide',
                      checked: safety.globalMaintenanceMode,
                    },
                    {
                      key: 'emergencyPaymentsDisabled',
                      title: 'Emergency Payments Freeze',
                      desc: 'Halts all inbound Paystack transactions and webhooks',
                      checked: safety.emergencyPaymentsDisabled,
                    },
                    {
                      key: 'emergencyWithdrawalsDisabled',
                      title: 'Emergency Withdrawals Freeze',
                      desc: 'Blocks all agent and merchant float disbursements',
                      checked: safety.emergencyWithdrawalsDisabled,
                    },
                    {
                      key: 'walletOperationsFrozen',
                      title: 'Wallet Operations Frozen',
                      desc: 'Disables internal balance transfers, credits, and debits',
                      checked: safety.walletOperationsFrozen,
                    },
                  ].map((item) => (
                    <label
                      key={item.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        backgroundColor: item.checked ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-bg-subtle)',
                        borderRadius: 'var(--radius-md)',
                        border: item.checked ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--color-border-subtle)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: item.checked ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                          {item.title}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                          {item.desc}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => setSafety({ ...safety, [item.key]: e.target.checked })}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--color-danger)', cursor: 'pointer' }}
                      />
                    </label>
                  ))}
                </div>
              </Card>

              {/* Transaction & Velocity Limits Card */}
              <Card
                elevated
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: 'var(--shadow-tactile-sm)',
                  padding: 'var(--space-5)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
                  <Settings size={16} color="var(--color-brand-bright)" />
                  <h4 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Operational Limits & Velocity Rules
                  </h4>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Max Single Transaction (GH₵)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={String(safety.maxSingleTransactionPesewas / 100)}
                      onChange={(e) => setSafety({ ...safety, maxSingleTransactionPesewas: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-subtle)',
                        backgroundColor: 'var(--color-bg-surface)',
                        color: 'var(--color-text-primary)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Max Daily Deposit Per User (GH₵)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={String(safety.maxDailyDepositPesewas / 100)}
                      onChange={(e) => setSafety({ ...safety, maxDailyDepositPesewas: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-subtle)',
                        backgroundColor: 'var(--color-bg-surface)',
                        color: 'var(--color-text-primary)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Min Profit Withdrawal Per Request (GH₵)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={String((safety.minWithdrawalPesewas || 1000) / 100)}
                      onChange={(e) => setSafety({ ...safety, minWithdrawalPesewas: Math.round(parseFloat(e.target.value || '10') * 100) })}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-subtle)',
                        backgroundColor: 'var(--color-bg-surface)',
                        color: 'var(--color-text-primary)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Max Single Profit Withdrawal Per Request (GH₵)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={String((safety.maxSingleWithdrawalPesewas || 500000) / 100)}
                      onChange={(e) => setSafety({ ...safety, maxSingleWithdrawalPesewas: Math.round(parseFloat(e.target.value || '5000') * 100) })}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-subtle)',
                        backgroundColor: 'var(--color-bg-surface)',
                        color: 'var(--color-text-primary)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Max Daily Profit Withdrawal Per Agent (GH₵)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={String(safety.maxDailyWithdrawalPesewas / 100)}
                      onChange={(e) => setSafety({ ...safety, maxDailyWithdrawalPesewas: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-subtle)',
                        backgroundColor: 'var(--color-bg-surface)',
                        color: 'var(--color-text-primary)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Suspicious Velocity Threshold (tx/min)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={String(safety.suspiciousVelocityThreshold)}
                      onChange={(e) => setSafety({ ...safety, suspiciousVelocityThreshold: parseInt(e.target.value || '10', 10) })}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-subtle)',
                        backgroundColor: 'var(--color-bg-surface)',
                        color: 'var(--color-text-primary)',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 5: MASS REPROCESS FAILED --- */}
      {activeTab === 'REPROCESS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Header Card */}
          <Card
            elevated
            style={{
              padding: 'var(--space-4) var(--space-5)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Mass Reprocess Failed Transactions (Controlled Batch)
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Pre-flight validation verifies idempotency before dispatching transient fulfillment failures back to provider queues.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => fetchReprocessPreview()}
                disabled={reprocessLoading}
                style={tactileButtonStyle}
                title="Rescan DLQ"
              >
                <RefreshCw size={13} className={reprocessLoading ? 'animate-spin' : ''} />
                <span>Rescan DLQ</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setReprocessReason(`Batch reprocess of ${reprocessPreview?.eligibleCount || 0} failed transactions`);
                  setIsReprocessModalOpen(true);
                }}
                disabled={reprocessExecuting || !reprocessPreview || reprocessPreview.eligibleCount === 0}
                style={primaryButtonStyle}
              >
                <RotateCcw size={14} />
                <span>Reprocess {reprocessPreview?.eligibleCount || 0} Eligible Orders</span>
              </button>
            </div>
          </Card>

          {reprocessLoading || !reprocessPreview ? (
            <Card style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
              <span>Scanning failed orders in Dead Letter Queue...</span>
            </Card>
          ) : (
            <Card
              elevated
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-tactile-sm)',
                padding: 'var(--space-5)',
              }}
            >
              {/* DLQ Counters Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Failed Scanned</span>
                  <p style={{ margin: '0.25rem 0 0 0', fontWeight: 800, fontSize: 'var(--font-size-xl)' }}>{reprocessPreview.totalFailed}</p>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-success)', borderTop: '1px solid var(--color-border-subtle)', borderRight: '1px solid var(--color-border-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 700 }}>Eligible For Retry</span>
                  <p style={{ margin: '0.25rem 0 0 0', fontWeight: 800, fontSize: 'var(--font-size-xl)', color: 'var(--color-success)' }}>{reprocessPreview.eligibleCount}</p>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-danger)', borderTop: '1px solid var(--color-border-subtle)', borderRight: '1px solid var(--color-border-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-danger)', fontWeight: 700 }}>Permanent / Ineligible</span>
                  <p style={{ margin: '0.25rem 0 0 0', fontWeight: 800, fontSize: 'var(--font-size-xl)', color: 'var(--color-danger)' }}>{reprocessPreview.ineligibleCount}</p>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                      <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Order #</th>
                      <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Carrier / Phone</th>
                      <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Amount</th>
                      <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Failure Class</th>
                      <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Error Details</th>
                      <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px', textAlign: 'right' }}>Eligibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reprocessPreview.eligibleItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          <span>No pending failed transactions requiring reprocessing.</span>
                        </td>
                      </tr>
                    ) : (
                      reprocessPreview.eligibleItems.map((item) => (
                        <tr key={item.orderId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-brand-primary)' }}>
                              {item.publicId || item.orderId.slice(0, 10)}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span style={{ fontSize: '11px' }}>{item.network} ({item.recipientPhone})</span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span style={{ fontWeight: 800, fontFamily: 'var(--font-data)', fontSize: '11px' }}>
                              GH₵ {(item.amountPesewas / 100).toFixed(2)}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <Badge variant="warning" size="xs">{item.failureClass}</Badge>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{item.errorMessage || item.errorCode || '—'}</span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                            <Badge variant={item.eligibleForRetry ? 'success' : 'danger'} size="xs">
                              {item.eligibleForRetry ? 'ELIGIBLE' : 'INELIGIBLE'}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* --- TAB 6: REPORTS & EXPORT --- */}
      {activeTab === 'REPORTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Header Card */}
          <Card
            elevated
            style={{
              padding: 'var(--space-4) var(--space-5)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              Financial Reports & Dataset Export
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Export authoritative ledger vouchers, payment settlements, refund histories, and reconciliation cases in CSV or JSON.
            </p>
          </Card>

          {/* Export Form Card */}
          <Card
            elevated
            style={{
              padding: 'var(--space-5)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Report Dataset
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  style={{ ...selectStyle, width: '100%' }}
                >
                  <option value="REVENUE">Revenue & Payment Transactions</option>
                  <option value="LEDGER">Double-Entry General Ledger Lines</option>
                  <option value="REFUNDS">Refund & Reversal Records</option>
                  <option value="RECONCILIATION">Reconciliation Discrepancies</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Export Format
                </label>
                <select
                  value={reportFormat}
                  onChange={(e) => setReportFormat(e.target.value)}
                  style={{ ...selectStyle, width: '100%' }}
                >
                  <option value="csv">CSV (Spreadsheet / Excel)</option>
                  <option value="json">JSON (Raw API Objects)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Start Date (Optional)
                </label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    fontSize: '11px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-primary)',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    fontSize: '11px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-primary)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleExportReport}
                disabled={exportLoading}
                style={primaryButtonStyle}
              >
                <Download size={14} className={exportLoading ? 'animate-spin' : ''} />
                <span>{exportLoading ? 'Generating Dataset...' : 'Generate & Download Report'}</span>
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TRANSACTION DOSSIER DRAWER & BACKDROP (zIndex 250 / 260)              */}
      {/* ========================================================================= */}
      {selectedTxId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 250,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setSelectedTxId(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '820px',
              height: '100%',
              backgroundColor: 'var(--color-bg-surface)',
              borderLeft: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-tactile-xl, 0 20px 50px rgba(0,0,0,0.5))',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 260,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: 'var(--space-5) var(--space-6)',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--color-bg-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-brand-primary)',
                  }}
                >
                  <CreditCard size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                      Settlement Dossier
                    </h2>
                    {txDetail?.transaction.status && (
                      <Badge variant={txDetail.transaction.status === 'PAID' ? 'success' : txDetail.transaction.status === 'PROCESSING' ? 'warning' : 'danger'} size="sm">
                        {txDetail.transaction.status}
                      </Badge>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Ref: {txDetail?.transaction.reference || selectedTxId}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedTxId(null)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    padding: '0.4rem',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  title="Close Dossier"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Dossier Tabs Switcher */}
            <div
              style={{
                display: 'flex',
                gap: '0.35rem',
                padding: '0.5rem var(--space-6)',
                borderBottom: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-bg-surface)',
              }}
            >
              {[
                { id: 'OVERVIEW', label: 'Overview & Profile', icon: <Layers size={13} /> },
                { id: 'FINANCIAL', label: 'Journal & Ledger', icon: <DollarSign size={13} /> },
                { id: 'GATEWAY', label: 'Gateway Telemetry', icon: <ShieldCheck size={13} /> },
                { id: 'ORDER_AUDIT', label: 'Order & Audit Trail', icon: <Clock size={13} /> },
              ].map((tab) => {
                const isActive = txDossierTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTxDossierTab(tab.id as any)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: isActive ? '1px solid var(--color-border-subtle)' : '1px solid transparent',
                      backgroundColor: isActive ? 'var(--color-bg-subtle)' : 'transparent',
                      color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '11px',
                      cursor: 'pointer',
                      boxShadow: isActive ? 'var(--shadow-tactile-sm)' : 'none',
                    }}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Dossier Content Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {txDetailLoading ? (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto var(--space-3)' }} />
                  <span>Loading transaction records from double-entry ledger...</span>
                </div>
              ) : !txDetail ? (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <span>Transaction details could not be loaded.</span>
                </div>
              ) : (
                <>
                  {/* TAB 1: OVERVIEW */}
                  {txDossierTab === 'OVERVIEW' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      {/* Metric Summary Strip */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Settled Amount</span>
                          <p style={{ margin: '0.2rem 0 0 0', fontWeight: 800, fontSize: 'var(--font-size-lg)', fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>
                            GH₵ {(txDetail.transaction.amountPesewas / 100).toFixed(2)}
                          </p>
                        </div>
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Payment Gateway</span>
                          <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                            {txDetail.externalPayment?.provider || 'Paystack'}
                          </p>
                        </div>
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Channel / Type</span>
                          <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                            {txDetail.transaction.type || 'DEPOSIT'}
                          </p>
                        </div>
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Timestamp</span>
                          <p style={{ margin: '0.2rem 0 0 0', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                            {new Date(txDetail.transaction.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Customer / Agent Profile Card */}
                      <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <h4 style={{ margin: 0, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                            Customer & Agent Profile
                          </h4>
                          {txDetail.transaction.userId && (
                            <a
                              href={`/admin/users/${txDetail.transaction.userId}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '11px', fontWeight: 700, color: 'var(--color-brand-primary)', textDecoration: 'none' }}
                            >
                              <span>View Full Dossier</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Full Name</span>
                            <p style={{ margin: '0.15rem 0 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                              {txDetail.transaction.userName}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Email Address</span>
                            <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                              {txDetail.transaction.userEmail || '—'}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Phone Number</span>
                            <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                              {txDetail.transaction.userPhone || '—'}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Account Role</span>
                            <p style={{ margin: '0.15rem 0 0 0' }}>
                              <Badge variant={txDetail.transaction.userRole === 'AGENT' ? 'success' : txDetail.transaction.userRole === 'ADMIN' ? 'warning' : 'neutral'} size="xs">
                                {txDetail.transaction.userRole || 'CUSTOMER'}
                              </Badge>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Authoritative Identifiers Card */}
                      <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                          Settlement Identifiers
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Provider Reference:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <code style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{txDetail.transaction.reference}</code>
                              <button
                                type="button"
                                onClick={() => handleCopy(txDetail.transaction.reference, 'dossier_ref')}
                                style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: copiedKey === 'dossier_ref' ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                              >
                                {copiedKey === 'dossier_ref' ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Transaction ID:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <code style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{txDetail.transaction.id}</code>
                              <button
                                type="button"
                                onClick={() => handleCopy(txDetail.transaction.id, 'dossier_txid')}
                                style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: copiedKey === 'dossier_txid' ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                              >
                                {copiedKey === 'dossier_txid' ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: FINANCIAL / JOURNAL */}
                  {txDossierTab === 'FINANCIAL' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <h4 style={{ margin: 0, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                            Double-Entry Journal Postings
                          </h4>
                          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                            Journal ID: {txDetail.financialMovement?.ledgerJournalId || 'N/A'}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                          <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.06)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-danger)' }}>
                            <span style={{ fontSize: '10px', color: 'var(--color-danger)', fontWeight: 800 }}>DEBIT ACCOUNT</span>
                            <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-primary)' }}>
                              {txDetail.financialMovement?.debitAccount || '1010-GATEWAY-SETTLEMENT'}
                            </p>
                            <p style={{ margin: '0.2rem 0 0 0', fontWeight: 800, fontFamily: 'var(--font-data)', fontSize: 'var(--font-size-sm)' }}>
                              GH₵ {((txDetail.financialMovement?.debitAmountPesewas || txDetail.transaction.amountPesewas) / 100).toFixed(2)}
                            </p>
                          </div>

                          <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.06)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-success)' }}>
                            <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 800 }}>CREDIT ACCOUNT</span>
                            <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-primary)' }}>
                              {txDetail.financialMovement?.creditAccount || '2010-USER-WALLET-LIABILITY'}
                            </p>
                            <p style={{ margin: '0.2rem 0 0 0', fontWeight: 800, fontFamily: 'var(--font-data)', fontSize: 'var(--font-size-sm)' }}>
                              GH₵ {((txDetail.financialMovement?.creditAmountPesewas || txDetail.transaction.amountPesewas) / 100).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {txDetail.financialMovement?.balanceBeforePesewas !== undefined && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', fontSize: '11px' }}>
                            <span>Balance Before: <strong>GH₵ {((txDetail.financialMovement.balanceBeforePesewas || 0) / 100).toFixed(2)}</strong></span>
                            <span>Balance After: <strong>GH₵ {((txDetail.financialMovement.balanceAfterPesewas || 0) / 100).toFixed(2)}</strong></span>
                          </div>
                        )}
                      </div>

                      {/* Ledger Lines Table if present */}
                      {txDetail.financialMovement?.ledgerLines && txDetail.financialMovement.ledgerLines.length > 0 && (
                        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                            General Ledger Line Entries ({txDetail.financialMovement.ledgerLines.length})
                          </h4>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '10px' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                                  <th style={{ padding: '0.4rem' }}>Type</th>
                                  <th style={{ padding: '0.4rem' }}>Account</th>
                                  <th style={{ padding: '0.4rem' }}>Amount</th>
                                  <th style={{ padding: '0.4rem' }}>Description</th>
                                </tr>
                              </thead>
                              <tbody>
                                {txDetail.financialMovement.ledgerLines.map((line: any, idx: number) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                                    <td style={{ padding: '0.4rem' }}>
                                      <Badge variant={line.entryType === 'DEBIT' ? 'danger' : 'success'} size="xs">{line.entryType}</Badge>
                                    </td>
                                    <td style={{ padding: '0.4rem', fontFamily: 'var(--font-mono)' }}>{line.accountType || line.accountId}</td>
                                    <td style={{ padding: '0.4rem', fontFamily: 'var(--font-data)', fontWeight: 700 }}>
                                      GH₵ {((line.amountPesewas || 0) / 100).toFixed(2)}
                                    </td>
                                    <td style={{ padding: '0.4rem', color: 'var(--color-text-muted)' }}>{line.description || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: GATEWAY TELEMETRY */}
                  {txDossierTab === 'GATEWAY' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                          External Gateway Verification
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Gateway Provider</span>
                            <p style={{ margin: '0.15rem 0 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                              {txDetail.externalPayment?.provider || 'Paystack'}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Provider Ref</span>
                            <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                              {txDetail.externalPayment?.providerReference || txDetail.transaction.reference}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Verification State</span>
                            <p style={{ margin: '0.15rem 0 0 0' }}>
                              <Badge variant={txDetail.externalPayment?.verificationStatus === 'VERIFIED' ? 'success' : 'warning'} size="xs">
                                {txDetail.externalPayment?.verificationStatus || 'VERIFIED'}
                              </Badge>
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Webhook Delivery</span>
                            <p style={{ margin: '0.15rem 0 0 0' }}>
                              <Badge variant="success" size="xs">
                                {txDetail.externalPayment?.webhookStatus || 'DELIVERED'}
                              </Badge>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Raw Metadata Explorer */}
                      <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                          Raw Gateway Payload & Headers
                        </h4>
                        <pre
                          style={{
                            margin: 0,
                            padding: '0.75rem',
                            backgroundColor: 'var(--color-bg-surface)',
                            border: '1px solid var(--color-border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--color-text-primary)',
                            overflowX: 'auto',
                            maxHeight: '260px',
                          }}
                        >
                          {JSON.stringify(txDetail.externalPayment?.rawMetadata || { reference: txDetail.transaction.reference, gateway: 'paystack', verified: true }, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: ORDER & AUDIT */}
                  {txDossierTab === 'ORDER_AUDIT' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      {/* Related Commerce Order if exists */}
                      {txDetail.relatedOrder && (
                        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                            Related Commerce Order
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Order #</span>
                              <p style={{ margin: '0.15rem 0 0 0', fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-brand-primary)' }}>
                                {txDetail.relatedOrder.publicId}
                              </p>
                            </div>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Network & Phone</span>
                              <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px' }}>
                                {txDetail.relatedOrder.network} ({txDetail.relatedOrder.recipientPhone})
                              </p>
                            </div>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Data Bundle</span>
                              <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', fontWeight: 700 }}>
                                {txDetail.relatedOrder.productName || `${txDetail.relatedOrder.dataAmountMb} MB`}
                              </p>
                            </div>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Fulfillment Status</span>
                              <p style={{ margin: '0.15rem 0 0 0' }}>
                                <Badge variant={txDetail.relatedOrder.fulfillmentStatus === 'COMPLETED' ? 'success' : 'warning'} size="xs">
                                  {txDetail.relatedOrder.fulfillmentStatus || 'COMPLETED'}
                                </Badge>
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Security Audit Trail */}
                      <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                          Immutable Security Audit Trail
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                          {txDetail.auditTrail && txDetail.auditTrail.length > 0 ? (
                            txDetail.auditTrail.map((ev: any, idx: number) => (
                              <div
                                key={idx}
                                style={{
                                  padding: '0.55rem 0.75rem',
                                  backgroundColor: 'var(--color-bg-surface)',
                                  borderRadius: 'var(--radius-md)',
                                  border: '1px solid var(--color-border-subtle)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: '11px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <ShieldCheck size={13} color="var(--color-brand-primary)" />
                                  <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{ev.action}</span>
                                  <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                                    by {ev.actorType} ({ev.actorId?.slice(0, 8)})
                                  </span>
                                </div>
                                <span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                                  {new Date(ev.timestamp).toLocaleString()}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              Settlement logged automatically via verified Paystack webhook listener.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. AGENT PAYOUT DOSSIER DRAWER & BACKDROP (zIndex 250 / 260)              */}
      {/* ========================================================================= */}
      {selectedPayout && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 250,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setSelectedPayout(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              height: '100%',
              backgroundColor: 'var(--color-bg-surface)',
              borderLeft: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-tactile-xl, 0 20px 50px rgba(0,0,0,0.5))',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 260,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: 'var(--space-5) var(--space-6)',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--color-bg-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-brand-primary)',
                  }}
                >
                  <ArrowUpRight size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                      Payout Request Dossier
                    </h2>
                    <Badge
                      variant={
                        selectedPayout.status === 'PAID'
                          ? 'success'
                          : selectedPayout.status === 'SCHEDULED'
                          ? 'info'
                          : selectedPayout.status === 'HELD'
                          ? 'neutral'
                          : selectedPayout.status === 'REJECTED'
                          ? 'danger'
                          : 'warning'
                      }
                      size="sm"
                    >
                      {selectedPayout.status}
                    </Badge>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Store: {selectedPayout.storeName || 'Agent Direct'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPayout(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '0.4rem',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Amount Banner */}
              <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-text-muted)' }}>Requested Disbursement Amount</span>
                <p style={{ margin: '0.35rem 0 0 0', fontWeight: 800, fontSize: 'var(--font-size-2xl)', fontFamily: 'var(--font-data)', color: 'var(--color-brand-primary)' }}>
                  GH₵ {((selectedPayout.amountPesewas || 0) / 100).toFixed(2)}
                </p>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  Requested on {new Date(selectedPayout.createdAt).toLocaleString()}
                </span>
              </div>

              {/* Scheduled Settlement Status Banner */}
              {selectedPayout.status === 'SCHEDULED' && parseScheduledAt(selectedPayout) && (
                <div style={{ padding: '0.85rem 1rem', backgroundColor: 'rgba(59, 130, 246, 0.08)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <TactileIcon icon={Clock} color="blue" size="sm" />
                  <div>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-brand-primary)' }}>
                      Scheduled Settlement Execution
                    </span>
                    <p style={{ margin: '0.15rem 0 0 0', fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                      {new Date(parseScheduledAt(selectedPayout)!).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
              )}

              {/* Paid Status Banner */}
              {selectedPayout.status === 'PAID' && selectedPayout.paidAt && (
                <div style={{ padding: '0.85rem 1rem', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <TactileIcon icon={CheckCircle2} color="emerald" size="sm" />
                  <div>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-success)' }}>
                      Disbursement Completed
                    </span>
                    <p style={{ margin: '0.15rem 0 0 0', fontWeight: 700, fontSize: '12px', color: 'var(--color-text-primary)' }}>
                      Settled on {new Date(selectedPayout.paidAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Administrative Hold Banner */}
              {selectedPayout.status === 'HELD' && (
                <div style={{ padding: '0.85rem 1rem', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <TactileIcon icon={AlertTriangle} color="amber" size="sm" />
                  <div>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-warning)' }}>
                      Administrative Hold Active
                    </span>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      Payout is paused pending compliance review or verification.
                    </p>
                  </div>
                </div>
              )}

              {/* Destination Bank & MOMO */}
              <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                  Destination Payout Rails
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Provider / Rail</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                      {selectedPayout.bankName || selectedPayout.destinationProvider || 'Mobile Money'}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Account / MOMO Number</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <code style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                        {selectedPayout.destinationAccount}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedPayout.destinationAccount, 'payout_dest')}
                        style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: copiedKey === 'payout_dest' ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                      >
                        {copiedKey === 'payout_dest' ? <Check size={11} /> : <Copy size={11} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Account Holder Name</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                      {selectedPayout.accountName || selectedPayout.agentName || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Merchant Agent Information */}
              <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                  Merchant & Agent Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Store Name</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                      {selectedPayout.storeName || 'Agent Direct'}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Store URL Slug</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-brand-primary)' }}>
                      /{selectedPayout.storeSlug || 'n/a'}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Agent Name</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                      {selectedPayout.agentName}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Agent Email</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                      {selectedPayout.agentEmail}
                    </p>
                  </div>
                </div>
              </div>

              {/* Admin Review & Notes Dossier */}
              {selectedPayout.adminNotes && (
                <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                    Admin Audit Notes & History
                  </h4>
                  <p style={{ margin: 0, fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {selectedPayout.adminNotes}
                  </p>
                  {selectedPayout.reviewedAt && (
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginTop: '0.4rem' }}>
                      Reviewed at: {new Date(selectedPayout.reviewedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {/* Settlement Actions in Drawer */}
              {(selectedPayout.status === 'PENDING' || selectedPayout.status === 'PROCESSING' || selectedPayout.status === 'SCHEDULED' || selectedPayout.status === 'HELD') && (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {selectedPayout.status !== 'HELD' && (
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawalModalTarget({ id: selectedPayout.id, item: selectedPayout, action: 'HOLD' });
                        setWithdrawalNote('');
                      }}
                      style={{ ...tactileButtonStyle, color: 'var(--color-warning)' }}
                    >
                      <span>Put on Hold</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawalModalTarget({ id: selectedPayout.id, item: selectedPayout, action: 'REJECT' });
                      setWithdrawalNote('');
                    }}
                    style={dangerButtonStyle}
                  >
                    <X size={13} />
                    <span>Reject Payout</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const schedTime = parseScheduledAt(selectedPayout);
                      setWithdrawalModalTarget({ id: selectedPayout.id, item: selectedPayout, action: 'PAID' });
                      if (selectedPayout.status === 'SCHEDULED' && schedTime) {
                        setScheduleMode('schedule');
                        const d = new Date(schedTime);
                        setScheduledDate(d.toISOString().slice(0, 10));
                        setScheduledTime(d.toTimeString().slice(0, 5));
                      } else {
                        setScheduleMode('immediate');
                        setScheduledDate(new Date().toISOString().slice(0, 10));
                        setScheduledTime('10:00');
                      }
                      setWithdrawalNote('');
                    }}
                    style={primaryButtonStyle}
                  >
                    <Calendar size={13} />
                    <span>{selectedPayout.status === 'SCHEDULED' ? 'Reschedule / Settle' : 'Settle / Schedule Payout'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. INTERACTIVE MODALS (Clean Accessible Modals replacing prompt/alert)   */}
      {/* ========================================================================= */}

      {/* A. REFUND ACTION MODAL */}
      <Modal
        isOpen={!!refundModalTarget}
        onClose={() => setRefundModalTarget(null)}
        title={`${refundModalTarget?.action === 'APPROVE' ? 'Approve' : 'Reject'} Refund Reversal`}
        subtitle="Two-person authorization audit log for financial reversal"
        maxWidth="500px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-1)' }}>
          {refundModalTarget && (
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Order: <strong style={{ fontFamily: 'var(--font-mono)' }}>{refundModalTarget.ref.orderPublicId}</strong></span>
                <span>Amount: <strong style={{ fontFamily: 'var(--font-data)' }}>GH₵ {(refundModalTarget.ref.amountPesewas / 100).toFixed(2)}</strong></span>
              </div>
              <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--color-text-muted)' }}>
                Customer: {refundModalTarget.ref.customerName} ({refundModalTarget.ref.customerEmail})
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              Mandatory Audit Rationale * (min 4 characters)
            </label>
            <textarea
              rows={3}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="e.g. Verified telecom gateway delivery failure with Datahouse"
              style={{
                width: '100%',
                padding: '0.5rem 0.65rem',
                fontSize: '11px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={() => setRefundModalTarget(null)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmRefundAction}
              disabled={refundSubmitting}
              style={refundModalTarget?.action === 'APPROVE' ? primaryButtonStyle : dangerButtonStyle}
            >
              {refundSubmitting ? 'Processing...' : `Confirm ${refundModalTarget?.action === 'APPROVE' ? 'Approval' : 'Rejection'}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* B. WITHDRAWAL ACTION MODAL */}
      <Modal
        isOpen={!!withdrawalModalTarget}
        onClose={() => setWithdrawalModalTarget(null)}
        title={
          withdrawalModalTarget?.action === 'REJECT'
            ? 'Reject Payout Request'
            : withdrawalModalTarget?.action === 'HOLD'
            ? 'Place Withdrawal on Administrative Hold'
            : withdrawalModalTarget?.item?.status === 'SCHEDULED'
            ? 'Reschedule or Settle Payout'
            : 'Authorize & Schedule Payout Settlement'
        }
        subtitle="Authoritative disbursement audit log & settlement scheduling"
        maxWidth="520px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-1)' }}>
          {withdrawalModalTarget && (
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Store: <strong>{withdrawalModalTarget.item.storeName || 'Agent Direct'}</strong></span>
                <span>Amount: <strong style={{ fontFamily: 'var(--font-data)' }}>GH₵ {((withdrawalModalTarget.item.amountPesewas || 0) / 100).toFixed(2)}</strong></span>
              </div>
              <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--color-text-muted)' }}>
                Destination: {withdrawalModalTarget.item.destinationAccount} ({withdrawalModalTarget.item.bankName || withdrawalModalTarget.item.destinationProvider || 'MOMO'})
              </div>
              {withdrawalModalTarget.item.status === 'SCHEDULED' && parseScheduledAt(withdrawalModalTarget.item) && (
                <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--color-brand-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} />
                  Currently Scheduled for: {new Date(parseScheduledAt(withdrawalModalTarget.item)!).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              )}
            </div>
          )}

          {/* Settle / Schedule Timing Toggle (when action is PAID / SCHEDULE) */}
          {(withdrawalModalTarget?.action === 'PAID' || withdrawalModalTarget?.action === 'SCHEDULE') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                Settlement Execution Timing
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setScheduleMode('immediate')}
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: scheduleMode === 'immediate' ? '2px solid var(--color-brand-primary)' : '1px solid var(--color-border-subtle)',
                    backgroundColor: scheduleMode === 'immediate' ? 'rgba(16, 185, 129, 0.08)' : 'var(--color-bg-surface)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '2px',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, color: scheduleMode === 'immediate' ? 'var(--color-brand-primary)' : 'var(--color-text-primary)' }}>
                    ⚡ Settle Immediately
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    Disburse funds & mark as PAID right now
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setScheduleMode('schedule');
                    if (!scheduledDate) {
                      setScheduledDate(new Date().toISOString().slice(0, 10));
                    }
                  }}
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: scheduleMode === 'schedule' ? '2px solid var(--color-brand-primary)' : '1px solid var(--color-border-subtle)',
                    backgroundColor: scheduleMode === 'schedule' ? 'rgba(16, 185, 129, 0.08)' : 'var(--color-bg-surface)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '2px',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, color: scheduleMode === 'schedule' ? 'var(--color-brand-primary)' : 'var(--color-text-primary)' }}>
                    📅 Schedule Settlement
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    Set custom execution date & time
                  </span>
                </button>
              </div>

              {/* Date & Time Picker Controls */}
              {scheduleMode === 'schedule' && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border-subtle)',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '3px', textTransform: 'uppercase' }}>
                        Settlement Date *
                      </label>
                      <input
                        type="date"
                        value={scheduledDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.6rem',
                          fontSize: '12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border-subtle)',
                          backgroundColor: 'var(--color-bg-surface)',
                          color: 'var(--color-text-primary)',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '3px', textTransform: 'uppercase' }}>
                        Settlement Time *
                      </label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.6rem',
                          fontSize: '12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border-subtle)',
                          backgroundColor: 'var(--color-bg-surface)',
                          color: 'var(--color-text-primary)',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  {/* Date Quick Presets */}
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600, marginRight: '0.4rem' }}>
                      Presets:
                    </span>
                    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '3px' }}>
                      <button
                        type="button"
                        onClick={() => setPresetDate('today')}
                        style={{ ...tactileButtonStyle, padding: '0.2rem 0.45rem', fontSize: '10px' }}
                      >
                        Today 6:00 PM
                      </button>
                      <button
                        type="button"
                        onClick={() => setPresetDate('tomorrow')}
                        style={{ ...tactileButtonStyle, padding: '0.2rem 0.45rem', fontSize: '10px' }}
                      >
                        Tomorrow 9:00 AM
                      </button>
                      <button
                        type="button"
                        onClick={() => setPresetDate('saturday')}
                        style={{ ...tactileButtonStyle, padding: '0.2rem 0.45rem', fontSize: '10px', color: 'var(--color-brand-primary)' }}
                      >
                        Next Saturday (Batch)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPresetDate('monday')}
                        style={{ ...tactileButtonStyle, padding: '0.2rem 0.45rem', fontSize: '10px' }}
                      >
                        Next Monday
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes / Reason Input */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              {withdrawalModalTarget?.action === 'REJECT'
                ? 'Rejection Reason * (Required, min 4 chars)'
                : withdrawalModalTarget?.action === 'HOLD'
                ? 'Hold Reason / Verification Notice (Optional)'
                : scheduleMode === 'schedule'
                ? 'Scheduling Notes / Batch Reference (Optional)'
                : 'Disbursement Reference / Transaction ID (Optional)'}
            </label>
            <input
              type="text"
              value={withdrawalNote}
              onChange={(e) => setWithdrawalNote(e.target.value)}
              placeholder={
                withdrawalModalTarget?.action === 'REJECT'
                  ? 'e.g. Beneficiary account name does not match agent KYC verification'
                  : withdrawalModalTarget?.action === 'HOLD'
                  ? 'e.g. Awaiting telecom float reconciliation or suspicious velocity check'
                  : scheduleMode === 'schedule'
                  ? 'e.g. Enqueued for Saturday Weekly Settlement Cycle'
                  : 'e.g. Momo transfer ref #829103 or bank EFT trace'
              }
              style={{
                width: '100%',
                padding: '0.5rem 0.65rem',
                fontSize: '11px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={() => setWithdrawalModalTarget(null)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmWithdrawalAction}
              disabled={withdrawalSubmitting}
              style={
                withdrawalModalTarget?.action === 'REJECT'
                  ? dangerButtonStyle
                  : withdrawalModalTarget?.action === 'HOLD'
                  ? { ...tactileButtonStyle, backgroundColor: 'var(--color-warning)', color: '#000', fontWeight: 800 }
                  : primaryButtonStyle
              }
            >
              {withdrawalSubmitting
                ? 'Updating...'
                : withdrawalModalTarget?.action === 'REJECT'
                ? 'Confirm Rejection'
                : withdrawalModalTarget?.action === 'HOLD'
                ? 'Place on Administrative Hold'
                : scheduleMode === 'schedule'
                ? 'Confirm Settlement Schedule'
                : 'Confirm Immediate Settlement'}
            </button>
          </div>
        </div>
      </Modal>

      {/* C. SAFETY CONTROLS CONFIRM MODAL */}
      <Modal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        title="Authorize Emergency Circuit Breaker Changes"
        subtitle="Super Admin operational authorization"
        maxWidth="520px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-1)' }}>
          <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-danger)' }}>
              WARNING: High-Authority Financial Action
            </span>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              Modifying financial circuit breakers will immediately affect checkout rails, Paystack webhooks, and float transfers across all accounts.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              Mandatory Super Admin Justification * (min 4 chars)
            </label>
            <textarea
              rows={3}
              value={safetyReason}
              onChange={(e) => setSafetyReason(e.target.value)}
              placeholder="e.g. Scheduled gateway maintenance window or security mitigation"
              style={{
                width: '100%',
                padding: '0.5rem 0.65rem',
                fontSize: '11px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={() => setIsSafetyModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSaveSafety}
              disabled={safetySaving}
              style={{
                ...primaryButtonStyle,
                background: 'linear-gradient(180deg, #EF4444 0%, #DC2626 100%)',
                backgroundColor: 'var(--color-danger, #EF4444)',
              }}
            >
              {safetySaving ? 'Committing...' : 'Authorize & Commit Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* D. REPROCESS CONFIRM MODAL */}
      <Modal
        isOpen={isReprocessModalOpen}
        onClose={() => setIsReprocessModalOpen(false)}
        title="Authorize Batch Reprocessing"
        subtitle="Dead Letter Queue order re-dispatch"
        maxWidth="500px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-1)' }}>
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Batch Target: {reprocessPreview?.eligibleCount || 0} Eligible Orders
            </span>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Idempotency checks have verified these orders have not reached terminal fulfillment status.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              Mandatory Audit Justification * (min 4 chars)
            </label>
            <input
              type="text"
              value={reprocessReason}
              onChange={(e) => setReprocessReason(e.target.value)}
              placeholder="e.g. Telecom provider restored after transient timeout"
              style={{
                width: '100%',
                padding: '0.5rem 0.65rem',
                fontSize: '11px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={() => setIsReprocessModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmExecuteReprocess}
              disabled={reprocessExecuting}
              style={primaryButtonStyle}
            >
              {reprocessExecuting ? 'Enqueuing...' : `Enqueue ${reprocessPreview?.eligibleCount || 0} Orders`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminPaymentsPage;
