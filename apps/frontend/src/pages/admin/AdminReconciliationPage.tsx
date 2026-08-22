import React, { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Select, Modal } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import {
  RefreshCw,
  CheckCircle,
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  Layers,
  ArrowRight,
  Database,
  CreditCard,
  Radio,
  FileSpreadsheet,
  Download,
  Eye,
  Check,
  ArrowUpCircle,
} from 'lucide-react';
import {
  adminApi,
  ReconciliationDashboardDto,
  ReconciliationCaseDto,
} from '../../api/admin.api.js';

export const AdminReconciliationPage: React.FC = () => {
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
      alert(res?.message || 'Paystack payment reconciliation completed.');
      fetchDashboard();
      fetchCases();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Audit failed.');
    } finally {
      setAuditRunning(null);
    }
  };

  // Trigger DataHouse Carrier Audit
  const handleTriggerDatahouse = async () => {
    setAuditRunning('DATAHOUSE');
    try {
      const res = await adminApi.triggerDatahouseReconciliation() as any;
      alert(res?.message || 'DataHouse carrier delivery reconciliation completed.');
      fetchDashboard();
      fetchCases();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Carrier audit failed.');
    } finally {
      setAuditRunning(null);
    }
  };

  // Trigger Ledger Audit
  const handleTriggerLedger = async () => {
    setAuditRunning('LEDGER');
    try {
      const res = await adminApi.triggerLedgerReconciliation() as any;
      alert(res?.message || 'General Ledger integrity audit completed.');
      fetchDashboard();
      fetchCases();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Ledger audit failed.');
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
      alert(`Case updated to ${newStatus}.`);
      setSelectedCase(null);
      setResolutionNotes('');
      fetchCases();
      fetchDashboard();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to update case status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Export Cases to CSV
  const handleExportCases = async () => {
    try {
      const blob = await adminApi.exportReconciliationCases({ status: statusFilter });
      const url = window.URL.createObjectURL(new Blob([blob as any]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reconciliation-cases-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to export reconciliation cases.');
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={RefreshCw} color="security" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-brand-bright)' }}>
              Automated Integrity & Audit
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
              Reconciliation Center & Case Management
            </h1>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Continuous cross-referencing across Paystack Gateway, DataHouse Telecom Logs, Internal Wallets, and General Ledger.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => { fetchDashboard(); fetchCases(); }}>
            <RefreshCw size={14} style={{ marginRight: '0.35rem' }} /> Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={handleTriggerPaystack} disabled={auditRunning !== null}>
            <CreditCard size={14} style={{ marginRight: '0.35rem' }} /> {auditRunning === 'PAYSTACK' ? 'Auditing...' : 'Audit Paystack'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleTriggerDatahouse} disabled={auditRunning !== null}>
            <Radio size={14} style={{ marginRight: '0.35rem' }} /> {auditRunning === 'DATAHOUSE' ? 'Auditing...' : 'Audit Carriers'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleTriggerLedger} disabled={auditRunning !== null}>
            <Database size={14} style={{ marginRight: '0.35rem' }} /> {auditRunning === 'LEDGER' ? 'Auditing...' : 'Audit Ledger'}
          </Button>
          <Button variant="primary" size="sm" onClick={handleExportCases}>
            <Download size={14} style={{ marginRight: '0.35rem' }} /> Export Cases (CSV)
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          label="Paystack Rails"
          value={`${dashboard?.paystackMetrics.matchRatePercent || 100}%`}
          helperText={`${dashboard?.paystackMetrics.recordsChecked || 0} checked | ${dashboard?.paystackMetrics.mismatched || 0} discrepancies`}
          accent={dashboard?.paystackMetrics.mismatched ? 'amber' : 'green'}
          icon={<TactileIcon icon={CreditCard} color="payments" size="sm" />}
        />
        <MetricCard
          label="DataHouse Carriers"
          value={`${dashboard?.datahouseMetrics.matchRatePercent || 100}%`}
          helperText={`${dashboard?.datahouseMetrics.recordsChecked || 0} orders synced with telecom gateways`}
          accent={dashboard?.datahouseMetrics.mismatched ? 'amber' : 'green'}
          icon={<TactileIcon icon={Radio} color="orders" size="sm" />}
        />
        <MetricCard
          label="Ledger Integrity"
          value={`${dashboard?.ledgerMetrics.integrityPercent || 100}%`}
          helperText={`${dashboard?.ledgerMetrics.balancedJournals || 0} balanced double-entry journals`}
          accent={dashboard?.ledgerMetrics.anomaliesCount ? 'red' : 'green'}
          icon={<TactileIcon icon={ShieldCheck} color="security" size="sm" />}
        />
        <MetricCard
          label="Active Cases"
          value={String(dashboard?.openCasesCount || 0)}
          helperText={`${dashboard?.criticalCasesCount || 0} critical cases requiring review`}
          accent={dashboard?.criticalCasesCount ? 'red' : 'blue'}
          icon={<TactileIcon icon={AlertTriangle} color={dashboard?.criticalCasesCount ? 'red' : 'api'} size="sm" />}
        />
      </div>

      {/* Filters Bar */}
      <Card accentColor="blue">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Search Cases</label>
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Case #, account name, reason, expected state..."
            />
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Case Status</label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'OPEN', label: 'OPEN' },
                { value: 'INVESTIGATING', label: 'INVESTIGATING' },
                { value: 'RESOLVED', label: 'RESOLVED' },
                { value: 'ESCALATED', label: 'ESCALATED' },
              ]}
            />
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Severity Level</label>
            <Select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Severities' },
                { value: 'CRITICAL', label: 'CRITICAL' },
                { value: 'HIGH', label: 'HIGH' },
                { value: 'MEDIUM', label: 'MEDIUM' },
                { value: 'LOW', label: 'LOW' },
              ]}
            />
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Audit Source</label>
            <Select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Sources' },
                { value: 'PAYSTACK', label: 'Paystack Gateway' },
                { value: 'DATAHOUSE', label: 'DataHouse Carrier' },
                { value: 'LEDGER', label: 'Double-Entry Ledger' },
                { value: 'WALLET', label: 'User Wallet' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Cases Table */}
      <Card>
        <Table
          headers={['Case #', 'Severity', 'Source', 'Account / Entity', 'Discrepancy (GHS)', 'Status', 'Detected Date', 'Action']}
          data={cases.map((c) => [
            <span key="num" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
              {c.caseNumber}
            </span>,
            <Badge key="sev" variant={c.severity === 'CRITICAL' || c.severity === 'HIGH' ? 'danger' : c.severity === 'MEDIUM' ? 'warning' : 'neutral'}>
              {c.severity}
            </Badge>,
            <Badge key="src" variant="primary">
              {c.source}
            </Badge>,
            <span key="acc" style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
              {c.accountName || c.accountId.slice(0, 14)}
            </span>,
            <span key="amt" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              GHS {(c.amountPesewas / 100).toFixed(2)}
            </span>,
            <Badge key="st" variant={c.status === 'RESOLVED' ? 'success' : c.status === 'ESCALATED' ? 'danger' : c.status === 'INVESTIGATING' ? 'warning' : 'neutral'}>
              {c.status}
            </Badge>,
            <span key="dt" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {new Date(c.createdAt).toLocaleString()}
            </span>,
            <Button key="act" variant="secondary" size="sm" onClick={() => { setSelectedCase(c); setResolutionNotes(c.resolutionNotes || ''); }}>
              <Eye size={12} style={{ marginRight: '0.25rem' }} /> Manage
            </Button>,
          ])}
          loading={casesLoading}
          emptyMessage="No active reconciliation discrepancy cases found."
        />

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalCases}
          onPageChange={(p) => setPage(p)}
        />
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', backgroundColor: 'var(--color-surface-sunken)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Severity</span>
                <p style={{ margin: 0 }}><Badge variant={selectedCase.severity === 'CRITICAL' ? 'danger' : 'warning'}>{selectedCase.severity}</Badge></p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Source</span>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{selectedCase.source}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Discrepancy</span>
                <p style={{ margin: 0, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>GHS {(selectedCase.amountPesewas / 100).toFixed(2)}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Status</span>
                <p style={{ margin: 0 }}><Badge variant={selectedCase.status === 'RESOLVED' ? 'success' : 'warning'}>{selectedCase.status}</Badge></p>
              </div>
            </div>

            {/* Expected vs Actual State */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-success)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-success)' }}>EXPECTED SYSTEM STATE</span>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: 'var(--font-size-xs)' }}>{selectedCase.expectedState}</p>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-danger)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-danger)' }}>ACTUAL OBSERVED STATE</span>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: 'var(--font-size-xs)' }}>{selectedCase.actualState}</p>
              </div>
            </div>

            {/* Discrepancy Details Payload */}
            {selectedCase.discrepancyDetails && Object.keys(selectedCase.discrepancyDetails).length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>Technical Discrepancy Payload</h4>
                <pre style={{ margin: 0, padding: '0.75rem', backgroundColor: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)', fontSize: '11px', fontFamily: 'var(--font-mono)', overflowX: 'auto' }}>
                  {JSON.stringify(selectedCase.discrepancyDetails, null, 2)}
                </pre>
              </div>
            )}

            {/* Resolution Form */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.35rem' }}>
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
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                }}
              />
            </div>

            {/* Lifecycle Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
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
