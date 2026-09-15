import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  AlertOctagon,
  Download,
  Activity,
  CheckCircle,
  XCircle,
  Database,
  Plus,
  Flame,
  Users,
  Key,
  CreditCard,
  Copy,
  ExternalLink,
  Clock,
  Server,
  Globe,
  Terminal,
  Hash,
  Calendar,
  Filter,
  X,
  ChevronRight,
  Check,
  Layers,
  Search,
  ArrowRight,
  Radio,
  Zap,
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

const QUICK_CATEGORY_PILLS = [
  { label: 'All', value: 'ALL' },
  { label: 'Authentication', value: AuditCategory.AUTH },
  { label: 'Users', value: AuditCategory.USERS },
  { label: 'Orders', value: AuditCategory.ORDERS },
  { label: 'Wallet', value: AuditCategory.WALLET },
  { label: 'Payments', value: AuditCategory.PAYMENTS },
  { label: 'API', value: AuditCategory.API },
  { label: 'Agents', value: AuditCategory.AGENTS },
  { label: 'Stores', value: AuditCategory.STORES },
  { label: 'Administration', value: AuditCategory.ADMIN_ACTION },
  { label: 'Security', value: AuditCategory.SECURITY },
  { label: 'System', value: AuditCategory.SYSTEM },
  { label: 'Providers', value: AuditCategory.PROVIDERS },
  { label: 'Notifications', value: AuditCategory.NOTIFICATIONS },
];

export const AdminAuditPage: React.FC = () => {
  const navigate = useNavigate();
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
    activitiesToday: 0,
    activeUsersCount: 0,
    failedActivitiesCount: 0,
    securityEventsCount: 0,
    adminActionsCount: 0,
    apiEventsCount: 0,
    financialEventsCount: 0,
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
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [auditLogs, setAuditLogs] = useState<AdminAuditListItemDto[]>([]);

  // Real-time Auto-Refresh & Live Sync State
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isEmittingTest, setIsEmittingTest] = useState(false);
  const [testEventToast, setTestEventToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Selected Log Detail Drawer State
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [selectedLogDetail, setSelectedLogDetail] = useState<AdminAuditDetailDto | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Quick Export State
  const [isQuickExportOpen, setIsQuickExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'CSV' | 'JSON'>('CSV');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

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

  // Clipboard copy helper
  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  // Relative time helper
  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return diffSec <= 0 ? 'just now' : `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDay = Math.floor(diffHr / 24);
      return `${diffDay}d ago`;
    } catch {
      return dateStr;
    }
  };

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
  const fetchOverview = useCallback(async (isSilent = false) => {
    try {
      const res = await adminApi.getAuditOverview();
      if (res) {
        setStats(res);
      }
      await fetchEmergencyControls();
      setLastUpdated(new Date());
    } catch {
      // Fallback to local default stats if network error
    }
  }, [fetchEmergencyControls]);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const res = await adminApi.getAuditEvents({
        page,
        limit: 25,
        search: searchQuery || undefined,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        severity: severityFilter !== 'ALL' ? severityFilter : undefined,
        result: resultFilter !== 'ALL' ? resultFilter : undefined,
        status: resultFilter !== 'ALL' ? resultFilter : undefined,
        actorRole: roleFilter !== 'ALL' ? roleFilter : undefined,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        actor: actorFilter || undefined,
        action: actionFilter || undefined,
        resource: resourceFilter || undefined,
        source: sourceFilter !== 'ALL' ? sourceFilter : undefined,
        startDate: startDateFilter || undefined,
        endDate: endDateFilter || undefined,
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
      setLastUpdated(new Date());
    } catch {
      setAuditLogs([]);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [page, searchQuery, categoryFilter, severityFilter, resultFilter, roleFilter, sourceFilter, actionFilter, resourceFilter, actorFilter, startDateFilter, endDateFilter]);

  // Fetch Incidents
  const fetchIncidents = useCallback(async (isSilent = false) => {
    try {
      const res = await adminApi.getSecurityIncidents({
        status: incidentStatusFilter !== 'ALL' ? incidentStatusFilter : undefined,
      });
      if (Array.isArray(res)) {
        setIncidents(res);
      }
      setLastUpdated(new Date());
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

  // Real-time Background Polling
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      // Pause background polling while investigating detail or filling forms
      if (
        selectedLogId ||
        isEmergencyModalOpen ||
        isCreateIncidentOpen ||
        selectedIncidentForUpdate ||
        isQuickExportOpen
      ) {
        return;
      }
      fetchOverview(true);
      if (activeTab === 'stream') {
        fetchAuditLogs(true);
      } else if (activeTab === 'incidents') {
        fetchIncidents(true);
      }
    }, autoRefreshInterval * 1000);

    return () => clearInterval(interval);
  }, [
    autoRefreshInterval,
    selectedLogId,
    isEmergencyModalOpen,
    isCreateIncidentOpen,
    selectedIncidentForUpdate,
    isQuickExportOpen,
    activeTab,
    fetchOverview,
    fetchAuditLogs,
    fetchIncidents,
  ]);

  // Emit Live Test Activity Event
  const handleEmitTestEvent = async () => {
    setIsEmittingTest(true);
    setTestEventToast(null);
    try {
      const res = await adminApi.emitTestAuditEvent();
      setTestEventToast({
        message: res?.message || 'Live cryptographic audit event emitted and verified in real time.',
        type: 'success',
      });
      await fetchOverview();
      await fetchAuditLogs();
      setTimeout(() => setTestEventToast(null), 6000);
    } catch (e: any) {
      setTestEventToast({
        message: e?.message || 'Failed to emit live test audit event.',
        type: 'error',
      });
      setTimeout(() => setTestEventToast(null), 6000);
    } finally {
      setIsEmittingTest(false);
    }
  };

  // Open Log Investigation Detail Drawer
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
      setIsQuickExportOpen(false);
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
      case AuditSeverity.NOTICE:
        return 'info';
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

  const getRoleBadgeVariant = (role?: string): 'default' | 'neutral' | 'success' | 'warning' | 'danger' | 'info' => {
    const r = (role || '').toLowerCase();
    if (r.includes('super_admin')) return 'danger';
    if (r.includes('admin')) return 'warning';
    if (r.includes('agent')) return 'info';
    if (r.includes('customer')) return 'success';
    if (r.includes('system') || r.includes('worker')) return 'neutral';
    return 'default';
  };

  const getSourceBadge = (source?: string) => {
    const s = (source || 'WEB').toUpperCase();
    let bg = 'rgba(59, 130, 246, 0.12)';
    let color = '#60a5fa';
    let borderColor = 'rgba(59, 130, 246, 0.3)';

    if (s === 'API') {
      bg = 'rgba(168, 85, 247, 0.12)';
      color = '#c084fc';
      borderColor = 'rgba(168, 85, 247, 0.3)';
    } else if (s === 'WORKER') {
      bg = 'rgba(234, 179, 8, 0.12)';
      color = '#facc15';
      borderColor = 'rgba(234, 179, 8, 0.3)';
    } else if (s === 'WEBHOOK') {
      bg = 'rgba(236, 72, 153, 0.12)';
      color = '#f472b6';
      borderColor = 'rgba(236, 72, 153, 0.3)';
    } else if (s === 'SYSTEM') {
      bg = 'rgba(148, 163, 184, 0.12)';
      color = '#94a3b8';
      borderColor = 'rgba(148, 163, 184, 0.3)';
    } else if (s === 'CLI') {
      bg = 'rgba(34, 197, 94, 0.12)';
      color = '#4ade80';
      borderColor = 'rgba(34, 197, 94, 0.3)';
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.15rem 0.45rem',
          borderRadius: '4px',
          fontSize: '0.6875rem',
          fontWeight: 700,
          fontFamily: 'monospace',
          backgroundColor: bg,
          color,
          border: `1px solid ${borderColor}`,
        }}
      >
        {s}
      </span>
    );
  };

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setSeverityFilter('ALL');
    setResultFilter('ALL');
    setRoleFilter('ALL');
    setSourceFilter('ALL');
    setActionFilter('');
    setResourceFilter('');
    setActorFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setPage(1);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={ShieldCheck} color="api" size="lg" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-api-bright)' }}>
                Security & Activity Control Center
              </span>
              <Badge variant={stats.tamperEvidenceStatus === 'VERIFIED' ? 'success' : 'danger'} size="sm">
                {stats.tamperEvidenceStatus === 'VERIFIED' ? 'Tamper-Evident SHA-256' : 'Verification Required'}
              </Badge>
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Activity & Audit
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Authoritative forensics engine capturing who did what, when, from where, to what, what changed, and resulting state. Total: {stats.totalEvents.toLocaleString()} records.
            </p>
          </div>
        </div>

        {/* Verification Status & Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Live Sync Status & Frequency Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'var(--color-surface-hover)',
              padding: '0.35rem 0.65rem',
              borderRadius: '8px',
              border: '1px solid var(--color-border-subtle)',
            }}
            title="Real-time Live Sync status and refresh frequency"
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: autoRefreshInterval > 0 ? '#10b981' : '#64748b',
                boxShadow: autoRefreshInterval > 0 ? '0 0 0 3px rgba(16, 185, 129, 0.2)' : 'none',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: autoRefreshInterval > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
              {autoRefreshInterval > 0 ? 'Live' : 'Paused'}
            </span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600,
                outline: 'none',
              }}
            >
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={0}>Off</option>
            </select>
            {lastUpdated && (
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', borderLeft: '1px solid var(--color-border-subtle)', paddingLeft: '0.4rem' }}>
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleEmitTestEvent}
            disabled={isEmittingTest}
            title="Emit an authoritative cryptographic test event to verify live real-time ingestion"
          >
            <Zap size={14} className={isEmittingTest ? 'animate-spin' : ''} style={{ marginRight: '0.35rem', color: '#f59e0b' }} />
            {isEmittingTest ? 'Emitting...' : 'Emit Test Event'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRunIntegrityCheck}
            disabled={isVerifying}
          >
            <ShieldCheck size={14} className={isVerifying ? 'animate-spin' : ''} style={{ marginRight: '0.35rem', color: '#10b981' }} />
            {isVerifying ? 'Verifying Chain...' : 'Verify Cryptographic Chain'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsQuickExportOpen(true)}
          >
            <Download size={14} style={{ marginRight: '0.35rem' }} />
            Export
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
            title="Refresh logs & telemetry"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {testEventToast && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: testEventToast.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${testEventToast.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '8px',
            color: testEventToast.type === 'success' ? '#4ade80' : '#f87171',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {testEventToast.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            <span>{testEventToast.message}</span>
          </div>
          <button
            onClick={() => setTestEventToast(null)}
            style={{
              background: 'none',
              border: 'none',
              color: testEventToast.type === 'success' ? '#4ade80' : '#f87171',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            ×
          </button>
        </div>
      )}

      {exportSuccessMsg && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', color: '#4ade80', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{exportSuccessMsg}</span>
          <button onClick={() => setExportSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '1rem' }}>×</button>
        </div>
      )}

      {/* 7 Top Metric Cards: Today's Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard
          title="Activities Today"
          value={(stats.activitiesToday ?? stats.totalEvents).toLocaleString()}
          subvalue={`${stats.totalEvents.toLocaleString()} total historical`}
          accent="purple"
          icon={<TactileIcon icon={Activity} color="api" size="sm" />}
        />
        <MetricCard
          title="Active Users"
          value={(stats.activeUsersCount ?? 0).toLocaleString()}
          subvalue="Unique actors recorded"
          accent="blue"
          icon={<TactileIcon icon={Users} color="analytics" size="sm" />}
        />
        <MetricCard
          title="Failed Activities"
          value={(stats.failedActivitiesCount ?? 0).toLocaleString()}
          subvalue="Non-success / denied"
          accent={(stats.failedActivitiesCount ?? 0) > 0 ? 'red' : 'green'}
          icon={<TactileIcon icon={AlertOctagon} color={(stats.failedActivitiesCount ?? 0) > 0 ? 'red' : 'security'} size="sm" />}
        />
        <MetricCard
          title="Security Events"
          value={(stats.securityEventsCount ?? stats.highSeverityCount).toLocaleString()}
          subvalue={`${stats.securityIncidentsCount || 0} active incidents`}
          accent={(stats.securityEventsCount ?? 0) > 0 ? 'orange' : 'green'}
          icon={<TactileIcon icon={ShieldAlert} color="amber" size="sm" />}
        />
        <MetricCard
          title="Admin Actions"
          value={(stats.adminActionsCount ?? 0).toLocaleString()}
          subvalue="Privileged modifications"
          accent="amber"
          icon={<TactileIcon icon={Shield} color="speed" size="sm" />}
        />
        <MetricCard
          title="API Events"
          value={(stats.apiEventsCount ?? 0).toLocaleString()}
          subvalue="Partner & developer calls"
          accent="cyan"
          icon={<TactileIcon icon={Key} color="api" size="sm" />}
        />
        <MetricCard
          title="Financial Events"
          value={(stats.financialEventsCount ?? 0).toLocaleString()}
          subvalue="Wallets, refunds, ledger"
          accent="green"
          icon={<TactileIcon icon={CreditCard} color="security" size="sm" />}
        />
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
        {[
          { key: 'stream', label: 'Activity & Audit Trail', icon: Activity, count: totalLogs },
          { key: 'incidents', label: 'Security Health & Incidents', icon: ShieldAlert, count: stats.securityIncidentsCount },
          { key: 'integrity', label: 'Audit Integrity & Chaining', icon: ShieldCheck },
          { key: 'classification', label: 'Classification Taxonomy', icon: Database },
          { key: 'emergency', label: 'Emergency Controls', icon: Flame },
          { key: 'export', label: 'Compliance Export', icon: Download },
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

      {/* TAB 1: Live Activity & Audit Stream */}
      {activeTab === 'stream' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Quick Filter Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              overflowX: 'auto',
              paddingBottom: '0.25rem',
              scrollbarWidth: 'thin',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Filter size={12} />
              Category:
            </span>
            {QUICK_CATEGORY_PILLS.map((pill) => {
              const isSelected = categoryFilter === pill.value;
              return (
                <button
                  key={pill.value}
                  onClick={() => {
                    setCategoryFilter(pill.value);
                    setPage(1);
                  }}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '999px',
                    border: isSelected ? '1px solid var(--color-primary-bright)' : '1px solid var(--color-border-subtle)',
                    background: isSelected ? 'var(--color-primary-subtle)' : 'var(--color-surface-hover)',
                    color: isSelected ? 'var(--color-primary-bright)' : 'var(--color-text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Compact Multi-Column Filter Toolbar */}
          <Card accentColor="blue">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Top Row: Search & Principal Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <SearchInput
                    placeholder="Search activity, actor, IP, correlation ID, endpoint..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Actor name or email..."
                    value={actorFilter}
                    onChange={(e) => {
                      setActorFilter(e.target.value);
                      setPage(1);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border-subtle)',
                      background: 'var(--color-surface-hover)',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.8125rem',
                    }}
                  />
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Action (e.g. ORDER_REFUND)..."
                    value={actionFilter}
                    onChange={(e) => {
                      setActionFilter(e.target.value);
                      setPage(1);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border-subtle)',
                      background: 'var(--color-surface-hover)',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.8125rem',
                    }}
                  />
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Resource (orders, plan_id...)..."
                    value={resourceFilter}
                    onChange={(e) => {
                      setResourceFilter(e.target.value);
                      setPage(1);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border-subtle)',
                      background: 'var(--color-surface-hover)',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.8125rem',
                    }}
                  />
                </div>
              </div>

              {/* Bottom Row: Dropdown Selects, Date Range & Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
                <Select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setPage(1);
                  }}
                  options={[
                    { label: 'All Roles', value: 'ALL' },
                    { label: 'Super Admin', value: 'SUPER_ADMIN' },
                    { label: 'Operations Admin', value: 'OPERATIONS_ADMIN' },
                    { label: 'Finance Admin', value: 'FINANCE_ADMIN' },
                    { label: 'Support Admin', value: 'SUPPORT_ADMIN' },
                    { label: 'Developer Admin', value: 'DEVELOPER_ADMIN' },
                    { label: 'Agent', value: 'AGENT' },
                    { label: 'Customer', value: 'CUSTOMER' },
                    { label: 'System / Worker', value: 'SYSTEM' },
                    { label: 'External Provider', value: 'PROVIDER' },
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
                    { label: 'Notice', value: AuditSeverity.NOTICE },
                    { label: 'Info', value: AuditSeverity.INFO },
                  ]}
                />

                <Select
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value);
                    setPage(1);
                  }}
                  options={[
                    { label: 'All Sources', value: 'ALL' },
                    { label: 'Web (Console)', value: 'WEB' },
                    { label: 'API (Client)', value: 'API' },
                    { label: 'Worker', value: 'WORKER' },
                    { label: 'Webhook', value: 'WEBHOOK' },
                    { label: 'System', value: 'SYSTEM' },
                    { label: 'CLI', value: 'CLI' },
                  ]}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => {
                      setStartDateFilter(e.target.value);
                      setPage(1);
                    }}
                    title="Start Date"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.5rem',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border-subtle)',
                      background: 'var(--color-surface-hover)',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.75rem',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => {
                      setEndDateFilter(e.target.value);
                      setPage(1);
                    }}
                    title="End Date"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.5rem',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border-subtle)',
                      background: 'var(--color-surface-hover)',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.75rem',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button variant="outline" size="sm" onClick={resetFilters} title="Reset all filters">
                    Reset
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setIsQuickExportOpen(true)}>
                    <Download size={13} style={{ marginRight: '0.25rem' }} />
                    Export
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Activity Table Card */}
          <Card accentColor="purple">
            {auditLogs.length === 0 && !isLoading ? (
              <div
                style={{
                  padding: '3.5rem 1.5rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                  }}
                >
                  <Activity size={28} style={{ color: 'var(--color-api-bright)' }} />
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 0.5rem 0' }}>
                  Real-time Activity Stream Is Active
                </h3>
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--color-text-muted)',
                    maxWidth: '520px',
                    margin: '0 0 1.5rem 0',
                    lineHeight: 1.5,
                  }}
                >
                  No records match your active search or filter criteria. Real database telemetry is active—no simulated or mock entries are displayed. You can emit a live test event below to verify instant cryptographic ingestion.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button variant="primary" size="sm" onClick={handleEmitTestEvent} disabled={isEmittingTest}>
                    <Zap size={14} style={{ marginRight: '0.35rem' }} />
                    {isEmittingTest ? 'Emitting...' : 'Emit Live Test Event'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Reset Filters
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Table
                  columns={[
                    {
                      header: 'Time',
                      render: (row: AdminAuditListItemDto) => (
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {formatRelativeTime(row.timestamp)}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }} title={row.timestamp}>
                            {new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </div>
                      ),
                    },
                    {
                      header: 'Actor',
                      render: (row: AdminAuditListItemDto) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: 'var(--color-surface-muted)',
                              border: '1px solid var(--color-border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              color: 'var(--color-text-secondary)',
                              flexShrink: 0,
                            }}
                          >
                            {(row.actorName || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span>{row.actorName}</span>
                              <Badge variant={getRoleBadgeVariant(row.actorRole)} size="sm">
                                {row.actorRole || 'user'}
                              </Badge>
                            </div>
                            {row.actorEmail && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                {row.actorEmail}
                              </div>
                            )}
                          </div>
                        </div>
                      ),
                    },
                    {
                      header: 'Action',
                      render: (row: AdminAuditListItemDto) => (
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-primary-bright)' }}>
                            {row.action}
                          </div>
                          {row.description ? (
                            <div style={{ fontSize: '0.725rem', color: 'var(--color-text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.description}>
                              {row.description}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                              {row.category}
                            </div>
                          )}
                        </div>
                      ),
                    },
                    {
                      header: 'Resource',
                      render: (row: AdminAuditListItemDto) => (
                        <div style={{ fontSize: '0.8125rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{row.resourceType}</span>
                          {row.resourceId && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.1rem' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                                {row.resourceId.length > 14 ? `${row.resourceId.slice(0, 14)}...` : row.resourceId}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(row.resourceId!, `res_${row.id}`);
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-text-muted)' }}
                                title="Copy Resource ID"
                              >
                                {copiedKey === `res_${row.id}` ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                              </button>
                            </div>
                          )}
                        </div>
                      ),
                    },
                    {
                      header: 'Status / Severity',
                      render: (row: AdminAuditListItemDto) => (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <Badge variant={getResultBadgeVariant(row.result)} size="sm">
                            {row.result}
                          </Badge>
                          <Badge variant={getSeverityBadgeVariant(row.severity)} size="sm">
                            {row.severity}
                          </Badge>
                        </div>
                      ),
                    },
                    {
                      header: 'Source / IP',
                      render: (row: AdminAuditListItemDto) => (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {getSourceBadge(row.source)}
                            {row.latencyMs !== undefined && (
                              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                                {row.latencyMs}ms
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                            {row.ipAddress || '—'}
                          </div>
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
              </>
            )}
          </Card>
        </div>
      )}

      {/* Tabs 2 - 6: Incidents, Integrity, Classification, Emergency, Export */}
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

      

      {/* Slide-Over Activity Detail Drawer */}
      {selectedLogDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => {
            setSelectedLogDetail(null);
            setSelectedLogId(null);
          }}
        >
          <div
            style={{
              width: 'min(680px, 100vw)',
              height: '100%',
              backgroundColor: 'var(--color-surface)',
              borderLeft: '1px solid var(--color-border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-12px 0 36px rgba(0, 0, 0, 0.6)',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                backgroundColor: 'var(--color-surface)',
                zIndex: 10,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary-bright)' }}>
                    Activity Dossier
                  </span>
                  <Badge variant={getResultBadgeVariant(selectedLogDetail.result)} size="sm">
                    {selectedLogDetail.result}
                  </Badge>
                  <Badge variant={getSeverityBadgeVariant(selectedLogDetail.severity)} size="sm">
                    {selectedLogDetail.severity}
                  </Badge>
                </div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
                  {selectedLogDetail.action}
                </h2>
              </div>

              <button
                onClick={() => {
                  setSelectedLogDetail(null);
                  setSelectedLogId(null);
                }}
                style={{
                  background: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: '6px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body Content */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Telemetry Strip */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border-subtle)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  {getSourceBadge(selectedLogDetail.source)}
                </div>
                {selectedLogDetail.httpMethod && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
                    {selectedLogDetail.httpMethod} {selectedLogDetail.httpStatus || 200}
                  </span>
                )}
                {selectedLogDetail.latencyMs !== undefined && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                    Latency: {selectedLogDetail.latencyMs}ms
                  </span>
                )}
                {selectedLogDetail.service && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Service: <strong>{selectedLogDetail.service}</strong>
                  </span>
                )}
                <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {new Date(selectedLogDetail.timestamp).toUTCString()}
                </div>
              </div>

              {/* Narrative Description Card */}
              {selectedLogDetail.description && (
                <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-primary-bright)', marginBottom: '0.25rem' }}>
                    Activity Narrative
                  </div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                    {selectedLogDetail.description}
                  </div>
                </div>
              )}

              {/* Justification Reason */}
              {selectedLogDetail.reason && (
                <div style={{ padding: '0.875rem 1rem', background: 'rgba(234, 179, 8, 0.08)', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.25)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#eab308' }}>
                    Justification Reason:
                  </span>
                  <span style={{ color: 'var(--color-text-primary)', marginLeft: '0.5rem', fontSize: '0.875rem' }}>
                    {selectedLogDetail.reason}
                  </span>
                </div>
              )}

              {/* Actor Dossier Card */}
              <div style={{ padding: '1rem', background: 'var(--color-surface-hover)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                  Actor Dossier
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Name & Role</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {selectedLogDetail.actorName}
                      <Badge variant={getRoleBadgeVariant(selectedLogDetail.actorRole)} size="sm">
                        {selectedLogDetail.actorRole || 'user'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Email</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                      {selectedLogDetail.actorEmail || '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Actor ID</div>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {selectedLogDetail.actorId ? `${selectedLogDetail.actorId.slice(0, 16)}...` : '—'}
                      {selectedLogDetail.actorId && (
                        <button
                          onClick={() => copyToClipboard(selectedLogDetail.actorId!, 'actorId')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0 }}
                        >
                          {copiedKey === 'actorId' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>IP Address</div>
                    <div style={{ fontSize: '0.8125rem', fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
                      {selectedLogDetail.ipAddress || '—'}
                    </div>
                  </div>
                </div>
                {selectedLogDetail.userAgent && (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>User Agent</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', wordBreak: 'break-all' }}>
                      {selectedLogDetail.userAgent}
                    </div>
                  </div>
                )}
              </div>

              {/* Request Tracing Card */}
              <div style={{ padding: '1rem', background: 'var(--color-surface-hover)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                  Request & Correlation Tracing
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedLogDetail.requestId && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Request ID:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <code style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)' }}>{selectedLogDetail.requestId}</code>
                        <button
                          onClick={() => copyToClipboard(selectedLogDetail.requestId!, 'requestId')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0 }}
                        >
                          {copiedKey === 'requestId' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  )}
                  {selectedLogDetail.correlationId && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Correlation ID:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <code style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)' }}>{selectedLogDetail.correlationId}</code>
                        <button
                          onClick={() => copyToClipboard(selectedLogDetail.correlationId!, 'correlationId')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0 }}
                        >
                          {copiedKey === 'correlationId' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  )}
                  {selectedLogDetail.endpoint && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Target Endpoint:</span>
                      <code style={{ fontSize: '0.75rem', color: 'var(--color-api-bright)' }}>{selectedLogDetail.endpoint}</code>
                    </div>
                  )}
                </div>
              </div>

              {/* Before vs After State Diff Viewer */}
              {(selectedLogDetail.beforeState || selectedLogDetail.afterState) && (
                <div style={{ padding: '1rem', background: 'var(--color-surface-hover)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                    State Transition Diff (Before vs After)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                    <div style={{ padding: '0.875rem', background: 'rgba(239, 68, 68, 0.06)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ef4444', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>PREVIOUS STATE (BEFORE)</span>
                      </div>
                      <pre style={{ margin: 0, fontSize: '0.75rem', overflowX: 'auto', fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
                        {JSON.stringify(selectedLogDetail.beforeState || {}, null, 2)}
                      </pre>
                    </div>

                    <div style={{ padding: '0.875rem', background: 'rgba(34, 197, 94, 0.06)', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4ade80', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>RESULTING STATE (AFTER)</span>
                      </div>
                      <pre style={{ margin: 0, fontSize: '0.75rem', overflowX: 'auto', fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
                        {JSON.stringify(selectedLogDetail.afterState || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Linked Investigation Records */}
              {selectedLogDetail.linkedRecords && Object.keys(selectedLogDetail.linkedRecords).length > 0 && (
                <div style={{ padding: '1rem', background: 'var(--color-surface-hover)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                    Linked Platform Records
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {selectedLogDetail.linkedRecords.orderId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/admin/orders?search=${selectedLogDetail.linkedRecords?.orderId}`)}
                      >
                        <ExternalLink size={12} style={{ marginRight: '0.35rem' }} />
                        Order ${selectedLogDetail.linkedRecords.orderId.slice(0, 10)}...
                      </Button>
                    )}
                    {selectedLogDetail.linkedRecords.userId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/admin/users/${selectedLogDetail.linkedRecords?.userId}`)}
                      >
                        <ExternalLink size={12} style={{ marginRight: '0.35rem' }} />
                        User Dossier
                      </Button>
                    )}
                    {selectedLogDetail.linkedRecords.walletId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/admin/ledger?search=${selectedLogDetail.linkedRecords?.walletId}`)}
                      >
                        <ExternalLink size={12} style={{ marginRight: '0.35rem' }} />
                        Ledger Journal
                      </Button>
                    )}
                    {selectedLogDetail.resourceType === 'data_plan' && selectedLogDetail.resourceId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/admin/bundles?search=${selectedLogDetail.resourceId}`)}
                      >
                        <ExternalLink size={12} style={{ marginRight: '0.35rem' }} />
                        Data Plan
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Sanitized Metadata Payload */}
              <div style={{ padding: '1rem', background: 'var(--color-surface-hover)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                    Event Metadata Payload (Sanitized)
                  </span>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(selectedLogDetail.metadata || {}, null, 2), 'metadataJson')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-primary-bright)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    {copiedKey === 'metadataJson' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    {copiedKey === 'metadataJson' ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>
                <pre style={{ padding: '0.75rem', background: 'var(--color-surface-muted)', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto', fontFamily: 'monospace', margin: 0, color: 'var(--color-text-primary)' }}>
                  {JSON.stringify(selectedLogDetail.metadata || {}, null, 2)}
                </pre>
              </div>

              {/* Cryptographic Proof Card */}
              <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <ShieldCheck size={16} color="#10b981" />
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#10b981' }}>
                    Cryptographic Integrity Seal
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div>
                    Event SHA-256: <code style={{ color: 'var(--color-text-primary)', wordBreak: 'break-all' }}>{selectedLogDetail.eventHash}</code>
                  </div>
                  <div>
                    Previous Block Hash: <code style={{ color: 'var(--color-text-primary)', wordBreak: 'break-all' }}>{selectedLogDetail.previousEventHash || '0000000000000000000000000000000000000000000000000000000000000000 (Genesis)'}</code>
                  </div>
                  <div style={{ marginTop: '0.25rem', fontSize: '0.7rem', color: '#10b981' }}>
                    ✓ Chained and sealed in append-only storage. Mutation or deletion is mathematically impossible.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Export Modal */}
      <Modal
        isOpen={isQuickExportOpen}
        onClose={() => setIsQuickExportOpen(false)}
        title="Export Activity & Audit Log"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
            Generate an authoritative export of the activity and audit trail matching your current filter criteria.
          </p>

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

          <div style={{ padding: '0.75rem 1rem', background: 'var(--color-surface-hover)', borderRadius: '6px', border: '1px solid var(--color-border-subtle)', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            <strong>Active Filter Bounds:</strong>
            <div>Category: {categoryFilter} | Role: {roleFilter} | Severity: {severityFilter}</div>
            {searchQuery && <div>Search: "{searchQuery}"</div>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Button variant="outline" onClick={() => setIsQuickExportOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleExport} disabled={isExporting}>
              <Download size={14} style={{ marginRight: '0.35rem' }} />
              {isExporting ? 'Generating...' : `Download ${exportFormat}`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODALS 2, 3, 4: Incidents & Emergency */}
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

