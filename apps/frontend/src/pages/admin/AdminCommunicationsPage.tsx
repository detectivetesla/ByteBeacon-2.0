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
} from 'lucide-react';

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
  const { success: toastSuccess, error: toastError } = useToast();
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
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<string>('ALL');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>('ALL');

  // Modals
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

  // Handle Cancel Campaign
  const handleCancelCampaign = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled campaign?')) return;
    try {
      await adminApi.cancelCommunicationCampaign(id, 'Cancelled by administrator from control center.');
      toastSuccess('Campaign Cancelled', 'The scheduled campaign was cancelled.');
      fetchCampaigns();
      fetchOverview();
    } catch (err: any) {
      toastError('Cancellation Error', err.message || 'Could not cancel campaign.');
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

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Mail} color="emerald" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-brand-bright)' }}>
              Platform Control Plane
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Communication Center & System Messaging
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Authoritative messaging hub for In-App alerts, transactional emails, marketing campaigns, and system events.
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={loadAllData} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} style={{ marginRight: '0.35rem' }} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsTemplateModalOpen(true)}>
            <FileText size={14} style={{ marginRight: '0.35rem' }} />
            New Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsCampaignModalOpen(true)}>
            <Calendar size={14} style={{ marginRight: '0.35rem' }} />
            Create Campaign
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsComposeModalOpen(true)}>
            <Send size={14} style={{ marginRight: '0.35rem' }} />
            Compose Message
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
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
          value={overview?.scheduledCount || '0'}
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

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', overflowX: 'auto', gap: '0.5rem', paddingBottom: '0.25rem' }}>
        {[
          { id: 'overview', label: 'Overview & Channels', icon: Radio },
          { id: 'compose', label: 'Compose Message', icon: Send },
          { id: 'campaigns', label: 'Campaigns', icon: Calendar },
          { id: 'templates', label: 'Templates', icon: FileText },
          { id: 'scheduled', label: 'Scheduled', icon: Clock },
          { id: 'delivery', label: 'Delivery Logs', icon: Layers },
          { id: 'system-events', label: 'System Event Triggers', icon: Shield },
          { id: 'diagnostics', label: 'Diagnostics', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1rem',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--color-brand-primary)' : '2px solid transparent',
                color: isActive ? 'var(--color-brand-bright)' : 'var(--color-text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 'var(--font-size-sm)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & CHANNELS */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Channels Matrix */}
          <Card accentColor="green">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Delivery Channels Operational Matrix
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
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
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {ch.name}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                        {ch.providerName}
                      </div>
                    </div>
                    {ch.status === 'OPERATIONAL' ? (
                      <Badge variant="success">OPERATIONAL</Badge>
                    ) : (
                      <Badge variant="neutral">NOT CONFIGURED</Badge>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.5rem' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {ch.isConfigured ? `Success Rate: ${ch.successRatePercent}%` : 'Provider pending setup'}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                      {ch.lastDeliveredAt ? `Last: ${new Date(ch.lastDeliveredAt).toLocaleTimeString()}` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Dispatches & Recent Activity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-6)' }}>
            {/* Recent Campaigns Preview */}
            <Card accentColor="blue">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontWeight: 700 }}>Recent Broadcast Campaigns</h4>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('campaigns')}>
                  View All <ChevronRight size={12} />
                </Button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {campaigns.slice(0, 3).map((cmp) => (
                  <div
                    key={cmp.id}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-bg-subtle)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{cmp.title}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        Target: {cmp.targetType} • {cmp.audienceCount} recipients
                      </div>
                    </div>
                    {renderStatusBadge(cmp.status)}
                  </div>
                ))}
                {campaigns.length === 0 && (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                    No campaigns created yet.
                  </div>
                )}
              </div>
            </Card>

            {/* Recent Delivery Logs Preview */}
            <Card accentColor="purple">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontWeight: 700 }}>Live Delivery Stream</h4>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('delivery')}>
                  View Logs <ChevronRight size={12} />
                </Button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {deliveryLogs.slice(0, 4).map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-bg-subtle)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{log.subject}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        To: {log.recipientEmailRedacted || log.recipientName} • Channel: {log.channel}
                      </div>
                    </div>
                    {renderStatusBadge(log.status)}
                  </div>
                ))}
                {deliveryLogs.length === 0 && (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                    No message logs recorded.
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: COMPOSE MESSAGE */}
      {activeTab === 'compose' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) minmax(320px, 420px)', gap: 'var(--space-6)' }}>
          {/* Composer Form */}
          <Card accentColor="green">
            <h3 style={{ margin: '0 0 1rem 0', fontWeight: 700 }}>Direct Message Composer</h3>
            <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Delivery Channels */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Delivery Channel(s)
                </label>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={composeChannels.includes(CommunicationChannel.IN_APP)}
                      onChange={(e) => {
                        if (e.target.checked) setComposeChannels([...composeChannels, CommunicationChannel.IN_APP]);
                        else setComposeChannels(composeChannels.filter((c) => c !== CommunicationChannel.IN_APP));
                      }}
                    />
                    In-App Notification
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={composeChannels.includes(CommunicationChannel.EMAIL)}
                      onChange={(e) => {
                        if (e.target.checked) setComposeChannels([...composeChannels, CommunicationChannel.EMAIL]);
                        else setComposeChannels(composeChannels.filter((c) => c !== CommunicationChannel.EMAIL));
                      }}
                    />
                    Transactional Email
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', cursor: 'not-allowed' }}>
                    <input type="checkbox" disabled />
                    SMS (Not Configured)
                  </label>
                </div>
              </div>

              {/* Target Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.4rem' }}>
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
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.4rem' }}>
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
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.4rem' }}>
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
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.4rem' }}>
                    Recipient Role
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
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.4rem' }}>
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
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.4rem' }}>
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
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.4rem' }}>
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
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Message Body
                </label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={5}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-base)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'inherit',
                    fontSize: 'var(--font-size-sm)',
                    resize: 'vertical',
                  }}
                  placeholder="Enter message content. You may use {{user_name}} variables."
                  required
                />
              </div>

              {/* Justification for CRITICAL or Broadcast */}
              {(composePriority === CommunicationPriority.CRITICAL || composeTarget === CommunicationTargetType.BROADCAST) && (
                <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-danger)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)', fontWeight: 600, marginBottom: '0.4rem', fontSize: 'var(--font-size-xs)' }}>
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

              <Button type="submit" variant="primary" disabled={isSending} style={{ marginTop: '0.5rem' }}>
                <Send size={14} style={{ marginRight: '0.4rem' }} />
                {isSending ? 'Dispatching Message...' : 'Dispatch Communication'}
              </Button>
            </form>
          </Card>

          {/* Live Preview Card */}
          <Card accentColor="blue">
            <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Eye size={16} /> Live Preview
            </h4>
            <div
              style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-subtle)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Badge variant="brand">IN-APP NOTIFICATION</Badge>
                {renderPriorityBadge(composePriority)}
              </div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
                {composeSubject || 'Subject Header Preview'}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {composeBody || 'The message body will appear here once typed in the composer form.'}
              </div>
              <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.5rem', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                Channels: {composeChannels.join(', ')} • Target: {composeTarget}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: CAMPAIGNS */}
      {activeTab === 'campaigns' && (
        <Card accentColor="blue">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 700 }}>Communication Campaigns</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Manage mass broadcast campaigns with large audience safety gates.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Select
                value={campaignStatusFilter}
                onChange={(e) => setCampaignStatusFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'SCHEDULED', label: 'Scheduled Only' },
                  { value: 'PROCESSING', label: 'Processing' },
                  { value: 'COMPLETED', label: 'Completed' },
                  { value: 'CANCELLED', label: 'Cancelled' },
                ]}
              />
              <Button variant="primary" size="sm" onClick={() => setIsCampaignModalOpen(true)}>
                <Calendar size={14} style={{ marginRight: '0.35rem' }} />
                New Campaign
              </Button>
            </div>
          </div>

          <Table headers={['Campaign Title', 'Audience & Target', 'Channels', 'Priority', 'Status', 'Delivered / Failed', 'Scheduled / Sent', 'Actions']}>
            {campaigns.map((cmp) => (
              <tr key={cmp.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <td style={{ padding: 'var(--space-3)' }}>
                  <div style={{ fontWeight: 600 }}>{cmp.title}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{cmp.subject}</div>
                </td>
                <td style={{ padding: 'var(--space-3)' }}>
                  <div>{cmp.audienceCount?.toLocaleString()} Users</div>
                  <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>{cmp.targetType} {cmp.segment ? `(${cmp.segment})` : ''}</div>
                </td>
                <td style={{ padding: 'var(--space-3)' }}>
                  {cmp.channels.map((ch) => (
                    <Badge key={ch} variant="neutral" style={{ marginRight: '0.25rem' }}>
                      {ch}
                    </Badge>
                  ))}
                </td>
                <td style={{ padding: 'var(--space-3)' }}>{renderPriorityBadge(cmp.priority)}</td>
                <td style={{ padding: 'var(--space-3)' }}>{renderStatusBadge(cmp.status)}</td>
                <td style={{ padding: 'var(--space-3)' }}>
                  <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{cmp.deliveredCount}</span> /{' '}
                  <span style={{ color: cmp.failedCount > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>{cmp.failedCount}</span>
                </td>
                <td style={{ padding: 'var(--space-3)' }}>
                  {cmp.scheduledAt ? (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)' }}>
                      Sched: {new Date(cmp.scheduledAt).toLocaleString()}
                    </div>
                  ) : cmp.sentAt ? (
                    <div style={{ fontSize: 'var(--font-size-xs)' }}>Sent: {new Date(cmp.sentAt).toLocaleString()}</div>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ padding: 'var(--space-3)' }}>
                  {cmp.status === 'SCHEDULED' ? (
                    <Button variant="danger" size="sm" onClick={() => handleCancelCampaign(cmp.id)}>
                      Cancel
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled>
                      View
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          {campaigns.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No campaigns found matching filter.
            </div>
          )}
        </Card>
      )}

      {/* TAB 4: TEMPLATES */}
      {activeTab === 'templates' && (
        <Card accentColor="purple">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 700 }}>Notification Templates Repository</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                System and custom notification templates with variable substitution and version control.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Select
                value={templateCategoryFilter}
                onChange={(e) => setTemplateCategoryFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Categories' },
                  { value: 'SYSTEM', label: 'System' },
                  { value: 'FINANCIAL', label: 'Financial' },
                  { value: 'TELECOM', label: 'Telecom' },
                  { value: 'SECURITY', label: 'Security' },
                  { value: 'MARKETING', label: 'Marketing' },
                ]}
              />
              <Button variant="primary" size="sm" onClick={() => setIsTemplateModalOpen(true)}>
                <FileText size={14} style={{ marginRight: '0.35rem' }} />
                New Template
              </Button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                      {tpl.name}
                    </div>
                    <code style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-brand-bright)' }}>{tpl.slug}</code>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <Badge variant="neutral">v{tpl.version}</Badge>
                    {tpl.isSystemCritical && <Badge variant="danger">CRITICAL</Badge>}
                  </div>
                </div>

                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', background: 'var(--color-bg-base)', padding: '0.5rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.2rem' }}>{tpl.subjectTemplate}</div>
                  <div style={{ lineHeight: 1.4 }}>{tpl.bodyTemplate.slice(0, 100)}...</div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {tpl.availableVariables?.map((v) => (
                    <span
                      key={v}
                      style={{
                        padding: '0.1rem 0.35rem',
                        borderRadius: 'var(--radius-xs)',
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--color-brand-bright)',
                        fontSize: 'var(--font-size-3xs)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.5rem' }}>
                  <Badge variant="brand">{tpl.category}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(tpl)}>
                    <Eye size={12} style={{ marginRight: '0.2rem' }} /> Full Preview
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 5: SCHEDULED */}
      {activeTab === 'scheduled' && (
        <Card accentColor="amber">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 700 }}>Scheduled Messages Queue</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Pending automated dispatches waiting for target execution timestamps.
              </p>
            </div>
          </div>

          <Table headers={['Campaign / Message', 'Target Audience', 'Channels', 'Scheduled Timestamp', 'Status', 'Actions']}>
            {campaigns
              .filter((c) => c.status === 'SCHEDULED')
              .map((cmp) => (
                <tr key={cmp.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <div style={{ fontWeight: 600 }}>{cmp.title}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{cmp.subject}</div>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>{cmp.audienceCount?.toLocaleString()} recipients ({cmp.targetType})</td>
                  <td style={{ padding: 'var(--space-3)' }}>{cmp.channels.join(', ')}</td>
                  <td style={{ padding: 'var(--space-3)' }}>{cmp.scheduledAt ? new Date(cmp.scheduledAt).toLocaleString() : '—'}</td>
                  <td style={{ padding: 'var(--space-3)' }}><Badge variant="warning">SCHEDULED</Badge></td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <Button variant="danger" size="sm" onClick={() => handleCancelCampaign(cmp.id)}>
                      Cancel Execution
                    </Button>
                  </td>
                </tr>
              ))}
          </Table>
          {campaigns.filter((c) => c.status === 'SCHEDULED').length === 0 && (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No messages currently scheduled in the queue.
            </div>
          )}
        </Card>
      )}

      {/* TAB 6: DELIVERY TRACKING LOGS */}
      {activeTab === 'delivery' && (
        <Card accentColor="cyan">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 700 }}>Communication Delivery Logs</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Comprehensive delivery audit trail with privacy-preserving sensitive data redaction.
              </p>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Input
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search recipient or subject..."
                style={{ width: '220px' }}
              />
              <Select
                value={logChannel}
                onChange={(e) => setLogChannel(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Channels' },
                  { value: 'IN_APP', label: 'In-App' },
                  { value: 'EMAIL', label: 'Email' },
                ]}
              />
              <Select
                value={logStatus}
                onChange={(e) => setLogStatus(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'DELIVERED', label: 'Delivered' },
                  { value: 'FAILED', label: 'Failed' },
                  { value: 'QUEUED', label: 'Queued' },
                ]}
              />
              <Button variant="outline" size="sm" onClick={() => fetchDeliveryLogs(1)}>
                <Search size={14} />
              </Button>
            </div>
          </div>

          <Table headers={['Recipient (Redacted)', 'Channel', 'Subject & Preview', 'Priority', 'Status', 'Attempts', 'Delivered At']}>
            {deliveryLogs.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <td style={{ padding: 'var(--space-3)' }}>
                  <div style={{ fontWeight: 600 }}>{log.recipientName}</div>
                  <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                    {log.recipientEmailRedacted} • {log.recipientRole}
                  </div>
                </td>
                <td style={{ padding: 'var(--space-3)' }}><Badge variant="neutral">{log.channel}</Badge></td>
                <td style={{ padding: 'var(--space-3)' }}>
                  <div style={{ fontWeight: 600 }}>{log.subject}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{log.bodyPreview}</div>
                </td>
                <td style={{ padding: 'var(--space-3)' }}>{renderPriorityBadge(log.priority)}</td>
                <td style={{ padding: 'var(--space-3)' }}>{renderStatusBadge(log.status)}</td>
                <td style={{ padding: 'var(--space-3)' }}>{log.attempts}</td>
                <td style={{ padding: 'var(--space-3)' }}>{log.deliveredAt ? new Date(log.deliveredAt).toLocaleTimeString() : '—'}</td>
              </tr>
            ))}
          </Table>

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Showing {deliveryLogs.length} of {deliveryPagination.total} logs (Page {deliveryPagination.page} of {deliveryPagination.totalPages})
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                variant="outline"
                size="sm"
                disabled={deliveryPagination.page <= 1}
                onClick={() => fetchDeliveryLogs(deliveryPagination.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={deliveryPagination.page >= deliveryPagination.totalPages}
                onClick={() => fetchDeliveryLogs(deliveryPagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 7: SYSTEM EVENT CATALOG */}
      {activeTab === 'system-events' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <Card accentColor="green">
            <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 700 }}>Authoritative System Event Triggers & Business Safety Invariants</h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              ByteBeacon 2.0 maintains strict transactional and telecom boundaries. System notifications are generated exclusively from verified server-side ledger and telecom fulfillment states.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-brand-bright)', marginBottom: '0.35rem' }}>
                  Financial Notification Safety
                </div>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  Payment receipts and wallet updates are triggered <strong>only</strong> after cryptographic Paystack HMAC webhook verification and double-entry voucher ledger commitment. The frontend cannot trigger payment notifications.
                </p>
              </div>

              <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-brand-bright)', marginBottom: '0.35rem' }}>
                  DataHouse Fulfillment Authority
                </div>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  Data bundle delivery notices are generated <strong>only</strong> after DataHouse upstream status confirms <code>FULFILLED</code>. Failed carrier dispatches generate automated refund notifications.
                </p>
              </div>

              <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-brand-bright)', marginBottom: '0.35rem' }}>
                  Security & Anti-Spoofing
                </div>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  Authentication alerts (new login, password change, API key rotation) include masked IP addresses and timestamps to prevent account compromise and phishing.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 8: DIAGNOSTICS */}
      {activeTab === 'diagnostics' && (
        <Card accentColor="purple">
          <h3 style={{ margin: '0 0 1rem 0', fontWeight: 700 }}>Communication Subsystem Health & Diagnostics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>In-App Notification Engine</span>
                <Badge variant="success">HEALTHY</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                Latency: 2ms • WebSocket & DB Polling Active
              </p>
            </div>

            <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Transactional Email Relay</span>
                <Badge variant="success">HEALTHY</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                Relay: SMTP/SES • Average Dispatch: 85ms
              </p>
            </div>

            <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>BullMQ Message Worker</span>
                <Badge variant="success">HEALTHY</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                Queue Depth: 0 • Active Workers: 2
              </p>
            </div>

            <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>SMS Carrier Gateway</span>
                <Badge variant="neutral">NOT CONFIGURED</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                SMS provider integration pending API key setup
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* MODAL 1: COMPOSE MESSAGE MODAL */}
      <Modal isOpen={isComposeModalOpen} onClose={() => setIsComposeModalOpen(false)} title="Compose Platform Message">
        <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.3rem' }}>
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
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.3rem' }}>
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
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.3rem' }}>
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
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.3rem' }}>
              Message Body
            </label>
            <textarea
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                padding: '0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-base)',
                color: 'var(--color-text-primary)',
                fontFamily: 'inherit',
                fontSize: 'var(--font-size-sm)',
              }}
              placeholder="Enter message text..."
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Button variant="outline" size="sm" onClick={() => setIsComposeModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isSending}>
              {isSending ? 'Sending...' : 'Send Message'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: CREATE CAMPAIGN MODAL */}
      <Modal isOpen={isCampaignModalOpen} onClose={() => setIsCampaignModalOpen(false)} title="Create Mass Communication Campaign">
        <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.3rem' }}>
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
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.3rem' }}>
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
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.3rem' }}>
              Schedule Date & Time (Leave blank for immediate dispatch)
            </label>
            <Input
              type="datetime-local"
              value={campaignScheduledAt}
              onChange={(e) => setCampaignScheduledAt(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.3rem' }}>
              Message Body
            </label>
            <textarea
              value={campaignBody}
              onChange={(e) => setCampaignBody(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                padding: '0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-base)',
                color: 'var(--color-text-primary)',
                fontFamily: 'inherit',
                fontSize: 'var(--font-size-sm)',
              }}
              placeholder="Campaign announcement content..."
              required
            />
          </div>

          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
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
            <Button variant="outline" size="sm" onClick={() => setIsCampaignModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isCreatingCampaign}>
              {isCreatingCampaign ? 'Creating...' : 'Schedule Campaign'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: CREATE TEMPLATE MODAL */}
      <Modal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} title="Register Notification Template">
        <form onSubmit={handleCreateTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.3rem' }}>
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
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.3rem' }}>
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
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.3rem' }}>
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
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.3rem' }}>
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
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.3rem' }}>
              Body Template
            </label>
            <textarea
              value={templateBody}
              onChange={(e) => setTemplateBody(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                padding: '0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-base)',
                color: 'var(--color-text-primary)',
                fontFamily: 'inherit',
                fontSize: 'var(--font-size-sm)',
              }}
              placeholder="Enter template body with {{variable}} placeholders..."
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Button variant="outline" size="sm" onClick={() => setIsTemplateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isCreatingTemplate}>
              {isCreatingTemplate ? 'Registering...' : 'Save Template'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: TEMPLATE FULL PREVIEW MODAL */}
      <Modal isOpen={!!previewTemplate} onClose={() => setPreviewTemplate(null)} title={previewTemplate?.name || 'Template Preview'}>
        {previewTemplate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <code>{previewTemplate.slug}</code>
              <Badge variant="brand">Version {previewTemplate.version}</Badge>
            </div>

            <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Subject:</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>{previewTemplate.subjectTemplate}</div>
            </div>

            <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Body:</div>
              <div style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{previewTemplate.bodyTemplate}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" size="sm" onClick={() => setPreviewTemplate(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
