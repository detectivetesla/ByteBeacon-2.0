import React, { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Select, Modal } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import {
  CreditCard,
  RefreshCw,
  DollarSign,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  Download,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle,
  XCircle,
  PauseCircle,
  PlayCircle,
  Settings,
  Sliders,
  FileSpreadsheet,
} from 'lucide-react';
import {
  adminApi,
  AdminFinanceStats,
  AdminTransactionListItem,
  AdminRefundListItemDto,
  FinancialSafetySettingsDto,
  ReprocessPreviewDto,
} from '../../api/admin.api.js';

export const AdminPaymentsPage: React.FC = () => {
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

  // --- Withdrawals State ---
  const [wdPage, setWdPage] = useState(1);
  const [wdStatus, setWdStatus] = useState('ALL');
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [wdTotalPages, setWdTotalPages] = useState(1);
  const [wdTotal, setWdTotal] = useState(0);

  // --- Safety Settings State ---
  const [safety, setSafety] = useState<FinancialSafetySettingsDto | null>(null);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetySaving, setSafetySaving] = useState(false);

  // --- Reprocess Failed State ---
  const [reprocessPreview, setReprocessPreview] = useState<ReprocessPreviewDto | null>(null);
  const [reprocessLoading, setReprocessLoading] = useState(false);
  const [reprocessExecuting, setReprocessExecuting] = useState(false);

  // --- Export Reports State ---
  const [reportType, setReportType] = useState('REVENUE');
  const [reportFormat, setReportFormat] = useState('csv');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

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
        search: paySearch || undefined,
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

  // 4. Fetch Withdrawals
  const fetchWithdrawals = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getFinanceWithdrawals({
        page: wdPage,
        limit: 20,
        status: wdStatus !== 'ALL' ? wdStatus : undefined,
      });
      if (res && Array.isArray(res.items)) {
        setWithdrawals(res.items);
        setWdTotalPages(res.pagination?.totalPages || 1);
        setWdTotal(res.pagination?.total || res.items.length);
      }
    } catch {
      setWithdrawals([]);
    } finally {
      setIsLoading(false);
    }
  }, [wdPage, wdStatus]);

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
  const fetchReprocessPreview = async () => {
    setReprocessLoading(true);
    try {
      const res = await adminApi.getReprocessPreview();
      setReprocessPreview(res);
    } catch {
      alert('Failed to scan DLQ for failed retries.');
    } finally {
      setReprocessLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (activeTab === 'PAYMENTS') fetchPayments();
    if (activeTab === 'REFUNDS') fetchRefunds();
    if (activeTab === 'WITHDRAWALS') fetchWithdrawals();
    if (activeTab === 'SAFETY') fetchSafetyControls();
    if (activeTab === 'REPROCESS') fetchReprocessPreview();
  }, [activeTab, fetchPayments, fetchRefunds, fetchWithdrawals, fetchSafetyControls]);

  // Handle Refund Approval/Rejection
  const handleRefundAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
    const reason = prompt(`Enter audit reason to ${action.toLowerCase()} refund:`);
    if (reason === null) return;
    try {
      await adminApi.processRefundAction(id, {
        action,
        reason: reason || `Admin ${action.toLowerCase()}`,
      });
      alert(`Refund ${action.toLowerCase()}d successfully.`);
      fetchRefunds();
      fetchOverview();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Action failed.');
    }
  };

  // Save Safety Controls
  const handleSaveSafetyControls = async () => {
    if (!safety) return;
    const reason = prompt('Super Admin Authorization: Enter justification for changing financial safety controls:');
    if (!reason) {
      alert('A justification reason is mandatory to change safety controls.');
      return;
    }

    setSafetySaving(true);
    try {
      await adminApi.updateFinancialSafetySettings({
        settings: safety,
        reason,
      });
      alert('Financial safety controls updated successfully.');
      fetchSafetyControls();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to update safety controls.');
    } finally {
      setSafetySaving(false);
    }
  };

  // Execute Batch Reprocess
  const handleExecuteReprocess = async () => {
    if (!reprocessPreview || reprocessPreview.eligibleCount === 0) {
      alert('No eligible items to reprocess.');
      return;
    }
    const reason = prompt(`Authorize batch retry of ${reprocessPreview.eligibleCount} transactions. Enter justification:`);
    if (!reason) return;

    setReprocessExecuting(true);
    try {
      await adminApi.executeReprocessBatch({
        reprocessAllEligible: true,
        reason,
      });
      alert(`Enqueued ${reprocessPreview.eligibleCount} transactions for re-execution.`);
      fetchReprocessPreview();
      fetchOverview();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to execute reprocess batch.');
    } finally {
      setReprocessExecuting(false);
    }
  };

  // Export Financial Report
  const handleExportReport = async () => {
    setExportLoading(true);
    try {
      const blob = await adminApi.exportFinancialReport({
        reportType,
        format: reportFormat,
        startDate: reportStartDate || undefined,
        endDate: reportEndDate || undefined,
      });
      const url = window.URL.createObjectURL(new Blob([blob as any]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `financial-report-${reportType.toLowerCase()}-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to generate report export.');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={CreditCard} color="payments" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-brand-bright)' }}>
              Payment Operations & Safety
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
              Payments, Refunds & Financial Controls
            </h1>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Gateway settlement verification, two-person refund authorization, agent payouts, and safety circuit breakers.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button variant="secondary" size="sm" onClick={() => { fetchOverview(); if (activeTab === 'PAYMENTS') fetchPayments(); else if (activeTab === 'REFUNDS') fetchRefunds(); else if (activeTab === 'WITHDRAWALS') fetchWithdrawals(); }}>
            <RefreshCw size={14} style={{ marginRight: '0.35rem' }} /> Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setActiveTab('REPROCESS')}>
            <RotateCcw size={14} style={{ marginRight: '0.35rem' }} /> Reprocess Failed
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setActiveTab('REPORTS')}>
            <Download size={14} style={{ marginRight: '0.35rem' }} /> Export Reports
          </Button>
          <Button variant="danger" size="sm" onClick={() => setActiveTab('SAFETY')}>
            <ShieldAlert size={14} style={{ marginRight: '0.35rem' }} /> Safety Controls
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          label="Total Inflow"
          value={`GHS ${(((stats?.totalDepositsPesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          helperText="Verified gateway settlements"
          accent="green"
          icon={<TactileIcon icon={DollarSign} color="security" size="sm" />}
        />
        <MetricCard
          label="Processing Inflows"
          value={String(stats?.processingPaymentsCount || 0)}
          helperText={`GHS ${(((stats?.processingPaymentsPesewas || 0) / 100).toFixed(2))} awaiting confirmation`}
          accent="amber"
          icon={<TactileIcon icon={CreditCard} color="orders" size="sm" />}
        />
        <MetricCard
          label="Failed Payments"
          value={String(stats?.failedPaymentsCount || 0)}
          helperText={`GHS ${(((stats?.failedPaymentsPesewas || 0) / 100).toFixed(2))} requiring review`}
          accent="red"
          icon={<TactileIcon icon={AlertTriangle} color="red" size="sm" />}
        />
        <MetricCard
          label="Pending Refunds"
          value={String(stats?.pendingRefundsCount || 0)}
          helperText={`GHS ${(((stats?.pendingRefundsPesewas || 0) / 100).toFixed(2))} in approval queue`}
          accent="purple"
          icon={<TactileIcon icon={RotateCcw} color="payments" size="sm" />}
        />
        <MetricCard
          label="Settled Withdrawals"
          value={`GHS ${(((stats?.totalWithdrawalsPesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          helperText="Agent & merchant payouts"
          accent="blue"
          icon={<TactileIcon icon={ArrowUpRight} color="api" size="sm" />}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', gap: '1.5rem', marginBottom: 'var(--space-2)' }}>
        <button
          onClick={() => setActiveTab('PAYMENTS')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.5rem',
            fontSize: 'var(--font-size-sm)',
            fontWeight: activeTab === 'PAYMENTS' ? 700 : 500,
            color: activeTab === 'PAYMENTS' ? 'var(--color-brand-bright)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'PAYMENTS' ? '2px solid var(--color-brand-bright)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CreditCard size={16} /> Gateway Payments & Inflows
        </button>
        <button
          onClick={() => setActiveTab('REFUNDS')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.5rem',
            fontSize: 'var(--font-size-sm)',
            fontWeight: activeTab === 'REFUNDS' ? 700 : 500,
            color: activeTab === 'REFUNDS' ? 'var(--color-brand-bright)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'REFUNDS' ? '2px solid var(--color-brand-bright)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <RotateCcw size={16} /> Refund Administration ({refunds.filter(r => r.status === 'PENDING' || r.status === 'REQUESTED').length})
        </button>
        <button
          onClick={() => setActiveTab('WITHDRAWALS')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.5rem',
            fontSize: 'var(--font-size-sm)',
            fontWeight: activeTab === 'WITHDRAWALS' ? 700 : 500,
            color: activeTab === 'WITHDRAWALS' ? 'var(--color-brand-bright)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'WITHDRAWALS' ? '2px solid var(--color-brand-bright)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <ArrowUpRight size={16} /> Agent Payouts
        </button>
        <button
          onClick={() => setActiveTab('SAFETY')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.5rem',
            fontSize: 'var(--font-size-sm)',
            fontWeight: activeTab === 'SAFETY' ? 700 : 500,
            color: activeTab === 'SAFETY' ? 'var(--color-brand-bright)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'SAFETY' ? '2px solid var(--color-brand-bright)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <ShieldAlert size={16} /> Safety & Kill Switches
        </button>
        <button
          onClick={() => setActiveTab('REPROCESS')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.5rem',
            fontSize: 'var(--font-size-sm)',
            fontWeight: activeTab === 'REPROCESS' ? 700 : 500,
            color: activeTab === 'REPROCESS' ? 'var(--color-brand-bright)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'REPROCESS' ? '2px solid var(--color-brand-bright)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Sliders size={16} /> Mass Reprocess Failed
        </button>
        <button
          onClick={() => setActiveTab('REPORTS')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.5rem',
            fontSize: 'var(--font-size-sm)',
            fontWeight: activeTab === 'REPORTS' ? 700 : 500,
            color: activeTab === 'REPORTS' ? 'var(--color-brand-bright)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'REPORTS' ? '2px solid var(--color-brand-bright)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <FileSpreadsheet size={16} /> Reports & Export
        </button>
      </div>

      {/* --- TAB 1: PAYMENTS --- */}
      {activeTab === 'PAYMENTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card accentColor="purple">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Search Gateway Inflows</label>
                <SearchInput
                  value={paySearch}
                  onChange={(e) => setPaySearch(e.target.value)}
                  placeholder="Provider reference, transaction ID, email, phone..."
                />
              </div>

              <div style={{ minWidth: '180px' }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Payment Status</label>
                <Select
                  value={payStatus}
                  onChange={(e) => setPayStatus(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Statuses' },
                    { value: 'PAID', label: 'PAID / Settled' },
                    { value: 'PROCESSING', label: 'PROCESSING' },
                    { value: 'FAILED', label: 'FAILED' },
                  ]}
                />
              </div>
            </div>
          </Card>

          <Card>
            <Table
              headers={['Reference', 'Customer / Agent', 'Amount (GHS)', 'Currency', 'Status', 'Timestamp']}
              data={payments.map((p) => [
                <div key="ref" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                    {p.reference}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>ID: {p.id.slice(0, 14)}...</span>
                </div>,
                <div key="user" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{p.userName}</span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{p.userEmail || p.userPhone}</span>
                </div>,
                <span key="amt" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  GHS {(p.amountPesewas / 100).toFixed(2)}
                </span>,
                <span key="cur" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{p.currency}</span>,
                <Badge
                  key="st"
                  variant={p.status === 'PAID' ? 'success' : p.status === 'PROCESSING' ? 'warning' : 'danger'}
                >
                  {p.status}
                </Badge>,
                <span key="ts" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  {new Date(p.createdAt).toLocaleString()}
                </span>,
              ])}
              loading={isLoading}
              emptyMessage="No gateway payment transactions found."
            />

            <Pagination
              currentPage={payPage}
              totalPages={payTotalPages}
              totalItems={payTotal}
              onPageChange={(p) => setPayPage(p)}
            />
          </Card>
        </div>
      )}

      {/* --- TAB 2: REFUNDS --- */}
      {activeTab === 'REFUNDS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card accentColor="amber">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              <div style={{ minWidth: '180px' }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Refund Status</label>
                <Select
                  value={refStatus}
                  onChange={(e) => setRefStatus(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Statuses' },
                    { value: 'PENDING', label: 'PENDING' },
                    { value: 'COMPLETED', label: 'COMPLETED' },
                    { value: 'REJECTED', label: 'REJECTED' },
                  ]}
                />
              </div>

              <div style={{ minWidth: '180px' }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Risk Level</label>
                <Select
                  value={refRisk}
                  onChange={(e) => setRefRisk(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Risk Levels' },
                    { value: 'STANDARD', label: 'Standard Risk (< GHS 500)' },
                    { value: 'HIGH_RISK', label: 'High Risk (Requires Super Admin)' },
                  ]}
                />
              </div>
            </div>
          </Card>

          <Card>
            <Table
              headers={['Order #', 'Customer', 'Amount (GHS)', 'Reason', 'Risk Level', 'Status', 'Requested', 'Action']}
              data={refunds.map((ref) => [
                <span key="ord" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                  {ref.orderPublicId}
                </span>,
                <div key="cust" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{ref.customerName}</span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{ref.customerEmail}</span>
                </div>,
                <span key="amt" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  GHS {(ref.amountPesewas / 100).toFixed(2)}
                </span>,
                <span key="rsn" style={{ fontSize: 'var(--font-size-xs)', maxWidth: '200px', display: 'block' }}>{ref.reason}</span>,
                <Badge key="risk" variant={ref.riskLevel === 'HIGH_RISK' ? 'danger' : 'neutral'}>
                  {ref.riskLevel}
                </Badge>,
                <Badge key="st" variant={ref.status === 'COMPLETED' ? 'success' : ref.status === 'REJECTED' ? 'danger' : 'warning'}>
                  {ref.status}
                </Badge>,
                <span key="dt" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  {new Date(ref.requestedAt).toLocaleString()}
                </span>,
                <div key="act" style={{ display: 'flex', gap: '0.35rem' }}>
                  {ref.status === 'PENDING' || ref.status === 'REQUESTED' ? (
                    <>
                      <Button variant="primary" size="sm" onClick={() => handleRefundAction(ref.id, 'APPROVE')}>
                        Approve Reversal
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleRefundAction(ref.id, 'REJECT')}>
                        Reject
                      </Button>
                    </>
                  ) : (
                    <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                      Processed
                    </span>
                  )}
                </div>,
              ])}
              loading={isLoading}
              emptyMessage="No refund requests found."
            />

            <Pagination
              currentPage={refPage}
              totalPages={refTotalPages}
              totalItems={refTotal}
              onPageChange={(p) => setRefPage(p)}
            />
          </Card>
        </div>
      )}

      {/* --- TAB 3: WITHDRAWALS --- */}
      {activeTab === 'WITHDRAWALS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card accentColor="blue">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700 }}>Agent Store Payout Administration</h3>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Direct Mobile Money disbursement & bank payout settlement requests from agent storefronts.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <Table
              headers={['Store Name', 'Agent', 'Amount (GHS)', 'Destination Account', 'Status', 'Requested Date']}
              data={withdrawals.map((w) => [
                <span key="st" style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{w.storeName}</span>,
                <div key="ag" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{w.agentName}</span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{w.agentEmail}</span>
                </div>,
                <span key="amt" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  GHS {(w.amountPesewas / 100).toFixed(2)}
                </span>,
                <span key="dst" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                  {w.destinationProvider}: {w.destinationAccount}
                </span>,
                <Badge key="st" variant={w.status === 'PAID' ? 'success' : w.status === 'REJECTED' ? 'danger' : 'warning'}>
                  {w.status}
                </Badge>,
                <span key="dt" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  {new Date(w.createdAt).toLocaleString()}
                </span>,
              ])}
              loading={isLoading}
              emptyMessage="No agent store withdrawal records found."
            />

            <Pagination
              currentPage={wdPage}
              totalPages={wdTotalPages}
              totalItems={wdTotal}
              onPageChange={(p) => setWdPage(p)}
            />
          </Card>
        </div>
      )}

      {/* --- TAB 4: SAFETY CONTROLS --- */}
      {activeTab === 'SAFETY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card accentColor="red">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ShieldAlert size={28} color="var(--color-danger)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-danger)' }}>
                    Emergency Financial Circuit Breakers
                  </h3>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    High-authority operational toggles. Modifying these immediately arrests financial movement across platform rails.
                  </p>
                </div>
              </div>

              <Button variant="danger" onClick={handleSaveSafetyControls} disabled={safetySaving}>
                {safetySaving ? 'Saving Controls...' : 'Commit Safety Controls'}
              </Button>
            </div>
          </Card>

          {safetyLoading || !safety ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Loading safety controls...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
              {/* Emergency Kill Switches */}
              <Card>
                <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700, fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldAlert size={16} color="var(--color-danger)" /> Emergency Kill Switches
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>Global Maintenance Mode</span>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>Blocks all customer checkouts and wallet top-ups</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={safety.globalMaintenanceMode}
                      onChange={(e) => setSafety({ ...safety, globalMaintenanceMode: e.target.checked })}
                    />
                  </label>

                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>Emergency Payments Freeze</span>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>Halts all inbound Paystack transactions</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={safety.emergencyPaymentsDisabled}
                      onChange={(e) => setSafety({ ...safety, emergencyPaymentsDisabled: e.target.checked })}
                    />
                  </label>

                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>Emergency Withdrawals Freeze</span>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>Blocks all agent and merchant float payouts</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={safety.emergencyWithdrawalsDisabled}
                      onChange={(e) => setSafety({ ...safety, emergencyWithdrawalsDisabled: e.target.checked })}
                    />
                  </label>

                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>Wallet Operations Frozen</span>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>Disables internal balance transfers and spends</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={safety.walletOperationsFrozen}
                      onChange={(e) => setSafety({ ...safety, walletOperationsFrozen: e.target.checked })}
                    />
                  </label>
                </div>
              </Card>

              {/* Transaction & Velocity Limits */}
              <Card>
                <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700, fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Settings size={16} color="var(--color-brand-bright)" /> Operational Limits & Velocity
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Max Single Transaction (GHS)</label>
                    <SearchInput
                      type="number"
                      value={String(safety.maxSingleTransactionPesewas / 100)}
                      onChange={(e) => setSafety({ ...safety, maxSingleTransactionPesewas: Math.round(parseFloat(e.target.value || '0') * 100) })}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Max Daily Deposit Per User (GHS)</label>
                    <SearchInput
                      type="number"
                      value={String(safety.maxDailyDepositPesewas / 100)}
                      onChange={(e) => setSafety({ ...safety, maxDailyDepositPesewas: Math.round(parseFloat(e.target.value || '0') * 100) })}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Max Daily Withdrawal Per Agent (GHS)</label>
                    <SearchInput
                      type="number"
                      value={String(safety.maxDailyWithdrawalPesewas / 100)}
                      onChange={(e) => setSafety({ ...safety, maxDailyWithdrawalPesewas: Math.round(parseFloat(e.target.value || '0') * 100) })}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Suspicious Velocity Threshold (tx/min)</label>
                    <SearchInput
                      type="number"
                      value={String(safety.suspiciousVelocityThreshold)}
                      onChange={(e) => setSafety({ ...safety, suspiciousVelocityThreshold: parseInt(e.target.value || '10', 10) })}
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
          <Card accentColor="orange">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700 }}>Mass Reprocess Failed Transactions (Controlled Batch)</h3>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Pre-flight validation verifies idempotency before dispatching transient fulfillment failures back to provider queues.
                </p>
              </div>
              <Button variant="primary" onClick={handleExecuteReprocess} disabled={reprocessExecuting || !reprocessPreview || reprocessPreview.eligibleCount === 0}>
                {reprocessExecuting ? 'Enqueuing...' : `Reprocess ${reprocessPreview?.eligibleCount || 0} Eligible Orders`}
              </Button>
            </div>
          </Card>

          {reprocessLoading || !reprocessPreview ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Scanning failed orders in Dead Letter Queue...</div>
          ) : (
            <Card>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Total Failed Scanned</span>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-xl)' }}>{reprocessPreview.totalFailed}</p>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-success)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 700 }}>Eligible For Retry</span>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-xl)', color: 'var(--color-success)' }}>{reprocessPreview.eligibleCount}</p>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-danger)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-danger)', fontWeight: 700 }}>Permanent / Ineligible</span>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-xl)', color: 'var(--color-danger)' }}>{reprocessPreview.ineligibleCount}</p>
                </div>
              </div>

              <Table
                headers={['Order #', 'Carrier / Phone', 'Amount', 'Failure Class', 'Error Details', 'Retry Eligibility']}
                data={reprocessPreview.eligibleItems.map((item) => [
                  <span key="ord" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                    {item.publicId || item.orderId.slice(0, 10)}
                  </span>,
                  <span key="ph" style={{ fontSize: 'var(--font-size-xs)' }}>{item.network} ({item.recipientPhone})</span>,
                  <span key="amt" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>GHS {(item.amountPesewas / 100).toFixed(2)}</span>,
                  <Badge key="fc" variant="warning">{item.failureClass}</Badge>,
                  <span key="err" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{item.errorMessage || item.errorCode}</span>,
                  <Badge key="el" variant={item.eligibleForRetry ? 'success' : 'danger'}>
                    {item.eligibleForRetry ? 'ELIGIBLE' : 'INELIGIBLE'}
                  </Badge>,
                ])}
                emptyMessage="No pending failed transactions requiring reprocessing."
              />
            </Card>
          )}
        </div>
      )}

      {/* --- TAB 6: REPORTS & EXPORT --- */}
      {activeTab === 'REPORTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card accentColor="green">
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: 'var(--font-size-base)', fontWeight: 700 }}>Financial Reports & Dataset Export</h3>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Export authoritative ledger vouchers, payment settlements, refund histories, and reconciliation cases in CSV or JSON.
            </p>
          </Card>

          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.25rem' }}>Report Dataset</label>
                <Select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  options={[
                    { value: 'REVENUE', label: 'Revenue & Payment Transactions' },
                    { value: 'LEDGER', label: 'Double-Entry General Ledger Lines' },
                    { value: 'REFUNDS', label: 'Refund & Reversal Records' },
                    { value: 'RECONCILIATION', label: 'Reconciliation Discrepancies' },
                  ]}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.25rem' }}>Export Format</label>
                <Select
                  value={reportFormat}
                  onChange={(e) => setReportFormat(e.target.value)}
                  options={[
                    { value: 'csv', label: 'CSV (Spreadsheet / Excel)' },
                    { value: 'json', label: 'JSON (Raw API Objects)' },
                  ]}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.25rem' }}>Start Date (Optional)</label>
                <SearchInput
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.25rem' }}>End Date (Optional)</label>
                <SearchInput
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" onClick={handleExportReport} disabled={exportLoading}>
                <Download size={14} style={{ marginRight: '0.35rem' }} />
                {exportLoading ? 'Generating Dataset...' : 'Generate & Download Report'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminPaymentsPage;
