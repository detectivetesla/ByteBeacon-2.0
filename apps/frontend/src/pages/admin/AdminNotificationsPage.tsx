import React, { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
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
  NotificationType,
  AlertStatus,
  AlertSource,
  NotificationRuleStatus,
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
} from '../../api/admin.api.js';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Shield,
  CheckCircle,
  RefreshCw,
  Search,
  Filter,
  Send,
  UserCheck,
  Eye,
  Plus,
  Radio,
  Clock,
  Activity,
  Layers,
  FileText,
  Lock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

type TabKey = 'overview' | 'alerts' | 'rules' | 'analytics' | 'history' | 'emergency';

export const AdminNotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Data states
  const [overview, setOverview] = useState<AdminNotificationOverviewDto | null>(null);
  const [alerts, setAlerts] = useState<AdminSystemAlertDto[]>([]);
  const [alertMeta, setAlertMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [rules, setRules] = useState<AdminNotificationRuleDto[]>([]);
  const [analytics, setAnalytics] = useState<AdminNotificationAnalyticsDto | null>(null);
  const [history, setHistory] = useState<AdminNotificationHistoryItemDto[]>([]);
  const [historyMeta, setHistoryMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Filters for Alerts
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<string>('ALL');
  const [alertStatusFilter, setAlertStatusFilter] = useState<string>('ALL');
  const [alertSourceFilter, setAlertSourceFilter] = useState<string>('ALL');

  // Filters for History
  const [histSearch, setHistSearch] = useState<string>('');
  const [histChannel, setHistChannel] = useState<string>('ALL');
  const [histStatus, setHistStatus] = useState<string>('ALL');

  // Modal / Detail states
  const [selectedAlert, setSelectedAlert] = useState<AdminSystemAlertDto | null>(null);
  const [alertTimeline, setAlertTimeline] = useState<AdminAlertEventDto[]>([]);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);
  const [alertActionNote, setAlertActionNote] = useState<string>('');
  const [alertResolutionText, setAlertResolutionText] = useState<string>('');
  const [assigneeUserId, setAssigneeUserId] = useState<string>('');

  const [selectedDelivery, setSelectedDelivery] = useState<AdminNotificationDeliveryDetailDto | null>(null);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState<boolean>(false);

  // Rule creation modal
  const [isCreateRuleModalOpen, setIsCreateRuleModalOpen] = useState<boolean>(false);
  const [ruleName, setRuleName] = useState<string>('');
  const [ruleDescription, setRuleDescription] = useState<string>('');
  const [ruleCondition, setRuleCondition] = useState<string>('');
  const [ruleValue, setRuleValue] = useState<string>('');
  const [ruleRoles, setRuleRoles] = useState<UserRole[]>([UserRole.ADMIN]);
  const [ruleChannels, setRuleChannels] = useState<CommunicationChannel[]>([CommunicationChannel.IN_APP]);
  const [ruleSeverity, setRuleSeverity] = useState<NotificationSeverity>(NotificationSeverity.INFO);

  // Emergency broadcast form state
  const [emSubject, setEmSubject] = useState<string>('');
  const [emBody, setEmBody] = useState<string>('');
  const [emSeverity, setEmSeverity] = useState<NotificationSeverity>(NotificationSeverity.CRITICAL);
  const [emAudience, setEmAudience] = useState<CommunicationTargetType>(CommunicationTargetType.BROADCAST);
  const [emChannels, setEmChannels] = useState<CommunicationChannel[]>([CommunicationChannel.IN_APP]);
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

  // Initial load
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([loadOverview(), loadAlerts(), loadRules(), loadAnalytics(), loadHistory()]);
    setIsLoading(false);
  }, [loadOverview, loadAlerts, loadRules, loadAnalytics, loadHistory]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Refresh current tab
  const handleRefresh = () => {
    if (activeTab === 'overview') loadOverview();
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
      setIsAlertModalOpen(true);
      setAlertActionNote('');
      setAlertResolutionText('');
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
      setIsAlertModalOpen(false);
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
      setIsDeliveryModalOpen(true);
    } catch (err: any) {
      toastError('Inspect Failed', err.message);
    }
  };

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
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <TactileIcon icon={Bell} color="speed" size="lg" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Notifications & Alerts Operations
            </h1>
            <p className="text-sm text-gray-400">
              System communications control plane, operational alert lifecycle, and delivery tracking.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="flex items-center gap-2"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          {isSuperAdmin && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setActiveTab('emergency')}
              className="flex items-center gap-2"
            >
              <Radio size={14} />
              Emergency Broadcast
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-800 space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Activity size={16} /> Overview
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'alerts'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <AlertTriangle size={16} /> Active Alerts
          {overview?.criticalAlerts ? (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full font-semibold">
              {overview.criticalAlerts}
            </span>
          ) : null}
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'rules'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Layers size={16} /> Notification Rules
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'analytics'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Sparkles size={16} /> Delivery Analytics
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Clock size={16} /> Extended History
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('emergency')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'emergency'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Radio size={16} /> Emergency Broadcast
          </button>
        )}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Total Notifications"
              value={overview?.totalNotifications ?? 0}
              icon={<TactileIcon icon={Bell} color="orders" size="sm" />}
              accent="blue"
            />
            <MetricCard
              label="Active System Alerts"
              value={overview?.systemAlerts ?? 0}
              icon={<TactileIcon icon={AlertTriangle} color="speed" size="sm" />}
              accent={overview?.criticalAlerts ? 'red' : 'orange'}
            />
            <MetricCard
              label="Critical Alerts"
              value={overview?.criticalAlerts ?? 0}
              icon={<TactileIcon icon={AlertOctagon} color="security" size="sm" />}
              accent="red"
            />
            <MetricCard
              label="Delivery Success Rate"
              value={`${overview?.deliverySuccessRate ?? 100}%`}
              icon={<TactileIcon icon={CheckCircle} color="analytics" size="sm" />}
              accent="green"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              label="Failed Deliveries"
              value={overview?.failedDeliveries ?? 0}
              accent="red"
            />
            <MetricCard
              label="Active Notification Rules"
              value={overview?.activeNotificationRules ?? 0}
              accent="violet"
            />
            <MetricCard
              label="Sent Today"
              value={overview?.sentToday ?? 0}
              accent="blue"
            />
          </div>

          {/* Recent System Events */}
          <Card title="Recent System Events" subtitle="Real-time event feed from background workers and services">
            <div className="divide-y divide-gray-800">
              {overview?.recentSystemEvents && overview.recentSystemEvents.length > 0 ? (
                overview.recentSystemEvents.map((evt) => (
                  <div key={evt.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {evt.severity === NotificationSeverity.CRITICAL ? (
                        <AlertOctagon size={18} className="text-red-500 shrink-0" />
                      ) : evt.severity === NotificationSeverity.SECURITY ? (
                        <Shield size={18} className="text-purple-500 shrink-0" />
                      ) : evt.severity === NotificationSeverity.WARNING ? (
                        <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                      ) : (
                        <CheckCircle size={18} className="text-blue-500 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-white">{evt.title}</p>
                        <p className="text-xs text-gray-500">{evt.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {getSeverityBadge(evt.severity)}
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(evt.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-gray-500 text-sm">
                  No recent system events logged.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: ACTIVE ALERTS */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="Severity"
                value={alertSeverityFilter}
                onChange={(e) => setAlertSeverityFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Severities' },
                  { value: NotificationSeverity.CRITICAL, label: 'Critical' },
                  { value: NotificationSeverity.SECURITY, label: 'Security' },
                  { value: NotificationSeverity.WARNING, label: 'Warning' },
                  { value: NotificationSeverity.INFO, label: 'Info' },
                ]}
              />
              <Select
                label="Status"
                value={alertStatusFilter}
                onChange={(e) => setAlertStatusFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: AlertStatus.OPEN, label: 'Open' },
                  { value: AlertStatus.ACKNOWLEDGED, label: 'Acknowledged' },
                  { value: AlertStatus.INVESTIGATING, label: 'Investigating' },
                  { value: AlertStatus.RESOLVED, label: 'Resolved' },
                  { value: AlertStatus.REOPENED, label: 'Reopened' },
                ]}
              />
              <Select
                label="Source"
                value={alertSourceFilter}
                onChange={(e) => setAlertSourceFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Sources' },
                  { value: AlertSource.PROVIDER_HEALTH, label: 'Provider Health' },
                  { value: AlertSource.PAYMENT_GATEWAY, label: 'Payment Gateway' },
                  { value: AlertSource.QUEUE_MONITOR, label: 'Queue Monitor' },
                  { value: AlertSource.DLQ_MONITOR, label: 'DLQ Monitor' },
                  { value: AlertSource.LEDGER_INTEGRITY, label: 'Ledger Integrity' },
                  { value: AlertSource.AUTH_SECURITY, label: 'Auth Security' },
                ]}
              />
            </div>
          </Card>

          {/* Alerts Table */}
          <Card title="System Alerts" subtitle={`${alerts.length} alerts loaded`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-gray-800/60 text-xs text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Severity</th>
                    <th className="p-3">Source / Condition</th>
                    <th className="p-3">Value / Threshold</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Assigned To</th>
                    <th className="p-3">Last Detected</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {alerts.length > 0 ? (
                    alerts.map((alert) => (
                      <tr key={alert.id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="p-3">{getSeverityBadge(alert.severity)}</td>
                        <td className="p-3">
                          <p className="font-semibold text-white">{alert.source}</p>
                          <p className="text-xs text-gray-400 line-clamp-1">{alert.condition}</p>
                        </td>
                        <td className="p-3 text-xs">
                          <span className="text-red-400 font-mono">{alert.currentValue}</span>
                          <span className="text-gray-500"> / {alert.threshold}</span>
                        </td>
                        <td className="p-3">{getAlertStatusBadge(alert.status)}</td>
                        <td className="p-3 text-xs text-gray-400">
                          {alert.assignedToName ?? <span className="text-gray-600">Unassigned</span>}
                        </td>
                        <td className="p-3 text-xs text-gray-500">
                          {new Date(alert.lastDetectedAt).toLocaleString()}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleInspectAlert(alert)}
                            className="flex items-center gap-1 ml-auto"
                          >
                            <Eye size={12} /> Inspect
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500">
                        No system alerts matching filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: NOTIFICATION RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Event-Driven Notification Rules</h2>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateRuleModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus size={14} /> New Rule
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rules.length > 0 ? (
              rules.map((rule) => (
                <Card key={rule.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white text-base">{rule.name}</h3>
                    {getSeverityBadge(rule.severity)}
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2">{rule.description}</p>
                  <div className="bg-gray-950 p-2.5 rounded-lg text-xs space-y-1 font-mono text-gray-300">
                    <div><span className="text-gray-500">IF:</span> {rule.eventCondition}</div>
                    {rule.conditionValue && (
                      <div><span className="text-gray-500">VALUE:</span> {rule.conditionValue}</div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800">
                    <span>v{rule.version}</span>
                    <Badge variant={rule.isActive ? 'success' : 'neutral'}>
                      {rule.isActive ? 'ACTIVE' : 'DISABLED'}
                    </Badge>
                  </div>
                </Card>
              ))
            ) : (
              <div className="col-span-full p-8 text-center text-gray-500 border border-gray-800 rounded-xl">
                No notification rules registered.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DELIVERY ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Lifetime Sent"
              value={analytics?.sent ?? 0}
              accent="blue"
            />
            <MetricCard
              label="Delivered"
              value={analytics?.delivered ?? 0}
              accent="green"
            />
            <MetricCard
              label="Failed Deliveries"
              value={analytics?.failed ?? 0}
              accent="red"
            />
            <MetricCard
              label="Avg Delivery Latency"
              value={`${analytics?.avgLatencyMs ?? 0}ms`}
              accent="violet"
            />
          </div>

          <Card title="Channel Performance Matrix" subtitle="Delivery rates across active delivery channels">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {analytics?.byChannel && analytics.byChannel.length > 0 ? (
                analytics.byChannel.map((ch) => (
                  <div key={ch.channel} className="p-4 bg-gray-950 rounded-xl border border-gray-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{ch.channel}</span>
                      <Badge variant="success">{ch.rate}%</Badge>
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <div>Sent: <span className="text-white font-mono">{ch.sent}</span></div>
                      <div>Delivered: <span className="text-green-400 font-mono">{ch.delivered}</span></div>
                      <div>Failed: <span className="text-red-400 font-mono">{ch.failed}</span></div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No channel metrics available yet.</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 5: EXTENDED HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Search Recipient"
                value={histSearch}
                onChange={(e) => setHistSearch(e.target.value)}
                placeholder="Search by name or email..."
              />
              <Select
                label="Channel"
                value={histChannel}
                onChange={(e) => setHistChannel(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Channels' },
                  { value: CommunicationChannel.IN_APP, label: 'In-App' },
                  { value: CommunicationChannel.EMAIL, label: 'Email' },
                  { value: CommunicationChannel.SMS, label: 'SMS' },
                  { value: CommunicationChannel.PUSH, label: 'Push' },
                ]}
              />
              <Select
                label="Status"
                value={histStatus}
                onChange={(e) => setHistStatus(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: CommunicationDeliveryStatus.DELIVERED, label: 'Delivered' },
                  { value: CommunicationDeliveryStatus.SENT, label: 'Sent' },
                  { value: CommunicationDeliveryStatus.FAILED, label: 'Failed' },
                  { value: CommunicationDeliveryStatus.PROCESSING, label: 'Processing' },
                ]}
              />
            </div>
          </Card>

          <Card title="Notification Delivery Logs" subtitle={`${history.length} records loaded`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-gray-800/60 text-xs text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Subject / Title</th>
                    <th className="p-3">Channel</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Attempts</th>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {history.length > 0 ? (
                    history.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="p-3">
                          <p className="font-semibold text-white">{item.recipientName}</p>
                          <p className="text-xs text-gray-500">{item.recipientRole}</p>
                        </td>
                        <td className="p-3">
                          <p className="font-medium text-white line-clamp-1">{item.title}</p>
                          <p className="text-xs text-gray-400 line-clamp-1">{item.bodyPreview}</p>
                        </td>
                        <td className="p-3 text-xs font-mono">{item.channel}</td>
                        <td className="p-3">
                          <Badge variant={item.status === 'DELIVERED' ? 'success' : item.status === 'FAILED' ? 'danger' : 'warning'}>
                            {item.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs font-mono">{item.attempts}</td>
                        <td className="p-3 text-xs text-gray-500">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleInspectDelivery(item.id)}
                            className="flex items-center gap-1 ml-auto"
                          >
                            <Eye size={12} /> Inspect
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500">
                        No delivery logs matching filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 6: EMERGENCY BROADCAST (SUPER ADMIN ONLY) */}
      {activeTab === 'emergency' && isSuperAdmin && (
        <Card title="Emergency System Broadcast" subtitle="Broadcast system-wide communications with strict authorization controls">
          <div className="space-y-4 max-w-2xl">
            <div className="bg-red-950/30 border border-red-800 p-4 rounded-xl text-xs text-red-300 flex items-start gap-3">
              <Lock size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Super Administrator Mandatory Control:</span> Emergency broadcasts are logged to the immutable tamper-evident audit ledger with CRITICAL severity.
              </div>
            </div>

            <Input
              label="Subject / Title"
              value={emSubject}
              onChange={(e) => setEmSubject(e.target.value)}
              placeholder="e.g. Scheduled Emergency Maintenance Window"
            />

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Broadcast Body</label>
              <textarea
                value={emBody}
                onChange={(e) => setEmBody(e.target.value)}
                rows={4}
                placeholder="Full announcement message..."
                className="w-full rounded-lg bg-gray-900 border border-gray-800 p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Severity"
                value={emSeverity}
                onChange={(e) => setEmSeverity(e.target.value as NotificationSeverity)}
                options={[
                  { value: NotificationSeverity.CRITICAL, label: 'Critical' },
                  { value: NotificationSeverity.SECURITY, label: 'Security Alert' },
                  { value: NotificationSeverity.WARNING, label: 'Warning' },
                  { value: NotificationSeverity.INFO, label: 'Informational' },
                ]}
              />
              <Select
                label="Target Audience"
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

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Mandatory Super Admin Justification Reason (min 10 chars)
              </label>
              <Input
                value={emJustification}
                onChange={(e) => setEmJustification(e.target.value)}
                placeholder="Operational justification for audit logs..."
              />
            </div>

            <Button
              variant="danger"
              size="md"
              onClick={handleSendEmergency}
              disabled={isSendingEmergency}
              className="w-full flex items-center justify-center gap-2"
            >
              <Radio size={16} />
              {isSendingEmergency ? 'Dispatching...' : 'Dispatch Emergency Broadcast'}
            </Button>
          </div>
        </Card>
      )}

      {/* INSPECT ALERT MODAL */}
      <Modal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        title={`Alert: ${selectedAlert?.source ?? ''}`}
      >
        {selectedAlert && (
          <div className="space-y-4 text-sm text-gray-300 max-h-[75vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              {getSeverityBadge(selectedAlert.severity)}
              {getAlertStatusBadge(selectedAlert.status)}
            </div>

            <div className="bg-gray-950 p-3 rounded-lg space-y-1.5 text-xs">
              <div><span className="text-gray-500">Condition:</span> <span className="text-white">{selectedAlert.condition}</span></div>
              <div><span className="text-gray-500">Current Value:</span> <span className="text-red-400 font-mono">{selectedAlert.currentValue}</span></div>
              <div><span className="text-gray-500">Threshold:</span> <span className="text-gray-300 font-mono">{selectedAlert.threshold}</span></div>
              <div><span className="text-gray-500">Deduplication Key:</span> <span className="text-gray-400 font-mono">{selectedAlert.deduplicationKey}</span></div>
              <div><span className="text-gray-500">First Detected:</span> {new Date(selectedAlert.firstDetectedAt).toLocaleString()}</div>
              <div><span className="text-gray-500">Last Detected:</span> {new Date(selectedAlert.lastDetectedAt).toLocaleString()}</div>
            </div>

            {/* Lifecycle Action Buttons */}
            <div className="border-t border-gray-800 pt-3 space-y-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Lifecycle Actions</h4>

              <div className="flex flex-wrap gap-2">
                {(selectedAlert.status === AlertStatus.OPEN || selectedAlert.status === AlertStatus.REOPENED || selectedAlert.status === AlertStatus.DETECTED) && (
                  <Button size="sm" variant="warning" onClick={() => handleAcknowledge(selectedAlert.id)}>
                    Acknowledge Alert
                  </Button>
                )}

                {selectedAlert.status === AlertStatus.ACKNOWLEDGED && (
                  <Button size="sm" variant="primary" onClick={() => handleInvestigate(selectedAlert.id)}>
                    Mark Investigating
                  </Button>
                )}
              </div>

              {/* Assignment Form */}
              <div className="flex gap-2 items-center">
                <Input
                  value={assigneeUserId}
                  onChange={(e) => setAssigneeUserId(e.target.value)}
                  placeholder="Assignee User UUID..."
                  className="text-xs"
                />
                <Button size="sm" variant="outline" onClick={() => handleAssign(selectedAlert.id)}>
                  Assign
                </Button>
              </div>

              {/* Resolution Form */}
              {(selectedAlert.status === AlertStatus.ACKNOWLEDGED || selectedAlert.status === AlertStatus.INVESTIGATING) && (
                <div className="space-y-2 bg-gray-950 p-3 rounded-lg border border-gray-800">
                  <label className="text-xs font-medium text-gray-400">Resolution Description (Required to Resolve)</label>
                  <textarea
                    value={alertResolutionText}
                    onChange={(e) => setAlertResolutionText(e.target.value)}
                    rows={2}
                    placeholder="Describe how the underlying issue was resolved..."
                    className="w-full rounded bg-gray-900 border border-gray-800 p-2 text-xs text-white focus:outline-none focus:border-green-500"
                  />
                  <Button size="sm" variant="success" onClick={() => handleResolve(selectedAlert.id)}>
                    Resolve Alert
                  </Button>
                </div>
              )}

              {/* Add Note */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400">Add Timeline Note</label>
                <div className="flex gap-2">
                  <Input
                    value={alertActionNote}
                    onChange={(e) => setAlertActionNote(e.target.value)}
                    placeholder="Internal investigation notes..."
                    className="text-xs"
                  />
                  <Button size="sm" variant="outline" onClick={() => handleAddNote(selectedAlert.id)}>
                    Add Note
                  </Button>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="border-t border-gray-800 pt-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Event Timeline</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {alertTimeline.map((item) => (
                  <div key={item.id} className="p-2.5 bg-gray-950 rounded border border-gray-800 text-xs">
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="font-semibold text-white">{item.action}</span>
                      <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-gray-500 mt-0.5">by {item.actorName}</p>
                    {item.note && <p className="text-gray-300 mt-1">{item.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* CREATE RULE MODAL */}
      <Modal
        isOpen={isCreateRuleModalOpen}
        onClose={() => setIsCreateRuleModalOpen(false)}
        title="Register Notification Rule"
      >
        <div className="space-y-4">
          <Input
            label="Rule Name"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="e.g. Notify On High Value Withdrawal"
          />
          <Input
            label="Description"
            value={ruleDescription}
            onChange={(e) => setRuleDescription(e.target.value)}
            placeholder="Short explanation of when this fires..."
          />
          <Input
            label="Event Condition"
            value={ruleCondition}
            onChange={(e) => setRuleCondition(e.target.value)}
            placeholder="e.g. WITHDRAWAL_SUBMITTED"
          />
          <Input
            label="Condition Value (Optional)"
            value={ruleValue}
            onChange={(e) => setRuleValue(e.target.value)}
            placeholder="e.g. amount >= 5000"
          />
          <Select
            label="Severity"
            value={ruleSeverity}
            onChange={(e) => setRuleSeverity(e.target.value as NotificationSeverity)}
            options={[
              { value: NotificationSeverity.INFO, label: 'Info' },
              { value: NotificationSeverity.WARNING, label: 'Warning' },
              { value: NotificationSeverity.CRITICAL, label: 'Critical' },
              { value: NotificationSeverity.SECURITY, label: 'Security' },
            ]}
          />
          <Button variant="primary" size="md" onClick={handleCreateRule} className="w-full">
            Save Rule
          </Button>
        </div>
      </Modal>

      {/* INSPECT DELIVERY DETAIL MODAL */}
      <Modal
        isOpen={isDeliveryModalOpen}
        onClose={() => setIsDeliveryModalOpen(false)}
        title="Delivery Record Inspection"
      >
        {selectedDelivery && (
          <div className="space-y-3 text-sm text-gray-300">
            <div className="bg-gray-950 p-3 rounded-lg space-y-1 text-xs">
              <div><span className="text-gray-500">Recipient:</span> <span className="text-white">{selectedDelivery.recipientName}</span> ({selectedDelivery.recipientEmail})</div>
              <div><span className="text-gray-500">Role:</span> {selectedDelivery.recipientRole}</div>
              <div><span className="text-gray-500">Subject:</span> <span className="text-white font-medium">{selectedDelivery.title}</span></div>
            </div>
            <div>
              <h5 className="text-xs font-semibold text-gray-400 mb-1">Message Body</h5>
              <div className="p-3 bg-gray-950 rounded border border-gray-800 text-xs whitespace-pre-wrap font-mono">
                {selectedDelivery.body}
              </div>
            </div>
            <div>
              <h5 className="text-xs font-semibold text-gray-400 mb-1">Channel Attempts</h5>
              <div className="space-y-1.5">
                {selectedDelivery.channelDeliveries.map((cd, idx) => (
                  <div key={idx} className="p-2 bg-gray-950 rounded border border-gray-800 flex items-center justify-between text-xs">
                    <span>{cd.channel} (Attempts: {cd.attempts})</span>
                    <Badge variant={cd.status === 'DELIVERED' ? 'success' : 'danger'}>{cd.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
