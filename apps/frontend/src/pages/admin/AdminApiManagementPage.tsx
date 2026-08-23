import React, { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Select, Modal, Input } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import {
  Key,
  Shield,
  ShieldAlert,
  RefreshCw,
  Layers,
  Activity,
  Zap,
  Radio,
  Sliders,
  Copy,
  Eye,
  RotateCw,
  Trash2,
  Send,
  Server,
  Terminal,
  Users,
} from 'lucide-react';
import {
  adminApi,
  AdminApiOverviewStats,
  AdminApiKeyListItemDto,
  AdminApiKeyDetailDto,
  AdminApiUsageAnalyticsDto,
  AdminApiSecurityEventDto,
  AdminWebhookListItemDto,
  AdminProviderConnectionDto,
  AdminApiPolicyConfigDto,
  AdminApiConsumerDto,
  AdminStructuredHealthDto,
  ApiKeyEnvironment,
  Permission,
} from '../../api/admin.api.js';

export const AdminApiManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'CONSUMERS' | 'KEYS' | 'USAGE' | 'ENDPOINTS' | 'WEBHOOKS' | 'SECURITY' | 'SANDBOX' | 'PROVIDERS' | 'POLICIES'
  >('OVERVIEW');

  const [isLoading, setIsLoading] = useState(false);
  const [overview, setOverview] = useState<AdminApiOverviewStats | null>(null);
  const [structuredHealth, setStructuredHealth] = useState<AdminStructuredHealthDto | null>(null);

  // --- API Consumers Tab State ---
  const [consumers, setConsumers] = useState<AdminApiConsumerDto[]>([]);
  const [consumerSearch, setConsumerSearch] = useState('');
  const [consumerEnvFilter, setConsumerEnvFilter] = useState('ALL');
  const [consumerStatusFilter, setConsumerStatusFilter] = useState('ALL');
  const [consumerPage, setConsumerPage] = useState(1);
  const [consumerTotalPages, setConsumerTotalPages] = useState(1);
  const [consumerTotal, setConsumerTotal] = useState(0);
  const [isCreateConsumerModalOpen, setIsCreateConsumerModalOpen] = useState(false);
  const [newConsumerName, setNewConsumerName] = useState('');
  const [newConsumerDesc, setNewConsumerDesc] = useState('');
  const [newConsumerOwnerId, setNewConsumerOwnerId] = useState('');
  const [newConsumerEnv, setNewConsumerEnv] = useState<ApiKeyEnvironment>(ApiKeyEnvironment.LIVE);

  // --- API Keys Tab State ---
  const [keys, setKeys] = useState<AdminApiKeyListItemDto[]>([]);
  const [keySearch, setKeySearch] = useState('');
  const [keyEnvFilter, setKeyEnvFilter] = useState('ALL');
  const [keyStatusFilter, setKeyStatusFilter] = useState('ALL');
  const [keyPage, setKeyPage] = useState(1);
  const [keyTotalPages, setKeyTotalPages] = useState(1);
  const [keyTotal, setKeyTotal] = useState(0);

  // --- Modals State ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyOwnerId, setNewKeyOwnerId] = useState('');
  const [newKeyEnv, setNewKeyEnv] = useState<ApiKeyEnvironment>(ApiKeyEnvironment.LIVE);
  const [newKeyScopes, setNewKeyScopes] = useState<Permission[]>([Permission.ORDERS_READ, Permission.ORDERS_CREATE]);
  const [newKeyExpiryDays, setNewKeyExpiryDays] = useState('90');
  const [newKeyRateLimit, setNewKeyRateLimit] = useState('300');
  const [newKeyIpRestrictions, setNewKeyIpRestrictions] = useState('');
  const [createdSecretResult, setCreatedSecretResult] = useState<{ rawApiKey: string; keyPrefix: string; name: string } | null>(null);

  // Rotate Key Modal
  const [rotateKeyId, setRotateKeyId] = useState<string | null>(null);
  const [rotateReason, setRotateReason] = useState('');
  const [rotateGraceHours, setRotateGraceHours] = useState('24');
  const [rotatedSecretResult, setRotatedSecretResult] = useState<{ rawApiKey: string; keyPrefix: string } | null>(null);

  // Key Detail Modal
  const [selectedKeyDetail, setSelectedKeyDetail] = useState<AdminApiKeyDetailDto | null>(null);

  // --- Usage Tab State ---
  const [usageRange, setUsageRange] = useState('30d');
  const [usageData, setUsageData] = useState<AdminApiUsageAnalyticsDto | null>(null);

  // --- Webhooks Tab State ---
  const [webhooks, setWebhooks] = useState<AdminWebhookListItemDto[]>([]);

  // --- Security Tab State ---
  const [securityEvents, setSecurityEvents] = useState<AdminApiSecurityEventDto[]>([]);
  const [secSeverityFilter, setSecSeverityFilter] = useState('ALL');

  // --- Provider Connections State ---
  const [providers, setProviders] = useState<AdminProviderConnectionDto[]>([]);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [targetSwitchProvider, setTargetSwitchProvider] = useState('');
  const [switchReason, setSwitchReason] = useState('');
  const [switchConfirmationText, setSwitchConfirmationText] = useState('');
  const [switchingProvider, setSwitchingProvider] = useState(false);

  // --- Policies State ---
  const [policies, setPolicies] = useState<AdminApiPolicyConfigDto | null>(null);
  const [policiesSaving, setPoliciesSaving] = useState(false);

  // 1. Fetch Overview Stats & Structured Health
  const fetchOverview = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ovRes, hlRes] = await Promise.all([
        adminApi.getApiOverview(),
        adminApi.getStructuredApiHealth().catch(() => null),
      ]);
      setOverview(ovRes);
      if (hlRes) setStructuredHealth(hlRes);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 1b. Fetch API Consumers List
  const fetchConsumers = useCallback(async () => {
    try {
      const res = await adminApi.getApiConsumers({
        search: consumerSearch || undefined,
        environment: consumerEnvFilter !== 'ALL' ? (consumerEnvFilter as any) : undefined,
        status: consumerStatusFilter !== 'ALL' ? (consumerStatusFilter as any) : undefined,
        page: consumerPage,
        limit: 20,
      });
      if (res && Array.isArray(res.items)) {
        setConsumers(res.items);
        setConsumerTotalPages(res.pagination?.totalPages || 1);
        setConsumerTotal(res.pagination?.total || 0);
      }
    } catch {
      setConsumers([]);
    }
  }, [consumerSearch, consumerEnvFilter, consumerStatusFilter, consumerPage]);

  // 2. Fetch API Keys List
  const fetchKeys = useCallback(async () => {
    try {
      const res = await adminApi.getApiKeys({
        search: keySearch || undefined,
        environment: keyEnvFilter !== 'ALL' ? (keyEnvFilter as any) : undefined,
        status: keyStatusFilter !== 'ALL' ? (keyStatusFilter as any) : undefined,
        page: keyPage,
        limit: 20,
      });
      if (res && Array.isArray(res.items)) {
        setKeys(res.items);
        setKeyTotalPages(res.pagination?.totalPages || 1);
        setKeyTotal(res.pagination?.total || 0);
      }
    } catch {
      setKeys([]);
    }
  }, [keySearch, keyEnvFilter, keyStatusFilter, keyPage]);

  // 3. Fetch Usage Analytics
  const fetchUsage = useCallback(async () => {
    try {
      const res = await adminApi.getApiUsage({ timeRange: usageRange });
      setUsageData(res);
    } catch {
      // Fallback
    }
  }, [usageRange]);

  // 4. Fetch Webhooks
  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await adminApi.getAdminWebhooks({ page: 1 });
      if (res && Array.isArray(res.items)) {
        setWebhooks(res.items);
      }
    } catch {
      setWebhooks([]);
    }
  }, []);

  // 5. Fetch Security Events
  const fetchSecurityEvents = useCallback(async () => {
    try {
      const res = await adminApi.getApiSecurityEvents({
        page: 1,
        severity: secSeverityFilter !== 'ALL' ? secSeverityFilter : undefined,
      });
      if (res && Array.isArray(res.items)) {
        setSecurityEvents(res.items);
      }
    } catch {
      setSecurityEvents([]);
    }
  }, [secSeverityFilter]);

  // 6. Fetch Providers
  const fetchProviders = useCallback(async () => {
    try {
      const res = await adminApi.getAdminProviders();
      setProviders(res);
    } catch {
      setProviders([]);
    }
  }, []);

  // 7. Fetch Policies
  const fetchPolicies = useCallback(async () => {
    try {
      const res = await adminApi.getApiPolicies();
      setPolicies(res);
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (activeTab === 'OVERVIEW') fetchOverview();
    if (activeTab === 'CONSUMERS') fetchConsumers();
    if (activeTab === 'KEYS') fetchKeys();
    if (activeTab === 'USAGE' || activeTab === 'ENDPOINTS') fetchUsage();
    if (activeTab === 'WEBHOOKS') fetchWebhooks();
    if (activeTab === 'SECURITY') fetchSecurityEvents();
    if (activeTab === 'PROVIDERS') fetchProviders();
    if (activeTab === 'POLICIES') fetchPolicies();
  }, [activeTab, fetchOverview, fetchConsumers, fetchKeys, fetchUsage, fetchWebhooks, fetchSecurityEvents, fetchProviders, fetchPolicies]);

  // Create API Key Handler
  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      alert('Key name is required');
      return;
    }

    try {
      const res = await adminApi.createAdminApiKey({
        name: newKeyName.trim(),
        ownerUserId: newKeyOwnerId.trim() || undefined as any,
        environment: newKeyEnv,
        scopes: newKeyScopes,
        expiresInDays: parseInt(newKeyExpiryDays, 10) || 90,
        rateLimitPerMinute: parseInt(newKeyRateLimit, 10) || 300,
        ipRestrictions: newKeyIpRestrictions.split(',').map((s: string) => s.trim()).filter(Boolean),
      });

      setCreatedSecretResult({
        rawApiKey: res.rawApiKey,
        keyPrefix: res.keyPrefix,
        name: res.name,
      });
      fetchKeys();
      fetchOverview();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to create API key');
    }
  };

  // Rotate Key Handler
  const handleRotateKey = async () => {
    if (!rotateKeyId || !rotateReason.trim()) {
      alert('A reason is required to rotate an API key');
      return;
    }

    try {
      const res = await adminApi.rotateAdminApiKey(rotateKeyId, {
        reason: rotateReason.trim(),
        expiresOldInHours: parseInt(rotateGraceHours, 10) || 24,
      });

      setRotatedSecretResult({
        rawApiKey: res.rawApiKey,
        keyPrefix: res.keyPrefix,
      });
      fetchKeys();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to rotate API key');
    }
  };

  // Revoke Key Handler
  const handleRevokeKey = async (id: string, name: string) => {
    const reason = prompt(`Authorize revocation of API Key "${name}". Enter justification:`);
    if (!reason) return;

    try {
      await adminApi.revokeAdminApiKey(id, reason);
      alert('API key revoked immediately.');
      fetchKeys();
      fetchOverview();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to revoke API key');
    }
  };

  // Switch Authoritative Provider Handler
  const handleSwitchProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSwitchProvider || !switchReason.trim()) {
      alert('Target provider and justification reason are mandatory.');
      return;
    }
    if (switchConfirmationText !== 'SWITCH PROVIDER') {
      alert('Please type "SWITCH PROVIDER" in the confirmation box.');
      return;
    }

    setSwitchingProvider(true);
    try {
      await adminApi.switchAuthoritativeProvider({
        newProvider: targetSwitchProvider,
        reason: switchReason.trim(),
      });
      alert(`Authoritative telecom fulfillment migrated to ${targetSwitchProvider} successfully.`);
      setIsSwitchModalOpen(false);
      setSwitchReason('');
      setSwitchConfirmationText('');
      fetchProviders();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to switch authoritative provider.');
    } finally {
      setSwitchingProvider(false);
    }
  };

  // Create Consumer Handler
  const handleCreateConsumer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConsumerName.trim()) {
      alert('Consumer name is required');
      return;
    }

    try {
      await adminApi.createApiConsumer({
        name: newConsumerName.trim(),
        description: newConsumerDesc.trim() || undefined,
        ownerUserId: newConsumerOwnerId.trim() || undefined as any,
        environment: newConsumerEnv,
      });
      alert('API Consumer created successfully.');
      setIsCreateConsumerModalOpen(false);
      setNewConsumerName('');
      setNewConsumerDesc('');
      setNewConsumerOwnerId('');
      fetchConsumers();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to create consumer');
    }
  };

  // Toggle Consumer Status
  const handleToggleConsumerStatus = async (id: string, name: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const reason = prompt(`Authorize status change for consumer "${name}" to ${nextStatus}. Enter justification:`);
    if (!reason) return;

    try {
      await adminApi.updateApiConsumer(id, { status: nextStatus, reason });
      alert(`Consumer status updated to ${nextStatus}.`);
      fetchConsumers();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to update consumer status');
    }
  };

  // Save Policies Handler
  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policies) return;

    const reason = prompt('Super Admin Authorization: Enter justification for updating API governance policies:');
    if (!reason) return;

    setPoliciesSaving(true);
    try {
      await adminApi.updateApiPolicies({
        policies,
        reason,
      });
      alert('API policies and emergency controls updated successfully.');
      fetchPolicies();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to update API policies.');
    } finally {
      setPoliciesSaving(false);
    }
  };

  // Webhook Test Ping
  const handleTestWebhook = async (id: string) => {
    try {
      const res = await adminApi.testAdminWebhook(id) as any;
      alert(res.message || 'Test event delivered successfully.');
      fetchWebhooks();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Webhook ping failed.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Key} color="api" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-api-bright)' }}>
              Developer Platform & Gateway Governance
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
              API Management & Security Center
            </h1>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Developer API credentials, endpoint latency analytics, webhook event dispatching, and telecom provider switching.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => { fetchOverview(); fetchKeys(); fetchConsumers(); fetchUsage(); }} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} style={{ marginRight: '0.35rem' }} /> Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => { setCreatedSecretResult(null); setIsCreateModalOpen(true); }}>
            <Key size={14} style={{ marginRight: '0.35rem' }} /> Generate API Key
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setIsCreateConsumerModalOpen(true)}>
            <Users size={14} style={{ marginRight: '0.35rem' }} /> Register Consumer
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setIsSwitchModalOpen(true); }}>
            <Radio size={14} style={{ marginRight: '0.35rem' }} /> Switch Provider
          </Button>
          <Button variant="danger" size="sm" onClick={() => setActiveTab('POLICIES')}>
            <ShieldAlert size={14} style={{ marginRight: '0.35rem' }} /> Emergency Controls
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          title="Active API Keys"
          value={String(overview?.activeKeys || 0)}
          subvalue={`${overview?.totalKeys || 0} total (${overview?.productionKeys || 0} prod, ${overview?.testKeys || 0} sandbox)`}
          accent="blue"
          icon={<TactileIcon icon={Key} color="api" size="sm" />}
        />
        <MetricCard
          title="Requests Today"
          value={(overview?.requestsToday || 0).toLocaleString()}
          subvalue={`${overview?.failedRequestsToday || 0} failed (${overview?.rateLimitEventsToday || 0} rate-limited)`}
          accent="green"
          icon={<TactileIcon icon={Activity} color="speed" size="sm" />}
        />
        <MetricCard
          title="P95 Latency"
          value={`${overview?.p95LatencyMs || 88}ms`}
          subvalue={`Avg: ${overview?.avgLatencyMs || 42}ms | P99: ${overview?.p99LatencyMs || 165}ms`}
          accent="purple"
          icon={<TactileIcon icon={Zap} color="security" size="sm" />}
        />
        <MetricCard
          title="Security Events"
          value={String(overview?.authFailuresToday || 0)}
          subvalue="Authentication & scope violations"
          accent={overview?.authFailuresToday ? 'amber' : 'green'}
          icon={<TactileIcon icon={ShieldAlert} color={overview?.authFailuresToday ? 'amber' : 'security'} size="sm" />}
        />
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', gap: '1.25rem', overflowX: 'auto' }}>
        {[
          { id: 'OVERVIEW', label: 'Overview & Health', icon: Layers },
          { id: 'CONSUMERS', label: `API Consumers (${consumers.length})`, icon: Users },
          { id: 'KEYS', label: `API Keys (${overview?.totalKeys || 0})`, icon: Key },
          { id: 'USAGE', label: 'Usage & Latency', icon: Activity },
          { id: 'ENDPOINTS', label: 'Endpoint Drill-Down', icon: Server },
          { id: 'WEBHOOKS', label: `Webhooks (${webhooks.length})`, icon: Send },
          { id: 'SECURITY', label: `Security Center (${securityEvents.length})`, icon: Shield },
          { id: 'SANDBOX', label: 'Sandbox Isolation', icon: Terminal },
          { id: 'PROVIDERS', label: `Provider Connections (${providers.length})`, icon: Radio },
          { id: 'POLICIES', label: 'Policies & Kill Switches', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.75rem 0.5rem',
                fontSize: 'var(--font-size-sm)',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--color-api-bright)' : 'var(--color-text-muted)',
                borderBottom: isActive ? '2px solid var(--color-api-bright)' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={15} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* --- TAB 1: OVERVIEW & HEALTH --- */}
      {activeTab === 'OVERVIEW' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card accentColor="blue">
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
              Live API Gateway & Upstream Telecom Health
            </h3>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Real-time latency telemetry across customer-facing endpoints, developer API gateways, and upstream provider connections.
            </p>
          </Card>

          <Card>
            <Table headers={['API Service / Rail', 'Environment', 'Health Status', '24h Volume', 'Error Rate', 'Avg Latency']}>
              {(overview?.servicesHealth || []).map((srv) => (
                <tr key={srv.name} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                      {srv.name}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <Badge variant={srv.environment === 'LIVE' ? 'success' : 'neutral'}>
                      {srv.environment}
                    </Badge>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <Badge variant={srv.status === 'HEALTHY' ? 'success' : srv.status === 'DEGRADED' ? 'warning' : 'danger'}>
                      {srv.status}
                    </Badge>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {srv.requests24h.toLocaleString()} reqs
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: srv.errorRatePercent > 1 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                      {srv.errorRatePercent}%
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {srv.avgLatencyMs} ms
                    </span>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>

          {/* Structured Platform Infrastructure Health */}
          {structuredHealth && (
            <Card accentColor="cyan">
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
                Platform Subsystem Operational Matrix
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
                {Object.entries(structuredHealth.components).map(([key, comp]) => (
                  <div
                    key={key}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-surface-sunken)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '11px' }}>{comp.name}</span>
                      <Badge variant={comp.status === 'OPERATIONAL' ? 'success' : 'danger'}>
                        {comp.status}
                      </Badge>
                    </div>
                    {comp.latencyMs !== undefined && (
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Latency: {comp.latencyMs}ms
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* --- TAB 1b: API CONSUMERS --- */}
      {activeTab === 'CONSUMERS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card accentColor="blue">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Search API Consumers</label>
                <SearchInput
                  value={consumerSearch}
                  onChange={(e) => setConsumerSearch(e.target.value)}
                  placeholder="Application name, owner name, email..."
                />
              </div>

              <div style={{ minWidth: '150px' }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Environment</label>
                <Select
                  value={consumerEnvFilter}
                  onChange={(e) => setConsumerEnvFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Environments' },
                    { value: 'LIVE', label: 'LIVE / Production' },
                    { value: 'TEST', label: 'TEST / Sandbox' },
                  ]}
                />
              </div>

              <div style={{ minWidth: '150px' }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Status</label>
                <Select
                  value={consumerStatusFilter}
                  onChange={(e) => setConsumerStatusFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Statuses' },
                    { value: 'ACTIVE', label: 'ACTIVE' },
                    { value: 'SUSPENDED', label: 'SUSPENDED' },
                    { value: 'REVOKED', label: 'REVOKED' },
                  ]}
                />
              </div>
            </div>
          </Card>

          <Card>
            <Table headers={['Consumer Application', 'Owner Account', 'Environment', 'Status', 'API Keys', '24h Requests', 'Last Activity', 'Actions']}>
              {consumers.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{c.name}</span>
                      {c.description && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{c.description}</span>}
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{c.ownerName}</span>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{c.ownerEmail}</span>
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <Badge variant={c.environment === 'LIVE' ? 'success' : 'neutral'}>
                      {c.environment}
                    </Badge>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <Badge variant={c.status === 'ACTIVE' ? 'success' : c.status === 'SUSPENDED' ? 'warning' : 'danger'}>
                      {c.status}
                    </Badge>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {c.keyCount} keys
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      {c.requestCount24h.toLocaleString()}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {c.lastActivityAt ? new Date(c.lastActivityAt).toLocaleTimeString() : 'Never'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <Button
                        variant={c.status === 'ACTIVE' ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => handleToggleConsumerStatus(c.id, c.name, c.status)}
                      >
                        {c.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>

            <Pagination
              currentPage={consumerPage}
              totalPages={consumerTotalPages}
              totalItems={consumerTotal}
              onPageChange={(p) => setConsumerPage(p)}
            />
          </Card>
        </div>
      )}

      {/* --- TAB 2: API KEYS --- */}
      {activeTab === 'KEYS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card accentColor="purple">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Search API Keys</label>
                <SearchInput
                  value={keySearch}
                  onChange={(e) => setKeySearch(e.target.value)}
                  placeholder="Key prefix, name, owner email, phone..."
                />
              </div>

              <div style={{ minWidth: '150px' }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Environment</label>
                <Select
                  value={keyEnvFilter}
                  onChange={(e) => setKeyEnvFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Environments' },
                    { value: 'LIVE', label: 'LIVE / Production' },
                    { value: 'TEST', label: 'TEST / Sandbox' },
                  ]}
                />
              </div>

              <div style={{ minWidth: '150px' }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Status</label>
                <Select
                  value={keyStatusFilter}
                  onChange={(e) => setKeyStatusFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Statuses' },
                    { value: 'ACTIVE', label: 'ACTIVE' },
                    { value: 'REVOKED', label: 'REVOKED' },
                    { value: 'EXPIRED', label: 'EXPIRED' },
                  ]}
                />
              </div>
            </div>
          </Card>

          <Card>
            <Table headers={['Key Identifier', 'Owner / Account', 'Environment', 'Status', 'Permitted Scopes', 'Rate Limit', 'Created', 'Actions']}>
              {keys.map((k) => (
                <tr key={k.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{k.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {k.keyPrefix}••••••••
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{k.ownerName}</span>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{k.ownerEmail} ({k.ownerRole})</span>
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <Badge variant={k.environment === 'LIVE' ? 'success' : 'neutral'}>
                      {k.environment}
                    </Badge>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <Badge variant={k.status === 'ACTIVE' ? 'success' : k.status === 'REVOKED' ? 'danger' : 'warning'}>
                      {k.status}
                    </Badge>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', maxWidth: '200px' }}>
                      {k.scopes.slice(0, 2).map((s) => (
                        <span key={s} style={{ fontSize: '10px', padding: '1px 4px', backgroundColor: 'var(--color-surface-sunken)', borderRadius: '3px' }}>
                          {s}
                        </span>
                      ))}
                      {k.scopes.length > 2 && (
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>+{k.scopes.length - 2} more</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                      {k.rateLimitPerMinute} / min
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {new Date(k.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <Button variant="secondary" size="sm" onClick={async () => {
                        const res = await adminApi.getApiKeyDetail(k.id);
                        setSelectedKeyDetail(res);
                      }}>
                        <Eye size={12} style={{ marginRight: '0.2rem' }} /> Dossier
                      </Button>
                      {k.status === 'ACTIVE' && (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => { setRotateKeyId(k.id); setRotateReason(''); setRotatedSecretResult(null); }}>
                            <RotateCw size={12} style={{ marginRight: '0.2rem' }} /> Rotate
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleRevokeKey(k.id, k.name)}>
                            <Trash2 size={12} />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>

            <Pagination
              currentPage={keyPage}
              totalPages={keyTotalPages}
              totalItems={keyTotal}
              onPageChange={(p) => setKeyPage(p)}
            />
          </Card>
        </div>
      )}

      {/* --- TAB 3: USAGE & LATENCY --- */}
      {activeTab === 'USAGE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontWeight: 700 }}>API Traffic & Latency Distribution</h3>
            <Select
              value={usageRange}
              onChange={(e) => setUsageRange(e.target.value)}
              options={[
                { value: 'today', label: 'Today (24 Hours)' },
                { value: '7d', label: 'Last 7 Days' },
                { value: '30d', label: 'Last 30 Days' },
                { value: '90d', label: 'Last 90 Days' },
              ]}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
            <MetricCard title="Total Requests" value={(usageData?.totalRequests || 0).toLocaleString()} accent="blue" />
            <MetricCard title="Success (2xx)" value={(usageData?.successRequests || 0).toLocaleString()} accent="green" />
            <MetricCard title="Client Errors (4xx)" value={(usageData?.clientErrors || 0).toLocaleString()} accent="amber" />
            <MetricCard title="Server Errors (5xx)" value={(usageData?.serverErrors || 0).toLocaleString()} accent="red" />
            <MetricCard title="429 Rate Limits" value={String(usageData?.rateLimitEvents || 0)} accent="purple" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-4)' }}>
            {/* Top Endpoints */}
            <Card>
              <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Top Requested Endpoints</h4>
              <Table headers={['Endpoint', 'Method', 'Requests', 'Error %', 'P95 Latency']}>
                {(usageData?.topEndpoints || []).map((ep) => (
                  <tr key={ep.endpoint} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600 }}>{ep.endpoint}</span>
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <Badge variant="brand">{ep.method}</Badge>
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <span style={{ fontWeight: 700 }}>{ep.requests.toLocaleString()}</span>
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <span style={{ color: ep.errorRatePercent > 1 ? 'var(--color-danger)' : 'inherit' }}>{ep.errorRatePercent}%</span>
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{ep.p95LatencyMs}ms</span>
                    </td>
                  </tr>
                ))}
              </Table>
            </Card>

            {/* Top Agents */}
            <Card>
              <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Top Consuming Resellers & Developers</h4>
              <Table headers={['Agent / Developer', 'Total Requests', 'Error Count', 'Last Activity']}>
                {(usageData?.agentUsage || []).map((ag) => (
                  <tr key={ag.agentId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{ag.agentName}</span>
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <span style={{ fontWeight: 700 }}>{ag.requests.toLocaleString()}</span>
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <span style={{ color: ag.errors > 0 ? 'var(--color-danger)' : 'inherit' }}>{ag.errors}</span>
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {ag.lastUsedAt ? new Date(ag.lastUsedAt).toLocaleTimeString() : 'Never'}
                      </span>
                    </td>
                  </tr>
                ))}
              </Table>
            </Card>
          </div>
        </div>
      )}

      {/* --- TAB 4: ENDPOINTS --- */}
      {activeTab === 'ENDPOINTS' && (
        <Card accentColor="cyan">
          <h3 style={{ margin: '0 0 1rem 0', fontWeight: 700 }}>API Endpoints Catalog & Performance</h3>
          <Table headers={['HTTP Method', 'Path', 'Authentication', 'Required Scope', 'Rate Limit Tier', 'Status']}>
            <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <td style={{ padding: 'var(--space-3)' }}><Badge variant="success">POST</Badge></td>
              <td style={{ padding: 'var(--space-3)' }}>/api/v1/orders</td>
              <td style={{ padding: 'var(--space-3)' }}>Bearer API Key</td>
              <td style={{ padding: 'var(--space-3)' }}>orders.create</td>
              <td style={{ padding: 'var(--space-3)' }}>AGENT (300/min)</td>
              <td style={{ padding: 'var(--space-3)' }}><Badge variant="success">HEALTHY</Badge></td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <td style={{ padding: 'var(--space-3)' }}><Badge variant="brand">GET</Badge></td>
              <td style={{ padding: 'var(--space-3)' }}>/api/v1/orders/:id</td>
              <td style={{ padding: 'var(--space-3)' }}>Bearer API Key</td>
              <td style={{ padding: 'var(--space-3)' }}>orders.read</td>
              <td style={{ padding: 'var(--space-3)' }}>AGENT (300/min)</td>
              <td style={{ padding: 'var(--space-3)' }}><Badge variant="success">HEALTHY</Badge></td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <td style={{ padding: 'var(--space-3)' }}><Badge variant="brand">GET</Badge></td>
              <td style={{ padding: 'var(--space-3)' }}>/api/v1/catalog/bundles</td>
              <td style={{ padding: 'var(--space-3)' }}>Public / None</td>
              <td style={{ padding: 'var(--space-3)' }}>None</td>
              <td style={{ padding: 'var(--space-3)' }}>CUSTOMER (120/min)</td>
              <td style={{ padding: 'var(--space-3)' }}><Badge variant="success">HEALTHY</Badge></td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <td style={{ padding: 'var(--space-3)' }}><Badge variant="success">POST</Badge></td>
              <td style={{ padding: 'var(--space-3)' }}>/api/v1/bulk-orders</td>
              <td style={{ padding: 'var(--space-3)' }}>Bearer API Key</td>
              <td style={{ padding: 'var(--space-3)' }}>orders.create</td>
              <td style={{ padding: 'var(--space-3)' }}>CUSTOM (60/min)</td>
              <td style={{ padding: 'var(--space-3)' }}><Badge variant="success">HEALTHY</Badge></td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <td style={{ padding: 'var(--space-3)' }}><Badge variant="warning">POST</Badge></td>
              <td style={{ padding: 'var(--space-3)' }}>/api/v1/orders/:id/refund</td>
              <td style={{ padding: 'var(--space-3)' }}>Bearer Token</td>
              <td style={{ padding: 'var(--space-3)' }}>orders.refund</td>
              <td style={{ padding: 'var(--space-3)' }}>ADMIN (600/min)</td>
              <td style={{ padding: 'var(--space-3)' }}><Badge variant="success">HEALTHY</Badge></td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <td style={{ padding: 'var(--space-3)' }}><Badge variant="brand">GET</Badge></td>
              <td style={{ padding: 'var(--space-3)' }}>/api/v1/agents/wallet/balance</td>
              <td style={{ padding: 'var(--space-3)' }}>Bearer API Key</td>
              <td style={{ padding: 'var(--space-3)' }}>wallet.read</td>
              <td style={{ padding: 'var(--space-3)' }}>AGENT (300/min)</td>
              <td style={{ padding: 'var(--space-3)' }}><Badge variant="success">HEALTHY</Badge></td>
            </tr>
          </Table>
        </Card>
      )}

      {/* --- TAB 5: WEBHOOKS --- */}
      {activeTab === 'WEBHOOKS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card accentColor="green">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 700 }}>Agent Webhook Delivery Dispatcher</h3>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Event notification callbacks with HMAC SHA-256 signatures, exponential backoff, and replay defense.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <Table headers={['Agent / Reseller', 'Webhook URL', 'Subscribed Events', 'Status', 'Failure Count', 'Last Delivery', 'Actions']}>
              {webhooks.map((w) => (
                <tr key={w.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{w.agentName}</span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{w.url}</span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                      {w.events.map((evt) => (
                        <span key={evt} style={{ fontSize: '10px', padding: '1px 4px', backgroundColor: 'var(--color-surface-sunken)', borderRadius: '3px' }}>
                          {evt}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <Badge variant={w.status === 'ACTIVE' ? 'success' : 'danger'}>{w.status}</Badge>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ color: w.failureCount > 0 ? 'var(--color-danger)' : 'inherit' }}>{w.failureCount}</span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {w.lastDeliveryAt ? `${new Date(w.lastDeliveryAt).toLocaleTimeString()} (${w.lastDeliveryStatus})` : 'None'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <Button variant="secondary" size="sm" onClick={() => handleTestWebhook(w.id)}>
                      <Send size={12} style={{ marginRight: '0.2rem' }} /> Test Ping
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}

      {/* --- TAB 6: SECURITY CENTER --- */}
      {activeTab === 'SECURITY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card accentColor="red">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--color-danger)' }}>
                  API Security Violations & Anomaly Stream
                </h3>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Real-time detection of forged signatures, repeated 401/403 attempts, scope breaches, and rate-limit violations.
                </p>
              </div>

              <Select
                value={secSeverityFilter}
                onChange={(e) => setSecSeverityFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Severities' },
                  { value: 'CRITICAL', label: 'CRITICAL' },
                  { value: 'HIGH', label: 'HIGH' },
                  { value: 'MEDIUM', label: 'MEDIUM' },
                  { value: 'LOW', label: 'LOW' },
                ]}
              />
            </div>
          </Card>

          <Card>
            <Table headers={['Event Type', 'Severity', 'Caller IP', 'Target Endpoint', 'Associated Key', 'Timestamp']}>
              {securityEvents.map((evt) => (
                <tr key={evt.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{evt.eventType}</span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <Badge variant={evt.severity === 'CRITICAL' || evt.severity === 'HIGH' ? 'danger' : 'warning'}>
                      {evt.severity}
                    </Badge>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{evt.ipAddress}</span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{evt.endpoint}</span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{evt.keyPrefix || 'None'}</span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {new Date(evt.timestamp).toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}

      {/* --- TAB 7: SANDBOX --- */}
      {activeTab === 'SANDBOX' && (
        <Card accentColor="amber">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <Terminal size={32} color="var(--color-warning)" />
            <div>
              <h3 style={{ margin: 0, fontWeight: 700 }}>Isolated Developer Sandbox Environment</h3>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Safe testing environment using mock telecom responses and non-contaminating test ledger balances.
              </p>
            </div>
          </div>

          <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', padding: '1rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-warning)' }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-warning)' }}>
              Non-Contamination Guarantee
            </span>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)' }}>
              Sandbox API keys prefixed with <code>ak_test_</code> or <code>bb_test_</code> can never mutate production financial ledger state or trigger live telecom carrier airtime/data dispatches.
            </p>
          </div>
        </Card>
      )}

      {/* --- TAB 8: PROVIDER CONNECTIONS & SWITCHING --- */}
      {activeTab === 'PROVIDERS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card accentColor="cyan">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 700 }}>Telecom & Payment Provider Connections</h3>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Active gateway connections. Switch authoritative providers with elevated Super Admin verification.
                </p>
              </div>

              <Button variant="primary" onClick={() => setIsSwitchModalOpen(true)}>
                <Radio size={14} style={{ marginRight: '0.35rem' }} /> Switch Authoritative Provider
              </Button>
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
            {providers.map((p) => (
              <Card key={p.id} accentColor={p.isAuthoritative ? 'green' : 'blue'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-base)' }}>{p.providerName}</h4>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Slug: {p.slug}</span>
                  </div>
                  {p.isAuthoritative ? (
                    <Badge variant="success">AUTHORITATIVE</Badge>
                  ) : (
                    <Badge variant="neutral">SECONDARY</Badge>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--font-size-xs)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Status:</span>
                    <Badge variant={p.status === 'HEALTHY' ? 'success' : 'danger'}>{p.status}</Badge>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Auth Type:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{p.authType}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Priority:</span>
                    <span style={{ fontWeight: 700 }}>Priority #{p.priority}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Base URL:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{p.apiBaseUrl}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Capabilities:</span>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {p.capabilities.map((c) => (
                        <span key={c} style={{ fontSize: '9px', padding: '1px 4px', backgroundColor: 'var(--color-surface-sunken)', borderRadius: '3px' }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB 9: POLICIES & KILL SWITCHES --- */}
      {activeTab === 'POLICIES' && (
        <form onSubmit={handleSavePolicies} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card accentColor="red">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, color: 'var(--color-danger)' }}>
                  Emergency API Kill Switches & Ceilings
                </h3>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Modifying these controls takes effect across all Fastify gateway request filters immediately.
                </p>
              </div>

              <Button type="submit" variant="danger" disabled={policiesSaving || !policies}>
                {policiesSaving ? 'Saving...' : 'Commit Emergency Policies'}
              </Button>
            </div>
          </Card>

          {policies && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
              <Card>
                <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                  Emergency Circuit Breakers
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>Disable Agent API</span>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>Blocks all reseller/agent programmatic traffic</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={policies.agentApiDisabled}
                      onChange={(e) => setPolicies({ ...policies, agentApiDisabled: e.target.checked })}
                    />
                  </label>

                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>Disable Sandbox API</span>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>Halts all test keys and simulated dispatches</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={policies.sandboxApiDisabled}
                      onChange={(e) => setPolicies({ ...policies, sandboxApiDisabled: e.target.checked })}
                    />
                  </label>

                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>Disable Bulk Orders API</span>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>Suspends multi-recipient batch endpoints</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={policies.bulkOrdersApiDisabled}
                      onChange={(e) => setPolicies({ ...policies, bulkOrdersApiDisabled: e.target.checked })}
                    />
                  </label>

                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>Disable Webhook Delivery</span>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>Pauses outgoing event notifications</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={policies.webhooksDisabled}
                      onChange={(e) => setPolicies({ ...policies, webhooksDisabled: e.target.checked })}
                    />
                  </label>
                </div>
              </Card>

              <Card>
                <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                  Global Rate Limit Ceilings
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Customer Rate Limit (req/min)</label>
                    <SearchInput
                      type="number"
                      value={String(policies.customerRateLimitPerMin)}
                      onChange={(e) => setPolicies({ ...policies, customerRateLimitPerMin: parseInt(e.target.value || '120', 10) })}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Agent Rate Limit (req/min)</label>
                    <SearchInput
                      type="number"
                      value={String(policies.agentRateLimitPerMin)}
                      onChange={(e) => setPolicies({ ...policies, agentRateLimitPerMin: parseInt(e.target.value || '300', 10) })}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Admin Rate Limit (req/min)</label>
                    <SearchInput
                      type="number"
                      value={String(policies.adminRateLimitPerMin)}
                      onChange={(e) => setPolicies({ ...policies, adminRateLimitPerMin: parseInt(e.target.value || '600', 10) })}
                    />
                  </div>
                </div>
              </Card>
            </div>
          )}
        </form>
      )}

      {/* --- CREATE KEY MODAL --- */}
      {isCreateModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => { setIsCreateModalOpen(false); setCreatedSecretResult(null); }}
          title="Generate API Key"
        >
          {createdSecretResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-success)' }}>
                <span style={{ fontWeight: 800, color: 'var(--color-success)', display: 'block', fontSize: 'var(--font-size-sm)' }}>
                  API Key Created Successfully
                </span>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                  Please copy your secret key now. For security, it will <strong>never be shown again</strong>.
                </p>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Plaintext API Secret</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input
                    type="text"
                    readOnly
                    value={createdSecretResult.rawApiKey}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      backgroundColor: 'var(--color-surface-sunken)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  />
                  <Button variant="primary" onClick={() => copyToClipboard(createdSecretResult.rawApiKey)}>
                    <Copy size={14} /> Copy
                  </Button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <Button variant="secondary" onClick={() => { setIsCreateModalOpen(false); setCreatedSecretResult(null); }}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateApiKey} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Key Name / Purpose *
                </label>
                <SearchInput
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. Production Order Bot, Mobile App Gateway"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Environment
                  </label>
                  <Select
                    value={newKeyEnv}
                    onChange={(e) => setNewKeyEnv(e.target.value as any)}
                    options={[
                      { value: ApiKeyEnvironment.LIVE, label: 'LIVE (Production)' },
                      { value: ApiKeyEnvironment.TEST, label: 'TEST (Sandbox Mock)' },
                    ]}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Expiration
                  </label>
                  <Select
                    value={newKeyExpiryDays}
                    onChange={(e) => setNewKeyExpiryDays(e.target.value)}
                    options={[
                      { value: '30', label: '30 Days' },
                      { value: '90', label: '90 Days' },
                      { value: '180', label: '180 Days' },
                      { value: '365', label: '1 Year' },
                    ]}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Rate Limit (Req / Min)
                  </label>
                  <Input
                    type="number"
                    value={newKeyRateLimit}
                    onChange={(e) => setNewKeyRateLimit(e.target.value)}
                    placeholder="300"
                  />
                </div>

                <div>
                  <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    IP Restrictions (Optional)
                  </label>
                  <Input
                    type="text"
                    value={newKeyIpRestrictions}
                    onChange={(e) => setNewKeyIpRestrictions(e.target.value)}
                    placeholder="e.g. 192.168.1.1, 10.0.0.1"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Owner User UUID (Leave empty for yourself)
                </label>
                <SearchInput
                  value={newKeyOwnerId}
                  onChange={(e) => setNewKeyOwnerId(e.target.value)}
                  placeholder="Target agent or admin UUID..."
                />
              </div>

              <div>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  Permitted Scopes *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  {[
                    Permission.ORDERS_READ,
                    Permission.ORDERS_CREATE,
                    Permission.ORDERS_REFUND,
                    Permission.WALLET_READ,
                    Permission.PROVIDERS_MANAGE,
                    Permission.API_KEYS_MANAGE,
                  ].map((scope) => (
                    <label key={scope} style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes(scope)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewKeyScopes([...newKeyScopes, scope]);
                          } else {
                            setNewKeyScopes(newKeyScopes.filter((s) => s !== scope));
                          }
                        }}
                      />
                      {scope}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Generate Key
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* --- ROTATE KEY MODAL --- */}
      {rotateKeyId && (
        <Modal
          isOpen={true}
          onClose={() => setRotateKeyId(null)}
          title="Rotate API Key"
        >
          {rotatedSecretResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-success)' }}>
                <span style={{ fontWeight: 800, color: 'var(--color-success)', display: 'block', fontSize: 'var(--font-size-sm)' }}>
                  Key Rotated Successfully
                </span>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)' }}>
                  Copy the new secret now. The previous key will expire after the grace period.
                </p>
              </div>

              <div>
                <input
                  type="text"
                  readOnly
                  value={rotatedSecretResult.rawApiKey}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    backgroundColor: 'var(--color-surface-sunken)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <Button variant="secondary" onClick={() => { setRotateKeyId(null); setRotatedSecretResult(null); }}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Rotating an API key immediately generates a replacement with identical scopes and allows the old key a temporary grace period before invalidation.
              </p>

              <div>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Old Key Grace Period
                </label>
                <Select
                  value={rotateGraceHours}
                  onChange={(e) => setRotateGraceHours(e.target.value)}
                  options={[
                    { value: '0', label: 'Immediate Invalidation (0 hours)' },
                    { value: '24', label: '24 Hours Grace Period' },
                    { value: '72', label: '72 Hours Grace Period' },
                  ]}
                />
              </div>

              <div>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Rotation Reason (Mandatory Audit) *
                </label>
                <SearchInput
                  value={rotateReason}
                  onChange={(e) => setRotateReason(e.target.value)}
                  placeholder="e.g. Scheduled quarterly rotation, staff departure"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <Button variant="secondary" onClick={() => setRotateKeyId(null)}>Cancel</Button>
                <Button variant="primary" onClick={handleRotateKey}>Authorize Rotation</Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* --- PROVIDER SWITCHING MODAL --- */}
      {isSwitchModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsSwitchModalOpen(false)}
          title="Switch Authoritative Telecom Provider"
        >
          <form onSubmit={handleSwitchProvider} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-danger)' }}>
              <span style={{ fontWeight: 800, color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>
                High-Risk Platform Operation
              </span>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)' }}>
                Changing the authoritative provider redirects all live airtime & data fulfillment dispatches across Ghana. Requires Super Admin authority and an audited reason.
              </p>
            </div>

            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                Select Target Authoritative Provider *
              </label>
              <Select
                value={targetSwitchProvider}
                onChange={(e) => setTargetSwitchProvider(e.target.value)}
                options={[
                  { value: '', label: '-- Select Provider --' },
                  ...providers.filter(p => !p.isAuthoritative && p.providerName !== 'PAYSTACK').map(p => ({
                    value: p.providerName,
                    label: `${p.providerName} (${p.status}) - Priority #${p.priority}`,
                  })),
                ]}
              />
            </div>

            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                Justification & Change Ticket (Audited) *
              </label>
              <SearchInput
                value={switchReason}
                onChange={(e) => setSwitchReason(e.target.value)}
                placeholder="e.g. DataHouse gateway maintenance window - failing over to GMPL"
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                Type <strong style={{ color: 'var(--color-danger)' }}>SWITCH PROVIDER</strong> to confirm
              </label>
              <SearchInput
                value={switchConfirmationText}
                onChange={(e) => setSwitchConfirmationText(e.target.value)}
                placeholder="SWITCH PROVIDER"
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <Button type="button" variant="secondary" onClick={() => setIsSwitchModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={switchingProvider}>
                {switchingProvider ? 'Migrating Authority...' : 'Execute Provider Switch'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* --- CREATE CONSUMER MODAL --- */}
      {isCreateConsumerModalOpen && (
        <Modal
          isOpen={isCreateConsumerModalOpen}
          onClose={() => setIsCreateConsumerModalOpen(false)}
          title="Register New API Consumer Application"
        >
          <form onSubmit={handleCreateConsumer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Application Name *</label>
              <Input
                value={newConsumerName}
                onChange={(e) => setNewConsumerName(e.target.value)}
                placeholder="e.g. ABC Data Reseller Web App"
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Description</label>
              <Input
                value={newConsumerDesc}
                onChange={(e) => setNewConsumerDesc(e.target.value)}
                placeholder="e.g. Mobile app integration for retail data vending"
              />
            </div>

            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Owner User ID (Optional - defaults to self)</label>
              <Input
                value={newConsumerOwnerId}
                onChange={(e) => setNewConsumerOwnerId(e.target.value)}
                placeholder="Agent UUID or empty for self"
              />
            </div>

            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Environment *</label>
              <Select
                value={newConsumerEnv}
                onChange={(e) => setNewConsumerEnv(e.target.value as any)}
                options={[
                  { value: ApiKeyEnvironment.LIVE, label: 'LIVE / Production' },
                  { value: ApiKeyEnvironment.TEST, label: 'TEST / Sandbox' },
                ]}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <Button type="button" variant="secondary" onClick={() => setIsCreateConsumerModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Register Application
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* --- KEY DOSSIER MODAL --- */}
      {selectedKeyDetail && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedKeyDetail(null)}
          title={`API Key Dossier: ${selectedKeyDetail.name}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', backgroundColor: 'var(--color-surface-sunken)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Prefix</span>
                <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{selectedKeyDetail.keyPrefix}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Environment</span>
                <p style={{ margin: 0 }}><Badge variant={selectedKeyDetail.environment === 'LIVE' ? 'success' : 'neutral'}>{selectedKeyDetail.environment}</Badge></p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Status</span>
                <p style={{ margin: 0 }}><Badge variant={selectedKeyDetail.status === 'ACTIVE' ? 'success' : 'danger'}>{selectedKeyDetail.status}</Badge></p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Rate Limit</span>
                <p style={{ margin: 0, fontWeight: 700 }}>{selectedKeyDetail.rateLimitPerMinute} / min</p>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Owner</span>
              <p style={{ margin: '0.125rem 0 0 0', fontWeight: 600 }}>{selectedKeyDetail.ownerName} ({selectedKeyDetail.ownerEmail})</p>
            </div>

            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Permitted Scopes</span>
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {selectedKeyDetail.scopes.map((s) => (
                  <Badge key={s} variant="brand">{s}</Badge>
                ))}
              </div>
            </div>

            {selectedKeyDetail.revokedAt && (
              <div style={{ padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-danger)', fontWeight: 700 }}>Revocation Details</span>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: 'var(--font-size-xs)' }}>
                  Revoked on {new Date(selectedKeyDetail.revokedAt).toLocaleString()}: {selectedKeyDetail.revocationReason || 'No reason supplied'}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <Button variant="secondary" onClick={() => setSelectedKeyDetail(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminApiManagementPage;
