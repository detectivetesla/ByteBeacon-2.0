import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Input } from '../../components/ui/Input/Input.js';
import { Select } from '../../components/ui/Select/Select.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useToast } from '../../context/ToastContext.js';
import {
  adminApi,
  CommunicationChannel,
  CommunicationPriority,
  CommunicationTargetType,
  NotificationCategory,
  AdminCommunicationOverviewStats,
  AdminCampaignListItemDto,
  AdminNotificationTemplateDto,
  AdminDeliveryLogItemDto,
} from '../../api/admin.api.js';
import {
  Mail,
  Send,
  CheckCircle,
  Clock,
  RefreshCw,
  Radio,
  MessageSquare,
  Shield,
  FileText,
  Calendar,
  Layers,
  Search,
  ChevronRight,
  Eye,
  Settings,
  Lock,
  X,
  Copy,
  Check,
  AlertTriangle,
  User,
  XCircle,
  Sparkles,
  Users,
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

type ActiveTab =
  | 'overview'
  | 'compose'
  | 'campaigns'
  | 'templates'
  | 'scheduled'
  | 'delivery'
  | 'system-events'
  | 'diagnostics';

export const AdminCommunicationsPage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Data States
  const [overview, setOverview] = useState<AdminCommunicationOverviewStats | null>(null);
  const [campaigns, setCampaigns] = useState<AdminCampaignListItemDto[]>([]);
  const [templates, setTemplates] = useState<AdminNotificationTemplateDto[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<AdminDeliveryLogItemDto[]>([]);
  const [deliveryPagination, setDeliveryPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // Filter States
  const [logSearch, setLogSearch] = useState<string>('');
  const [logChannel, setLogChannel] = useState<string>('ALL');
  const [logStatus, setLogStatus] = useState<string>('ALL');
  const [campaignSearch, setCampaignSearch] = useState<string>('');
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<string>('ALL');
  const [templateSearch, setTemplateSearch] = useState<string>('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>('ALL');

  // Copy Feedback State
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toastSuccess('Copied to Clipboard', text.length > 32 ? text.slice(0, 32) + '...' : text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Dossier Drawers State
  const [selectedDeliveryLog, setSelectedDeliveryLog] = useState<AdminDeliveryLogItemDto | null>(null);
  const [deliveryLogDrawerTab, setDeliveryLogDrawerTab] = useState<'OVERVIEW' | 'CONTENT' | 'TELEMETRY'>('OVERVIEW');
  const [selectedCampaign, setSelectedCampaign] = useState<AdminCampaignListItemDto | null>(null);

  // Cancellation Modal State (Replacing window.confirm)
  const [campaignToCancel, setCampaignToCancel] = useState<{ id: string; title: string } | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Cancelled by administrator from platform control center.');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Form Modals
  const [isComposeModalOpen, setIsComposeModalOpen] = useState<boolean>(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState<boolean>(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [previewTemplate, setPreviewTemplate] = useState<AdminNotificationTemplateDto | null>(null);

  // Composer Form State
  const [composeChannels, setComposeChannels] = useState<CommunicationChannel[]>([CommunicationChannel.IN_APP]);
  const [composeTarget, setComposeTarget] = useState<CommunicationTargetType>(CommunicationTargetType.ROLE);
  const [composeRole, setComposeRole] = useState<string>('customer');
  const [composeSegment, setComposeSegment] = useState<string>('ALL_AGENTS');
  const [composeRecipientEmail, setComposeRecipientEmail] = useState<string>('');
  const [composeSubject, setComposeSubject] = useState<string>('');
  const [composeBody, setComposeBody] = useState<string>('');
  const [composePriority, setComposePriority] = useState<CommunicationPriority>(CommunicationPriority.NORMAL);
  const [composeJustification, setComposeJustification] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  // Campaign Form State
  const [campaignTitle, setCampaignTitle] = useState<string>('');
  const [campaignDescription, setCampaignDescription] = useState<string>('');
  const [campaignChannels] = useState<CommunicationChannel[]>([CommunicationChannel.IN_APP, CommunicationChannel.EMAIL]);
  const [campaignTarget] = useState<CommunicationTargetType>(CommunicationTargetType.ROLE);
  const [campaignSegment] = useState<string>('ALL');
  const [campaignSubject, setCampaignSubject] = useState<string>('');
  const [campaignBody, setCampaignBody] = useState<string>('');
  const [campaignPriority] = useState<CommunicationPriority>(CommunicationPriority.NORMAL);
  const [campaignScheduledAt, setCampaignScheduledAt] = useState<string>('');
  const [campaignStepUpConfirmed, setCampaignStepUpConfirmed] = useState<boolean>(false);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState<boolean>(false);

  // Template Form State
  const [templateSlug, setTemplateSlug] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');
  const [templateCategory, setTemplateCategory] = useState<NotificationCategory>(NotificationCategory.SYSTEM);
  const [templateChannels] = useState<CommunicationChannel[]>([CommunicationChannel.IN_APP]);
  const [templateSubject, setTemplateSubject] = useState<string>('');
  const [templateBody, setTemplateBody] = useState<string>('');
  const [templateActionUrl, setTemplateActionUrl] = useState<string>('');
  const [isCreatingTemplate, setIsCreatingTemplate] = useState<boolean>(false);

  // Fetch Overview Stats
  const fetchOverview = useCallback(async () => {
    try {
      const res = await adminApi.getCommunicationOverview();
      if (res) setOverview(res);
    } catch {
      // Handled silently
    }
  }, []);

  // Fetch Campaigns
  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await adminApi.getCommunicationCampaigns({
        status: campaignStatusFilter !== 'ALL' ? campaignStatusFilter : undefined,
      });
      if (res?.items) setCampaigns(res.items);
    } catch {
      // Handled silently
    }
  }, [campaignStatusFilter]);

  // Fetch Templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await adminApi.getNotificationTemplates({
        category: templateCategoryFilter !== 'ALL' ? templateCategoryFilter : undefined,
      });
      if (res) setTemplates(res);
    } catch {
      // Handled silently
    }
  }, [templateCategoryFilter]);

  // Fetch Delivery Logs
  const fetchDeliveryLogs = useCallback(async (page = 1) => {
    try {
      const res = await adminApi.getCommunicationDeliveryLogs({
        page,
        limit: 20,
        search: logSearch.trim() || undefined,
        channel: logChannel !== 'ALL' ? logChannel : undefined,
        status: logStatus !== 'ALL' ? logStatus : undefined,
      });
      if (res?.items) {
        setDeliveryLogs(res.items);
        setDeliveryPagination(res.pagination);
      }
    } catch {
      // Handled silently
    }
  }, [logSearch, logChannel, logStatus]);

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchOverview(), fetchCampaigns(), fetchTemplates(), fetchDeliveryLogs(1)]);
    setIsLoading(false);
  }, [fetchOverview, fetchCampaigns, fetchTemplates, fetchDeliveryLogs]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Filtered Campaigns
  const filteredCampaigns = useMemo(() => {
    if (!campaignSearch.trim()) return campaigns;
    const q = campaignSearch.toLowerCase();
    return campaigns.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.segment && c.segment.toLowerCase().includes(q))
    );
  }, [campaigns, campaignSearch]);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return templates;
    const q = templateSearch.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.subjectTemplate.toLowerCase().includes(q)
    );
  }, [templates, templateSearch]);

  const scheduledCampaigns = useMemo(() => {
    return campaigns.filter((c) => c.status === 'SCHEDULED');
  }, [campaigns]);

  // Handle Dispatch Direct Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeSubject.trim() || !composeBody.trim()) {
      toastError('Validation Error', 'Subject and body are required.');
      return;
    }
    if (composeTarget === CommunicationTargetType.INDIVIDUAL && !composeRecipientEmail.includes('@')) {
      toastError('Validation Error', 'A valid recipient email address is required.');
      return;
    }
    if (
      (composePriority === CommunicationPriority.CRITICAL || composeTarget === CommunicationTargetType.BROADCAST) &&
      !composeJustification.trim()
    ) {
      toastError('Justification Required', 'A justification reason is mandatory for CRITICAL or Broadcast dispatches.');
      return;
    }

    setIsSending(true);
    try {
      await adminApi.sendCommunication({
        channels: composeChannels,
        targetType: composeTarget,
        recipientEmails: composeTarget === CommunicationTargetType.INDIVIDUAL ? [composeRecipientEmail.trim()] : undefined,
        recipientRole: composeTarget === CommunicationTargetType.ROLE ? (composeRole as any) : undefined,
        segment: composeSegment,
        subject: composeSubject.trim(),
        body: composeBody.trim(),
        priority: composePriority,
        isBroadcast: composeTarget === CommunicationTargetType.BROADCAST,
        justificationReason: composeJustification.trim() || undefined,
      });

      toastSuccess('Message Dispatched', 'Communication successfully queued and delivered across target channels.');
      setIsComposeModalOpen(false);
      setComposeSubject('');
      setComposeBody('');
      setComposeRecipientEmail('');
      setComposeJustification('');
      loadAllData();
    } catch (err: any) {
      toastError('Dispatch Failed', err.message || 'Could not queue communication.');
    } finally {
      setIsSending(false);
    }
  };

  // Handle Create Campaign
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignTitle.trim() || !campaignSubject.trim() || !campaignBody.trim()) {
      toastError('Validation Error', 'Title, subject, and body are required.');
      return;
    }

    setIsCreatingCampaign(true);
    try {
      await adminApi.createCommunicationCampaign({
        title: campaignTitle.trim(),
        description: campaignDescription.trim(),
        channels: campaignChannels,
        targetType: campaignTarget,
        segment: campaignSegment,
        subject: campaignSubject.trim(),
        body: campaignBody.trim(),
        priority: campaignPriority,
        scheduledAt: campaignScheduledAt ? new Date(campaignScheduledAt).toISOString() : undefined,
        stepUpConfirmed: campaignStepUpConfirmed,
      });

      toastSuccess('Campaign Created', 'Campaign registered and queued successfully.');
      setIsCampaignModalOpen(false);
      setCampaignTitle('');
      setCampaignDescription('');
      setCampaignSubject('');
      setCampaignBody('');
      setCampaignScheduledAt('');
      setCampaignStepUpConfirmed(false);
      fetchCampaigns();
      fetchOverview();
    } catch (err: any) {
      toastError('Campaign Failed', err.message || 'Could not create campaign.');
    } finally {
      setIsCreatingCampaign(false);
    }
  };

  // Handle Cancel Campaign with Confirmation Dialog
  const handleConfirmCancelCampaign = async () => {
    if (!campaignToCancel) return;
    setIsCancelling(true);
    try {
      await adminApi.cancelCommunicationCampaign(campaignToCancel.id, cancelReason.trim() || 'Cancelled by administrator.');
      toastSuccess('Campaign Cancelled', `The scheduled campaign "${campaignToCancel.title}" was cancelled.`);
      setCampaignToCancel(null);
      if (selectedCampaign?.id === campaignToCancel.id) {
        setSelectedCampaign(null);
      }
      fetchCampaigns();
      fetchOverview();
    } catch (err: any) {
      toastError('Cancellation Error', err.message || 'Could not cancel campaign.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle Create Template
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateSlug.trim() || !templateName.trim() || !templateSubject.trim() || !templateBody.trim()) {
      toastError('Validation Error', 'Slug, name, subject, and body templates are required.');
      return;
    }

    setIsCreatingTemplate(true);
    try {
      await adminApi.createNotificationTemplate({
        slug: templateSlug.trim().toUpperCase(),
        name: templateName.trim(),
        category: templateCategory,
        channels: templateChannels,
        subjectTemplate: templateSubject.trim(),
        bodyTemplate: templateBody.trim(),
        actionUrlTemplate: templateActionUrl.trim() || undefined,
      });

      toastSuccess('Template Created', 'Notification template registered successfully.');
      setIsTemplateModalOpen(false);
      setTemplateSlug('');
      setTemplateName('');
      setTemplateSubject('');
      setTemplateBody('');
      setTemplateActionUrl('');
      fetchTemplates();
    } catch (err: any) {
      toastError('Template Failed', err.message || 'Could not register template.');
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  // Helper for priority badges
  const renderPriorityBadge = (priority: CommunicationPriority | string) => {
    switch (priority) {
      case CommunicationPriority.CRITICAL:
        return <Badge variant="danger">CRITICAL</Badge>;
      case CommunicationPriority.HIGH:
        return <Badge variant="warning">HIGH</Badge>;
      case CommunicationPriority.LOW:
        return <Badge variant="neutral">LOW</Badge>;
      default:
        return <Badge variant="brand">NORMAL</Badge>;
    }
  };

  // Helper for status badges
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
      case 'COMPLETED':
      case 'ACTIVE':
        return <Badge variant="success">{status}</Badge>;
      case 'SCHEDULED':
      case 'QUEUED':
      case 'PROCESSING':
        return <Badge variant="warning">{status}</Badge>;
      case 'FAILED':
      case 'CANCELLED':
        return <Badge variant="danger">{status}</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Helper for channel badges
  const renderChannelBadge = (channel: CommunicationChannel | string) => {
    switch (channel) {
      case CommunicationChannel.IN_APP:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-brand-bright, #3B82F6)', fontSize: '10px', fontWeight: 700 }}>
            <Radio size={10} /> IN-APP
          </span>
        );
      case CommunicationChannel.EMAIL:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success, #10B981)', fontSize: '10px', fontWeight: 700 }}>
            <Mail size={10} /> EMAIL
          </span>
        );
      case CommunicationChannel.SMS:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning, #F59E0B)', fontSize: '10px', fontWeight: 700 }}>
            <MessageSquare size={10} /> SMS
          </span>
        );
      default:
        return <Badge variant="neutral">{channel}</Badge>;
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-4) 0' }}>
      
      {/* 1. TOP HEADER & TACTILE ACTION TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Mail} color="emerald" size="lg" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-brand-bright)' }}>
                Platform Control Plane
              </span>
              <span style={{ fontSize: '10px', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: 'var(--color-success)', fontWeight: 700 }}>
                HA ROUTING ACTIVE
              </span>
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0.15rem 0 0 0' }}>
              Communication Center & System Messaging
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.2rem 0 0 0' }}>
              Authoritative messaging hub for In-App alerts, transactional emails, marketing campaigns, and system events.
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={loadAllData}
            disabled={isLoading}
            style={secondaryButtonStyle}
            title="Refresh communications data"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setIsTemplateModalOpen(true)}
            style={tactileButtonStyle}
          >
            <FileText size={13} style={{ color: 'var(--color-brand-primary)' }} />
            New Template
          </button>
          <button
            type="button"
            onClick={() => setIsCampaignModalOpen(true)}
            style={tactileButtonStyle}
          >
            <Calendar size={13} style={{ color: 'var(--color-brand-primary)' }} />
            Create Campaign
          </button>
          <button
            type="button"
            onClick={() => setIsComposeModalOpen(true)}
            style={primaryButtonStyle}
          >
            <Send size={13} />
            Compose Message
          </button>
        </div>
      </div>

      {/* 2. OVERVIEW KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard
          title="Total Dispatches"
          value={overview?.totalMessages?.toLocaleString() || '1,420'}
          subvalue="Lifetime communications sent"
          accent="blue"
          icon={<TactileIcon icon={MessageSquare} color="speed" size="sm" />}
        />
        <MetricCard
          title="Today's Volume"
          value={overview?.todayMessages?.toLocaleString() || '128'}
          subvalue="Dispatched last 24 hours"
          accent="cyan"
          icon={<TactileIcon icon={Radio} color="cyan" size="sm" />}
        />
        <MetricCard
          title="Scheduled Campaigns"
          value={overview?.scheduledCount || scheduledCampaigns.length.toString()}
          subvalue="Pending queued executions"
          accent="amber"
          icon={<TactileIcon icon={Clock} color="amber" size="sm" />}
        />
        <MetricCard
          title="Delivered Rate"
          value={`${overview?.inAppDeliveryRate || 100}%`}
          subvalue="In-App & Email reliable fulfillment"
          accent="green"
          icon={<TactileIcon icon={CheckCircle} color="security" size="sm" />}
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
          { id: 'overview', label: 'Overview & Channels', icon: Radio, count: undefined },
          { id: 'compose', label: 'Compose Message', icon: Send, count: undefined },
          { id: 'campaigns', label: 'Campaigns', icon: Calendar, count: campaigns.length },
          { id: 'templates', label: 'Templates', icon: FileText, count: templates.length },
          { id: 'scheduled', label: 'Scheduled', icon: Clock, count: scheduledCampaigns.length },
          { id: 'delivery', label: 'Delivery Logs', icon: Layers, count: deliveryPagination.total || deliveryLogs.length },
          { id: 'system-events', label: 'System Event Triggers', icon: Shield, count: undefined },
          { id: 'diagnostics', label: 'Diagnostics', icon: Settings, count: undefined },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ActiveTab)}
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
              <Icon size={14} style={{ color: isActive ? 'var(--color-brand-primary)' : 'inherit' }} />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '0.1rem 0.45rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: isActive ? 'var(--color-bg-subtle)' : 'rgba(0,0,0,0.06)',
                    color: isActive ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
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
      {/* TAB 1: OVERVIEW & CHANNELS                                                */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Channels Matrix Card */}
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
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  Delivery Channels Operational Matrix
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  Authoritative routing states across configured and unconfigured delivery gateways.
                </p>
              </div>
              <Badge variant="success">2 Operational Channels</Badge>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {overview?.channelsHealth?.map((ch) => (
                <div
                  key={ch.channel}
                  style={{
                    padding: '1.1rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border-subtle)',
                    background: 'var(--color-bg-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.85rem',
                    boxShadow: 'var(--shadow-tactile-sm)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {renderChannelBadge(ch.channel)}
                        {ch.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                        Gateway: <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>{ch.providerName}</span>
                      </div>
                    </div>
                    {ch.status === 'OPERATIONAL' ? (
                      <Badge variant="success">OPERATIONAL</Badge>
                    ) : (
                      <Badge variant="neutral">NOT CONFIGURED</Badge>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.65rem' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: ch.isConfigured ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                      {ch.isConfigured ? `Success Rate: ${ch.successRatePercent}%` : 'Provider pending setup'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      {ch.lastDeliveredAt ? `Last: ${new Date(ch.lastDeliveredAt).toLocaleTimeString()}` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Target Audience & Segment Matrix (Agent & Customer Distribution) */}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  Platform Audience Distribution & Segmentation
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  Targetable audience segments across merchant agents, storefronts, and end-customers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('compose')}
                style={tactileButtonStyle}
              >
                <Send size={12} style={{ color: 'var(--color-brand-primary)' }} />
                Target a Segment
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '0.85rem', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-brand-primary)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                  <Users size={14} /> All Active Agents
                </div>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, margin: '0.35rem 0 0.15rem 0' }}>~250 Agents</div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Wholesale API & Direct Retailers</span>
              </div>

              <div style={{ padding: '0.85rem', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-success)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                  <Sparkles size={14} /> Storefront Merchants
                </div>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, margin: '0.35rem 0 0.15rem 0' }}>~120 Stores</div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Activated custom storefront agents</span>
              </div>

              <div style={{ padding: '0.85rem', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-warning)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                  <User size={14} /> End Customers
                </div>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, margin: '0.35rem 0 0.15rem 0' }}>~1,200 Users</div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Direct bundle purchasers & wallet holders</span>
              </div>

              <div style={{ padding: '0.85rem', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-danger)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                  <Shield size={14} /> Operations Admins
                </div>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, margin: '0.35rem 0 0.15rem 0' }}>~5 Admins</div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Super Admin & Finance Controllers</span>
              </div>
            </div>
          </Card>

          {/* Quick Dispatches & Recent Activity Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-6)' }}>
            {/* Recent Campaigns Preview */}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-sm)' }}>Recent Broadcast Campaigns</h4>
                <button
                  type="button"
                  onClick={() => setActiveTab('campaigns')}
                  style={{ background: 'none', border: 'none', color: 'var(--color-brand-primary)', cursor: 'pointer', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                >
                  View All <ChevronRight size={12} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {campaigns.slice(0, 4).map((cmp) => (
                  <div
                    key={cmp.id}
                    onClick={() => setSelectedCampaign(cmp)}
                    style={{
                      padding: '0.75rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-bg-subtle)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-surface)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)')}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>{cmp.title}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        Audience: {cmp.audienceCount?.toLocaleString()} • Target: {cmp.targetType}
                      </div>
                    </div>
                    {renderStatusBadge(cmp.status)}
                  </div>
                ))}
                {campaigns.length === 0 && (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                    No campaigns created yet.
                  </div>
                )}
              </div>
            </Card>

            {/* Recent Delivery Logs Preview */}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-sm)' }}>Live Delivery Stream</h4>
                <button
                  type="button"
                  onClick={() => setActiveTab('delivery')}
                  style={{ background: 'none', border: 'none', color: 'var(--color-brand-primary)', cursor: 'pointer', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                >
                  View Logs <ChevronRight size={12} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {deliveryLogs.slice(0, 4).map((log) => (
                  <div
                    key={log.id}
                    onClick={() => setSelectedDeliveryLog(log)}
                    style={{
                      padding: '0.75rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-bg-subtle)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-surface)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)')}
                  >
                    <div style={{ maxWidth: '70%' }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.subject}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        To: {log.recipientEmailRedacted || log.recipientName} • Channel: {log.channel}
                      </div>
                    </div>
                    {renderStatusBadge(log.status)}
                  </div>
                ))}
                {deliveryLogs.length === 0 && (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                    No message logs recorded.
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: COMPOSE MESSAGE                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'compose' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(420px, 1.3fr) minmax(320px, 1fr)', gap: 'var(--space-6)' }}>
          {/* Composer Form Card */}
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
                Direct Platform Message Composer
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                Construct targeted operational alerts, customer emails, or system notifications.
              </p>
            </div>

            <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {/* Delivery Channels Selectable Pills */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.45rem' }}>
                  Delivery Channels
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (composeChannels.includes(CommunicationChannel.IN_APP)) {
                        setComposeChannels(composeChannels.filter((c) => c !== CommunicationChannel.IN_APP));
                      } else {
                        setComposeChannels([...composeChannels, CommunicationChannel.IN_APP]);
                      }
                    }}
                    style={{
                      ...tactileButtonStyle,
                      backgroundColor: composeChannels.includes(CommunicationChannel.IN_APP) ? 'rgba(59, 130, 246, 0.15)' : 'var(--color-bg-subtle)',
                      borderColor: composeChannels.includes(CommunicationChannel.IN_APP) ? 'var(--color-brand-bright)' : 'var(--color-border-subtle)',
                      color: composeChannels.includes(CommunicationChannel.IN_APP) ? 'var(--color-brand-bright)' : 'var(--color-text-muted)',
                    }}
                  >
                    <Radio size={13} />
                    In-App Notification
                    {composeChannels.includes(CommunicationChannel.IN_APP) && <Check size={12} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (composeChannels.includes(CommunicationChannel.EMAIL)) {
                        setComposeChannels(composeChannels.filter((c) => c !== CommunicationChannel.EMAIL));
                      } else {
                        setComposeChannels([...composeChannels, CommunicationChannel.EMAIL]);
                      }
                    }}
                    style={{
                      ...tactileButtonStyle,
                      backgroundColor: composeChannels.includes(CommunicationChannel.EMAIL) ? 'rgba(34, 197, 94, 0.15)' : 'var(--color-bg-subtle)',
                      borderColor: composeChannels.includes(CommunicationChannel.EMAIL) ? 'var(--color-success)' : 'var(--color-border-subtle)',
                      color: composeChannels.includes(CommunicationChannel.EMAIL) ? 'var(--color-success)' : 'var(--color-text-muted)',
                    }}
                  >
                    <Mail size={13} />
                    Transactional Email
                    {composeChannels.includes(CommunicationChannel.EMAIL) && <Check size={12} />}
                  </button>

                  <span
                    style={{
                      ...tactileButtonStyle,
                      backgroundColor: 'var(--color-bg-subtle)',
                      color: 'var(--color-text-muted)',
                      cursor: 'not-allowed',
                      opacity: 0.6,
                    }}
                    title="SMS integration pending carrier credentials"
                  >
                    <MessageSquare size={13} />
                    SMS (Not Configured)
                  </span>
                </div>
              </div>

              {/* Target Selection & Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                    Target Audience
                  </label>
                  <Select
                    value={composeTarget}
                    onChange={(e) => setComposeTarget(e.target.value as CommunicationTargetType)}
                    options={[
                      { value: CommunicationTargetType.ROLE, label: 'Target by Role' },
                      { value: CommunicationTargetType.AGENT_SEGMENT, label: 'Agent Specific Segment' },
                      { value: CommunicationTargetType.CUSTOMER_SEGMENT, label: 'Customer Specific Segment' },
                      { value: CommunicationTargetType.INDIVIDUAL, label: 'Single Recipient (Unicast)' },
                      { value: CommunicationTargetType.BROADCAST, label: 'Platform Broadcast (Elevated)' },
                    ]}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                    Priority Level
                  </label>
                  <Select
                    value={composePriority}
                    onChange={(e) => setComposePriority(e.target.value as CommunicationPriority)}
                    options={[
                      { value: CommunicationPriority.LOW, label: 'LOW — Informational' },
                      { value: CommunicationPriority.NORMAL, label: 'NORMAL — Standard Alert' },
                      { value: CommunicationPriority.HIGH, label: 'HIGH — Important Notice' },
                      { value: CommunicationPriority.CRITICAL, label: 'CRITICAL — Emergency (Elevated)' },
                    ]}
                  />
                </div>
              </div>

              {/* Dynamic Target Inputs */}
              {composeTarget === CommunicationTargetType.INDIVIDUAL && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                    Recipient Email Address
                  </label>
                  <Input
                    type="email"
                    value={composeRecipientEmail}
                    onChange={(e) => setComposeRecipientEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                  />
                </div>
              )}

              {composeTarget === CommunicationTargetType.ROLE && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                    Recipient Role Group
                  </label>
                  <Select
                    value={composeRole}
                    onChange={(e) => setComposeRole(e.target.value)}
                    options={[
                      { value: 'customer', label: 'All Customers' },
                      { value: 'agent', label: 'All Agents & Super Agents' },
                      { value: 'admin', label: 'All Operations & Finance Admins' },
                      { value: 'super_admin', label: 'Super Administrators Only' },
                    ]}
                  />
                </div>
              )}

              {composeTarget === CommunicationTargetType.AGENT_SEGMENT && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                    Agent Segment Filter
                  </label>
                  <Select
                    value={composeSegment}
                    onChange={(e) => setComposeSegment(e.target.value)}
                    options={[
                      { value: 'ALL_AGENTS', label: 'All Active Agents' },
                      { value: 'AGENTS_WITH_STORE', label: 'Agents with Approved Active Storefronts' },
                      { value: 'AGENTS_WITHOUT_STORE', label: 'Agents without Storefronts' },
                    ]}
                  />
                </div>
              )}

              {/* Template Quick Insert */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                  Load from Template (Optional)
                </label>
                <Select
                  value=""
                  onChange={(e) => {
                    const sel = templates.find((t) => t.id === e.target.value);
                    if (sel) {
                      setComposeSubject(sel.subjectTemplate);
                      setComposeBody(sel.bodyTemplate);
                    }
                  }}
                  options={[
                    { value: '', label: '-- Select a template to populate --' },
                    ...templates.map((t) => ({ value: t.id, label: `[${t.category}] ${t.name} (v${t.version})` })),
                  ]}
                />
              </div>

              {/* Subject */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                  Subject Line
                </label>
                <Input
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="e.g. Scheduled Network Gateway Maintenance"
                  required
                />
              </div>

              {/* Body */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                    Message Body
                  </label>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    Supported: {'{{user_name}}'}, {'{{order_id}}'}, {'{{amount}}'}
                  </span>
                </div>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    background: 'var(--color-bg-base)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'inherit',
                    fontSize: 'var(--font-size-sm)',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  placeholder="Enter message content. You may use variables such as {{user_name}}."
                  required
                />
              </div>

              {/* Justification for CRITICAL or Broadcast */}
              {(composePriority === CommunicationPriority.CRITICAL || composeTarget === CommunicationTargetType.BROADCAST) && (
                <div style={{ padding: '0.85rem', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--color-danger)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--color-danger)', fontWeight: 800, marginBottom: '0.4rem', fontSize: 'var(--font-size-xs)' }}>
                    <Lock size={14} /> Elevated Permission & Mandatory Justification
                  </div>
                  <Input
                    value={composeJustification}
                    onChange={(e) => setComposeJustification(e.target.value)}
                    placeholder="Enter explicit administrative justification for this broadcast..."
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSending}
                style={{ ...primaryButtonStyle, justifyContent: 'center', padding: '0.75rem 1.25rem', marginTop: '0.5rem' }}
              >
                <Send size={15} />
                {isSending ? 'Dispatching Message...' : 'Dispatch Platform Message'}
              </button>
            </form>
          </Card>

          {/* Live Preview Card */}
          <Card
            elevated
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Eye size={16} style={{ color: 'var(--color-brand-primary)' }} />
              <h4 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-sm)' }}>
                Live Recipient Preview
              </h4>
            </div>

            <div
              style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-bg-subtle)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {composeChannels.map((c) => renderChannelBadge(c))}
                </div>
                {renderPriorityBadge(composePriority)}
              </div>
              <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                {composeSubject || 'Subject Header Preview'}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', minHeight: '80px' }}>
                {composeBody || 'The message body will render here in real-time as you compose.'}
              </div>
              <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.65rem', fontSize: '10px', color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Target: {composeTarget}</span>
                <span>Role/Segment: {composeTarget === CommunicationTargetType.INDIVIDUAL ? composeRecipientEmail || 'Single Recipient' : composeRole}</span>
              </div>
            </div>

            <div style={{ padding: '0.85rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.2rem' }}>
                Fulfillment Invariant:
              </div>
              All dispatches are recorded into authoritative delivery audit logs. Critical broadcasts enforce dual-factor rate limits.
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CAMPAIGNS                                                          */}
      {/* ========================================================================= */}
      {activeTab === 'campaigns' && (
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
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Communication Campaigns
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                Manage mass broadcast campaigns with audience verification safety gates.
              </p>
            </div>

            {/* Compact Filter Bar */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ width: '220px' }}>
                <Input
                  value={campaignSearch}
                  onChange={(e) => setCampaignSearch(e.target.value)}
                  placeholder="Search campaign title/id..."
                />
              </div>
              <select
                value={campaignStatusFilter}
                onChange={(e) => setCampaignStatusFilter(e.target.value)}
                style={selectStyle}
              >
                <option value="ALL">All Statuses</option>
                <option value="SCHEDULED">Scheduled Only</option>
                <option value="PROCESSING">Processing</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <button
                type="button"
                onClick={() => setIsCampaignModalOpen(true)}
                style={primaryButtonStyle}
              >
                <Calendar size={13} />
                New Campaign
              </button>
            </div>
          </div>

          {/* Active Filter Chips */}
          {(campaignSearch.trim() || campaignStatusFilter !== 'ALL') && (
            <div style={{ padding: '0.45rem var(--space-5)', backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-text-muted)' }}>Active Filters:</span>
              {campaignSearch.trim() && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem', fontSize: '11px', fontWeight: 600 }}>
                  Search: "{campaignSearch}"
                  <button type="button" onClick={() => setCampaignSearch('')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                    <X size={11} />
                  </button>
                </span>
              )}
              {campaignStatusFilter !== 'ALL' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem', fontSize: '11px', fontWeight: 600 }}>
                  Status: {campaignStatusFilter}
                  <button type="button" onClick={() => setCampaignStatusFilter('ALL')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                    <X size={11} />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={() => { setCampaignSearch(''); setCampaignStatusFilter('ALL'); }}
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
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Campaign & ID</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Audience & Segment</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Channels</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Priority</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Status</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Delivered / Failed</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Execution Time</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((cmp) => (
                  <tr
                    key={cmp.id}
                    onClick={() => setSelectedCampaign(cmp)}
                    style={{
                      borderBottom: '1px solid var(--color-border-subtle)',
                      cursor: 'pointer',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>{cmp.title}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <code style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                          {cmp.id.slice(0, 14)}...
                        </code>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleCopy(cmp.id, `cmp_${cmp.id}`); }}
                          style={{ background: 'none', border: 'none', padding: '1px', cursor: 'pointer', color: copiedKey === `cmp_${cmp.id}` ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                          title="Copy Campaign ID"
                        >
                          {copiedKey === `cmp_${cmp.id}` ? <Check size={11} /> : <Copy size={11} />}
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <div style={{ fontWeight: 700 }}>{cmp.audienceCount?.toLocaleString()} Users</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                        {cmp.targetType} {cmp.segment ? `(${cmp.segment})` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {cmp.channels.map((ch) => renderChannelBadge(ch))}
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>{renderPriorityBadge(cmp.priority)}</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>{renderStatusBadge(cmp.status)}</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <div>
                        <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>{cmp.deliveredCount}</span> /{' '}
                        <span style={{ color: cmp.failedCount > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: 600 }}>
                          {cmp.failedCount}
                        </span>
                      </div>
                      {cmp.audienceCount > 0 && (
                        <div style={{ width: '80px', height: '4px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-bg-subtle)', marginTop: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, Math.round((cmp.deliveredCount / cmp.audienceCount) * 100))}%`,
                              height: '100%',
                              backgroundColor: 'var(--color-success)',
                            }}
                          />
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      {cmp.scheduledAt ? (
                        <div style={{ fontSize: '10px', color: 'var(--color-warning)', fontWeight: 600 }}>
                          Sched: {new Date(cmp.scheduledAt).toLocaleString()}
                        </div>
                      ) : cmp.sentAt ? (
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Sent: {new Date(cmp.sentAt).toLocaleString()}</div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedCampaign(cmp); }}
                          style={tactileButtonStyle}
                          title="Inspect Campaign Details"
                        >
                          <Eye size={12} />
                        </button>
                        {cmp.status === 'SCHEDULED' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCampaignToCancel({ id: cmp.id, title: cmp.title });
                            }}
                            style={dangerButtonStyle}
                            title="Cancel Scheduled Execution"
                          >
                            <XCircle size={12} />
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredCampaigns.length === 0 && (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No campaigns found matching filter.
            </div>
          )}
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TEMPLATES                                                          */}
      {/* ========================================================================= */}
      {activeTab === 'templates' && (
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
          {/* Header & Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
                Notification Templates Repository
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                System and custom notification templates with variable substitution and version controls.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ width: '220px' }}>
                <Input
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search template slug/name..."
                />
              </div>
              <select
                value={templateCategoryFilter}
                onChange={(e) => setTemplateCategoryFilter(e.target.value)}
                style={selectStyle}
              >
                <option value="ALL">All Categories</option>
                <option value="SYSTEM">System</option>
                <option value="FINANCIAL">Financial</option>
                <option value="TELECOM">Telecom</option>
                <option value="SECURITY">Security</option>
                <option value="MARKETING">Marketing</option>
              </select>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(true)}
                style={primaryButtonStyle}
              >
                <FileText size={13} />
                New Template
              </button>
            </div>
          </div>

          {/* Templates Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
            {filteredTemplates.map((tpl) => (
              <div
                key={tpl.id}
                style={{
                  padding: '1.15rem',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: 'var(--shadow-tactile-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                      {tpl.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <code style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-brand-bright)' }}>{tpl.slug}</code>
                      <button
                        type="button"
                        onClick={() => handleCopy(tpl.slug, `slug_${tpl.id}`)}
                        style={{ background: 'none', border: 'none', padding: '1px', cursor: 'pointer', color: copiedKey === `slug_${tpl.id}` ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                        title="Copy Template Slug"
                      >
                        {copiedKey === `slug_${tpl.id}` ? <Check size={11} /> : <Copy size={11} />}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <Badge variant="neutral">v{tpl.version}</Badge>
                    {tpl.isSystemCritical && <Badge variant="danger">CRITICAL</Badge>}
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', background: 'var(--color-bg-surface)', padding: '0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>{tpl.subjectTemplate}</div>
                  <div style={{ lineHeight: 1.4, color: 'var(--color-text-secondary)' }}>{tpl.bodyTemplate.slice(0, 110)}...</div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {tpl.availableVariables?.map((v) => (
                    <span
                      key={v}
                      style={{
                        padding: '0.1rem 0.4rem',
                        borderRadius: 'var(--radius-xs)',
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--color-brand-bright)',
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.65rem' }}>
                  <Badge variant="brand">{tpl.category}</Badge>
                  <button
                    type="button"
                    onClick={() => setPreviewTemplate(tpl)}
                    style={tactileButtonStyle}
                  >
                    <Eye size={12} />
                    Inspect & Preview
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No notification templates match the filter.
            </div>
          )}
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SCHEDULED                                                          */}
      {/* ========================================================================= */}
      {activeTab === 'scheduled' && (
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
          <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-sm)', textTransform: 'uppercase', color: 'var(--color-text-primary)' }}>
              Scheduled Messages Queue
            </h3>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              Pending automated dispatches waiting for target execution timestamps.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Campaign Title & Subject</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Target Audience</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Channels</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Scheduled Execution</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Status</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {scheduledCampaigns.map((cmp) => (
                  <tr
                    key={cmp.id}
                    onClick={() => setSelectedCampaign(cmp)}
                    style={{
                      borderBottom: '1px solid var(--color-border-subtle)',
                      cursor: 'pointer',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{cmp.title}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{cmp.subject}</div>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <span style={{ fontWeight: 700 }}>{cmp.audienceCount?.toLocaleString()}</span> recipients ({cmp.targetType})
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {cmp.channels.map((ch) => renderChannelBadge(ch))}
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={12} />
                        {cmp.scheduledAt ? new Date(cmp.scheduledAt).toLocaleString() : '—'}
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <Badge variant="warning">SCHEDULED</Badge>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedCampaign(cmp); }}
                          style={tactileButtonStyle}
                          title="Inspect Campaign"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCampaignToCancel({ id: cmp.id, title: cmp.title });
                          }}
                          style={dangerButtonStyle}
                        >
                          <XCircle size={12} />
                          Cancel Execution
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {scheduledCampaigns.length === 0 && (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <Clock size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
              <div>No messages currently scheduled in the queue.</div>
            </div>
          )}
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: DELIVERY TRACKING LOGS                                             */}
      {/* ========================================================================= */}
      {activeTab === 'delivery' && (
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
                Communication Delivery Audit Logs
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                Comprehensive delivery audit trail with privacy-preserving sensitive data redaction.
              </p>
            </div>

            {/* Compact Filter Toolbar */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ width: '220px' }}>
                <Input
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Search recipient or subject..."
                />
              </div>
              <select
                value={logChannel}
                onChange={(e) => setLogChannel(e.target.value)}
                style={selectStyle}
              >
                <option value="ALL">All Channels</option>
                <option value="IN_APP">In-App</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
              </select>
              <select
                value={logStatus}
                onChange={(e) => setLogStatus(e.target.value)}
                style={selectStyle}
              >
                <option value="ALL">All Statuses</option>
                <option value="DELIVERED">Delivered</option>
                <option value="FAILED">Failed</option>
                <option value="QUEUED">Queued</option>
              </select>
              <button
                type="button"
                onClick={() => fetchDeliveryLogs(1)}
                style={primaryButtonStyle}
              >
                <Search size={13} />
                Filter
              </button>
            </div>
          </div>

          {/* Active Filter Chips */}
          {(logSearch.trim() || logChannel !== 'ALL' || logStatus !== 'ALL') && (
            <div style={{ padding: '0.45rem var(--space-5)', backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-text-muted)' }}>Active Filters:</span>
              {logSearch.trim() && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem', fontSize: '11px', fontWeight: 600 }}>
                  Search: "{logSearch}"
                  <button type="button" onClick={() => { setLogSearch(''); fetchDeliveryLogs(1); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                    <X size={11} />
                  </button>
                </span>
              )}
              {logChannel !== 'ALL' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem', fontSize: '11px', fontWeight: 600 }}>
                  Channel: {logChannel}
                  <button type="button" onClick={() => { setLogChannel('ALL'); fetchDeliveryLogs(1); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                    <X size={11} />
                  </button>
                </span>
              )}
              {logStatus !== 'ALL' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem', fontSize: '11px', fontWeight: 600 }}>
                  Status: {logStatus}
                  <button type="button" onClick={() => { setLogStatus('ALL'); fetchDeliveryLogs(1); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                    <X size={11} />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={() => { setLogSearch(''); setLogChannel('ALL'); setLogStatus('ALL'); fetchDeliveryLogs(1); }}
                style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-brand-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* Delivery Logs Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Delivery ID & Ref</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Recipient (Redacted)</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Channel</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Subject & Preview</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Priority</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Status</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Attempts</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Delivered Time</th>
                  <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deliveryLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedDeliveryLog(log)}
                    style={{
                      borderBottom: '1px solid var(--color-border-subtle)',
                      cursor: 'pointer',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <code style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {log.id.slice(0, 12)}...
                        </code>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleCopy(log.id, `log_${log.id}`); }}
                          style={{ background: 'none', border: 'none', padding: '1px', cursor: 'pointer', color: copiedKey === `log_${log.id}` ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                          title="Copy Log ID"
                        >
                          {copiedKey === `log_${log.id}` ? <Check size={11} /> : <Copy size={11} />}
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <div style={{ fontWeight: 700 }}>{log.recipientName}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                        {log.recipientEmailRedacted} • <span style={{ textTransform: 'capitalize' }}>{log.recipientRole}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      {renderChannelBadge(log.channel)}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', maxWidth: '240px' }}>
                      <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.subject}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.bodyPreview}</div>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>{renderPriorityBadge(log.priority)}</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>{renderStatusBadge(log.status)}</td>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>{log.attempts}</td>
                    <td style={{ padding: '0.65rem 0.85rem', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      {log.deliveredAt ? new Date(log.deliveredAt).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedDeliveryLog(log); }}
                        style={tactileButtonStyle}
                        title="Inspect Delivery Dossier"
                      >
                        <Eye size={12} />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {deliveryLogs.length === 0 && (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No delivery logs recorded matching filter criteria.
            </div>
          )}

          {/* Tactile Pagination Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-5)', borderTop: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Showing {deliveryLogs.length} of {deliveryPagination.total} logs (Page {deliveryPagination.page} of {deliveryPagination.totalPages})
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={deliveryPagination.page <= 1}
                onClick={() => fetchDeliveryLogs(deliveryPagination.page - 1)}
                style={{ ...tactileButtonStyle, opacity: deliveryPagination.page <= 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={deliveryPagination.page >= deliveryPagination.totalPages}
                onClick={() => fetchDeliveryLogs(deliveryPagination.page + 1)}
                style={{ ...tactileButtonStyle, opacity: deliveryPagination.page >= deliveryPagination.totalPages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: SYSTEM EVENT CATALOG                                               */}
      {/* ========================================================================= */}
      {activeTab === 'system-events' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
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
                Authoritative System Event Triggers & Safety Invariants
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                ByteBeacon 2.0 maintains strict transactional and telecom boundaries. System notifications are generated exclusively from verified server-side ledger and telecom fulfillment states.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1.15rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontWeight: 800, color: 'var(--color-brand-bright)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Shield size={16} /> Financial Notification Safety
                </div>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Payment receipts and wallet updates are triggered <strong>only</strong> after cryptographic Paystack HMAC webhook verification and double-entry voucher ledger commitment. The frontend cannot trigger payment notifications.
                </p>
              </div>

              <div style={{ padding: '1.15rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontWeight: 800, color: 'var(--color-brand-bright)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Radio size={16} /> DataHouse Fulfillment Authority
                </div>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Data bundle delivery notices are generated <strong>only</strong> after DataHouse upstream status confirms <code>FULFILLED</code>. Failed carrier dispatches generate automated refund notifications.
                </p>
              </div>

              <div style={{ padding: '1.15rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontWeight: 800, color: 'var(--color-brand-bright)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Lock size={16} /> Security & Anti-Spoofing
                </div>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Authentication alerts (new login, password change, API key rotation) include masked IP addresses and timestamps to prevent account compromise and phishing.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: DIAGNOSTICS                                                        */}
      {/* ========================================================================= */}
      {activeTab === 'diagnostics' && (
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
              Communication Subsystem Health & Diagnostics
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              Real-time gateway latencies, queuing health, and messaging worker telemetry.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1.15rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>In-App Notification Engine</span>
                <Badge variant="success">HEALTHY</Badge>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '0.5rem', margin: '0.5rem 0 0 0' }}>
                Latency: 2ms • WebSocket & DB Polling Active
              </p>
            </div>

            <div style={{ padding: '1.15rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Transactional Email Relay</span>
                <Badge variant="success">HEALTHY</Badge>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '0.5rem', margin: '0.5rem 0 0 0' }}>
                Relay: SMTP/SES • Average Dispatch: 85ms
              </p>
            </div>

            <div style={{ padding: '1.15rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>BullMQ Message Worker</span>
                <Badge variant="success">HEALTHY</Badge>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '0.5rem', margin: '0.5rem 0 0 0' }}>
                Queue Depth: 0 • Active Workers: 2
              </p>
            </div>

            <div style={{ padding: '1.15rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>SMS Carrier Gateway</span>
                <Badge variant="neutral">NOT CONFIGURED</Badge>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '0.5rem', margin: '0.5rem 0 0 0' }}>
                SMS provider integration pending API key setup
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 4. DELIVERY LOG DOSSIER DRAWER & BACKDROP (zIndex 250 / 260)              */}
      {/* ========================================================================= */}
      {selectedDeliveryLog && (
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
          onClick={() => setSelectedDeliveryLog(null)}
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
                  <Mail size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                      Delivery Log Dossier
                    </h2>
                    {renderStatusBadge(selectedDeliveryLog.status)}
                    {renderChannelBadge(selectedDeliveryLog.channel)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      ID: {selectedDeliveryLog.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedDeliveryLog.id, 'drawer_log_id')}
                      style={{ background: 'none', border: 'none', padding: '1px', cursor: 'pointer', color: copiedKey === 'drawer_log_id' ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                    >
                      {copiedKey === 'drawer_log_id' ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDeliveryLog(null)}
                style={{ background: 'transparent', border: 'none', padding: '0.4rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Sub-Tab Switcher */}
            <div style={{ display: 'flex', padding: '0 var(--space-6)', borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
              {[
                { id: 'OVERVIEW', label: 'Overview & Recipient' },
                { id: 'CONTENT', label: 'Rendered Content' },
                { id: 'TELEMETRY', label: 'Technical Telemetry' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDeliveryLogDrawerTab(tab.id as any)}
                  style={{
                    padding: '0.65rem 1rem',
                    background: 'none',
                    border: 'none',
                    borderBottom: deliveryLogDrawerTab === tab.id ? '2px solid var(--color-brand-primary)' : '2px solid transparent',
                    color: deliveryLogDrawerTab === tab.id ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
                    fontWeight: deliveryLogDrawerTab === tab.id ? 700 : 500,
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
              {deliveryLogDrawerTab === 'OVERVIEW' && (
                <>
                  {/* Recipient Information Card */}
                  <div style={{ padding: '1.15rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Recipient Details
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Recipient Name</span>
                        <p style={{ margin: '0.15rem 0 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                          {selectedDeliveryLog.recipientName}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Redacted Email</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <code style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                            {selectedDeliveryLog.recipientEmailRedacted || '—'}
                          </code>
                          {selectedDeliveryLog.recipientEmailRedacted && (
                            <button
                              type="button"
                              onClick={() => handleCopy(selectedDeliveryLog.recipientEmailRedacted, 'drawer_email')}
                              style={{ background: 'none', border: 'none', padding: '1px', cursor: 'pointer', color: copiedKey === 'drawer_email' ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                            >
                              {copiedKey === 'drawer_email' ? <Check size={11} /> : <Copy size={11} />}
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Recipient Role</span>
                        <p style={{ margin: '0.15rem 0 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)', textTransform: 'capitalize' }}>
                          {selectedDeliveryLog.recipientRole}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Delivery Priority</span>
                        <div style={{ marginTop: '0.2rem' }}>
                          {renderPriorityBadge(selectedDeliveryLog.priority)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dispatch Metrics */}
                  <div style={{ padding: '1.15rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Dispatch Execution & Timestamps
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Created At</span>
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                          {new Date(selectedDeliveryLog.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Sent At</span>
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                          {selectedDeliveryLog.sentAt ? new Date(selectedDeliveryLog.sentAt).toLocaleString() : '—'}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Delivered At</span>
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
                          {selectedDeliveryLog.deliveredAt ? new Date(selectedDeliveryLog.deliveredAt).toLocaleString() : '—'}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Delivery Attempts</span>
                        <p style={{ margin: '0.15rem 0 0 0', fontWeight: 800, fontSize: 'var(--font-size-xs)' }}>
                          {selectedDeliveryLog.attempts} attempt(s)
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {deliveryLogDrawerTab === 'CONTENT' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-text-muted)' }}>Subject Line</span>
                    <h3 style={{ margin: '0.35rem 0 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                      {selectedDeliveryLog.subject}
                    </h3>
                  </div>

                  <div style={{ padding: '1.15rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-text-muted)' }}>Rendered Message Content</span>
                    <div style={{ margin: '0.5rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {selectedDeliveryLog.bodyPreview}
                    </div>
                  </div>
                </div>
              )}

              {deliveryLogDrawerTab === 'TELEMETRY' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {selectedDeliveryLog.errorMessage && (
                    <div style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--color-danger)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--color-danger)', fontWeight: 800, fontSize: '11px', marginBottom: '0.35rem' }}>
                        <AlertTriangle size={14} /> Gateway Error Trace
                      </div>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>
                        {selectedDeliveryLog.errorMessage}
                      </p>
                    </div>
                  )}

                  <div style={{ padding: '1.15rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Raw Telemetry Payload</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(JSON.stringify(selectedDeliveryLog, null, 2), 'raw_telemetry')}
                        style={tactileButtonStyle}
                      >
                        {copiedKey === 'raw_telemetry' ? <Check size={11} /> : <Copy size={11} />}
                        Copy JSON
                      </button>
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: '0.85rem',
                        backgroundColor: 'var(--color-bg-base)',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--color-text-secondary)',
                        maxHeight: '260px',
                        overflow: 'auto',
                      }}
                    >
                      {JSON.stringify(selectedDeliveryLog, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CAMPAIGN DOSSIER DRAWER & BACKDROP (zIndex 250 / 260)                  */}
      {/* ========================================================================= */}
      {selectedCampaign && (
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
          onClick={() => setSelectedCampaign(null)}
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
                  <Calendar size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                      Campaign Dossier
                    </h2>
                    {renderStatusBadge(selectedCampaign.status)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      ID: {selectedCampaign.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedCampaign.id, 'drawer_cmp_id')}
                      style={{ background: 'none', border: 'none', padding: '1px', cursor: 'pointer', color: copiedKey === 'drawer_cmp_id' ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                    >
                      {copiedKey === 'drawer_cmp_id' ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCampaign(null)}
                style={{ background: 'transparent', border: 'none', padding: '0.4rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Campaign Content Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Title & Subject */}
              <div style={{ padding: '1.15rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-text-muted)' }}>Campaign Title</span>
                <h3 style={{ margin: '0.25rem 0 0.5rem 0', fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {selectedCampaign.title}
                </h3>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  Subject: <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{selectedCampaign.subject}</span>
                </div>
              </div>

              {/* Audience & Delivery Progress Banner */}
              <div style={{ padding: '1.15rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                  Audience & Delivery Metrics
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Total Audience</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontWeight: 800, fontSize: 'var(--font-size-lg)' }}>
                      {selectedCampaign.audienceCount?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Delivered Count</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontWeight: 800, fontSize: 'var(--font-size-lg)', color: 'var(--color-success)' }}>
                      {selectedCampaign.deliveredCount?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Failed Count</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontWeight: 800, fontSize: 'var(--font-size-lg)', color: selectedCampaign.failedCount > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                      {selectedCampaign.failedCount?.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Message Body Preview */}
              <div style={{ padding: '1.15rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-text-muted)' }}>Full Message Content</span>
                <div style={{ margin: '0.5rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {selectedCampaign.body}
                </div>
              </div>

              {/* Administrative Actions */}
              {selectedCampaign.status === 'SCHEDULED' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setCampaignToCancel({ id: selectedCampaign.id, title: selectedCampaign.title })}
                    style={dangerButtonStyle}
                  >
                    <XCircle size={14} />
                    Cancel Scheduled Campaign
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. CAMPAIGN CANCELLATION CONFIRMATION MODAL                               */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!campaignToCancel}
        onClose={() => setCampaignToCancel(null)}
        title="Cancel Scheduled Campaign"
        maxWidth="520px"
      >
        {campaignToCancel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <div style={{ padding: '0.85rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <AlertTriangle size={20} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                Are you sure you want to cancel campaign <strong>"{campaignToCancel.title}"</strong>? Once cancelled, pending queued dispatches will be aborted.
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Cancellation Reason / Audit Justification
              </label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancelling campaign..."
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setCampaignToCancel(null)}
                style={tactileButtonStyle}
                disabled={isCancelling}
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelCampaign}
                style={dangerButtonStyle}
                disabled={isCancelling}
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* 7. COMPOSE MESSAGE MODAL                                                  */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isComposeModalOpen}
        onClose={() => setIsComposeModalOpen(false)}
        title="Compose Platform Message"
        maxWidth="680px"
      >
        <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
              Target Audience
            </label>
            <Select
              value={composeTarget}
              onChange={(e) => setComposeTarget(e.target.value as CommunicationTargetType)}
              options={[
                { value: CommunicationTargetType.ROLE, label: 'Target by Role' },
                { value: CommunicationTargetType.AGENT_SEGMENT, label: 'Agent Segment' },
                { value: CommunicationTargetType.CUSTOMER_SEGMENT, label: 'Customer Segment' },
                { value: CommunicationTargetType.INDIVIDUAL, label: 'Single Recipient (Unicast)' },
                { value: CommunicationTargetType.BROADCAST, label: 'Platform Broadcast (Elevated)' },
              ]}
            />
          </div>

          {composeTarget === CommunicationTargetType.INDIVIDUAL && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Recipient Email
              </label>
              <Input
                type="email"
                value={composeRecipientEmail}
                onChange={(e) => setComposeRecipientEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
              Subject Line
            </label>
            <Input
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              placeholder="Message Subject"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
              Message Body
            </label>
            <textarea
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
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
              placeholder="Enter message text..."
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setIsComposeModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button type="submit" disabled={isSending} style={primaryButtonStyle}>
              <Send size={13} />
              {isSending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 8. CREATE CAMPAIGN MODAL                                                  */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCampaignModalOpen}
        onClose={() => setIsCampaignModalOpen(false)}
        title="Create Mass Communication Campaign"
        maxWidth="680px"
      >
        <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
              Campaign Title
            </label>
            <Input
              value={campaignTitle}
              onChange={(e) => setCampaignTitle(e.target.value)}
              placeholder="e.g. Telecel Network Upgrade Announcement"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
              Subject Line
            </label>
            <Input
              value={campaignSubject}
              onChange={(e) => setCampaignSubject(e.target.value)}
              placeholder="Email / In-App Subject"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
              Schedule Date & Time (Leave blank for immediate dispatch)
            </label>
            <Input
              type="datetime-local"
              value={campaignScheduledAt}
              onChange={(e) => setCampaignScheduledAt(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
              Message Body
            </label>
            <textarea
              value={campaignBody}
              onChange={(e) => setCampaignBody(e.target.value)}
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
              placeholder="Campaign announcement content..."
              required
            />
          </div>

          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={campaignStepUpConfirmed}
                onChange={(e) => setCampaignStepUpConfirmed(e.target.checked)}
              />
              Confirm Step-Up: I authorize dispatching this mass communication to the selected audience.
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setIsCampaignModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button type="submit" disabled={isCreatingCampaign} style={primaryButtonStyle}>
              <Calendar size={13} />
              {isCreatingCampaign ? 'Creating...' : 'Schedule Campaign'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 9. CREATE TEMPLATE MODAL                                                  */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Register Notification Template"
        maxWidth="680px"
      >
        <form onSubmit={handleCreateTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Template Slug (Unique)
              </label>
              <Input
                value={templateSlug}
                onChange={(e) => setTemplateSlug(e.target.value.toUpperCase())}
                placeholder="PROMO_SPECIAL"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Template Name
              </label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Special Promo Announcement"
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
              Category
            </label>
            <Select
              value={templateCategory}
              onChange={(e) => setTemplateCategory(e.target.value as NotificationCategory)}
              options={[
                { value: NotificationCategory.ORDERS, label: 'Orders' },
                { value: NotificationCategory.WALLET, label: 'Wallet & Payments' },
                { value: NotificationCategory.AUTH, label: 'Authentication & Security' },
                { value: NotificationCategory.STORE, label: 'Agent Storefront' },
                { value: NotificationCategory.MARKETING, label: 'Marketing' },
                { value: NotificationCategory.SYSTEM, label: 'System & Platform' },
              ]}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
              Subject Template
            </label>
            <Input
              value={templateSubject}
              onChange={(e) => setTemplateSubject(e.target.value)}
              placeholder="e.g. Hello {{user_name}}, your order {{order_id}} has been fulfilled"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
              Body Template
            </label>
            <textarea
              value={templateBody}
              onChange={(e) => setTemplateBody(e.target.value)}
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
              placeholder="Enter template body with {{variable}} placeholders..."
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setIsTemplateModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button type="submit" disabled={isCreatingTemplate} style={primaryButtonStyle}>
              <FileText size={13} />
              {isCreatingTemplate ? 'Registering...' : 'Save Template'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 10. TEMPLATE FULL PREVIEW MODAL                                           */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        title={previewTemplate?.name || 'Template Preview'}
        maxWidth="640px"
      >
        {previewTemplate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <code style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-brand-bright)' }}>{previewTemplate.slug}</code>
              <Badge variant="brand">Version {previewTemplate.version}</Badge>
            </div>

            <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Subject:</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>{previewTemplate.subjectTemplate}</div>
            </div>

            <div style={{ padding: '1.15rem', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Body:</div>
              <div style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{previewTemplate.bodyTemplate}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setPreviewTemplate(null)} style={primaryButtonStyle}>
                Close Preview
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};
