import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Input } from '../../components/ui/Input/Input.js';
import { Select } from '../../components/ui/Select/Select.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useToast } from '../../context/ToastContext.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  adminApi,
  UserRole,
  NotificationSeverity,
  AlertStatus,
  AlertSource,
  CommunicationChannel,
  CommunicationDeliveryStatus,
  CommunicationTargetType,
  AdminNotificationOverviewDto,
  AdminSystemAlertDto,
  AdminAlertEventDto,
  AdminNotificationRuleDto,
  AdminNotificationAnalyticsDto,
  AdminNotificationHistoryItemDto,
  AdminNotificationDeliveryDetailDto,
  UserNotificationItemDto,
  UserNotificationCountsDto,
} from '../../api/admin.api.js';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Shield,
  CheckCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  Plus,
  Radio,
  Clock,
  Activity,
  Layers,
  Lock,
  Sparkles,
  CheckCheck,
  Trash2,
  X,
  Check,
  Copy,
  Search,
  User,
  Sliders,
  ChevronRight,
  XCircle,
  Info,
  FileText,
  Send,
} from 'lucide-react';

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

const secondaryButtonStyle: React.CSSProperties = {
  ...tactileButtonStyle,
  backgroundColor: 'var(--color-bg-subtle)',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border-subtle)',
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

type TabKey = 'notifications' | 'alerts' | 'overview' | 'rules' | 'analytics' | 'history' | 'emergency';

export const AdminNotificationsPage: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { toastSuccess, toastError } = useToast();
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

  const [activeTab, setActiveTab] = useState<TabKey>(
    location.pathname.endsWith('/alerts') ? 'alerts' : 'notifications',
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Data states
  const [overview, setOverview] = useState<AdminNotificationOverviewDto | null>(null);
  const [alerts, setAlerts] = useState<AdminSystemAlertDto[]>([]);
  const [alertMeta, setAlertMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [rules, setRules] = useState<AdminNotificationRuleDto[]>([]);
  const [analytics, setAnalytics] = useState<AdminNotificationAnalyticsDto | null>(null);
  const [history, setHistory] = useState<AdminNotificationHistoryItemDto[]>([]);
  const [historyMeta, setHistoryMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Admin In-App Notifications state
  const [adminNotifications, setAdminNotifications] = useState<UserNotificationItemDto[]>([]);
  const [adminNotifCounts, setAdminNotifCounts] = useState<UserNotificationCountsDto | null>(null);
  const [adminNotifTab, setAdminNotifTab] = useState<'all' | 'unread'>('all');
  const [isLoadingAdminNotifs, setIsLoadingAdminNotifs] = useState<boolean>(false);
  const [isClearingAdminNotifs, setIsClearingAdminNotifs] = useState<boolean>(false);

  // Filters for Alerts
  const [alertSearch, setAlertSearch] = useState<string>('');
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<string>('ALL');
  const [alertStatusFilter, setAlertStatusFilter] = useState<string>('ALL');
  const [alertSourceFilter, setAlertSourceFilter] = useState<string>('ALL');

  // Filters for History
  const [histSearch, setHistSearch] = useState<string>('');
  const [histChannel, setHistChannel] = useState<string>('ALL');
  const [histStatus, setHistStatus] = useState<string>('ALL');

  // Copy Feedback State
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toastSuccess('Copied to Clipboard', text.length > 32 ? text.slice(0, 32) + '...' : text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Dossier Drawers State
  const [selectedAlert, setSelectedAlert] = useState<AdminSystemAlertDto | null>(null);
  const [alertTimeline, setAlertTimeline] = useState<AdminAlertEventDto[]>([]);
  const [alertDrawerTab, setAlertDrawerTab] = useState<'OVERVIEW' | 'LIFECYCLE' | 'TIMELINE'>('OVERVIEW');
  const [alertActionNote, setAlertActionNote] = useState<string>('');
  const [alertResolutionText, setAlertResolutionText] = useState<string>('');
  const [assigneeUserId, setAssigneeUserId] = useState<string>('');

  const [selectedDelivery, setSelectedDelivery] = useState<AdminNotificationDeliveryDetailDto | null>(null);

  // Rule creation modal
  const [isCreateRuleModalOpen, setIsCreateRuleModalOpen] = useState<boolean>(false);
  const [ruleName, setRuleName] = useState<string>('');
  const [ruleDescription, setRuleDescription] = useState<string>('');
  const [ruleCondition, setRuleCondition] = useState<string>('');
  const [ruleValue, setRuleValue] = useState<string>('');
  const [ruleRoles] = useState<UserRole[]>([UserRole.ADMIN]);
  const [ruleChannels] = useState<CommunicationChannel[]>([CommunicationChannel.IN_APP]);
  const [ruleSeverity, setRuleSeverity] = useState<NotificationSeverity>(NotificationSeverity.INFO);

  // Emergency broadcast form state
  const [emSubject, setEmSubject] = useState<string>('');
  const [emBody, setEmBody] = useState<string>('');
  const [emSeverity, setEmSeverity] = useState<NotificationSeverity>(NotificationSeverity.CRITICAL);
  const [emAudience, setEmAudience] = useState<CommunicationTargetType>(CommunicationTargetType.BROADCAST);
  const [emChannels] = useState<CommunicationChannel[]>([CommunicationChannel.IN_APP]);
  const [emJustification, setEmJustification] = useState<string>('');
  const [isSendingEmergency, setIsSendingEmergency] = useState<boolean>(false);

  // Fetch Overview
  const loadOverview = useCallback(async () => {
    try {
      const data = await adminApi.getNotificationOverview();
      setOverview(data);
    } catch (err: any) {
      toastError('Failed to load overview', err.message);
    }
  }, [toastError]);

  // Fetch Alerts
  const loadAlerts = useCallback(async () => {
    try {
      const res = await adminApi.getAlerts({
        severity: alertSeverityFilter !== 'ALL' ? alertSeverityFilter : undefined,
        status: alertStatusFilter !== 'ALL' ? alertStatusFilter : undefined,
        source: alertSourceFilter !== 'ALL' ? alertSourceFilter : undefined,
        page: alertMeta.page,
        limit: alertMeta.limit,
      });
      if (res?.items) {
        setAlerts(res.items);
        setAlertMeta(res.meta);
      }
    } catch (err: any) {
      toastError('Failed to load alerts', err.message);
    }
  }, [alertSeverityFilter, alertStatusFilter, alertSourceFilter, alertMeta.page, alertMeta.limit, toastError]);

  // Fetch Rules
  const loadRules = useCallback(async () => {
    try {
      const data = await adminApi.getNotificationRules();
      setRules(data);
    } catch (err: any) {
      toastError('Failed to load notification rules', err.message);
    }
  }, [toastError]);

  // Fetch Analytics
  const loadAnalytics = useCallback(async () => {
    try {
      const data = await adminApi.getNotificationAnalytics();
      setAnalytics(data);
    } catch (err: any) {
      toastError('Failed to load delivery analytics', err.message);
    }
  }, [toastError]);

  // Fetch History
  const loadHistory = useCallback(async () => {
    try {
      const res = await adminApi.getNotificationHistory({
        recipient: histSearch || undefined,
        channel: histChannel !== 'ALL' ? histChannel : undefined,
        status: histStatus !== 'ALL' ? histStatus : undefined,
        page: historyMeta.page,
        limit: historyMeta.limit,
      });
      if (res?.items) {
        setHistory(res.items);
        setHistoryMeta(res.meta);
      }
    } catch (err: any) {
      toastError('Failed to load history', err.message);
    }
  }, [histSearch, histChannel, histStatus, historyMeta.page, historyMeta.limit, toastError]);

  // Fetch Admin In-App Notifications
  const loadAdminNotifications = useCallback(async () => {
    setIsLoadingAdminNotifs(true);
    try {
      const [res, counts] = await Promise.all([
        adminApi.getUserNotifications({ limit: 50 }),
        adminApi.getUserNotificationCounts(),
      ]);
      setAdminNotifications(res?.items || []);
      setAdminNotifCounts(counts);
    } catch (err: any) {
      toastError('Failed to load admin notifications', err.message);
    } finally {
      setIsLoadingAdminNotifs(false);
    }
  }, [toastError]);

  const handleMarkAllAdminNotificationsRead = async () => {
    try {
      await adminApi.markAllNotificationsRead();
      setAdminNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      if (adminNotifCounts) {
        setAdminNotifCounts({ ...adminNotifCounts, unread: 0 });
      }
      toastSuccess('All Read', 'Marked all notifications as read.');
    } catch (err: any) {
      toastError('Action Failed', err.message);
    }
  };

  const handleClearAdminNotifications = async () => {
    if (adminNotifications.length === 0) return;
    setIsClearingAdminNotifs(true);
    try {
      await adminApi.clearUserNotifications();
      setAdminNotifications([]);
      if (adminNotifCounts) {
        setAdminNotifCounts({ total: 0, unread: 0 });
      }
      toastSuccess('Notifications Cleared', 'All notifications cleared.');
    } catch (err: any) {
      toastError('Clear Failed', err.message);
    } finally {
      setIsClearingAdminNotifs(false);
    }
  };

  const handleMarkSingleAdminNotificationRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await adminApi.markNotificationRead(id);
      setAdminNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      if (adminNotifCounts) {
        setAdminNotifCounts({ ...adminNotifCounts, unread: Math.max(0, adminNotifCounts.unread - 1) });
      }
    } catch (err: any) {
      toastError('Action Failed', err.message);
    }
  };

  const handleDeleteAdminNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await adminApi.deleteUserNotification(id);
      setAdminNotifications((prev) => prev.filter((n) => n.id !== id));
      toastSuccess('Dismissed', 'Notification deleted.');
    } catch (err: any) {
      toastError('Delete Failed', err.message);
    }
  };

  const handleAcknowledgeAllAlerts = async () => {
    try {
      const res = await adminApi.acknowledgeAllAlerts();
      toastSuccess('Alerts Acknowledged', `${res.count} alerts marked as acknowledged.`);
      loadAlerts();
      loadOverview();
    } catch (err: any) {
      toastError('Action Failed', err.message);
    }
  };

  const handleClearAlerts = async () => {
    try {
      const res = await adminApi.clearAlerts();
      toastSuccess('Alerts Cleared', `${res.count} alerts cleared/resolved.`);
      loadAlerts();
      loadOverview();
    } catch (err: any) {
      toastError('Clear Failed', err.message);
    }
  };

  // Initial load
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([loadOverview(), loadAdminNotifications(), loadAlerts(), loadRules(), loadAnalytics(), loadHistory()]);
    setIsLoading(false);
  }, [loadOverview, loadAdminNotifications, loadAlerts, loadRules, loadAnalytics, loadHistory]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Refresh current tab
  const handleRefresh = () => {
    if (activeTab === 'notifications') loadAdminNotifications();
    else if (activeTab === 'overview') loadOverview();
    else if (activeTab === 'alerts') loadAlerts();
    else if (activeTab === 'rules') loadRules();
    else if (activeTab === 'analytics') loadAnalytics();
    else if (activeTab === 'history') loadHistory();
  };

  // Inspect Alert Detail
  const handleInspectAlert = async (alert: AdminSystemAlertDto) => {
    try {
      const res = await adminApi.getAlertDetail(alert.id);
      setSelectedAlert(res.alert);
      setAlertTimeline(res.timeline);
      setAlertActionNote('');
      setAlertResolutionText('');
      setAlertDrawerTab('OVERVIEW');
    } catch (err: any) {
      toastError('Failed to inspect alert', err.message);
    }
  };

  // Acknowledge Alert
  const handleAcknowledge = async (alertId: string) => {
    try {
      await adminApi.acknowledgeAlert(alertId, { note: alertActionNote || undefined });
      toastSuccess('Alert Acknowledged', 'Status changed to ACKNOWLEDGED');
      loadAlerts();
      if (selectedAlert?.id === alertId) {
        handleInspectAlert({ ...selectedAlert, status: AlertStatus.ACKNOWLEDGED });
      }
    } catch (err: any) {
      toastError('Acknowledge Failed', err.message);
    }
  };

  // Investigate Alert
  const handleInvestigate = async (alertId: string) => {
    try {
      await adminApi.investigateAlert(alertId, { note: alertActionNote || undefined });
      toastSuccess('Investigation Started', 'Status changed to INVESTIGATING');
      loadAlerts();
      if (selectedAlert?.id === alertId) {
        handleInspectAlert({ ...selectedAlert, status: AlertStatus.INVESTIGATING });
      }
    } catch (err: any) {
      toastError('Investigation Update Failed', err.message);
    }
  };

  // Resolve Alert
  const handleResolve = async (alertId: string) => {
    if (!alertResolutionText || alertResolutionText.trim().length < 5) {
      toastError('Validation Error', 'Resolution description is required (min 5 characters).');
      return;
    }
    try {
      await adminApi.resolveAlert(alertId, {
        resolution: alertResolutionText,
        note: alertActionNote || undefined,
      });
      toastSuccess('Alert Resolved', 'Status changed to RESOLVED');
      loadAlerts();
      setSelectedAlert(null);
    } catch (err: any) {
      toastError('Resolve Failed', err.message);
    }
  };

  // Assign Alert
  const handleAssign = async (alertId: string) => {
    if (!assigneeUserId.trim()) {
      toastError('Validation Error', 'Assignee user ID is required.');
      return;
    }
    try {
      await adminApi.assignAlert(alertId, {
        assigneeUserId,
        note: alertActionNote || undefined,
      });
      toastSuccess('Alert Assigned', 'Assignee updated successfully');
      loadAlerts();
      if (selectedAlert?.id === alertId) {
        handleInspectAlert({ ...selectedAlert, assignedToId: assigneeUserId });
      }
    } catch (err: any) {
      toastError('Assign Failed', err.message);
    }
  };

  // Add Note to Alert
  const handleAddNote = async (alertId: string) => {
    if (!alertActionNote.trim()) return;
    try {
      await adminApi.addAlertNote(alertId, alertActionNote);
      toastSuccess('Note Added', 'Internal note logged to alert timeline');
      setAlertActionNote('');
      if (selectedAlert?.id === alertId) {
        handleInspectAlert(selectedAlert);
      }
    } catch (err: any) {
      toastError('Failed to add note', err.message);
    }
  };

  // Create Notification Rule
  const handleCreateRule = async () => {
    if (!ruleName.trim() || !ruleCondition.trim()) {
      toastError('Validation Error', 'Rule Name and Event Condition are required.');
      return;
    }
    try {
      await adminApi.createNotificationRule({
        name: ruleName,
        description: ruleDescription,
        eventCondition: ruleCondition,
        conditionValue: ruleValue,
        notifyRoles: ruleRoles,
        channels: ruleChannels,
        severity: ruleSeverity,
      });
      toastSuccess('Rule Created', 'Active notification rule registered');
      setIsCreateRuleModalOpen(false);
      loadRules();
    } catch (err: any) {
      toastError('Creation Failed', err.message);
    }
  };

  // Send Emergency Broadcast
  const handleSendEmergency = async () => {
    if (!emSubject.trim() || !emBody.trim()) {
      toastError('Validation Error', 'Subject and Body are required.');
      return;
    }
    if (!emJustification || emJustification.trim().length < 10) {
      toastError('Justification Required', 'Super Admin justification reason is mandatory (min 10 chars).');
      return;
    }
    setIsSendingEmergency(true);
    try {
      await adminApi.sendEmergencyBroadcast({
        subject: emSubject,
        body: emBody,
        severity: emSeverity,
        audience: emAudience,
        channels: emChannels,
        justificationReason: emJustification,
      });
      toastSuccess('Emergency Broadcast Dispatched', 'Broadcast sent across selected channels');
      setEmSubject('');
      setEmBody('');
      setEmJustification('');
      loadOverview();
      loadHistory();
    } catch (err: any) {
      toastError('Broadcast Failed', err.message);
    } finally {
      setIsSendingEmergency(false);
    }
  };

  // Inspect Delivery Record
  const handleInspectDelivery = async (id: string) => {
    try {
      const detail = await adminApi.getNotificationDeliveryDetail(id);
      setSelectedDelivery(detail);
    } catch (err: any) {
      toastError('Inspect Failed', err.message);
    }
  };

  // Filtered Alerts
  const filteredAlerts = useMemo(() => {
    if (!alertSearch.trim()) return alerts;
    const q = alertSearch.toLowerCase();
    return alerts.filter(
      (a) =>
        a.source.toLowerCase().includes(q) ||
        a.condition.toLowerCase().includes(q) ||
        (a.assignedToName && a.assignedToName.toLowerCase().includes(q)) ||
        a.id.toLowerCase().includes(q)
    );
  }, [alerts, alertSearch]);

  const getSeverityBadge = (severity: NotificationSeverity) => {
    switch (severity) {
      case NotificationSeverity.CRITICAL:
        return <Badge variant="danger">CRITICAL</Badge>;
      case NotificationSeverity.SECURITY:
        return <Badge variant="warning">SECURITY</Badge>;
      case NotificationSeverity.WARNING:
        return <Badge variant="warning">WARNING</Badge>;
      default:
        return <Badge variant="info">INFO</Badge>;
    }
  };

  const getAlertStatusBadge = (status: AlertStatus) => {
    switch (status) {
      case AlertStatus.OPEN:
      case AlertStatus.DETECTED:
        return <Badge variant="danger">{status}</Badge>;
      case AlertStatus.ACKNOWLEDGED:
        return <Badge variant="warning">ACKNOWLEDGED</Badge>;
      case AlertStatus.INVESTIGATING:
        return <Badge variant="info">INVESTIGATING</Badge>;
      case AlertStatus.RESOLVED:
        return <Badge variant="success">RESOLVED</Badge>;
      case AlertStatus.REOPENED:
        return <Badge variant="danger">REOPENED</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-4) 0' }}>
      
      {/* 1. TOP HEADER & TACTILE ACTION TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Bell} color="emerald" size="lg" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-brand-bright)' }}>
                Platform Operations & Health
              </span>
              {overview?.criticalAlerts && overview.criticalAlerts > 0 ? (
                <span style={{ fontSize: '10px', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <AlertOctagon size={10} /> {overview.criticalAlerts} CRITICAL ALERT(S)
                </span>
              ) : (
                <span style={{ fontSize: '10px', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: 'var(--color-success)', fontWeight: 700 }}>
                  TELEMETRY HEALTHY
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0.15rem 0 0 0' }}>
              Notifications & Alerts Operations
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.2rem 0 0 0' }}>
              Authoritative communications control plane, real-time system alerts lifecycle, and delivery audit telemetry.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            style={secondaryButtonStyle}
            title="Refresh current tab"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setIsCreateRuleModalOpen(true)}
            style={tactileButtonStyle}
          >
            <Plus size={13} style={{ color: 'var(--color-brand-primary)' }} />
            New Rule
          </button>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('emergency')}
              style={dangerButtonStyle}
            >
              <Radio size={13} />
              Emergency Broadcast
            </button>
          )}
        </div>
      </div>

      {/* 2. OVERVIEW KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard
          title="Total Notifications"
          value={overview?.totalNotifications?.toLocaleString() ?? 0}
          icon={<TactileIcon icon={Bell} color="speed" size="sm" />}
          accent="blue"
        />
        <MetricCard
          title="Active System Alerts"
          value={overview?.systemAlerts ?? 0}
          icon={<TactileIcon icon={AlertTriangle} color="speed" size="sm" />}
          accent={overview?.criticalAlerts ? 'red' : 'orange'}
        />
        <MetricCard
          title="Critical Alerts"
          value={overview?.criticalAlerts ?? 0}
          icon={<TactileIcon icon={AlertOctagon} color="security" size="sm" />}
          accent="red"
        />
        <MetricCard
          title="Delivery Success Rate"
          value={`${overview?.deliverySuccessRate ?? 100}%`}
          icon={<TactileIcon icon={CheckCircle} color="analytics" size="sm" />}
          accent="green"
        />
      </div>

      {/* 3. TACTILE SEGMENTED SUB-PAGE SWITCHER BAR */}
      <div
        style={{
          display: 'flex',
          backgroundColor: 'var(--color-bg-subtle)',
          padding: '4px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-subtle)',
          gap: '4px',
          overflowX: 'auto',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        {[
          { id: 'notifications', label: 'In-App Notifications', icon: Bell, count: adminNotifCounts?.unread },
          { id: 'alerts', label: 'Active Alerts', icon: AlertTriangle, count: alertMeta.total || alerts.length },
          { id: 'overview', label: 'Overview & Events', icon: Activity, count: undefined },
          { id: 'rules', label: 'Notification Rules', icon: Layers, count: rules.length },
          { id: 'analytics', label: 'Delivery Analytics', icon: Sparkles, count: undefined },
          { id: 'history', label: 'Extended History', icon: Clock, count: historyMeta.total || history.length },
          ...(isSuperAdmin ? [{ id: 'emergency', label: 'Emergency Broadcast', icon: Radio, count: undefined }] : []),
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TabKey)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 0.95rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isActive ? 'var(--color-bg-surface)' : 'transparent',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 'var(--font-size-xs)',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all var(--transition-fast)',
                boxShadow: isActive ? 'var(--shadow-tactile-sm)' : 'none',
              }}
            >
              <Icon size={14} style={{ color: isActive ? (tab.id === 'emergency' ? 'var(--color-danger)' : 'var(--color-brand-primary)') : 'inherit' }} />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '0.1rem 0.45rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: tab.id === 'alerts' && overview?.criticalAlerts ? 'rgba(239, 68, 68, 0.2)' : isActive ? 'var(--color-bg-subtle)' : 'rgba(0,0,0,0.06)',
                    color: tab.id === 'alerts' && overview?.criticalAlerts ? 'var(--color-danger)' : isActive ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
                    fontWeight: 800,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* SUBPAGE 1: IN-APP NOTIFICATIONS FEED                                      */}
      {/* ========================================================================= */}
      {activeTab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Header Controls Bar */}
          <div
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
              gap: '0.75rem',
            }}
          >
            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '0.45rem' }}>
              <button
                type="button"
                onClick={() => setAdminNotifTab('all')}
                style={{
                  ...tactileButtonStyle,
                  backgroundColor: adminNotifTab === 'all' ? 'var(--color-bg-subtle)' : 'transparent',
                  color: adminNotifTab === 'all' ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
                }}
              >
                All Notifications
                <span style={{ fontSize: '10px', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-bg-surface)' }}>
                  {adminNotifCounts?.total ?? adminNotifications.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAdminNotifTab('unread')}
                style={{
                  ...tactileButtonStyle,
                  backgroundColor: adminNotifTab === 'unread' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                  color: adminNotifTab === 'unread' ? 'var(--color-danger)' : 'var(--color-text-muted)',
                }}
              >
                Unread Only
                {(adminNotifCounts?.unread ?? adminNotifications.filter((n) => !n.isRead).length) > 0 && (
                  <span style={{ fontSize: '10px', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', fontWeight: 800 }}>
                    {adminNotifCounts?.unread ?? adminNotifications.filter((n) => !n.isRead).length}
                  </span>
                )}
              </button>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleMarkAllAdminNotificationsRead}
                disabled={adminNotifications.filter((n) => !n.isRead).length === 0}
                style={tactileButtonStyle}
              >
                <CheckCheck size={13} style={{ color: 'var(--color-success)' }} />
                Mark all read
              </button>
              <button
                type="button"
                onClick={handleClearAdminNotifications}
                disabled={adminNotifications.length === 0 || isClearingAdminNotifs}
                style={dangerButtonStyle}
              >
                <Trash2 size={13} />
                {isClearingAdminNotifs ? 'Clearing...' : 'Clear Feed'}
              </button>
            </div>
          </div>

          {/* Feed Card */}
          <Card
            elevated
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            {isLoadingAdminNotifs ? (
              <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', color: 'var(--color-brand-primary)' }} />
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>Loading notifications feed...</p>
              </div>
            ) : adminNotifications.filter((n) => adminNotifTab === 'all' || !n.isRead).length === 0 ? (
              <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Bell size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
                <p style={{ fontWeight: 800, fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)', margin: 0 }}>
                  No notifications in feed
                </p>
                <p style={{ fontSize: '11px', marginTop: '0.25rem', color: 'var(--color-text-muted)' }}>
                  {adminNotifTab === 'unread'
                    ? 'All admin operational alerts have been marked as read.'
                    : 'System notices and activity messages will appear here.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {adminNotifications
                  .filter((n) => adminNotifTab === 'all' || !n.isRead)
                  .map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '1rem 1.25rem',
                        borderBottom: '1px solid var(--color-border-subtle)',
                        backgroundColor: !item.isRead ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
                        borderLeft: !item.isRead ? '3px solid var(--color-brand-primary)' : '3px solid transparent',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '1rem',
                        transition: 'background-color var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = !item.isRead ? 'rgba(59, 130, 246, 0.04)' : 'transparent')}
                    >
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                        <div style={{ marginTop: '2px' }}>{getSeverityBadge(item.severity)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h4 style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                              {item.title}
                            </h4>
                            {!item.isRead && (
                              <span style={{ width: '6px', height: '6px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-brand-primary)' }} />
                            )}
                          </div>
                          <p style={{ margin: '0.35rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                            {item.body}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginTop: '0.5rem', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                            <span>{new Date(item.createdAt).toLocaleString()}</span>
                            {item.actionUrl && (
                              <a
                                href={item.actionUrl}
                                style={{ color: 'var(--color-brand-primary)', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}
                              >
                                View Target <ChevronRight size={11} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Single item actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                        {!item.isRead && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkSingleAdminNotificationRead(item.id, e)}
                            title="Mark as read"
                            style={tactileButtonStyle}
                          >
                            <Check size={11} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteAdminNotification(item.id, e)}
                          title="Dismiss notification"
                          style={{ ...tactileButtonStyle, color: 'var(--color-text-muted)' }}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBPAGE 2: ACTIVE SYSTEM ALERTS                                           */}
      {/* ========================================================================= */}
      {activeTab === 'alerts' && (
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
          {/* Header & Filter Toolbar */}
          <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-sm)', textTransform: 'uppercase', color: 'var(--color-text-primary)' }}>
                System Telemetry & Operational Alerts
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                Authoritative event detections across telecom providers, financial gateways, and queues.
              </p>
            </div>

            {/* Compact Filter Toolbar */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ width: '220px' }}>
                <Input
                  value={alertSearch}
                  onChange={(e) => setAlertSearch(e.target.value)}
                  placeholder="Search alert condition/source..."
                />
              </div>

              <select
                value={alertSeverityFilter}
                onChange={(e) => setAlertSeverityFilter(e.target.value)}
                style={selectStyle}
              >
                <option value="ALL">All Severities</option>
                <option value={NotificationSeverity.CRITICAL}>Critical</option>
                <option value={NotificationSeverity.SECURITY}>Security</option>
                <option value={NotificationSeverity.WARNING}>Warning</option>
                <option value={NotificationSeverity.INFO}>Info</option>
              </select>

              <select
                value={alertStatusFilter}
                onChange={(e) => setAlertStatusFilter(e.target.value)}
                style={selectStyle}
              >
                <option value="ALL">All Statuses</option>
                <option value={AlertStatus.OPEN}>Open</option>
                <option value={AlertStatus.ACKNOWLEDGED}>Acknowledged</option>
                <option value={AlertStatus.INVESTIGATING}>Investigating</option>
                <option value={AlertStatus.RESOLVED}>Resolved</option>
                <option value={AlertStatus.REOPENED}>Reopened</option>
              </select>

              <select
                value={alertSourceFilter}
                onChange={(e) => setAlertSourceFilter(e.target.value)}
                style={selectStyle}
              >
                <option value="ALL">All Sources</option>
                <option value={AlertSource.PROVIDER_HEALTH}>Provider Health</option>
                <option value={AlertSource.PAYMENT_GATEWAY}>Payment Gateway</option>
                <option value={AlertSource.QUEUE_MONITOR}>Queue Monitor</option>
                <option value={AlertSource.DLQ_MONITOR}>DLQ Monitor</option>
                <option value={AlertSource.LEDGER_INTEGRITY}>Ledger Integrity</option>
                <option value={AlertSource.AUTH_SECURITY}>Auth Security</option>
              </select>

              <button
                type="button"
                onClick={handleAcknowledgeAllAlerts}
                disabled={alerts.filter((a) => a.status === AlertStatus.OPEN || a.status === AlertStatus.DETECTED || a.status === AlertStatus.REOPENED).length === 0}
                style={tactileButtonStyle}
                title="Acknowledge All Open Alerts"
              >
                <CheckCheck size={13} style={{ color: 'var(--color-brand-primary)' }} />
                Acknowledge All
              </button>

              <button
                type="button"
                onClick={handleClearAlerts}
                disabled={alerts.filter((a) => a.status === AlertStatus.ACKNOWLEDGED || a.status === AlertStatus.INVESTIGATING).length === 0}
                style={dangerButtonStyle}
                title="Clear Investigated Alerts"
              >
                <Trash2 size={13} />
                Clear
              </button>
            </div>
          </div>

          {/* Active Filter Chips */}
          {(alertSearch.trim() || alertSeverityFilter !== 'ALL' || alertStatusFilter !== 'ALL' || alertSourceFilter !== 'ALL') && (
            <div style={{ padding: '0.45rem var(--space-5)', backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-text-muted)' }}>Active Filters:</span>
              {alertSearch.trim() && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem', fontSize: '11px', fontWeight: 600 }}>
                  Search: "{alertSearch}"
                  <button type="button" onClick={() => setAlertSearch('')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                    <X size={11} />
                  </button>
                </span>
              )}
              {alertSeverityFilter !== 'ALL' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem', fontSize: '11px', fontWeight: 600 }}>
                  Severity: {alertSeverityFilter}
                  <button type="button" onClick={() => setAlertSeverityFilter('ALL')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                    <X size={11} />
                  </button>
                </span>
              )}
              {alertStatusFilter !== 'ALL' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem', fontSize: '11px', fontWeight: 600 }}>
                  Status: {alertStatusFilter}
                  <button type="button" onClick={() => setAlertStatusFilter('ALL')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                    <X size={11} />
                  </button>
                </span>
              )}
              {alertSourceFilter !== 'ALL' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem', fontSize: '11px', fontWeight: 600 }}>
                  Source: {alertSourceFilter}
                  <button type="button" onClick={() => setAlertSourceFilter('ALL')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                    <X size={11} />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={() => { setAlertSearch(''); setAlertSeverityFilter('ALL'); setAlertStatusFilter('ALL'); setAlertSourceFilter('ALL'); }}
                style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-brand-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Severity</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Source & Trigger</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Value / Threshold</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Status</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Assigned Admin</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Last Detected</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.length > 0 ? (
                  filteredAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      onClick={() => handleInspectAlert(alert)}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        cursor: 'pointer',
                        transition: 'background-color var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '0.65rem 0.85rem' }}>{getSeverityBadge(alert.severity)}</td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <div style={{ fontWeight: 800, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>{alert.source}</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {alert.condition}
                        </div>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--color-danger)', fontWeight: 800 }}>{alert.currentValue}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}> / {alert.threshold}</span>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>{getAlertStatusBadge(alert.status)}</td>
                      <td style={{ padding: '0.65rem 0.85rem', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {alert.assignedToName ?? <span style={{ opacity: 0.5 }}>Unassigned</span>}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                        {new Date(alert.lastDetectedAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleInspectAlert(alert); }}
                          style={tactileButtonStyle}
                          title="Inspect Alert Details"
                        >
                          <Eye size={12} />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No system alerts found matching active filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* SUBPAGE 3: OVERVIEW & REAL-TIME EVENTS                                    */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
            <MetricCard
              title="Failed Deliveries"
              value={overview?.failedDeliveries ?? 0}
              accent="red"
            />
            <MetricCard
              title="Active Notification Rules"
              value={overview?.activeNotificationRules ?? 0}
              accent="violet"
            />
            <MetricCard
              title="Sent Today"
              value={overview?.sentToday ?? 0}
              accent="blue"
            />
          </div>

          {/* Recent System Events */}
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
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
                  Recent System Telemetry Events
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  Real-time event feed from backend background workers, carrier relays, and queues.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {overview?.recentSystemEvents && overview.recentSystemEvents.length > 0 ? (
                overview.recentSystemEvents.map((evt) => (
                  <div
                    key={evt.id}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {evt.severity === NotificationSeverity.CRITICAL ? (
                        <AlertOctagon size={18} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                      ) : evt.severity === NotificationSeverity.SECURITY ? (
                        <Shield size={18} style={{ color: '#A855F7', flexShrink: 0 }} />
                      ) : evt.severity === NotificationSeverity.WARNING ? (
                        <AlertTriangle size={18} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                      ) : (
                        <CheckCircle size={18} style={{ color: 'var(--color-brand-primary)', flexShrink: 0 }} />
                      )}
                      <div>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{evt.title}</p>
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '10px', color: 'var(--color-text-muted)' }}>{evt.type}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {getSeverityBadge(evt.severity)}
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                        {new Date(evt.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                  No recent system events logged.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBPAGE 4: NOTIFICATION RULES                                             */}
      {/* ========================================================================= */}
      {activeTab === 'rules' && (
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
                Event-Driven Notification Rules Engine
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                Automatic dispatch rules triggered upon platform events, thresholds, or system incidents.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateRuleModalOpen(true)}
              style={primaryButtonStyle}
            >
              <Plus size={13} /> New Rule
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {rules.length > 0 ? (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    padding: '1.15rem',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    boxShadow: 'var(--shadow-tactile-sm)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{rule.name}</h4>
                    {getSeverityBadge(rule.severity)}
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{rule.description}</p>
                  
                  <div style={{ padding: '0.65rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-subtle)', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>IF:</span> {rule.eventCondition}</div>
                    {rule.conditionValue && (
                      <div style={{ marginTop: '2px' }}><span style={{ color: 'var(--color-text-muted)' }}>VALUE:</span> {rule.conditionValue}</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border-subtle)', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    <span>Version {rule.version}</span>
                    <Badge variant={rule.isActive ? 'success' : 'neutral'}>
                      {rule.isActive ? 'ACTIVE' : 'DISABLED'}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ gridColumn: '1 / -1', padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No notification rules registered. Click "New Rule" to configure an event trigger.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* SUBPAGE 5: DELIVERY ANALYTICS                                             */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
            <MetricCard
              title="Lifetime Sent"
              value={analytics?.sent?.toLocaleString() ?? 0}
              accent="blue"
            />
            <MetricCard
              title="Delivered"
              value={analytics?.delivered?.toLocaleString() ?? 0}
              accent="green"
            />
            <MetricCard
              title="Failed Deliveries"
              value={analytics?.failed?.toLocaleString() ?? 0}
              accent="red"
            />
            <MetricCard
              title="Avg Delivery Latency"
              value={`${analytics?.avgLatencyMs ?? 0}ms`}
              accent="violet"
            />
          </div>

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
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
                Channel Performance Matrix
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                Delivery success rates and volume metrics across all active carrier channels.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              {analytics?.byChannel && analytics.byChannel.length > 0 ? (
                analytics.byChannel.map((ch) => (
                  <div
                    key={ch.channel}
                    style={{
                      padding: '1.15rem',
                      borderRadius: 'var(--radius-lg)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      boxShadow: 'var(--shadow-tactile-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{ch.channel}</span>
                      <Badge variant="success">{ch.rate}%</Badge>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div>Sent: <span style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{ch.sent}</span></div>
                      <div>Delivered: <span style={{ fontWeight: 700, color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>{ch.delivered}</span></div>
                      <div>Failed: <span style={{ fontWeight: 700, color: 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>{ch.failed}</span></div>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>No channel metrics available yet.</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBPAGE 6: EXTENDED DELIVERY HISTORY                                      */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
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
          {/* Header & Filter Toolbar */}
          <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-sm)', textTransform: 'uppercase', color: 'var(--color-text-primary)' }}>
                Extended Notification Delivery Logs
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                Historic delivery trail and carrier dispatch status.
              </p>
            </div>

            {/* Compact Filter Toolbar */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ width: '220px' }}>
                <Input
                  value={histSearch}
                  onChange={(e) => setHistSearch(e.target.value)}
                  placeholder="Search recipient name/email..."
                />
              </div>

              <select
                value={histChannel}
                onChange={(e) => setHistChannel(e.target.value)}
                style={selectStyle}
              >
                <option value="ALL">All Channels</option>
                <option value={CommunicationChannel.IN_APP}>In-App</option>
                <option value={CommunicationChannel.EMAIL}>Email</option>
                <option value={CommunicationChannel.SMS}>SMS</option>
                <option value={CommunicationChannel.PUSH}>Push</option>
              </select>

              <select
                value={histStatus}
                onChange={(e) => setHistStatus(e.target.value)}
                style={selectStyle}
              >
                <option value="ALL">All Statuses</option>
                <option value={CommunicationDeliveryStatus.DELIVERED}>Delivered</option>
                <option value={CommunicationDeliveryStatus.SENT}>Sent</option>
                <option value={CommunicationDeliveryStatus.FAILED}>Failed</option>
                <option value={CommunicationDeliveryStatus.PROCESSING}>Processing</option>
              </select>

              <button
                type="button"
                onClick={() => loadHistory()}
                style={primaryButtonStyle}
              >
                <Search size={13} /> Filter
              </button>
            </div>
          </div>

          {/* Active Filter Chips */}
          {(histSearch.trim() || histChannel !== 'ALL' || histStatus !== 'ALL') && (
            <div style={{ padding: '0.45rem var(--space-5)', backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-text-muted)' }}>Active Filters:</span>
              {histSearch.trim() && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem', fontSize: '11px', fontWeight: 600 }}>
                  Search: "{histSearch}"
                  <button type="button" onClick={() => { setHistSearch(''); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                    <X size={11} />
                  </button>
                </span>
              )}
              {histChannel !== 'ALL' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem', fontSize: '11px', fontWeight: 600 }}>
                  Channel: {histChannel}
                  <button type="button" onClick={() => { setHistChannel('ALL'); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                    <X size={11} />
                  </button>
                </span>
              )}
              {histStatus !== 'ALL' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem', fontSize: '11px', fontWeight: 600 }}>
                  Status: {histStatus}
                  <button type="button" onClick={() => { setHistStatus('ALL'); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                    <X size={11} />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={() => { setHistSearch(''); setHistChannel('ALL'); setHistStatus('ALL'); }}
                style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-brand-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Recipient</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Subject & Preview</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Channel</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Status</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Attempts</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Timestamp</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.length > 0 ? (
                  history.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => handleInspectDelivery(item.id)}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        cursor: 'pointer',
                        transition: 'background-color var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>{item.recipientName}</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{item.recipientRole}</div>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', maxWidth: '280px' }}>
                        <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.bodyPreview}</div>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--font-mono)' }}>{item.channel}</td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <Badge variant={item.status === 'DELIVERED' ? 'success' : item.status === 'FAILED' ? 'danger' : 'warning'}>
                          {item.status}
                        </Badge>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>{item.attempts}</td>
                      <td style={{ padding: '0.65rem 0.85rem', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleInspectDelivery(item.id); }}
                          style={tactileButtonStyle}
                        >
                          <Eye size={12} /> Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No delivery logs matching active filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* SUBPAGE 7: EMERGENCY BROADCAST (SUPER ADMIN ONLY)                         */}
      {/* ========================================================================= */}
      {activeTab === 'emergency' && isSuperAdmin && (
        <Card
          elevated
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-tactile-sm)',
            padding: 'var(--space-6)',
          }}
        >
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
              Emergency System-Wide Broadcast Console
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              Dispatches immediate operational and security communications with strict authorization controls.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', maxWidth: '680px' }}>
            <div style={{ padding: '0.85rem 1rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Lock size={18} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
              <div style={{ fontSize: '11px', color: 'var(--color-danger)', lineHeight: 1.4 }}>
                <strong>Super Administrator Mandatory Invariant:</strong> Emergency broadcasts bypass queue delays and are logged to the immutable tamper-evident audit ledger with CRITICAL severity.
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Subject / Headline
              </label>
              <Input
                value={emSubject}
                onChange={(e) => setEmSubject(e.target.value)}
                placeholder="e.g. Scheduled Emergency Maintenance Window"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Broadcast Body
              </label>
              <textarea
                value={emBody}
                onChange={(e) => setEmBody(e.target.value)}
                rows={5}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  background: 'var(--color-bg-base)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--font-size-sm)',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
                placeholder="Full emergency announcement text..."
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                  Severity Level
                </label>
                <Select
                  value={emSeverity}
                  onChange={(e) => setEmSeverity(e.target.value as NotificationSeverity)}
                  options={[
                    { value: NotificationSeverity.CRITICAL, label: 'Critical' },
                    { value: NotificationSeverity.SECURITY, label: 'Security Alert' },
                    { value: NotificationSeverity.WARNING, label: 'Warning' },
                    { value: NotificationSeverity.INFO, label: 'Informational' },
                  ]}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                  Target Audience
                </label>
                <Select
                  value={emAudience}
                  onChange={(e) => setEmAudience(e.target.value as CommunicationTargetType)}
                  options={[
                    { value: CommunicationTargetType.BROADCAST, label: 'System-Wide Broadcast' },
                    { value: CommunicationTargetType.ROLE, label: 'By Role' },
                    { value: CommunicationTargetType.AGENT_SEGMENT, label: 'All Agents' },
                    { value: CommunicationTargetType.CUSTOMER_SEGMENT, label: 'All Customers' },
                  ]}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Mandatory Super Admin Justification (min 10 chars)
              </label>
              <Input
                value={emJustification}
                onChange={(e) => setEmJustification(e.target.value)}
                placeholder="Operational justification for immutable audit logs..."
                required
              />
            </div>

            <button
              type="button"
              onClick={handleSendEmergency}
              disabled={isSendingEmergency}
              style={{ ...dangerButtonStyle, justifyContent: 'center', padding: '0.75rem 1.25rem', marginTop: '0.5rem' }}
            >
              <Radio size={14} />
              {isSendingEmergency ? 'Dispatching...' : 'Dispatch Emergency Broadcast'}
            </button>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 4. SLIDE-OVER ALERT DOSSIER DRAWER & BACKDROP (zIndex 250 / 260)           */}
      {/* ========================================================================= */}
      {selectedAlert && (
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
          onClick={() => setSelectedAlert(null)}
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
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                      Alert: {selectedAlert.source}
                    </h2>
                    {getSeverityBadge(selectedAlert.severity)}
                    {getAlertStatusBadge(selectedAlert.status)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Key: {selectedAlert.deduplicationKey}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedAlert.deduplicationKey, 'dedup_key')}
                      style={{ background: 'none', border: 'none', padding: '1px', cursor: 'pointer', color: copiedKey === 'dedup_key' ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                    >
                      {copiedKey === 'dedup_key' ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                style={{ background: 'transparent', border: 'none', padding: '0.4rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Sub-Tab Switcher */}
            <div style={{ display: 'flex', padding: '0 var(--space-6)', borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
              {[
                { id: 'OVERVIEW', label: 'Condition & Context' },
                { id: 'LIFECYCLE', label: 'Lifecycle Actions' },
                { id: 'TIMELINE', label: `Timeline (${alertTimeline.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAlertDrawerTab(tab.id as any)}
                  style={{
                    padding: '0.65rem 1rem',
                    background: 'none',
                    border: 'none',
                    borderBottom: alertDrawerTab === tab.id ? '2px solid var(--color-brand-primary)' : '2px solid transparent',
                    color: alertDrawerTab === tab.id ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
                    fontWeight: alertDrawerTab === tab.id ? 700 : 500,
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Drawer Body Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {alertDrawerTab === 'OVERVIEW' && (
                <>
                  {/* Values Banner */}
                  <div style={{ padding: '1.15rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Trigger Metrics & Threshold
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Current Detected Value</span>
                        <p style={{ margin: '0.15rem 0 0 0', fontWeight: 800, fontSize: 'var(--font-size-lg)', fontFamily: 'var(--font-mono)', color: 'var(--color-danger)' }}>
                          {selectedAlert.currentValue}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Safety Threshold</span>
                        <p style={{ margin: '0.15rem 0 0 0', fontWeight: 800, fontSize: 'var(--font-size-lg)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                          {selectedAlert.threshold}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Condition Details */}
                  <div style={{ padding: '1.15rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-text-muted)' }}>Condition Description</span>
                    <p style={{ margin: '0.35rem 0 0 0', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                      {selectedAlert.condition}
                    </p>
                  </div>

                  {/* Timestamps & Assignee */}
                  <div style={{ padding: '1.15rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Detection Audit Trail
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>First Detected</span>
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                          {new Date(selectedAlert.firstDetectedAt).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Last Detected</span>
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                          {new Date(selectedAlert.lastDetectedAt).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Assigned Administrator</span>
                        <p style={{ margin: '0.15rem 0 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                          {selectedAlert.assignedToName || 'Unassigned'}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {alertDrawerTab === 'LIFECYCLE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                  {/* Status Transition Action Buttons */}
                  <div style={{ padding: '1.15rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Alert Status Controls
                    </h4>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {(selectedAlert.status === AlertStatus.OPEN || selectedAlert.status === AlertStatus.REOPENED || selectedAlert.status === AlertStatus.DETECTED) && (
                        <button
                          type="button"
                          onClick={() => handleAcknowledge(selectedAlert.id)}
                          style={tactileButtonStyle}
                        >
                          <CheckCircle size={13} style={{ color: 'var(--color-warning)' }} />
                          Acknowledge Alert
                        </button>
                      )}

                      {selectedAlert.status === AlertStatus.ACKNOWLEDGED && (
                        <button
                          type="button"
                          onClick={() => handleInvestigate(selectedAlert.id)}
                          style={primaryButtonStyle}
                        >
                          <Activity size={13} />
                          Mark Investigating
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Assignee Form */}
                  <div style={{ padding: '1.15rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Assign Administrator
                    </h4>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Input
                        value={assigneeUserId}
                        onChange={(e) => setAssigneeUserId(e.target.value)}
                        placeholder="Assignee User UUID..."
                      />
                      <button
                        type="button"
                        onClick={() => handleAssign(selectedAlert.id)}
                        style={tactileButtonStyle}
                      >
                        Assign
                      </button>
                    </div>
                  </div>

                  {/* Resolution Form */}
                  {(selectedAlert.status === AlertStatus.ACKNOWLEDGED || selectedAlert.status === AlertStatus.INVESTIGATING) && (
                    <div style={{ padding: '1.15rem', backgroundColor: 'rgba(34, 197, 94, 0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-success)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-success)' }}>
                          Resolve Alert
                        </h4>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                          Resolution description is required for the immutable audit trail (min 5 chars).
                        </span>
                      </div>
                      <textarea
                        value={alertResolutionText}
                        onChange={(e) => setAlertResolutionText(e.target.value)}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '0.65rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border-subtle)',
                          background: 'var(--color-bg-surface)',
                          color: 'var(--color-text-primary)',
                          fontFamily: 'inherit',
                          fontSize: 'var(--font-size-xs)',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                        placeholder="Describe root cause and how the issue was resolved..."
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => handleResolve(selectedAlert.id)}
                          style={primaryButtonStyle}
                        >
                          <CheckCircle size={13} />
                          Confirm Resolution
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Add Timeline Note */}
                  <div style={{ padding: '1.15rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Log Investigation Note
                    </h4>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Input
                        value={alertActionNote}
                        onChange={(e) => setAlertActionNote(e.target.value)}
                        placeholder="Internal notes for audit timeline..."
                      />
                      <button
                        type="button"
                        onClick={() => handleAddNote(selectedAlert.id)}
                        style={tactileButtonStyle}
                      >
                        Add Note
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {alertDrawerTab === 'TIMELINE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {alertTimeline.length > 0 ? (
                    alertTimeline.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          border: '1px solid var(--color-border-subtle)',
                          fontSize: '11px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>{item.action}</span>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                            {new Date(item.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '10px', color: 'var(--color-text-muted)' }}>by {item.actorName}</p>
                        {item.note && (
                          <p style={{ margin: '0.35rem 0 0 0', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                            {item.note}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No events logged in timeline yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SLIDE-OVER DELIVERY DOSSIER DRAWER & BACKDROP (zIndex 250 / 260)        */}
      {/* ========================================================================= */}
      {selectedDelivery && (
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
          onClick={() => setSelectedDelivery(null)}
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
            {/* Header */}
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
                  <Send size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    Delivery Record Dossier
                  </h2>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Recipient: {selectedDelivery.recipientName}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDelivery(null)}
                style={{ background: 'transparent', border: 'none', padding: '0.4rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1.15rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-text-muted)' }}>Recipient Context</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Name</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{selectedDelivery.recipientName}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Email</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{selectedDelivery.recipientEmail}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Role</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{selectedDelivery.recipientRole}</p>
                  </div>
                </div>
              </div>

              <div style={{ padding: '1.15rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-text-muted)' }}>Message Content</span>
                <h4 style={{ margin: '0.35rem 0 0.5rem 0', fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {selectedDelivery.title}
                </h4>
                <div style={{ padding: '0.85rem', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {selectedDelivery.body}
                </div>
              </div>

              <div style={{ padding: '1.15rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-text-muted)' }}>Carrier Channel Dispatches</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {selectedDelivery.channelDeliveries.map((cd, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.65rem 0.85rem',
                        backgroundColor: 'var(--color-bg-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11px',
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{cd.channel} (Attempts: {cd.attempts})</span>
                      <Badge variant={cd.status === 'DELIVERED' ? 'success' : 'danger'}>{cd.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. CREATE RULE MODAL                                                      */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCreateRuleModalOpen}
        onClose={() => setIsCreateRuleModalOpen(false)}
        title="Register Event-Driven Notification Rule"
        maxWidth="600px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
              Rule Name
            </label>
            <Input
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="e.g. High Value Withdrawal Alert"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
              Description
            </label>
            <Input
              value={ruleDescription}
              onChange={(e) => setRuleDescription(e.target.value)}
              placeholder="Explanation of conditions and trigger intent..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Event Condition
              </label>
              <Input
                value={ruleCondition}
                onChange={(e) => setRuleCondition(e.target.value)}
                placeholder="e.g. WITHDRAWAL_SUBMITTED"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Condition Value (Optional)
              </label>
              <Input
                value={ruleValue}
                onChange={(e) => setRuleValue(e.target.value)}
                placeholder="e.g. amount >= 5000"
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
              Severity Classification
            </label>
            <Select
              value={ruleSeverity}
              onChange={(e) => setRuleSeverity(e.target.value as NotificationSeverity)}
              options={[
                { value: NotificationSeverity.INFO, label: 'Info' },
                { value: NotificationSeverity.WARNING, label: 'Warning' },
                { value: NotificationSeverity.CRITICAL, label: 'Critical' },
                { value: NotificationSeverity.SECURITY, label: 'Security Alert' },
              ]}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setIsCreateRuleModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button type="button" onClick={handleCreateRule} style={primaryButtonStyle}>
              <Plus size={13} /> Save Rule
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
