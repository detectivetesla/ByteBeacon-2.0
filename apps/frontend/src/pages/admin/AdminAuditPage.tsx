import React, { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Select, Modal } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  FileText,
  RefreshCw,
  Eye,
  AlertTriangle,
  Download,
  Activity,
  CheckCircle,
  XCircle,
  Database,
  Plus,
  Flame,
} from 'lucide-react';
import {
  adminApi,
  AdminAuditOverviewStatsDto,
  AdminAuditListItemDto,
  AdminAuditDetailDto,
  AdminSecurityIncidentDto,
  AdminAuditIntegrityVerificationDto,
  AuditSeverity,
  AuditCategory,
  AuditResult,
  SecurityIncidentStatus,
  SecurityHealthStatus,
} from '../../api/admin.api.js';

type ActiveTab = 'stream' | 'incidents' | 'integrity' | 'classification' | 'emergency' | 'export';

export const AdminAuditPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('stream');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Overview stats
  const [stats, setStats] = useState<AdminAuditOverviewStatsDto>({
    totalEvents: 0,
    criticalEventsCount: 0,
    highSeverityCount: 0,
    warningCount: 0,
    failedLogins24h: 0,
    rateLimitViolations24h: 0,
    securityIncidentsCount: 0,
    overallSecurityHealth: SecurityHealthStatus.HEALTHY,
    tamperEvidenceStatus: 'VERIFIED',
    lastChainedHash: '0000000000000000000000000000000000000000000000000000000000000000',
    verifiedBlocksCount: 0,
  });

  // Audit Stream State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [resultFilter, setResultFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [auditLogs, setAuditLogs] = useState<AdminAuditListItemDto[]>([]);

  // Selected Log Detail Modal
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [selectedLogDetail, setSelectedLogDetail] = useState<AdminAuditDetailDto | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Incidents State
  const [incidents, setIncidents] = useState<AdminSecurityIncidentDto[]>([]);
  const [incidentStatusFilter, setIncidentStatusFilter] = useState('ALL');
  const [isCreateIncidentOpen, setIsCreateIncidentOpen] = useState(false);
  const [selectedIncidentForUpdate, setSelectedIncidentForUpdate] = useState<AdminSecurityIncidentDto | null>(null);
  const [newIncidentTitle, setNewIncidentTitle] = useState('');
  const [newIncidentSeverity, setNewIncidentSeverity] = useState<AuditSeverity>(AuditSeverity.HIGH);
  const [newIncidentNotes, setNewIncidentNotes] = useState('');
  const [updateIncidentStatus, setUpdateIncidentStatus] = useState<SecurityIncidentStatus>(SecurityIncidentStatus.INVESTIGATING);
  const [updateIncidentNote, setUpdateIncidentNote] = useState('');
  const [updateIncidentResolution, setUpdateIncidentResolution] = useState('');

  // Integrity Check State
  const [integrityResult, setIntegrityResult] = useState<AdminAuditIntegrityVerificationDto | null>(null);

  // Export State
  const [exportFormat, setExportFormat] = useState<'CSV' | 'JSON'>('CSV');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Emergency Controls State
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [emergencyControlsList, setEmergencyControlsList] = useState<Array<{
    key: string;
    name: string;
    desc: string;
    status: boolean;
    lastToggledBy?: string | null;
    lastToggledAt?: string | null;
    lastJustification?: string | null;
  }>>([
    {
      key: 'MAINTENANCE_MODE',
      name: 'Platform Maintenance Mode',
      desc: 'Restricts all customer and agent portal access; renders platform maintenance splash.',
      status: false,
    },
    {
      key: 'DISABLE_AGENT_STORES',
      name: 'Kill Switch: Agent Storefronts',
      desc: 'Immediately pauses checkout processing on all agent public storefront subdomains.',
      status: false,
    },
    {
      key: 'KILL_SWITCH_PAYSTACK',
      name: 'Kill Switch: Paystack Live Processing',
      desc: 'Halts incoming MoMo/Card deposits; forces fallback to manual bank reconciliation.',
      status: false,
    },
    {
      key: 'KILL_SWITCH_TELECOM_DISPATCH',
      name: 'Kill Switch: Automated Telecom Dispatch',
      desc: 'Holds new data bundle orders in pending queue rather than submitting upstream to DataHouse.',
      status: false,
    },
    {
      key: 'EMERGENCY_READ_ONLY',
      name: 'Emergency Platform Read-Only Mode',
      desc: 'Disables all database write operations across financial, catalog, and order engines.',
      status: false,
    },
  ]);
  const [selectedEmergencyKey, setSelectedEmergencyKey] = useState<string>('');
  const [selectedEmergencyName, setSelectedEmergencyName] = useState<string>('');
  const [emergencyTargetState, setEmergencyTargetState] = useState<boolean>(false);
  const [emergencyReason, setEmergencyReason] = useState<string>('');
  const [emergencyStepUpInput, setEmergencyStepUpInput] = useState<string>('');
  const [emergencyError, setEmergencyError] = useState<string | null>(null);
  const [emergencySuccessMsg, setEmergencySuccessMsg] = useState<string | null>(null);

  // Fetch Emergency Controls
  const fetchEmergencyControls = useCallback(async () => {
    try {
      const controls = await adminApi.getEmergencyControls();
      if (Array.isArray(controls) && controls.length > 0) {
        setEmergencyControlsList(controls);
      }
    } catch {
      // Keep resilient defaults
    }
  }, []);

  // Fetch Overview Stats
  const fetchOverview = useCallback(async () => {
    try {
      const res = await adminApi.getAuditOverview();
      if (res) {
        setStats(res);
      }
      await fetchEmergencyControls();
    } catch {
      // Fallback to local default stats if network error
    }
  }, [fetchEmergencyControls]);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getAuditEvents({
        page,
        limit: 25,
        search: searchQuery,
        category: categoryFilter,
        severity: severityFilter,
        result: resultFilter,
        actorRole: roleFilter,
      });
      if (res && Array.isArray(res.items)) {
        setAuditLogs(res.items);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalLogs(res.pagination?.total || res.items.length);
      } else {
        setAuditLogs([]);
        setTotalPages(1);
        setTotalLogs(0);
      }
    } catch {
      setAuditLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, categoryFilter, severityFilter, resultFilter, roleFilter]);

  // Fetch Incidents
  const fetchIncidents = useCallback(async () => {
    try {
      const res = await adminApi.getSecurityIncidents({
        status: incidentStatusFilter !== 'ALL' ? incidentStatusFilter : undefined,
      });
      if (Array.isArray(res)) {
        setIncidents(res);
      }
    } catch {
      setIncidents([]);
    }
  }, [incidentStatusFilter]);

  useEffect(() => {
    fetchOverview();
    fetchEmergencyControls();
  }, [fetchOverview, fetchEmergencyControls]);

  useEffect(() => {
    if (activeTab === 'stream') {
      fetchAuditLogs();
    } else if (activeTab === 'incidents') {
      fetchIncidents();
    }
  }, [activeTab, fetchAuditLogs, fetchIncidents]);

  // Open Log Investigation Detail
  const handleInspectLog = async (log: AdminAuditListItemDto) => {
    setSelectedLogId(log.id);
    setIsLoadingDetail(true);
    try {
      const detail = await adminApi.getAuditEventDetail(log.id);
      setSelectedLogDetail(detail || { ...log, metadata: {} });
    } catch {
      setSelectedLogDetail({ ...log, metadata: {} });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Run Integrity Check
  const handleRunIntegrityCheck = async () => {
    setIsVerifying(true);
    try {
      const res = await adminApi.verifyAuditIntegrity();
      setIntegrityResult(res);
      await fetchOverview();
    } catch (e: any) {
      alert(e?.message || 'Failed to verify audit integrity');
    } finally {
      setIsVerifying(false);
    }
  };

  // Create Incident
  const handleCreateIncident = async () => {
    if (!newIncidentTitle.trim()) {
      alert('Please provide an incident title');
      return;
    }
    try {
      await adminApi.createSecurityIncident({
        title: newIncidentTitle,
        severity: newIncidentSeverity,
        investigationNotes: newIncidentNotes,
        triggeringEventId: selectedLogId || undefined,
      });
      setIsCreateIncidentOpen(false);
      setNewIncidentTitle('');
      setNewIncidentNotes('');
      fetchIncidents();
      fetchOverview();
    } catch (e: any) {
      alert(e?.message || 'Failed to register incident');
    }
  };

  // Update Incident
  const handleUpdateIncident = async () => {
    if (!selectedIncidentForUpdate) return;
    try {
      await adminApi.updateSecurityIncident(selectedIncidentForUpdate.id, {
        status: updateIncidentStatus,
        timelineNote: updateIncidentNote,
        resolution: updateIncidentResolution,
      });
      setSelectedIncidentForUpdate(null);
      setUpdateIncidentNote('');
      setUpdateIncidentResolution('');
      fetchIncidents();
      fetchOverview();
    } catch (e: any) {
      alert(e?.message || 'Failed to update incident');
    }
  };

  // Execute Export
  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccessMsg(null);
    try {
      const res: any = await adminApi.exportAuditLogs({
        format: exportFormat,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        severity: severityFilter !== 'ALL' ? severityFilter : undefined,
        actorRole: roleFilter !== 'ALL' ? roleFilter : undefined,
        search: searchQuery || undefined,
      });

      if (exportFormat === 'CSV' && typeof res === 'string') {
        const blob = new Blob([res], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `bytebeacon-audit-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setExportSuccessMsg(`Successfully exported audit records in ${exportFormat} format. Export operation has been recorded in the immutable audit stream.`);
      fetchOverview();
    } catch (e: any) {
      alert(e?.message || 'Failed to export audit logs');
    } finally {
      setIsExporting(false);
    }
  };

  // Open Emergency Modal
  const openEmergencyModal = (key: string, name: string, currentState: boolean) => {
    setSelectedEmergencyKey(key);
    setSelectedEmergencyName(name);
    setEmergencyTargetState(!currentState);
    setEmergencyReason('');
    setEmergencyStepUpInput('');
    setEmergencyError(null);
    setIsEmergencyModalOpen(true);
  };

  // Submit Emergency Toggle
  const handleEmergencySubmit = async () => {
    if (!emergencyReason.trim()) {
      setEmergencyError('An explicit administrative justification is mandatory.');
      return;
    }
    if (emergencyStepUpInput.trim() !== 'CONFIRM_EMERGENCY_ACTION') {
      setEmergencyError('Please type "CONFIRM_EMERGENCY_ACTION" exactly to confirm.');
      return;
    }

    try {
      await adminApi.toggleEmergencyControl({
        controlKey: selectedEmergencyKey as any,
        enabled: emergencyTargetState,
        reason: emergencyReason.trim(),
        stepUpConfirmation: emergencyStepUpInput.trim(),
      });
      setIsEmergencyModalOpen(false);
      setEmergencySuccessMsg(`Emergency control "${selectedEmergencyName}" ${emergencyTargetState ? 'ACTIVATED' : 'DEACTIVATED'} successfully.`);
      fetchOverview();
    } catch (e: any) {
      setEmergencyError(e?.message || 'Failed to toggle emergency control');
    }
  };

  const getSeverityBadgeVariant = (sev: string): 'default' | 'neutral' | 'success' | 'warning' | 'danger' | 'info' => {
    switch (sev) {
      case AuditSeverity.CRITICAL:
        return 'danger';
      case AuditSeverity.HIGH:
        return 'warning';
      case AuditSeverity.WARNING:
        return 'neutral';
      case AuditSeverity.INFO:
      default:
        return 'info';
    }
  };

  const getResultBadgeVariant = (res: string): 'default' | 'neutral' | 'success' | 'warning' | 'danger' | 'info' => {
    switch (res) {
      case AuditResult.SUCCESS:
        return 'success';
      case AuditResult.FAILURE:
        return 'danger';
      case AuditResult.DENIED:
        return 'warning';
      case AuditResult.CHALLENGED:
        return 'neutral';
      default:
        return 'default';
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Shield} color="api" size="lg" />
      <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-api-bright)' }}>
                Security & Compliance Control Plane
              </span>
              <Badge variant={stats.tamperEvidenceStatus === 'VERIFIED' ? 'success' : 'danger'} size="sm">
                {stats.tamperEvidenceStatus === 'VERIFIED' ? 'Tamper-Evident Chained' : 'Verification Required'}
              </Badge>
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Audit & Security Operations
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Central authoritative evidence system recording every privileged, financial, telecom, and worker operation across ByteBeacon 2.0. Total: {stats.totalEvents.toLocaleString()} records.
            </p>
          </div>
        </div>

        {/* Verification Status & Manual Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOverview}
            disabled={isVerifying}
          >
            <RefreshCw size={14} className={isVerifying ? 'animate-spin' : ''} style={{ marginRight: '0.35rem' }} />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateIncidentOpen(true)}
          >
            <Plus size={14} style={{ marginRight: '0.35rem' }} />
            Open Incident
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              fetchOverview();
              if (activeTab === 'stream') fetchAuditLogs();
              if (activeTab === 'incidents') fetchIncidents();
            }}
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {emergencySuccessMsg && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', color: '#4ade80', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{emergencySuccessMsg}</span>
          <button onClick={() => setEmergencySuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard
          title="Total Audit Events"
          value={stats.totalEvents.toLocaleString()}
          subvalue="Append-only cryptographic log"
          accent="purple"
          icon={<TactileIcon icon={FileText} color="api" size="sm" />}
        />
        <MetricCard
          title="Critical & High Incidents"
          value={stats.criticalEventsCount > 0 ? `${stats.criticalEventsCount} Critical` : `${stats.highSeverityCount} High`}
          subvalue={`${stats.securityIncidentsCount} active security incidents`}
          accent={stats.criticalEventsCount > 0 ? 'red' : 'orange'}
          icon={<TactileIcon icon={ShieldAlert} color={stats.criticalEventsCount > 0 ? 'red' : 'amber'} size="sm" />}
        />
        <MetricCard
          title="Warnings & Suspicious Activity"
          value={stats.warningCount.toString()}
          subvalue={`${stats.failedLogins24h} failed logins, ${stats.rateLimitViolations24h} throttles (24h)`}
          accent="amber"
          icon={<TactileIcon icon={AlertTriangle} color="speed" size="sm" />}
        />
        <MetricCard
          title="Security Health"
          value={stats.overallSecurityHealth}
          subvalue={`Chain SHA-256: ${stats.lastChainedHash.slice(0, 10)}...`}
          accent={stats.overallSecurityHealth === SecurityHealthStatus.HEALTHY ? 'green' : 'red'}
          icon={<TactileIcon icon={ShieldCheck} color="security" size="sm" />}
        />
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
        {[
          { key: 'stream', label: 'Live Audit Stream', icon: Activity, count: totalLogs },
          { key: 'incidents', label: 'Security Health & Incidents', icon: ShieldAlert, count: stats.securityIncidentsCount },
          { key: 'integrity', label: 'Audit Integrity & Chaining', icon: ShieldCheck },
          { key: 'classification', label: 'Event Classification Taxonomy', icon: Database },
          { key: 'emergency', label: 'Emergency Switchboard', icon: Flame },
          { key: 'export', label: 'Export & Compliance', icon: Download },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as ActiveTab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? 'var(--color-surface-hover)' : 'transparent',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                fontWeight: isActive ? 600 : 500,
                fontSize: 'var(--font-size-sm)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={16} style={{ color: isActive ? 'var(--color-api-bright)' : 'inherit' }} />
              {tab.label}
              {tab.count !== undefined && (
                <span
                  style={{
                    padding: '0.125rem 0.375rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    background: isActive ? 'var(--color-primary-subtle)' : 'var(--color-surface-muted)',
                    color: isActive ? 'var(--color-primary-bright)' : 'inherit',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Live Audit Stream */}
      {activeTab === 'stream' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Filters Card */}
          <Card accentColor="blue">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <SearchInput
                  placeholder="Search by Action, Actor, IP, Correlation ID, Resource..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <Select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Categories', value: 'ALL' },
                  { label: 'Authentication', value: AuditCategory.AUTH },
                  { label: 'Authorization', value: AuditCategory.AUTHORIZATION },
                  { label: 'API Security', value: AuditCategory.API_SECURITY },
                  { label: 'Financial Security', value: AuditCategory.FINANCIAL_SECURITY },
                  { label: 'Telecom Security', value: AuditCategory.TELECOM_SECURITY },
                  { label: 'System Worker', value: AuditCategory.SYSTEM_WORKER },
                  { label: 'Admin Action', value: AuditCategory.ADMIN_ACTION },
                ]}
              />

              <Select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Severities', value: 'ALL' },
                  { label: 'Critical', value: AuditSeverity.CRITICAL },
                  { label: 'High', value: AuditSeverity.HIGH },
                  { label: 'Warning', value: AuditSeverity.WARNING },
                  { label: 'Info', value: AuditSeverity.INFO },
                ]}
              />

              <Select
                value={resultFilter}
                onChange={(e) => {
                  setResultFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Results', value: 'ALL' },
                  { label: 'Success', value: AuditResult.SUCCESS },
                  { label: 'Failure', value: AuditResult.FAILURE },
                  { label: 'Denied', value: AuditResult.DENIED },
                  { label: 'Challenged', value: AuditResult.CHALLENGED },
                ]}
              />

              <Select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Roles', value: 'ALL' },
                  { label: 'Super Admin', value: 'SUPER_ADMIN' },
                  { label: 'Admin', value: 'ADMIN' },
                  { label: 'Agent', value: 'AGENT' },
                  { label: 'Customer', value: 'CUSTOMER' },
                  { label: 'System / Worker', value: 'SYSTEM' },
                  { label: 'External Provider', value: 'PROVIDER' },
                ]}
              />
            </div>
          </Card>

          {/* Audit Table Card */}
          <Card accentColor="purple">
            <Table
              columns={[
                {
                  header: 'Timestamp',
                  render: (row: AdminAuditListItemDto) => (
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                        {new Date(row.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  ),
                },
                {
                  header: 'Actor & Role',
                  render: (row: AdminAuditListItemDto) => (
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {row.actorName}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ textTransform: 'capitalize' }}>{row.actorRole}</span>
                        {row.ipAddress && <span>• {row.ipAddress}</span>}
                      </div>
                    </div>
                  ),
                },
                {
                  header: 'Action & Category',
                  render: (row: AdminAuditListItemDto) => (
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-primary-bright)' }}>
                        {row.action}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                        {row.category}
                      </div>
                    </div>
                  ),
                },
                {
                  header: 'Resource',
                  render: (row: AdminAuditListItemDto) => (
                    <div style={{ fontSize: '0.8125rem' }}>
                      <span style={{ fontWeight: 500 }}>{row.resourceType}</span>
                      {row.resourceId && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                          {row.resourceId.slice(0, 16)}...
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Result',
                  render: (row: AdminAuditListItemDto) => (
                    <Badge variant={getResultBadgeVariant(row.result)} size="sm">
                      {row.result}
                    </Badge>
                  ),
                },
                {
                  header: 'Severity',
                  render: (row: AdminAuditListItemDto) => (
                    <Badge variant={getSeverityBadgeVariant(row.severity)} size="sm">
                      {row.severity}
                    </Badge>
                  ),
                },
                {
                  header: 'Event Hash',
                  render: (row: AdminAuditListItemDto) => (
                    <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-text-muted)' }} title={row.eventHash}>
                      {row.eventHash.slice(0, 8)}...
                    </div>
                  ),
                },
                {
                  header: 'Inspect',
                  render: (row: AdminAuditListItemDto) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleInspectLog(row)}
                      title="Inspect Activity Dossier"
                    >
                      <Eye size={14} style={{ color: 'var(--color-api-bright)' }} />
                    </Button>
                  ),
                },
              ]}
              data={auditLogs}
              keyExtractor={(row) => row.id}
              emptyMessage="No audit events matched your search or filters."
            />

            {totalPages > 1 && (
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: Security Health & Incidents */}
      {activeTab === 'incidents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card accentColor="red">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                  Security Incident Tracker
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
                  Traceable incident response workflow: Open → Investigating → Contained → Resolved.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Select
                  value={incidentStatusFilter}
                  onChange={(e) => setIncidentStatusFilter(e.target.value)}
                  options={[
                    { label: 'All Incident States', value: 'ALL' },
                    { label: 'Open', value: SecurityIncidentStatus.OPEN },
                    { label: 'Investigating', value: SecurityIncidentStatus.INVESTIGATING },
                    { label: 'Contained', value: SecurityIncidentStatus.CONTAINED },
                    { label: 'Resolved', value: SecurityIncidentStatus.RESOLVED },
                    { label: 'False Positive', value: SecurityIncidentStatus.FALSE_POSITIVE },
                  ]}
                />
                <Button variant="primary" size="sm" onClick={() => setIsCreateIncidentOpen(true)}>
                  <Plus size={14} style={{ marginRight: '0.25rem' }} />
                  New Incident
                </Button>
              </div>
            </div>

            {incidents.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <ShieldCheck size={48} style={{ color: 'var(--color-green-400)', margin: '0 auto 1rem auto' }} />
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Zero Open Security Incidents
                </div>
                <div style={{ fontSize: '0.875rem' }}>
                  All systems operating normally without unresolved security alerts or breaches.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    style={{
                      padding: '1.25rem',
                      borderRadius: '8px',
                      background: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-primary-bright)' }}>
                            {inc.incidentNumber}
                          </span>
                          <Badge variant={getSeverityBadgeVariant(inc.severity)} size="sm">
                            {inc.severity}
                          </Badge>
                          <Badge
                            variant={
                              inc.status === SecurityIncidentStatus.OPEN
                                ? 'danger'
                                : inc.status === SecurityIncidentStatus.INVESTIGATING
                                ? 'warning'
                                : inc.status === SecurityIncidentStatus.CONTAINED
                                ? 'neutral'
                                : 'success'
                            }
                            size="sm"
                          >
                            {inc.status}
                          </Badge>
                        </div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0.35rem 0 0 0', color: 'var(--color-text-primary)' }}>
                          {inc.title}
                        </h4>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedIncidentForUpdate(inc);
                          setUpdateIncidentStatus(inc.status);
                          setUpdateIncidentResolution(inc.resolution || '');
                        }}
                      >
                        Manage Incident
                      </Button>
                    </div>

                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                      {inc.investigationNotes || 'No initial investigation notes recorded.'}
                    </p>

                    {/* Timeline & Metadata */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.5rem' }}>
                      <div>Assigned: <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{inc.assignedAdminName}</span></div>
                      {inc.affectedUserEmail && <div>Affected User: <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{inc.affectedUserEmail}</span></div>}
                      <div>Opened: <span style={{ color: 'var(--color-text-primary)' }}>{new Date(inc.createdAt).toLocaleString()}</span></div>
                      {inc.resolvedAt && <div>Resolved: <span style={{ color: '#4ade80' }}>{new Date(inc.resolvedAt).toLocaleString()}</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: Audit Integrity & Chaining */}
      {activeTab === 'integrity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card accentColor="green">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <TactileIcon icon={ShieldCheck} color="security" size="md" />
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                  Cryptographic Audit Tamper-Evidence Architecture
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
                  Each audit event is linked into a SHA-256 cryptographic sequence: Event(N) = SHA256(Hash(N-1) + Payload).
                </p>
              </div>
            </div>

            {/* Architecture Explainer */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1rem',
                padding: '1.25rem',
                background: 'var(--color-surface-hover)',
                borderRadius: '8px',
                border: '1px solid var(--color-border-subtle)',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-api-bright)', marginBottom: '0.25rem' }}>
                  1. Append-Only Persistence
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Audit logs cannot be updated or deleted by any administrative account. Corrective events append new entries.
                </p>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-primary-bright)', marginBottom: '0.25rem' }}>
                  2. Sequential Chaining
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Any unauthorized database tampering, row deletion, or retroactive timestamp modification breaks the cryptographic hash-chain.
                </p>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-green-400)', marginBottom: '0.25rem' }}>
                  3. Zero-Credential Guarantee
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Passwords, API secrets, MFA keys, and Paystack credentials are automatically sanitized before hashing or storage.
                </p>
              </div>
            </div>

            {/* Live Verification Box */}
            <div
              style={{
                padding: '1.5rem',
                borderRadius: '8px',
                background: integrityResult && !integrityResult.isTamperEvident ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.08)',
                border: `1px solid ${integrityResult && !integrityResult.isTamperEvident ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.25)'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  {integrityResult && !integrityResult.isTamperEvident ? (
                    <XCircle size={20} style={{ color: '#ef4444' }} />
                  ) : (
                    <CheckCircle size={20} style={{ color: '#4ade80' }} />
                  )}
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {integrityResult
                      ? integrityResult.isTamperEvident
                        ? 'Cryptographic Audit Trail Intact (0 Discrepancies)'
                        : `Hash Chain Discrepancy Detected (${integrityResult.discrepanciesCount} Broken Links)`
                      : 'Cryptographic Hash-Chain Verified'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  Latest Head Hash: <code style={{ color: 'var(--color-text-primary)' }}>{stats.lastChainedHash}</code>
                </div>
                {integrityResult && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    Verified {integrityResult.totalChecked} recent event blocks at {new Date(integrityResult.lastVerifiedAt).toLocaleTimeString()}
                  </div>
                )}
              </div>

              <Button
                variant="primary"
                onClick={handleRunIntegrityCheck}
                disabled={isVerifying}
              >
                <ShieldCheck size={16} style={{ marginRight: '0.4rem' }} />
                {isVerifying ? 'Running Tamper Scan...' : 'Re-verify Entire Chain'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: Event Classification Taxonomy */}
      {activeTab === 'classification' && (
        <Card accentColor="purple">
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--color-text-primary)' }}>
            Security & Operational Event Classification Catalog
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0 0 1.5rem 0' }}>
            Authoritative categorization of actions, trigger boundaries, and default severity assignments.
          </p>

          <Table
            columns={[
              {
                header: 'Category',
                render: (row: any) => (
                  <span style={{ fontWeight: 700, color: 'var(--color-primary-bright)' }}>{row.category}</span>
                ),
              },
              {
                header: 'Sample Events & Actions',
                render: (row: any) => (
                  <div style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>
                    {row.events}
                  </div>
                ),
              },
              {
                header: 'Default Severity',
                render: (row: any) => (
                  <Badge variant={getSeverityBadgeVariant(row.severity)} size="sm">
                    {row.severity}
                  </Badge>
                ),
              },
              {
                header: 'Authoritative Safety Boundary',
                render: (row: any) => (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{row.boundary}</span>
                ),
              },
            ]}
            data={[
              {
                category: 'AUTH',
                events: 'AUTH_LOGIN, AUTH_LOGOUT, AUTH_LOGIN_FAILED, PASSWORD_RESET',
                severity: AuditSeverity.WARNING,
                boundary: 'Zero password/token logging; IP and User-Agent capture for brute-force protection.',
              },
              {
                category: 'AUTHORIZATION',
                events: 'PERMISSION_DENIED, USER_ROLE_PROMOTED, PRIVILEGE_ESCALATION_ATTEMPT',
                severity: AuditSeverity.HIGH,
                boundary: 'Evaluated against RBAC permission matrices before mutation; Super Admin rights required.',
              },
              {
                category: 'API_SECURITY',
                events: 'API_KEY_CREATED, API_KEY_ROTATED, API_RATE_LIMIT_EXCEEDED, SCOPE_VIOLATION',
                severity: AuditSeverity.WARNING,
                boundary: 'Cryptographic SHA-256 API key hashing; client never receives raw secrets in logs.',
              },
              {
                category: 'FINANCIAL_SECURITY',
                events: 'WALLET_ADJUSTMENT, MANUAL_REFUND_EXECUTED, LEDGER_ANOMALY_DETECTED',
                severity: AuditSeverity.HIGH,
                boundary: 'Double-entry ledger journal balance check (Debits == Credits); Paystack webhook HMAC check.',
              },
              {
                category: 'TELECOM_SECURITY',
                events: 'PROVIDER_STATE_RECONCILIATION, CARRIER_CREDENTIAL_UPDATED, WEBHOOK_SIGNATURE_FAILED',
                severity: AuditSeverity.HIGH,
                boundary: 'DataHouse authoritative state invariant; reconciliation overrides internal status.',
              },
              {
                category: 'SYSTEM_WORKER',
                events: 'RECONCILIATION_WORKER_EXECUTED, FULFILLMENT_RETRY_POSTED, BULK_ORDER_CHUNK_DISPATCHED',
                severity: AuditSeverity.INFO,
                boundary: 'Background worker execution attribution for explainable order state transitions.',
              },
            ]}
            keyExtractor={(row) => row.category}
          />
        </Card>
      )}

      {/* TAB 5: Emergency Switchboard */}
      {activeTab === 'emergency' && (
        <Card accentColor="red">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <TactileIcon icon={Flame} color="red" size="md" />
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                Super Admin Emergency Controls & Kill Switches
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
                Privileged platform kill switches for disaster mitigation. Every toggle mandates step-up authentication and justification.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {emergencyControlsList.map((ctrl) => (
              <div
                key={ctrl.key}
                style={{
                  padding: '1.25rem',
                  borderRadius: '8px',
                  background: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {ctrl.name}
                    </span>
                    <Badge variant={ctrl.status ? 'danger' : 'neutral'} size="sm">
                      {ctrl.status ? 'ACTIVE (RESTRICTED)' : 'INACTIVE (NORMAL)'}
                    </Badge>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
                    {ctrl.desc}
                  </p>
                  {ctrl.lastToggledAt && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                      Last toggled: {new Date(ctrl.lastToggledAt).toLocaleString()}
                    </span>
                  )}
                </div>

                <Button
                  variant={ctrl.status ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => openEmergencyModal(ctrl.key, ctrl.name, ctrl.status)}
                >
                  {ctrl.status ? 'Deactivate Control' : 'Activate Emergency Kill Switch'}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 6: Export & Compliance */}
      {activeTab === 'export' && (
        <Card accentColor="cyan">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <TactileIcon icon={Download} color="analytics" size="md" />
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                Audit Log Export & Regulatory Compliance
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
                Securely export filtered audit logs for external compliance, regulatory review, or forensic investigation.
              </p>
            </div>
          </div>

          {exportSuccessMsg && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', color: '#4ade80', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {exportSuccessMsg}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Export Format
              </label>
              <Select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'CSV' | 'JSON')}
                options={[
                  { label: 'CSV (Spreadsheet / Excel format)', value: 'CSV' },
                  { label: 'JSON (Raw structured event stream)', value: 'JSON' },
                ]}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Category Filter
              </label>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                options={[
                  { label: 'All Categories', value: 'ALL' },
                  { label: 'Authentication', value: AuditCategory.AUTH },
                  { label: 'Financial Security', value: AuditCategory.FINANCIAL_SECURITY },
                  { label: 'Telecom Security', value: AuditCategory.TELECOM_SECURITY },
                  { label: 'Admin Action', value: AuditCategory.ADMIN_ACTION },
                ]}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Severity Filter
              </label>
              <Select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                options={[
                  { label: 'All Severities', value: 'ALL' },
                  { label: 'Critical & High Only', value: AuditSeverity.HIGH },
                  { label: 'Critical Only', value: AuditSeverity.CRITICAL },
                ]}
              />
            </div>
          </div>

          <div style={{ padding: '1rem', background: 'var(--color-surface-hover)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)', marginBottom: '1.5rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            <strong>Regulatory Audit Notice:</strong> Exporting audit logs generates an immutable <code>AUDIT_DATA_EXPORTED</code> record attributable to your account and IP address. Sensitive authentication secrets and raw payment credentials remain permanently redacted in exported datasets.
          </div>

          <Button
            variant="primary"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download size={16} style={{ marginRight: '0.4rem' }} />
            {isExporting ? 'Generating Export File...' : `Export Filtered Records (${exportFormat})`}
          </Button>
        </Card>
      )}

      {/* MODAL 1: Activity Dossier Investigation Drawer */}
      <Modal
        isOpen={Boolean(selectedLogId)}
        onClose={() => {
          setSelectedLogId(null);
          setSelectedLogDetail(null);
        }}
        title="Audit Activity Dossier"
      >
        {isLoadingDetail || !selectedLogDetail ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
            <div>Loading activity investigation records...</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            {/* Header info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', padding: '1rem', background: 'var(--color-surface-hover)', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Action</div>
                <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-primary-bright)' }}>{selectedLogDetail.action}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Severity & Result</div>
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
                  <Badge variant={getSeverityBadgeVariant(selectedLogDetail.severity)} size="sm">{selectedLogDetail.severity}</Badge>
                  <Badge variant={getResultBadgeVariant(selectedLogDetail.result)} size="sm">{selectedLogDetail.result}</Badge>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Actor</div>
                <div style={{ fontWeight: 600 }}>{selectedLogDetail.actorName} ({selectedLogDetail.actorRole})</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Timestamp (UTC)</div>
                <div>{new Date(selectedLogDetail.timestamp).toISOString()}</div>
              </div>
            </div>

            {/* Reason & Correlation */}
            {selectedLogDetail.reason && (
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-primary-bright)' }}>Justification Reason: </span>
                <span style={{ color: 'var(--color-text-primary)' }}>{selectedLogDetail.reason}</span>
              </div>
            )}

            {/* Before vs After State Diffs */}
            {(selectedLogDetail.beforeState || selectedLogDetail.afterState) && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
                  State Transition Diff
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.06)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.35rem' }}>BEFORE STATE</div>
                    <pre style={{ margin: 0, fontSize: '0.75rem', overflowX: 'auto', fontFamily: 'monospace' }}>
                      {JSON.stringify(selectedLogDetail.beforeState || {}, null, 2)}
                    </pre>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'rgba(34, 197, 94, 0.06)', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4ade80', marginBottom: '0.35rem' }}>AFTER STATE</div>
                    <pre style={{ margin: 0, fontSize: '0.75rem', overflowX: 'auto', fontFamily: 'monospace' }}>
                      {JSON.stringify(selectedLogDetail.afterState || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Linked Records */}
            {selectedLogDetail.linkedRecords && Object.keys(selectedLogDetail.linkedRecords).length > 0 && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
                  Linked Investigation Records
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {selectedLogDetail.linkedRecords.orderId && (
                    <Badge variant="neutral">Order ID: {selectedLogDetail.linkedRecords.orderId}</Badge>
                  )}
                  {selectedLogDetail.linkedRecords.paymentId && (
                    <Badge variant="neutral">Payment ID: {selectedLogDetail.linkedRecords.paymentId}</Badge>
                  )}
                  {selectedLogDetail.linkedRecords.walletId && (
                    <Badge variant="neutral">Wallet ID: {selectedLogDetail.linkedRecords.walletId}</Badge>
                  )}
                  {selectedLogDetail.linkedRecords.userId && (
                    <Badge variant="neutral">User ID: {selectedLogDetail.linkedRecords.userId}</Badge>
                  )}
                </div>
              </div>
            )}

            {/* Metadata Payload */}
            <div>
              <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: 'var(--color-text-primary)' }}>
                Event Metadata (Sanitized)
              </div>
              <pre style={{ padding: '0.75rem', background: 'var(--color-surface-muted)', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto', fontFamily: 'monospace', margin: 0 }}>
                {JSON.stringify(selectedLogDetail.metadata || {}, null, 2)}
              </pre>
            </div>

            {/* Cryptographic Proof */}
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.5rem' }}>
              <div>Current Event Hash: <code style={{ color: 'var(--color-text-primary)' }}>{selectedLogDetail.eventHash}</code></div>
              <div>Previous Block Hash: <code style={{ color: 'var(--color-text-primary)' }}>{selectedLogDetail.previousEventHash || 'Genesis (0000...)'}</code></div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: Create Security Incident */}
      <Modal
        isOpen={isCreateIncidentOpen}
        onClose={() => setIsCreateIncidentOpen(false)}
        title="Open Security Incident"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Incident Title
            </label>
            <input
              type="text"
              placeholder="e.g. Suspicious Brute-force Login Spikes on Admin Gateway"
              value={newIncidentTitle}
              onChange={(e) => setNewIncidentTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                borderRadius: '6px',
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-surface-hover)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Severity Level
            </label>
            <Select
              value={newIncidentSeverity}
              onChange={(e) => setNewIncidentSeverity(e.target.value as AuditSeverity)}
              options={[
                { label: 'Critical Incident', value: AuditSeverity.CRITICAL },
                { label: 'High Severity', value: AuditSeverity.HIGH },
                { label: 'Warning / Suspicious', value: AuditSeverity.WARNING },
                { label: 'Informational', value: AuditSeverity.INFO },
              ]}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Initial Investigation Notes
            </label>
            <textarea
              rows={4}
              placeholder="Detail observations, affected users, anomalous IP addresses, or potential risk vector..."
              value={newIncidentNotes}
              onChange={(e) => setNewIncidentNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                borderRadius: '6px',
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-surface-hover)',
                color: 'var(--color-text-primary)',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Button variant="outline" onClick={() => setIsCreateIncidentOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateIncident}>
              Register Incident
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: Update Security Incident */}
      <Modal
        isOpen={Boolean(selectedIncidentForUpdate)}
        onClose={() => setSelectedIncidentForUpdate(null)}
        title={`Manage Incident ${selectedIncidentForUpdate?.incidentNumber || ''}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Update Incident Status
            </label>
            <Select
              value={updateIncidentStatus}
              onChange={(e) => setUpdateIncidentStatus(e.target.value as SecurityIncidentStatus)}
              options={[
                { label: 'OPEN (Active alert)', value: SecurityIncidentStatus.OPEN },
                { label: 'INVESTIGATING (Forensics in progress)', value: SecurityIncidentStatus.INVESTIGATING },
                { label: 'CONTAINED (Risk mitigated)', value: SecurityIncidentStatus.CONTAINED },
                { label: 'RESOLVED (Closed successfully)', value: SecurityIncidentStatus.RESOLVED },
                { label: 'FALSE_POSITIVE (Dismissed)', value: SecurityIncidentStatus.FALSE_POSITIVE },
              ]}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Add Investigation Timeline Note
            </label>
            <textarea
              rows={3}
              placeholder="Record forensic actions taken, IP blocked, user contacted..."
              value={updateIncidentNote}
              onChange={(e) => setUpdateIncidentNote(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                borderRadius: '6px',
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-surface-hover)',
                color: 'var(--color-text-primary)',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Resolution Summary (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Malicious IP blocked on Cloudflare; affected customer tokens revoked."
              value={updateIncidentResolution}
              onChange={(e) => setUpdateIncidentResolution(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                borderRadius: '6px',
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-surface-hover)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Button variant="outline" onClick={() => setSelectedIncidentForUpdate(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUpdateIncident}>
              Save Updates
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 4: Step-Up Emergency Control Toggle */}
      <Modal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        title="⚠️ Super Admin Emergency Kill Switch"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '0.875rem' }}>
            <strong>CAUTION:</strong> You are about to {emergencyTargetState ? 'ACTIVATE' : 'DEACTIVATE'} <strong>{selectedEmergencyName}</strong>. This state change affects all active users across the platform immediately.
          </div>

          {emergencyError && (
            <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px', color: '#f87171', fontSize: '0.8125rem' }}>
              {emergencyError}
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Administrative Justification Reason (Mandatory)
            </label>
            <textarea
              rows={3}
              placeholder="State the exact operational reason or incident reference for this emergency toggle..."
              value={emergencyReason}
              onChange={(e) => setEmergencyReason(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                borderRadius: '6px',
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-surface-hover)',
                color: 'var(--color-text-primary)',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Type <code style={{ color: '#ef4444' }}>CONFIRM_EMERGENCY_ACTION</code> to proceed:
            </label>
            <input
              type="text"
              placeholder="CONFIRM_EMERGENCY_ACTION"
              value={emergencyStepUpInput}
              onChange={(e) => setEmergencyStepUpInput(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                borderRadius: '6px',
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-surface-hover)',
                color: 'var(--color-text-primary)',
                fontFamily: 'monospace',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Button variant="outline" onClick={() => setIsEmergencyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleEmergencySubmit}
              disabled={emergencyStepUpInput.trim() !== 'CONFIRM_EMERGENCY_ACTION'}
            >
              Confirm & Apply Emergency State
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
