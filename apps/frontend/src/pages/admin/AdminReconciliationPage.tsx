import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Select } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import {
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Database,
  CreditCard,
  Radio,
  Download,
  Eye,
  Check,
  ArrowUpCircle,
  X,
  FileCheck2,
} from 'lucide-react';
import {
  adminApi,
  ReconciliationDashboardDto,
  ReconciliationCaseDto,
} from '../../api/admin.api.js';
import { useToast } from '../../context/ToastContext.js';
import { downloadFileFromResponse } from '../../utils/exportUtils.js';

export const AdminReconciliationPage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();
  const [dashboard, setDashboard] = useState<ReconciliationDashboardDto | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // --- Cases State ---
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cases, setCases] = useState<ReconciliationCaseDto[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCases, setTotalCases] = useState(0);
  const [casesLoading, setCasesLoading] = useState(false);

  // --- Case Detail / Resolution Modal ---
  const [selectedCase, setSelectedCase] = useState<ReconciliationCaseDto | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // --- Trigger Audits State ---
  const [auditRunning, setAuditRunning] = useState<string | null>(null);

  // 1. Fetch Dashboard Metrics
  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const res = await adminApi.getReconciliationDashboard();
      setDashboard(res);
    } catch {
      // Fallback
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  // 2. Fetch Cases List
  const fetchCases = useCallback(async () => {
    setCasesLoading(true);
    try {
      const res = await adminApi.getReconciliationCases({
        page,
        limit: 20,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        severity: severityFilter !== 'ALL' ? severityFilter : undefined,
        source: sourceFilter !== 'ALL' ? sourceFilter : undefined,
        search: searchQuery || undefined,
      });
      if (res && Array.isArray(res.items)) {
        setCases(res.items);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalCases(res.pagination?.total || res.items.length);
      }
    } catch {
      setCases([]);
    } finally {
      setCasesLoading(false);
    }
  }, [page, statusFilter, severityFilter, sourceFilter, searchQuery]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Trigger Paystack Audit
  const handleTriggerPaystack = async () => {
    setAuditRunning('PAYSTACK');
    try {
      const res = await adminApi.triggerPaystackReconciliation() as any;
      toastSuccess(res?.message || 'Paystack payment reconciliation completed successfully.');
      fetchDashboard();
      fetchCases();
    } catch (err: any) {
      toastError(err.response?.data?.message || err.message || 'Paystack audit failed.');
    } finally {
      setAuditRunning(null);
    }
  };

  // Trigger Carrier / Datahouse Audit
  const handleTriggerCarrierAudit = async () => {
    setAuditRunning('DATAHOUSE');
    try {
      const res = await adminApi.triggerCarrierReconciliation() as any;
      toastSuccess(res?.message || 'Carrier delivery reconciliation completed successfully.');
      fetchDashboard();
      fetchCases();
    } catch (err: any) {
      toastError(err.response?.data?.message || err.message || 'Carrier audit failed.');
    } finally {
      setAuditRunning(null);
    }
  };

  const handleTriggerDatahouse = handleTriggerCarrierAudit;

  // Trigger Ledger Audit
  const handleTriggerLedger = async () => {
    setAuditRunning('LEDGER');
    try {
      const res = await adminApi.triggerLedgerReconciliation() as any;
      toastSuccess(res?.message || 'General Ledger integrity audit completed successfully.');
      fetchDashboard();
      fetchCases();
    } catch (err: any) {
      toastError(err.response?.data?.message || err.message || 'Ledger audit failed.');
    } finally {
      setAuditRunning(null);
    }
  };

  // Update Case Status
  const handleUpdateCaseStatus = async (caseId: string, newStatus: 'INVESTIGATING' | 'RESOLVED' | 'ESCALATED') => {
    setActionLoading(true);
    try {
      await adminApi.updateReconciliationCaseStatus(caseId, {
        status: newStatus,
        resolutionNotes: resolutionNotes || `Status transitioned to ${newStatus} by admin`,
      });
      toastSuccess(`Case updated to ${newStatus}.`);
      setSelectedCase(null);
      setResolutionNotes('');
      fetchCases();
      fetchDashboard();
    } catch (err: any) {
      toastError(err.response?.data?.message || err.message || 'Failed to update case status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Export Cases to CSV
  const handleExportCases = async () => {
    try {
      const blob = await adminApi.exportReconciliationCases({ status: statusFilter !== 'ALL' ? statusFilter : undefined });
      downloadFileFromResponse(blob, `reconciliation-cases-${Date.now()}.csv`, 'csv');
      toastSuccess('Reconciliation cases exported successfully.');
    } catch {
      toastError('Failed to export reconciliation cases.');
    }
  };

  // Active Filter Chips
  const activeFilters = useMemo(() => {
    const list: Array<{ id: string; label: string; onRemove: () => void }> = [];

    if (statusFilter !== 'ALL') {
      list.push({
        id: 'status',
        label: `Status: ${statusFilter}`,
        onRemove: () => { setStatusFilter('ALL'); setPage(1); },
      });
    }

    if (severityFilter !== 'ALL') {
      list.push({
        id: 'severity',
        label: `Severity: ${severityFilter}`,
        onRemove: () => { setSeverityFilter('ALL'); setPage(1); },
      });
    }

    if (sourceFilter !== 'ALL') {
      const sourceLabels: Record<string, string> = {
        PAYSTACK: 'Source: Paystack Gateway',
        CARRIER: 'Source: Telecom Carrier',
        LEDGER: 'Source: Double-Entry Ledger',
        WALLET: 'Source: User Wallet',
      };
      list.push({
        id: 'source',
        label: sourceLabels[sourceFilter] || `Source: ${sourceFilter}`,
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
  }, [statusFilter, severityFilter, sourceFilter, searchQuery]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setSeverityFilter('ALL');
    setSourceFilter('ALL');
    setPage(1);
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return <Badge variant="success" size="sm" dot>Resolved</Badge>;
      case 'INVESTIGATING':
        return <Badge variant="warning" size="sm" dot>Investigating</Badge>;
      case 'ESCALATED':
        return <Badge variant="danger" size="sm" dot>Escalated</Badge>;
      case 'OPEN':
      default:
        return <Badge variant="neutral" size="sm" dot>Open</Badge>;
    }
  };

  const renderSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <Badge variant="danger" size="sm">CRITICAL</Badge>;
      case 'HIGH':
        return <Badge variant="danger" size="sm">HIGH</Badge>;
      case 'MEDIUM':
        return <Badge variant="warning" size="sm">MEDIUM</Badge>;
      case 'LOW':
      default:
        return <Badge variant="neutral" size="sm">LOW</Badge>;
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header Toolbar with Standardized Tactile Action Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={RefreshCw} color="security" size="lg" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-brand-primary)' }}>
                Automated Integrity & Audit
              </span>
              <Badge variant="brand" size="sm">Phase 11.5</Badge>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>•</span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Continuous Reconciliation
              </span>
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
              Reconciliation Center & Case Management
            </h1>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              Continuous cross-referencing across Paystack Gateway, Telecom Carrier Logs, Internal Wallets, and General Ledger.
            </p>
          </div>
        </div>

        {/* Standardized Tactile Action Buttons */}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { fetchDashboard(); fetchCases(); }}
            disabled={dashboardLoading || casesLoading}
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
              cursor: (dashboardLoading || casesLoading) ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <RefreshCw size={14} className={dashboardLoading || casesLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleTriggerPaystack}
            disabled={auditRunning !== null}
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
              cursor: auditRunning !== null ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <CreditCard size={14} className={auditRunning === 'PAYSTACK' ? 'animate-spin' : ''} />
            <span>{auditRunning === 'PAYSTACK' ? 'Auditing Paystack...' : 'Audit Paystack'}</span>
          </button>

          <button
            type="button"
            onClick={handleTriggerDatahouse}
            disabled={auditRunning !== null}
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
              cursor: auditRunning !== null ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Radio size={14} className={auditRunning === 'DATAHOUSE' ? 'animate-spin' : ''} />
            <span>{auditRunning === 'DATAHOUSE' ? 'Auditing Carriers...' : 'Audit Carriers'}</span>
          </button>

          <button
            type="button"
            onClick={handleTriggerLedger}
            disabled={auditRunning !== null}
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
              cursor: auditRunning !== null ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Database size={14} className={auditRunning === 'LEDGER' ? 'animate-spin' : ''} />
            <span>{auditRunning === 'LEDGER' ? 'Auditing Ledger...' : 'Audit Ledger'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCases}
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
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Download size={14} />
            <span>Export Cases (CSV)</span>
          </button>
        </div>
      </div>

      {/* 2. Sleek, Standardized KPI Metric Cards (Uniform clean surfaces without bright background tints) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          title="Paystack Rails"
          value={`${dashboard?.paystackMetrics.matchRatePercent || 100}%`}
          subvalue={`${dashboard?.paystackMetrics.recordsChecked || 0} checked | ${dashboard?.paystackMetrics.mismatched || 0} discrepancies`}
          icon={<TactileIcon icon={CreditCard} color="payments" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title="Telecom Carriers"
          value={`${dashboard?.datahouseMetrics.matchRatePercent || 100}%`}
          subvalue={`${dashboard?.datahouseMetrics.recordsChecked || 0} orders synced with gateways`}
          icon={<TactileIcon icon={Radio} color="orders" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title="Ledger Integrity"
          value={`${dashboard?.ledgerMetrics.integrityPercent || 100}%`}
          subvalue={`${dashboard?.ledgerMetrics.balancedJournals || 0} balanced double-entry journals`}
          icon={<TactileIcon icon={ShieldCheck} color="security" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title="Active Cases"
          value={String(dashboard?.openCasesCount || 0)}
          subvalue={`${dashboard?.criticalCasesCount || 0} critical cases requiring review`}
          icon={<TactileIcon icon={AlertTriangle} color={dashboard?.criticalCasesCount ? 'red' : 'analytics'} size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
      </div>

      {/* 3. Compact, Standard Horizontal Advanced Filter Suite (No loud colors) */}
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
          {/* Search Input */}
          <div style={{ flex: '1 1 280px', minWidth: '240px' }}>
            <SearchInput
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search Case #, account name, reason, expected state..."
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
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'OPEN', label: 'OPEN' },
                  { value: 'INVESTIGATING', label: 'INVESTIGATING' },
                  { value: 'RESOLVED', label: 'RESOLVED' },
                  { value: 'ESCALATED', label: 'ESCALATED' },
                ]}
              />
            </div>

            {/* Severity */}
            <div style={{ width: '150px' }}>
              <Select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'All Severities' },
                  { value: 'CRITICAL', label: 'CRITICAL' },
                  { value: 'HIGH', label: 'HIGH' },
                  { value: 'MEDIUM', label: 'MEDIUM' },
                  { value: 'LOW', label: 'LOW' },
                ]}
              />
            </div>

            {/* Source */}
            <div style={{ width: '175px' }}>
              <Select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'All Sources' },
                  { value: 'PAYSTACK', label: 'Paystack Gateway' },
                  { value: 'CARRIER', label: 'Telecom Carrier' },
                  { value: 'LEDGER', label: 'Double-Entry Ledger' },
                  { value: 'WALLET', label: 'User Wallet' },
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

      {/* 4. Cases Table with Standard Card Styling & Breathing Room */}
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
        <Table
          minWidth="1200px"
          headers={['Case #', 'Severity', 'Source', 'Account / Entity', 'Discrepancy (GHS)', 'Status', 'Detected Date', 'Actions']}
        >
          {casesLoading ? (
            <tr>
              <td colSpan={8} style={{ padding: 'var(--space-10) var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Loading reconciliation discrepancy cases...</p>
              </td>
            </tr>
          ) : cases.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: 'var(--space-10) var(--space-4)', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-bg-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-success)',
                    }}
                  >
                    <FileCheck2 size={24} />
                  </div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                    No Discrepancy Cases Found
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', maxWidth: '420px' }}>
                    All transactions, gateway logs, and ledger double-entries match expected state criteria.
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            cases.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', transition: 'background-color var(--transition-fast)' }}>
                {/* Case # */}
                <td style={{ padding: '0.85rem 1rem' }}>
                  <button
                    type="button"
                    onClick={() => { setSelectedCase(c); setResolutionNotes(c.resolutionNotes || ''); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-brand-primary, #0284C7)',
                      cursor: 'pointer',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      padding: 0,
                      textAlign: 'left',
                    }}
                  >
                    {c.caseNumber}
                  </button>
                </td>

                {/* Severity */}
                <td style={{ padding: '0.85rem 1rem' }}>
                  {renderSeverityBadge(c.severity)}
                </td>

                {/* Source */}
                <td style={{ padding: '0.85rem 1rem' }}>
                  <Badge variant="brand" size="sm">
                    {c.source}
                  </Badge>
                </td>

                {/* Account / Entity */}
                <td style={{ padding: '0.85rem 1rem' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                    {c.accountName || (c.accountId ? `${c.accountId.slice(0, 14)}...` : 'System Entity')}
                  </span>
                </td>

                {/* Discrepancy (GHS) */}
                <td style={{ padding: '0.85rem 1rem' }}>
                  <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: c.amountPesewas > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                    GH₵ {(c.amountPesewas / 100).toFixed(2)}
                  </span>
                </td>

                {/* Status */}
                <td style={{ padding: '0.85rem 1rem' }}>
                  {renderStatusBadge(c.status)}
                </td>

                {/* Detected Date */}
                <td style={{ padding: '0.85rem 1rem' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {new Date(c.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </td>

                {/* Actions */}
                <td style={{ padding: '0.85rem 1rem' }}>
                  <button
                    type="button"
                    onClick={() => { setSelectedCase(c); setResolutionNotes(c.resolutionNotes || ''); }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border-subtle)',
                      boxShadow: 'var(--shadow-tactile-sm)',
                      color: 'var(--color-text-primary)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <Eye size={12} />
                    <span>Manage</span>
                  </button>
                </td>
              </tr>
            ))
          )}
        </Table>

        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalCases}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </Card>

      {/* --- CASE DETAIL & RESOLUTION MODAL --- */}
      {selectedCase && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCase(null)}
          title={`Reconciliation Case Dossier: ${selectedCase.caseNumber}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '75vh', overflowY: 'auto' }}>
            {/* Header summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Severity</span>
                <div style={{ marginTop: '0.2rem' }}>{renderSeverityBadge(selectedCase.severity)}</div>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Source</span>
                <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{selectedCase.source}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Discrepancy</span>
                <p style={{ margin: '0.2rem 0 0 0', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-danger)' }}>GH₵ {(selectedCase.amountPesewas / 100).toFixed(2)}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Status</span>
                <div style={{ marginTop: '0.2rem' }}>{renderStatusBadge(selectedCase.status)}</div>
              </div>
            </div>

            {/* Expected vs Actual State */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.06)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-success)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-success)' }}>EXPECTED SYSTEM STATE</span>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: 'var(--font-size-xs)' }}>{selectedCase.expectedState}</p>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.06)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-danger)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-danger)' }}>ACTUAL OBSERVED STATE</span>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: 'var(--font-size-xs)' }}>{selectedCase.actualState}</p>
              </div>
            </div>

            {/* Discrepancy Details Payload */}
            {selectedCase.discrepancyDetails && Object.keys(selectedCase.discrepancyDetails).length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>Technical Discrepancy Payload</h4>
                <pre style={{ margin: 0, padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', fontSize: '11px', fontFamily: 'var(--font-mono)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
                  {JSON.stringify(selectedCase.discrepancyDetails, null, 2)}
                </pre>
              </div>
            )}

            {/* Resolution Form */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--color-text-primary)' }}>
                Resolution / Investigation Notes (Audited)
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Document cause of discrepancy and corrective actions taken..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Lifecycle Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border-subtle)' }}>
              <Button type="button" variant="secondary" onClick={() => setSelectedCase(null)}>
                Close
              </Button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {selectedCase.status !== 'INVESTIGATING' && selectedCase.status !== 'RESOLVED' && (
                  <Button
                    variant="secondary"
                    disabled={actionLoading}
                    onClick={() => handleUpdateCaseStatus(selectedCase.id, 'INVESTIGATING')}
                  >
                    Mark Investigating
                  </Button>
                )}

                {selectedCase.status !== 'ESCALATED' && (
                  <Button
                    variant="danger"
                    disabled={actionLoading}
                    onClick={() => handleUpdateCaseStatus(selectedCase.id, 'ESCALATED')}
                  >
                    <ArrowUpCircle size={14} style={{ marginRight: '0.35rem' }} /> Escalate to Super Admin
                  </Button>
                )}

                {selectedCase.status !== 'RESOLVED' && (
                  <Button
                    variant="primary"
                    disabled={actionLoading}
                    onClick={() => handleUpdateCaseStatus(selectedCase.id, 'RESOLVED')}
                  >
                    <Check size={14} style={{ marginRight: '0.35rem' }} /> Resolve Case
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminReconciliationPage;
