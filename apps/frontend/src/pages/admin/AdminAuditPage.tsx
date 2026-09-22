import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Filter,
  X,
  Check,
  Zap,
  Clock,
  RotateCcw,
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

const inputStyle: React.CSSProperties = {
  padding: '0.45rem 0.75rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-subtle)',
  backgroundColor: 'var(--color-bg-surface)',
  color: 'var(--color-text-primary)',
  fontSize: '12px',
  fontWeight: 500,
  outline: 'none',
  boxShadow: 'var(--shadow-tactile-sm)',
};

const formatActionName = (action: string): string => {
  if (!action) return 'Unknown Action';
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const getActionCategoryInfo = (action: string, _category?: string) => {
  const act = (action || '').toUpperCase();
  if (act.includes('DELETE') || act.includes('REVOKE') || act.includes('PURGE') || act.includes('KILL')) {
    return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.25)' };
  }
  if (act.includes('CREATE') || act.includes('INSERT') || act.includes('ADD') || act.includes('APPROVE') || act.includes('SUCCESS')) {
    return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)' };
  }
  if (act.includes('UPDATE') || act.includes('MODIFY') || act.includes('TOGGLE') || act.includes('EDIT')) {
    return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)' };
  }
  if (act.includes('LOGIN') || act.includes('AUTH') || act.includes('TOKEN')) {
    return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.25)' };
  }
  return { color: 'var(--color-text-secondary)', bg: 'var(--color-bg-subtle)', border: 'var(--color-border-subtle)' };
};

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
  const [_isLoadingDetail, setIsLoadingDetail] = useState(false);
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
  const [_emergencySuccessMsg, setEmergencySuccessMsg] = useState<string | null>(null);

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
  const fetchOverview = useCallback(async (_isSilent = false) => {
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
  const fetchIncidents = useCallback(async (_isSilent = false) => {
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

  // Active filter chips for Audit Stream
  const activeFilters = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];
    if (searchQuery.trim()) {
      chips.push({ id: 'search', label: `Search: "${searchQuery}"`, onRemove: () => { setSearchQuery(''); setPage(1); } });
    }
    if (categoryFilter !== 'ALL') {
      const pill = QUICK_CATEGORY_PILLS.find((p) => p.value === categoryFilter);
      chips.push({ id: 'category', label: `Category: ${pill?.label || categoryFilter}`, onRemove: () => { setCategoryFilter('ALL'); setPage(1); } });
    }
    if (roleFilter !== 'ALL') {
      chips.push({ id: 'role', label: `Role: ${roleFilter}`, onRemove: () => { setRoleFilter('ALL'); setPage(1); } });
    }
    if (resultFilter !== 'ALL') {
      chips.push({ id: 'result', label: `Result: ${resultFilter}`, onRemove: () => { setResultFilter('ALL'); setPage(1); } });
    }
    if (severityFilter !== 'ALL') {
      chips.push({ id: 'severity', label: `Severity: ${severityFilter}`, onRemove: () => { setSeverityFilter('ALL'); setPage(1); } });
    }
    if (sourceFilter !== 'ALL') {
      chips.push({ id: 'source', label: `Source: ${sourceFilter}`, onRemove: () => { setSourceFilter('ALL'); setPage(1); } });
    }
    if (actorFilter.trim()) {
      chips.push({ id: 'actor', label: `Actor: "${actorFilter}"`, onRemove: () => { setActorFilter(''); setPage(1); } });
    }
    if (actionFilter.trim()) {
      chips.push({ id: 'action', label: `Action: "${actionFilter}"`, onRemove: () => { setActionFilter(''); setPage(1); } });
    }
    if (resourceFilter.trim()) {
      chips.push({ id: 'resource', label: `Resource: "${resourceFilter}"`, onRemove: () => { setResourceFilter(''); setPage(1); } });
    }
    if (startDateFilter) {
      chips.push({ id: 'startDate', label: `From: ${startDateFilter}`, onRemove: () => { setStartDateFilter(''); setPage(1); } });
    }
    if (endDateFilter) {
      chips.push({ id: 'endDate', label: `To: ${endDateFilter}`, onRemove: () => { setEndDateFilter(''); setPage(1); } });
    }
    return chips;
  }, [searchQuery, categoryFilter, roleFilter, resultFilter, severityFilter, sourceFilter, actorFilter, actionFilter, resourceFilter, startDateFilter, endDateFilter]);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header (Standardized with Tactile Buttons) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={ShieldCheck} color="api" size="lg" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-brand-bright)' }}>
                Security & Activity Control Center
              </span>
              <Badge variant={stats.tamperEvidenceStatus === 'VERIFIED' ? 'success' : 'danger'} size="sm">
                {stats.tamperEvidenceStatus === 'VERIFIED' ? 'Tamper-Evident SHA-256' : 'Verification Required'}
              </Badge>
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Activity & Audit
            </h1>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Authoritative forensics engine capturing who did what, when, from where, to what, what changed, and resulting state. Total: {stats.totalEvents.toLocaleString()} records.
            </p>
          </div>
        </div>

        {/* Verification Status & Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Live Sync Status & Frequency Selector */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: 'var(--color-bg-surface)',
              padding: '0.45rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-tactile-sm)',
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
            <span style={{ fontSize: '11px', fontWeight: 700, color: autoRefreshInterval > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
              {autoRefreshInterval > 0 ? 'Live' : 'Paused'}
            </span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-secondary)',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 700,
                outline: 'none',
                padding: 0,
              }}
            >
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={0}>Off</option>
            </select>
            {lastUpdated && (
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', borderLeft: '1px solid var(--color-border-subtle)', paddingLeft: '0.4rem', fontFamily: 'monospace' }}>
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleEmitTestEvent}
            disabled={isEmittingTest}
            style={tactileButtonStyle}
            title="Emit an authoritative cryptographic test event to verify live real-time ingestion"
          >
            <Zap size={14} className={isEmittingTest ? 'animate-spin' : ''} style={{ color: '#f59e0b' }} />
            <span>{isEmittingTest ? 'Emitting...' : 'Emit Test Event'}</span>
          </button>

          <button
            type="button"
            onClick={handleRunIntegrityCheck}
            disabled={isVerifying}
            style={tactileButtonStyle}
            title="Verify full SHA-256 cryptographic hash-chain"
          >
            <ShieldCheck size={14} className={isVerifying ? 'animate-spin' : ''} style={{ color: '#10b981' }} />
            <span>{isVerifying ? 'Verifying Chain...' : 'Verify Chain'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsQuickExportOpen(true)}
            style={tactileButtonStyle}
            title="Export filtered records"
          >
            <Download size={14} />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateIncidentOpen(true)}
            style={primaryButtonStyle}
            title="Open new security incident"
          >
            <Plus size={14} />
            <span>Open Incident</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchOverview();
              if (activeTab === 'stream') fetchAuditLogs();
              if (activeTab === 'incidents') fetchIncidents();
            }}
            disabled={isLoading}
            style={{ ...tactileButtonStyle, padding: '0.45rem 0.65rem' }}
            title="Refresh logs & telemetry"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
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

      {/* 8 Top Metric Cards: Balanced 4x2 Responsive KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          title="Activities Today"
          value={(stats.activitiesToday ?? stats.totalEvents).toLocaleString()}
          subvalue={`${stats.totalEvents.toLocaleString()} total historical`}
          accent="green"
          icon={<TactileIcon icon={Activity} color="speed" size="sm" />}
        />
        <MetricCard
          title="Active Actors"
          value={(stats.activeUsersCount ?? 0).toLocaleString()}
          subvalue="Unique actors recorded"
          accent="blue"
          icon={<TactileIcon icon={Users} color="analytics" size="sm" />}
        />
        <MetricCard
          title="Financial Events"
          value={(stats.financialEventsCount ?? 0).toLocaleString()}
          subvalue="Wallets, payouts & ledger"
          accent="green"
          icon={<TactileIcon icon={CreditCard} color="security" size="sm" />}
        />
        <MetricCard
          title="Cryptographic Chain"
          value={stats.tamperEvidenceStatus === 'VERIFIED' ? 'Verified' : 'Review'}
          subvalue={`${(stats.verifiedBlocksCount || stats.totalEvents).toLocaleString()} blocks chained (SHA-256)`}
          accent={stats.tamperEvidenceStatus === 'VERIFIED' ? 'green' : 'red'}
          icon={<TactileIcon icon={ShieldCheck} color="security" size="sm" />}
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
          title="API Integrations"
          value={(stats.apiEventsCount ?? 0).toLocaleString()}
          subvalue="Partner & developer calls"
          accent="cyan"
          icon={<TactileIcon icon={Key} color="api" size="sm" />}
        />
        <MetricCard
          title="Failed Activities"
          value={(stats.failedActivitiesCount ?? 0).toLocaleString()}
          subvalue="Non-success / denied"
          accent={(stats.failedActivitiesCount ?? 0) > 0 ? 'red' : 'green'}
          icon={<TactileIcon icon={AlertOctagon} color={(stats.failedActivitiesCount ?? 0) > 0 ? 'red' : 'security'} size="sm" />}
        />
      </div>

      {/* Tab Navigation (Segmented Tactile Switcher) */}
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          padding: '0.25rem',
          backgroundColor: 'var(--color-bg-subtle)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-subtle)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
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
              type="button"
              onClick={() => setActiveTab(tab.key as ActiveTab)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
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
              <Icon size={14} style={{ color: isActive ? 'var(--color-primary-bright)' : 'var(--color-text-muted)' }} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.1rem 0.45rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: isActive ? 'var(--color-bg-subtle)' : 'rgba(255,255,255,0.06)',
                    color: isActive ? 'var(--color-primary-bright)' : 'var(--color-text-muted)',
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
          {/* Quick Category Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              overflowX: 'auto',
              paddingBottom: '0.25rem',
              scrollbarWidth: 'thin',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Filter size={12} />
              Category:
            </span>
            {QUICK_CATEGORY_PILLS.map((pill) => {
              const isSelected = categoryFilter === pill.value;
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(pill.value);
                    setPage(1);
                  }}
                  style={{
                    padding: '0.3rem 0.7rem',
                    borderRadius: 'var(--radius-full)',
                    border: isSelected ? '1px solid var(--color-primary-bright)' : '1px solid var(--color-border-subtle)',
                    background: isSelected ? 'rgba(34, 197, 94, 0.12)' : 'var(--color-bg-surface)',
                    color: isSelected ? 'var(--color-primary-bright)' : 'var(--color-text-secondary)',
                    fontSize: '11px',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: isSelected ? 'var(--shadow-tactile-sm)' : 'none',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Compact Multi-Column Filter Toolbar */}
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
            {/* Top Row: Search & Specific Text Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem', alignItems: 'center' }}>
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
                    ...inputStyle,
                    width: '100%',
                    boxSizing: 'border-box',
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
                    ...inputStyle,
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Resource ID or type..."
                  value={resourceFilter}
                  onChange={(e) => {
                    setResourceFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    ...inputStyle,
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Bottom Row: Dropdown Selects, Date Range & Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
                <select
                  value={roleFilter}
                  onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                  style={selectStyle}
                  aria-label="Filter by Role"
                >
                  <option value="ALL">All Roles</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="OPERATIONS_ADMIN">Operations Admin</option>
                  <option value="FINANCE_ADMIN">Finance Admin</option>
                  <option value="SUPPORT_ADMIN">Support Admin</option>
                  <option value="DEVELOPER_ADMIN">Developer Admin</option>
                  <option value="AGENT">Agent</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="SYSTEM">System / Worker</option>
                  <option value="PROVIDER">External Provider</option>
                </select>

                <select
                  value={resultFilter}
                  onChange={(e) => { setResultFilter(e.target.value); setPage(1); }}
                  style={selectStyle}
                  aria-label="Filter by Result"
                >
                  <option value="ALL">All Results</option>
                  <option value={AuditResult.SUCCESS}>Success</option>
                  <option value={AuditResult.FAILURE}>Failure</option>
                  <option value={AuditResult.DENIED}>Denied</option>
                  <option value={AuditResult.CHALLENGED}>Challenged</option>
                </select>

                <select
                  value={severityFilter}
                  onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
                  style={selectStyle}
                  aria-label="Filter by Severity"
                >
                  <option value="ALL">All Severities</option>
                  <option value={AuditSeverity.CRITICAL}>Critical</option>
                  <option value={AuditSeverity.HIGH}>High</option>
                  <option value={AuditSeverity.WARNING}>Warning</option>
                  <option value={AuditSeverity.NOTICE}>Notice</option>
                  <option value={AuditSeverity.INFO}>Info</option>
                </select>

                <select
                  value={sourceFilter}
                  onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                  style={selectStyle}
                  aria-label="Filter by Source"
                >
                  <option value="ALL">All Sources</option>
                  <option value="WEB">Web (Console)</option>
                  <option value="API">API (Client)</option>
                  <option value="WORKER">Worker</option>
                  <option value="WEBHOOK">Webhook</option>
                  <option value="SYSTEM">System</option>
                  <option value="CLI">CLI</option>
                </select>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>From:</span>
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => { setStartDateFilter(e.target.value); setPage(1); }}
                    style={{ ...inputStyle, padding: '0.4rem 0.55rem', fontSize: '11px' }}
                    title="Start Date"
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>To:</span>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => { setEndDateFilter(e.target.value); setPage(1); }}
                    style={{ ...inputStyle, padding: '0.4rem 0.55rem', fontSize: '11px' }}
                    title="End Date"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={resetFilters}
                  style={{ ...tactileButtonStyle, padding: '0.45rem 0.75rem' }}
                  title="Reset all filters"
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuickExportOpen(true)}
                  style={{ ...tactileButtonStyle, padding: '0.45rem 0.75rem' }}
                  title="Export filtered records"
                >
                  <Download size={12} />
                  <span>Export</span>
                </button>
              </div>
            </div>

            {/* Active Filters Pill Bar */}
            {activeFilters.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                  alignItems: 'center',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--color-border-subtle)',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginRight: '0.25rem' }}>
                  Active Filters ({activeFilters.length}):
                </span>
                {activeFilters.map((chip) => (
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
                      boxShadow: 'var(--shadow-tactile-sm)',
                    }}
                  >
                    {chip.label}
                    <button
                      type="button"
                      onClick={chip.onRemove}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={`Remove filter: ${chip.label}`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={resetFilters}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary-bright)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '0.2rem 0.4rem',
                    textDecoration: 'underline',
                  }}
                >
                  Clear all
                </button>
              </div>
            )}
          </Card>

          {/* Activity Table Card */}
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
                  <button type="button" onClick={handleEmitTestEvent} disabled={isEmittingTest} style={primaryButtonStyle}>
                    <Zap size={14} />
                    <span>{isEmittingTest ? 'Emitting...' : 'Emit Live Test Event'}</span>
                  </button>
                  <button type="button" onClick={resetFilters} style={tactileButtonStyle}>
                    <span>Reset Filters</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Table
                  columns={[
                    {
                      header: 'Time',
                      render: (row: AdminAuditListItemDto) => (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {formatRelativeTime(row.timestamp)}
                          </div>
                          <div
                            style={{
                              fontSize: '0.6875rem',
                              color: 'var(--color-text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontFamily: 'monospace',
                            }}
                            title={row.timestamp}
                          >
                            <Clock size={10} />
                            {new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </div>
                      ),
                    },
                    {
                      header: 'Actor',
                      render: (row: AdminAuditListItemDto) => {
                        const role = (row.actorRole || 'user').toLowerCase();
                        let avatarBg = 'rgba(59, 130, 246, 0.12)';
                        let avatarColor = '#3b82f6';
                        if (role.includes('super_admin')) {
                          avatarBg = 'rgba(239, 68, 68, 0.15)';
                          avatarColor = '#ef4444';
                        } else if (role.includes('admin')) {
                          avatarBg = 'rgba(245, 158, 11, 0.15)';
                          avatarColor = '#f59e0b';
                        } else if (role.includes('agent')) {
                          avatarBg = 'rgba(16, 185, 129, 0.15)';
                          avatarColor = '#10b981';
                        } else if (role.includes('customer')) {
                          avatarBg = 'rgba(14, 165, 233, 0.15)';
                          avatarColor = '#0ea5e9';
                        }
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: 'var(--radius-md, 8px)',
                                backgroundColor: avatarBg,
                                color: avatarColor,
                                border: `1px solid ${avatarColor}33`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                flexShrink: 0,
                                boxShadow: 'var(--shadow-tactile-sm)',
                              }}
                            >
                              {(row.actorName || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                                  {row.actorName}
                                </span>
                                <Badge variant={getRoleBadgeVariant(row.actorRole)} size="sm">
                                  {row.actorRole || 'user'}
                                </Badge>
                              </div>
                              {row.actorEmail && (
                                <div
                                  style={{
                                    fontSize: '0.7rem',
                                    color: 'var(--color-text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                  }}
                                >
                                  <span>{row.actorEmail}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(row.actorEmail!, `email_${row.id}`);
                                    }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center' }}
                                    title="Copy Actor Email"
                                  >
                                    {copiedKey === `email_${row.id}` ? <Check size={10} color="#10b981" /> : <Copy size={10} />}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      },
                    },
                    {
                      header: 'Action',
                      render: (row: AdminAuditListItemDto) => {
                        const styleInfo = getActionCategoryInfo(row.action, row.category);
                        const friendlyName = formatActionName(row.action);
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                                {friendlyName}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.625rem',
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: 'var(--radius-xs, 4px)',
                                  backgroundColor: styleInfo.bg,
                                  color: styleInfo.color,
                                  border: `1px solid ${styleInfo.border}`,
                                }}
                              >
                                {row.action}
                              </span>
                            </div>
                            {row.description ? (
                              <div
                                style={{
                                  fontSize: '0.725rem',
                                  color: 'var(--color-text-secondary)',
                                  maxWidth: '320px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={row.description}
                              >
                                {row.description}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                Category: {row.category}
                              </div>
                            )}
                          </div>
                        );
                      },
                    },
                    {
                      header: 'Resource',
                      render: (row: AdminAuditListItemDto) => (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {row.resourceType}
                          </span>
                          {row.resourceId ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontFamily: 'monospace',
                                  color: 'var(--color-text-muted)',
                                  backgroundColor: 'var(--color-bg-subtle)',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: 'var(--radius-xs, 4px)',
                                  border: '1px solid var(--color-border-subtle)',
                                }}
                                title={row.resourceId}
                              >
                                {row.resourceId.length > 16 ? `${row.resourceId.slice(0, 16)}...` : row.resourceId}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(row.resourceId!, `res_${row.id}`);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 0,
                                  color: 'var(--color-text-muted)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                }}
                                title="Copy Resource ID"
                              >
                                {copiedKey === `res_${row.id}` ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>—</span>
                          )}
                        </div>
                      ),
                    },
                    {
                      header: 'Status & Severity',
                      render: (row: AdminAuditListItemDto) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
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
                      header: 'Source & IP',
                      render: (row: AdminAuditListItemDto) => (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {getSourceBadge(row.source)}
                            {row.latencyMs !== undefined && (
                              <span
                                style={{
                                  fontSize: '0.6875rem',
                                  color: 'var(--color-text-muted)',
                                  fontFamily: 'monospace',
                                  backgroundColor: 'var(--color-bg-subtle)',
                                  padding: '0.05rem 0.3rem',
                                  borderRadius: '3px',
                                }}
                              >
                                {row.latencyMs}ms
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                            {row.ipAddress || '—'}
                          </div>
                        </div>
                      ),
                    },
                    {
                      header: 'Inspect',
                      render: (row: AdminAuditListItemDto) => (
                        <button
                          type="button"
                          onClick={() => handleInspectLog(row)}
                          style={{
                            ...tactileButtonStyle,
                            padding: '0.35rem 0.65rem',
                            color: 'var(--color-text-secondary)',
                          }}
                          title="Inspect Activity Dossier"
                        >
                          <Eye size={13} style={{ color: 'var(--color-primary-bright)' }} />
                          <span>Inspect</span>
                        </button>
                      ),
                    },
                  ]}
                  data={auditLogs}
                  keyExtractor={(row) => row.id}
                  emptyMessage="No audit events matched your search or filters."
                />

                {totalPages > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: 'var(--space-3) var(--space-4)',
                      borderTop: '1px solid var(--color-border-subtle)',
                      backgroundColor: 'var(--color-bg-surface)',
                    }}
                  >
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      Showing page <strong style={{ color: 'var(--color-text-primary)' }}>{page}</strong> of{' '}
                      <strong style={{ color: 'var(--color-text-primary)' }}>{totalPages}</strong> ({totalLogs.toLocaleString()} total entries)
                    </div>
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
      {/* TAB 2: Security Incidents */}
      {activeTab === 'incidents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card elevation="sm">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
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
                <button
                  style={primaryButtonStyle}
                  onClick={() => setIsCreateIncidentOpen(true)}
                >
                  <Plus size={14} style={{ marginRight: '0.25rem' }} />
                  New Incident
                </button>
              </div>
            </div>

            {incidents.length === 0 ? (
              <div
                style={{
                  padding: '3.5rem 2rem',
                  textAlign: 'center',
                  background: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px dashed var(--color-border-subtle)',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(34, 197, 94, 0.1)',
                    color: 'var(--color-success)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto',
                  }}
                >
                  <ShieldCheck size={28} />
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Zero Open Security Incidents
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                  All systems operating normally without unresolved security alerts or active breaches.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    style={{
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border-subtle)',
                      boxShadow: 'var(--shadow-tactile-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'var(--color-bg-subtle)',
                              border: '1px solid var(--color-border-subtle)',
                              color: 'var(--color-primary-bright)',
                            }}
                          >
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

                      <button
                        style={tactileButtonStyle}
                        onClick={() => {
                          setSelectedIncidentForUpdate(inc);
                          setUpdateIncidentStatus(inc.status);
                          setUpdateIncidentResolution(inc.resolution || '');
                        }}
                      >
                        Manage Incident
                      </button>
                    </div>

                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                      {inc.investigationNotes || 'No initial investigation notes recorded.'}
                    </p>

                    {/* Timeline & Metadata */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.5rem' }}>
                      <div>Assigned: <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{inc.assignedAdminName}</span></div>
                      {inc.affectedUserEmail && <div>Affected User: <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{inc.affectedUserEmail}</span></div>}
                      <div>Opened: <span style={{ color: 'var(--color-text-primary)' }}>{new Date(inc.createdAt).toLocaleString()}</span></div>
                      {inc.resolvedAt && <div>Resolved: <span style={{ color: '#4ade80', fontWeight: 600 }}>{new Date(inc.resolvedAt).toLocaleString()}</span></div>}
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
          <Card elevation="sm">
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
                background: 'var(--color-bg-subtle)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: '0.25rem' }}>
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
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4ade80', marginBottom: '0.25rem' }}>
                  3. Zero-Credential Guarantee
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Passwords, API secrets, MFA keys, and payment credentials are automatically sanitized before hashing or storage.
                </p>
              </div>
            </div>

            {/* Live Verification Box */}
            <div
              style={{
                padding: '1.5rem',
                borderRadius: 'var(--radius-md)',
                background: integrityResult && !integrityResult.isTamperEvident ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)',
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
                  Latest Head Hash:{' '}
                  <code style={{ color: 'var(--color-text-primary)', background: 'var(--color-bg-subtle)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}>
                    {stats.lastChainedHash}
                  </code>
                </div>
                {integrityResult && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    Verified {integrityResult.totalChecked} recent event blocks at {new Date(integrityResult.lastVerifiedAt).toLocaleTimeString()}
                  </div>
                )}
              </div>

              <button
                style={primaryButtonStyle}
                onClick={handleRunIntegrityCheck}
                disabled={isVerifying}
              >
                <ShieldCheck size={16} />
                {isVerifying ? 'Running Tamper Scan...' : 'Re-verify Entire Chain'}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: Event Classification Taxonomy */}
      {activeTab === 'classification' && (
        <Card elevation="sm">
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
        <Card elevation="sm">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
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
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  boxShadow: 'var(--shadow-tactile-sm)',
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

                <button
                  style={ctrl.status ? tactileButtonStyle : dangerButtonStyle}
                  onClick={() => openEmergencyModal(ctrl.key, ctrl.name, ctrl.status)}
                >
                  {ctrl.status ? 'Deactivate Control' : 'Activate Emergency Kill Switch'}
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 6: Export & Compliance */}
      {activeTab === 'export' && (
        <Card elevation="sm">
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
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: 'var(--radius-md)', color: '#4ade80', fontSize: '0.875rem', marginBottom: '1rem' }}>
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

          <div style={{ padding: '1rem', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', marginBottom: '1.5rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            <strong>Regulatory Audit Notice:</strong> Exporting audit logs generates an immutable <code>AUDIT_DATA_EXPORTED</code> record attributable to your account and IP address. Sensitive authentication secrets and raw payment credentials remain permanently redacted in exported datasets.
          </div>

          <button
            style={primaryButtonStyle}
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download size={16} />
            {isExporting ? 'Generating Export File...' : `Export Filtered Records (${exportFormat})`}
          </button>
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

