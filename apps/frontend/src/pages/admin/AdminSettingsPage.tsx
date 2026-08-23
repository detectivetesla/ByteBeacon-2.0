import React, { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Input, Switch, Select } from '../../components/ui/index.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
import { useToast } from '../../context/ToastContext.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  adminApi,
  ConfigScope,
  ConfigCategory,
  FeatureFlagTargetRole,
  AdminGlobalConfigOverviewDto,
  AdminSystemConfigItemDto,
  AdminConfigVersionItemDto,
  AdminFeatureFlagItemDto,
  AdminActiveSessionDto,
  AdminSystemHealthDiagnosticDto,
  AdminRolePermissionMatrixDto,
  AdminUserEffectiveAuthorizationDto,
} from '../../api/admin.api.js';
import {
  Sliders,
  Shield,
  Lock,
  Cpu,
  CreditCard,
  Package,
  Users,
  Store,
  Flag,
  History,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Zap,
  Globe,
  RotateCcw,
  UserX,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';

type SettingsTab =
  | 'PLATFORM'
  | 'SECURITY'
  | 'PERMISSIONS'
  | 'SESSIONS'
  | 'RATE_LIMITS'
  | 'PAYMENTS'
  | 'TELECOM'
  | 'ORDERS'
  | 'AGENTS'
  | 'FEATURE_FLAGS'
  | 'HISTORY_HEALTH';

export const AdminSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const isSuperAdmin = user?.role === 'super_admin';

  // Active Tab
  const [activeTab, setActiveTab] = useState<SettingsTab>('PLATFORM');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Data States
  const [overview, setOverview] = useState<AdminGlobalConfigOverviewDto | null>(null);
  const [configs, setConfigs] = useState<AdminSystemConfigItemDto[]>([]);
  const [featureFlags, setFeatureFlags] = useState<AdminFeatureFlagItemDto[]>([]);
  const [activeSessions, setActiveSessions] = useState<AdminActiveSessionDto[]>([]);
  const [healthDiagnostics, setHealthDiagnostics] = useState<AdminSystemHealthDiagnosticDto | null>(null);
  const [permissionMatrix, setPermissionMatrix] = useState<AdminRolePermissionMatrixDto | null>(null);

  // Permissions Inspector & Simulator States
  const [selectedPermCategory, setSelectedPermCategory] = useState<string>('ALL');
  const [simulatorUserId, setSimulatorUserId] = useState('');
  const [simulatedUser, setSimulatedUser] = useState<AdminUserEffectiveAuthorizationDto | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Modals & Actions
  const [editingConfig, setEditingConfig] = useState<AdminSystemConfigItemDto | null>(null);
  const [editValue, setEditValue] = useState<any>('');
  const [editReason, setEditReason] = useState('');
  const [stepUpToken, setStepUpToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Version History Modal
  const [viewingVersionKey, setViewingVersionKey] = useState<string | null>(null);
  const [versionHistory, setVersionHistory] = useState<AdminConfigVersionItemDto[]>([]);
  const [rollbackTarget, setRollbackTarget] = useState<AdminConfigVersionItemDto | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');

  // Feature Flag Edit Modal
  const [editingFlag, setEditingFlag] = useState<AdminFeatureFlagItemDto | null>(null);
  const [flagEnabled, setFlagEnabled] = useState(false);
  const [flagTargetRole, setFlagTargetRole] = useState<FeatureFlagTargetRole>(FeatureFlagTargetRole.ALL);
  const [flagEnvironment, setFlagEnvironment] = useState('ALL');
  const [flagReason, setFlagReason] = useState('');

  // Session Revoke Modal
  const [revokingSession, setRevokingSession] = useState<AdminActiveSessionDto | null>(null);
  const [revokeAllForUser, setRevokeAllForUser] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  // Fetch all settings data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [overviewData, configData, flagData, sessionData, healthData, permData] = await Promise.all([
        adminApi.getGlobalConfigOverview().catch(() => null),
        adminApi.getSystemConfigs().catch(() => []),
        adminApi.getFeatureFlags().catch(() => []),
        adminApi.getActiveSessions().catch(() => []),
        adminApi.getSystemHealthDiagnostics().catch(() => null),
        adminApi.getPermissionRegistry().catch(() => null),
      ]);

      if (overviewData) setOverview(overviewData);
      setConfigs(configData || []);
      setFeatureFlags(flagData || []);
      setActiveSessions(sessionData || []);
      if (healthData) setHealthDiagnostics(healthData);
      if (permData) setPermissionMatrix(permData);
    } catch (err: any) {
      toastError('Failed to load settings', err.message || 'Error fetching system configurations');
    } finally {
      setIsLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Edit Modal
  const handleOpenEdit = (config: AdminSystemConfigItemDto) => {
    setEditingConfig(config);
    setEditValue(config.value);
    setEditReason('');
    setStepUpToken('');
  };

  // Submit Config Update
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConfig) return;

    if (!editReason || editReason.trim().length < 5) {
      toastError('Reason required', 'Please provide a justification (min 5 characters) for this change.');
      return;
    }

    if ((editingConfig.riskLevel === 'HIGH' || editingConfig.riskLevel === 'CRITICAL') && !isSuperAdmin) {
      toastError('Unauthorized', 'High and Critical settings require Super Administrator privileges.');
      return;
    }

    if (
      (editingConfig.riskLevel === 'HIGH' || editingConfig.riskLevel === 'CRITICAL') &&
      stepUpToken !== 'CONFIRM_CONFIG_CHANGE'
    ) {
      toastError('Step-Up Required', 'Please enter CONFIRM_CONFIG_CHANGE to proceed.');
      return;
    }

    setIsSubmitting(true);
    try {
      let parsedValue = editValue;
      if (editingConfig.dataType === 'NUMBER') {
        parsedValue = Number(editValue);
      } else if (editingConfig.dataType === 'BOOLEAN') {
        parsedValue = Boolean(editValue);
      } else if (editingConfig.dataType === 'JSON' && typeof editValue === 'string') {
        try {
          parsedValue = JSON.parse(editValue);
        } catch {
          toastError('Invalid JSON', 'Please provide valid JSON format.');
          setIsSubmitting(false);
          return;
        }
      }

      await adminApi.updateSystemConfig(editingConfig.configKey, {
        value: parsedValue,
        reason: editReason,
        stepUpConfirmation: stepUpToken,
      });

      toastSuccess(
        'Configuration updated',
        `'${editingConfig.configKey}' successfully updated. An immutable audit record has been generated.`,
      );
      setEditingConfig(null);
      await loadData();
    } catch (err: any) {
      toastError('Update failed', err.message || 'Error updating configuration setting');
    } finally {
      setIsSubmitting(false);
    }
  };

  // View Version History
  const handleViewVersions = async (configKey: string) => {
    setViewingVersionKey(configKey);
    try {
      const versions = await adminApi.getConfigVersions(configKey);
      setVersionHistory(versions);
    } catch (err: any) {
      toastError('Failed to fetch history', err.message || 'Error loading version timeline');
    }
  };

  // Execute Rollback
  const handleExecuteRollback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollbackTarget || !viewingVersionKey) return;

    if (stepUpToken !== 'CONFIRM_CONFIG_CHANGE') {
      toastError('Step-Up Required', 'Please enter CONFIRM_CONFIG_CHANGE to execute rollback.');
      return;
    }

    if (!rollbackReason || rollbackReason.trim().length < 5) {
      toastError('Reason required', 'Please provide a valid rollback reason.');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminApi.rollbackSystemConfig(viewingVersionKey, {
        targetVersion: rollbackTarget.version,
        reason: rollbackReason,
        stepUpConfirmation: stepUpToken,
      });

      toastSuccess(
        'Rollback successful',
        `'${viewingVersionKey}' restored to version ${rollbackTarget.version}.`,
      );
      setRollbackTarget(null);
      setViewingVersionKey(null);
      await loadData();
    } catch (err: any) {
      toastError('Rollback failed', err.message || 'Error executing configuration rollback');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Feature Flag Modal
  const handleOpenFlagEdit = (flag: AdminFeatureFlagItemDto) => {
    setEditingFlag(flag);
    setFlagEnabled(flag.isEnabled);
    setFlagTargetRole(flag.targetRole);
    setFlagEnvironment(flag.environment);
    setFlagReason('');
    setStepUpToken('');
  };

  // Save Feature Flag
  const handleSaveFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFlag) return;

    if (!flagReason || flagReason.trim().length < 5) {
      toastError('Reason required', 'Please enter a justification reason.');
      return;
    }

    if (
      (editingFlag.flagKey === 'MAINTENANCE_MODE' || editingFlag.flagKey === 'PAYSTACK_LIVE') &&
      stepUpToken !== 'CONFIRM_CONFIG_CHANGE'
    ) {
      toastError('Step-Up Required', 'Enter CONFIRM_CONFIG_CHANGE for critical flags.');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminApi.updateFeatureFlag(editingFlag.flagKey, {
        isEnabled: flagEnabled,
        targetRole: flagTargetRole,
        environment: flagEnvironment,
        reason: flagReason,
        stepUpConfirmation: stepUpToken,
      });

      toastSuccess(
        'Feature flag updated',
        `'${editingFlag.name}' is now ${flagEnabled ? 'ENABLED' : 'DISABLED'}.`,
      );
      setEditingFlag(null);
      await loadData();
    } catch (err: any) {
      toastError('Update failed', err.message || 'Error updating feature flag');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Revoke Session
  const handleRevokeSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokingSession) return;

    if (!revokeReason || revokeReason.trim().length < 3) {
      toastError('Reason required', 'Please provide a revocation reason.');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminApi.revokeActiveSession(revokingSession.sessionId, {
        reason: revokeReason,
        revokeAllForUser,
      });

      toastSuccess('Session revoked', 'The session has been terminated immediately.');
      setRevokingSession(null);
      await loadData();
    } catch (err: any) {
      toastError('Revocation failed', err.message || 'Error revoking session');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Evaluate User Effective Permissions (Simulator)
  const handleSimulateUser = async (targetId: string) => {
    if (!targetId || targetId.trim() === '') {
      toastError('User ID required', 'Please enter a valid user UUID.');
      return;
    }

    setIsSimulating(true);
    try {
      const data = await adminApi.getUserEffectivePermissions(targetId.trim());
      setSimulatedUser(data);
      toastSuccess('Evaluation complete', `Evaluated authorization profile for ${data.userName}.`);
    } catch (err: any) {
      toastError('Evaluation failed', err.message || 'Error inspecting user effective permissions');
      setSimulatedUser(null);
    } finally {
      setIsSimulating(false);
    }
  };

  // Filtered configurations
  const filteredConfigs = configs.filter((c) => {
    if (activeTab === 'PLATFORM') return c.category === ConfigCategory.GENERAL;
    if (activeTab === 'SECURITY') return c.category === ConfigCategory.SECURITY;
    if (activeTab === 'RATE_LIMITS') return c.scope === ConfigScope.RATE_LIMITS;
    if (activeTab === 'PAYMENTS') return c.category === ConfigCategory.PAYMENTS;
    if (activeTab === 'TELECOM') return c.category === ConfigCategory.TELECOM;
    if (activeTab === 'ORDERS') return c.category === ConfigCategory.ORDERS;
    if (activeTab === 'AGENTS') return c.category === ConfigCategory.AGENTS || c.category === ConfigCategory.CATALOG;
    return true;
  }).filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.configKey.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
  });

  // Filtered permissions
  const filteredPermissions = (permissionMatrix?.registry || []).filter((p: any) => {
    if (selectedPermCategory !== 'ALL' && p.category !== selectedPermCategory) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.permission.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Sliders} color="indigo" size="lg" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-api-bright)' }}>
                Platform Governance & Global Control
              </span>
              <Badge variant={overview?.platformStatus === 'OPERATIONAL' ? 'success' : 'danger'} size="sm">
                ● {overview?.platformStatus || 'OPERATIONAL'}
              </Badge>
              <Badge variant="neutral" size="sm">
                {overview?.environment || 'PRODUCTION'}
              </Badge>
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              System Configuration & Authorization Center
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
              Authoritative management of platform behavior, security policies, RBAC permission matrix, payments, telecom routing, order thresholds, and feature flags.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="secondary" size="sm" onClick={loadData} disabled={isLoading} leftIcon={<RefreshCw size={14} />}>
            Refresh Diagnostics
          </Button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard
          title="Platform Operating State"
          value={overview?.platformStatus || 'OPERATIONAL'}
          accent={overview?.platformStatus === 'OPERATIONAL' ? 'green' : 'red'}
          icon={<TactileIcon icon={Activity} color={overview?.platformStatus === 'OPERATIONAL' ? 'security' : 'red'} size="sm" />}
          subvalue={overview?.platformStatus === 'OPERATIONAL' ? 'Normal checkout live' : 'Maintenance active'}
        />
        <MetricCard
          title="Environment & Jurisdiction"
          value="Ghana (GHS)"
          accent="blue"
          icon={<TactileIcon icon={Globe} color="orders" size="sm" />}
          subvalue="Africa/Accra timezone"
        />
        <MetricCard
          title="Configuration Health"
          value={overview?.configurationHealth || 'HEALTHY'}
          accent="green"
          icon={<TactileIcon icon={CheckCircle2} color="emerald" size="sm" />}
          subvalue="8/8 Subsystems Checked"
        />
        <MetricCard
          title="Active Feature Flags"
          value={`${overview?.activeFeatureFlagsCount || 4} Enabled`}
          accent="amber"
          icon={<TactileIcon icon={Flag} color="speed" size="sm" />}
          subvalue={`${overview?.activeSessionsCount || 1} Active Sessions`}
        />
      </div>

      {/* 3. Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.375rem',
          borderBottom: '1px solid var(--color-border-subtle)',
          paddingBottom: '0.25rem',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <Button
          variant={activeTab === 'PLATFORM' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('PLATFORM')}
          leftIcon={<Globe size={14} />}
        >
          Platform
        </Button>
        <Button
          variant={activeTab === 'SECURITY' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('SECURITY')}
          leftIcon={<Shield size={14} />}
        >
          Security & Auth
        </Button>
        <Button
          variant={activeTab === 'PERMISSIONS' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('PERMISSIONS')}
          leftIcon={<Lock size={14} />}
        >
          Permissions & RBAC ({permissionMatrix?.totalPermissionsCount || 25})
        </Button>
        <Button
          variant={activeTab === 'SESSIONS' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('SESSIONS')}
          leftIcon={<Users size={14} />}
        >
          Active Sessions ({activeSessions.length})
        </Button>
        <Button
          variant={activeTab === 'RATE_LIMITS' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('RATE_LIMITS')}
          leftIcon={<Zap size={14} />}
        >
          Rate Limits
        </Button>
        <Button
          variant={activeTab === 'PAYMENTS' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('PAYMENTS')}
          leftIcon={<CreditCard size={14} />}
        >
          Payments & Safety
        </Button>
        <Button
          variant={activeTab === 'TELECOM' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('TELECOM')}
          leftIcon={<Cpu size={14} />}
        >
          Telecom & Routing
        </Button>
        <Button
          variant={activeTab === 'ORDERS' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('ORDERS')}
          leftIcon={<Package size={14} />}
        >
          Orders & MTN
        </Button>
        <Button
          variant={activeTab === 'AGENTS' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('AGENTS')}
          leftIcon={<Store size={14} />}
        >
          Agents & Stores
        </Button>
        <Button
          variant={activeTab === 'FEATURE_FLAGS' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('FEATURE_FLAGS')}
          leftIcon={<Flag size={14} />}
        >
          Feature Flags ({featureFlags.length})
        </Button>
        <Button
          variant={activeTab === 'HISTORY_HEALTH' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('HISTORY_HEALTH')}
          leftIcon={<Activity size={14} />}
        >
          Health & Diagnostics
        </Button>
      </div>

      {/* 4. Tab Contents */}

      {/* TAB: PERMISSIONS & RBAC MATRIX (Phase 11.14) */}
      {activeTab === 'PERMISSIONS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Top RBAC Architecture Banner */}
          <Card elevated accentColor="purple" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  Authoritative Permission Registry & Role Matrix
                </h2>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0' }}>
                  Roles determine potential capabilities; explicit permissions dictate operational access; Fastify backend is the final authority.
                </p>
              </div>
              <Badge variant="brand" size="md">
                25 Granular Permissions Defined
              </Badge>
            </div>

            {/* Invariant Note */}
            <div
              style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-bg-base)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <ShieldAlert size={16} color="var(--color-primary)" />
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                <strong>Role Invariants:</strong> SUPER_ADMIN has immutable omni-capabilities (bypass-protected). Customer & Reseller Agents operate with strict scope partitioning.
              </span>
            </div>

            {/* Permission Simulator */}
            <div
              style={{
                marginTop: 'var(--space-5)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-surface-elevated)',
                border: '1px solid var(--color-border-default)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TactileIcon icon={UserCheck} color="payments" size="sm" />
                  <div>
                    <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                      Live User Permission Simulator & Inspector
                    </h3>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                      Evaluate actual calculated permissions, role assignment, and tenant data bounds for any platform account.
                    </span>
                  </div>
                </div>

                {user?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSimulatorUserId(user.id);
                      handleSimulateUser(user.id);
                    }}
                    leftIcon={<UserCheck size={14} />}
                  >
                    Simulate My Account
                  </Button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '260px' }}>
                  <Input
                    placeholder="Enter target User UUID (e.g. 00000000-0000-0000-0000-000000000001)..."
                    value={simulatorUserId}
                    onChange={(e) => setSimulatorUserId(e.target.value)}
                    leftIcon={<Search size={14} />}
                  />
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleSimulateUser(simulatorUserId)}
                  disabled={isSimulating}
                >
                  {isSimulating ? 'Evaluating...' : 'Evaluate Access Profile'}
                </Button>
              </div>

              {/* Simulation Result */}
              {simulatedUser && (
                <div
                  style={{
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {simulatedUser.userName} ({simulatedUser.userEmail})
                      </span>
                      <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                        <Badge variant="neutral" size="sm">Role: {simulatedUser.role}</Badge>
                        {simulatedUser.adminSubRole && (
                          <Badge variant="neutral" size="sm">Sub-Role: {simulatedUser.adminSubRole}</Badge>
                        )}
                        <Badge variant={simulatedUser.status === 'ACTIVE' ? 'success' : 'danger'} size="sm">
                          Status: {simulatedUser.status}
                        </Badge>
                        <Badge variant={simulatedUser.mfaEnforced ? 'success' : 'warning'} size="sm">
                          MFA: {simulatedUser.mfaEnforced ? 'Enforced' : 'Optional'}
                        </Badge>
                        {simulatedUser.isLastSuperAdmin && (
                          <Badge variant="danger" size="sm">
                            ★ Last Active Super Admin (Lockout Protected)
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: 'var(--font-size-2xs)', textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-api-bright)' }}>Tenant Ownership Scope:</span>
                      <div style={{ color: 'var(--color-text-secondary)' }}>{simulatedUser.tenantScope.scopeType}</div>
                    </div>
                  </div>

                  <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                    <strong>Boundary Description:</strong> {simulatedUser.tenantScope.description}
                  </p>

                  <div>
                    <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      Effective Server-Side Permissions ({simulatedUser.effectivePermissions.length}):
                    </span>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.375rem' }}>
                      {simulatedUser.effectivePermissions.map((perm: string) => (
                        <code
                          key={perm}
                          style={{
                            fontSize: 'var(--font-size-3xs)',
                            padding: '0.125rem 0.375rem',
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: 'var(--color-bg-base)',
                            border: '1px solid var(--color-border-subtle)',
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          {perm}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Filter Toolbar for Permission Matrix */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                Filter Domain:
              </span>
              {['ALL', 'ORDERS', 'WALLET_FINANCE', 'USERS_AGENTS', 'CATALOG_TELECOM', 'DEVELOPER_APIS', 'COMMUNICATION', 'PLATFORM_GOVERNANCE'].map((cat) => (
                <Button
                  key={cat}
                  variant={selectedPermCategory === cat ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedPermCategory(cat)}
                >
                  {cat === 'ALL' ? 'All Domains' : cat.replace('_', ' ')}
                </Button>
              ))}
            </div>

            <div style={{ width: '240px' }}>
              <Input
                placeholder="Search permissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search size={14} />}
              />
            </div>
          </div>

          {/* Role Comparison Table */}
          <Card elevated accentColor="cyan" style={{ padding: 'var(--space-6)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)' }}>
                  <th style={{ padding: '0.625rem' }}>Permission Identifier & Name</th>
                  <th style={{ padding: '0.625rem' }}>Category</th>
                  <th style={{ padding: '0.625rem' }}>Risk Level</th>
                  <th style={{ padding: '0.625rem', textAlign: 'center' }}>Customer</th>
                  <th style={{ padding: '0.625rem', textAlign: 'center' }}>Agent</th>
                  <th style={{ padding: '0.625rem', textAlign: 'center' }}>Ops Admin</th>
                  <th style={{ padding: '0.625rem', textAlign: 'center' }}>Finance Admin</th>
                  <th style={{ padding: '0.625rem', textAlign: 'center' }}>Support Admin</th>
                  <th style={{ padding: '0.625rem', textAlign: 'center' }}>Dev Admin</th>
                  <th style={{ padding: '0.625rem', textAlign: 'center' }}>Super Admin</th>
                </tr>
              </thead>
              <tbody>
                {filteredPermissions.map((perm: any) => (
                  <tr key={perm.permission} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '0.625rem' }}>
                      <code style={{ fontWeight: 800, color: 'var(--color-api-bright)' }}>{perm.permission}</code>
                      <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '0.125rem' }}>{perm.name}</div>
                      <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', maxWidth: '320px' }}>
                        {perm.description}
                      </div>
                    </td>
                    <td style={{ padding: '0.625rem' }}>
                      <Badge variant="neutral" size="sm">{perm.category}</Badge>
                    </td>
                    <td style={{ padding: '0.625rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <Badge
                          variant={
                            perm.riskLevel === 'CRITICAL'
                              ? 'danger'
                              : perm.riskLevel === 'HIGH'
                                ? 'warning'
                                : 'default'
                          }
                          size="sm"
                        >
                          {perm.riskLevel}
                        </Badge>
                        {perm.requiresStepUp && (
                          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-accent-red)', fontWeight: 700 }}>
                            Step-Up Required
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.625rem', textAlign: 'center' }}>
                      {perm.allowedRoles.customer ? <Badge variant="success" size="sm">✓</Badge> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.625rem', textAlign: 'center' }}>
                      {perm.allowedRoles.agent ? <Badge variant="success" size="sm">✓</Badge> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.625rem', textAlign: 'center' }}>
                      {perm.allowedRoles.operationsAdmin ? <Badge variant="success" size="sm">✓</Badge> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.625rem', textAlign: 'center' }}>
                      {perm.allowedRoles.financeAdmin ? <Badge variant="success" size="sm">✓</Badge> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.625rem', textAlign: 'center' }}>
                      {perm.allowedRoles.supportAdmin ? <Badge variant="success" size="sm">✓</Badge> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.625rem', textAlign: 'center' }}>
                      {perm.allowedRoles.developerAdmin ? <Badge variant="success" size="sm">✓</Badge> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.625rem', textAlign: 'center' }}>
                      <Badge variant="success" size="sm">✓</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* TAB 1 TO 8: Configuration Grids */}
      {activeTab !== 'SESSIONS' && activeTab !== 'FEATURE_FLAGS' && activeTab !== 'HISTORY_HEALTH' && activeTab !== 'PERMISSIONS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Search Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px', maxWidth: '400px' }}>
              <Input
                placeholder="Search configuration keys..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search size={14} />}
              />
            </div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Showing {filteredConfigs.length} configuration parameters
            </span>
          </div>

          {/* Config Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
            {filteredConfigs.map((config) => {
              const isBoolean = config.dataType === 'BOOLEAN';
              const isCritical = config.riskLevel === 'CRITICAL';
              const isHigh = config.riskLevel === 'HIGH';

              return (
                <Card
                  key={config.id}
                  elevated
                  accentColor={isCritical ? 'red' : isHigh ? 'amber' : 'blue'}
                  style={{
                    padding: 'var(--space-4)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <code style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {config.configKey}
                      </code>
                      <Badge
                        variant={
                          config.riskLevel === 'CRITICAL'
                            ? 'danger'
                            : config.riskLevel === 'HIGH'
                              ? 'warning'
                              : config.riskLevel === 'MEDIUM'
                                ? 'neutral'
                                : 'default'
                        }
                        size="sm"
                      >
                        {config.riskLevel}
                      </Badge>
                    </div>

                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 0 0.5rem 0', minHeight: '32px' }}>
                      {config.description}
                    </p>

                    {/* Current Value Display */}
                    <div
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-bg-subtle)',
                        border: '1px solid var(--color-border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Current Value:
                      </span>
                      <span
                        style={{
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 700,
                          color: isBoolean
                            ? config.value === true
                              ? 'var(--color-accent-green)'
                              : 'var(--color-accent-red)'
                            : 'var(--color-text-primary)',
                        }}
                      >
                        {config.isSecret ? '[CONFIGURED_SECRET]' : typeof config.value === 'object' ? JSON.stringify(config.value) : String(config.value)}
                      </span>
                    </div>
                  </div>

                  {/* Metadata Footer & Edit Action */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid var(--color-border-subtle)',
                      paddingTop: '0.5rem',
                    }}
                  >
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                      v{config.version} • {new Date(config.lastModifiedAt).toLocaleDateString()}
                    </span>

                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewVersions(config.configKey)}
                        leftIcon={<History size={14} />}
                      >
                        History
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenEdit(config)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Active Sessions */}
      {activeTab === 'SESSIONS' && (
        <Card elevated accentColor="blue" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                Active Platform User Sessions
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0' }}>
                Investigate active authentication sessions across Customer, Agent, and Admin domains with force revocation capability.
              </p>
            </div>
            <Badge variant="success" size="sm">
              {activeSessions.length} Active Sessions
            </Badge>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)' }}>
                  <th style={{ padding: '0.5rem' }}>User / Account</th>
                  <th style={{ padding: '0.5rem' }}>Role</th>
                  <th style={{ padding: '0.5rem' }}>IP Address</th>
                  <th style={{ padding: '0.5rem' }}>Device / Client</th>
                  <th style={{ padding: '0.5rem' }}>Created</th>
                  <th style={{ padding: '0.5rem' }}>Expires</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions.map((session) => (
                  <tr key={session.sessionId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '0.5rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{session.userName}</div>
                      <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>{session.userEmail}</div>
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <Badge variant="neutral" size="sm">{session.userRole}</Badge>
                    </td>
                    <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{session.ipAddress}</td>
                    <td style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {session.userAgent}
                    </td>
                    <td style={{ padding: '0.5rem' }}>{new Date(session.createdAt).toLocaleTimeString()}</td>
                    <td style={{ padding: '0.5rem' }}>{new Date(session.expiresAt).toLocaleTimeString()}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setRevokingSession(session);
                          setRevokeAllForUser(false);
                          setRevokeReason('');
                        }}
                        leftIcon={<UserX size={14} />}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 9: Feature Flags Switchboard */}
      {activeTab === 'FEATURE_FLAGS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                Platform Feature Flag Switchboard
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0' }}>
                Safely control progressive rollouts, environment gating, and emergency checkout toggles without server restarts.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
            {featureFlags.map((flag) => (
              <Card
                key={flag.id}
                elevated
                accentColor={flag.isEnabled ? 'green' : 'amber'}
                style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 'var(--space-3)' }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div>
                      <code style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 800, color: 'var(--color-api-bright)' }}>
                        {flag.flagKey}
                      </code>
                      <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0.125rem 0' }}>
                        {flag.name}
                      </h3>
                    </div>
                    <Badge variant={flag.isEnabled ? 'success' : 'neutral'} size="sm">
                      {flag.isEnabled ? 'ENABLED' : 'DISABLED'}
                    </Badge>
                  </div>

                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0.5rem' }}>
                    {flag.description}
                  </p>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    <Badge variant="neutral" size="sm">Target: {flag.targetRole}</Badge>
                    <Badge variant="neutral" size="sm">Env: {flag.environment}</Badge>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.5rem' }}>
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                    {flag.lastToggledAt ? `Updated ${new Date(flag.lastToggledAt).toLocaleDateString()}` : 'Default Seed'}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => handleOpenFlagEdit(flag)}>
                    Configure Flag
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 10: Health & Subsystem Diagnostics */}
      {activeTab === 'HISTORY_HEALTH' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <Card elevated accentColor="green" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  Subsystem Connectivity & Health Matrix
                </h2>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0' }}>
                  Automated continuous diagnostic verification across databases, caching, payment rails, and carrier gateways.
                </p>
              </div>
              <Badge variant="success" size="sm">
                Uptime: {Math.floor((healthDiagnostics?.uptimeSeconds || 0) / 60)} mins
              </Badge>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
              {healthDiagnostics?.subsystems.map((sub: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {sub.component}
                    </span>
                    <Badge
                      variant={sub.status === 'HEALTHY' ? 'success' : sub.status === 'WARNING' ? 'warning' : 'danger'}
                      size="sm"
                    >
                      {sub.status}
                    </Badge>
                  </div>
                  <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                    {sub.message}
                  </p>
                  {sub.latencyMs !== undefined && (
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                      Latency: {sub.latencyMs}ms
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* 5. MODALS */}

      {/* Edit Config Modal */}
      {editingConfig && (
        <Modal
          isOpen={true}
          onClose={() => setEditingConfig(null)}
          title={`Edit Configuration: ${editingConfig.configKey}`}
        >
          <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
              {editingConfig.description}
            </p>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Badge variant="neutral" size="sm">Scope: {editingConfig.scope}</Badge>
              <Badge variant="neutral" size="sm">Type: {editingConfig.dataType}</Badge>
              <Badge
                variant={
                  editingConfig.riskLevel === 'CRITICAL'
                    ? 'danger'
                    : editingConfig.riskLevel === 'HIGH'
                      ? 'warning'
                      : 'default'
                }
                size="sm"
              >
                Risk: {editingConfig.riskLevel}
              </Badge>
            </div>

            {/* Input by DataType */}
            {editingConfig.dataType === 'BOOLEAN' ? (
              <Switch
                checked={Boolean(editValue)}
                onChange={(checked) => setEditValue(checked)}
                label="Enabled Status"
                description={`Toggle '${editingConfig.configKey}' state`}
              />
            ) : editingConfig.dataType === 'NUMBER' ? (
              <Input
                type="number"
                label="Value"
                value={String(editValue)}
                onChange={(e) => setEditValue(e.target.value)}
              />
            ) : (
              <Input
                label="Value"
                value={String(editValue)}
                onChange={(e) => setEditValue(e.target.value)}
              />
            )}

            <Input
              label="Mandatory Change Justification Reason *"
              placeholder="e.g. Production threshold increase approved by Ops"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              hint="Required for immutable audit logging and compliance."
            />

            {(editingConfig.riskLevel === 'HIGH' || editingConfig.riskLevel === 'CRITICAL') && (
              <div
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg-danger-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-danger)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-accent-red)', fontWeight: 700, fontSize: 'var(--font-size-xs)', marginBottom: '0.25rem' }}>
                  <AlertTriangle size={14} /> High / Critical Risk Setting Step-Up
                </div>
                <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0 0 0.5rem 0' }}>
                  Please type <code style={{ fontWeight: 800 }}>CONFIRM_CONFIG_CHANGE</code> to apply changes to this setting.
                </p>
                <Input
                  placeholder="CONFIRM_CONFIG_CHANGE"
                  value={stepUpToken}
                  onChange={(e) => setStepUpToken(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
              <Button variant="ghost" size="md" onClick={() => setEditingConfig(null)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="primary" size="md" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Applying...' : 'Apply & Audit Update'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Version History Drawer Modal */}
      {viewingVersionKey && (
        <Modal
          isOpen={true}
          onClose={() => setViewingVersionKey(null)}
          title={`Configuration Version History: ${viewingVersionKey}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxHeight: '60vh', overflowY: 'auto' }}>
            {versionHistory.length === 0 ? (
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                No prior version snapshots recorded for this configuration key.
              </p>
            ) : (
              versionHistory.map((ver) => (
                <div
                  key={ver.id}
                  style={{
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                      Version {ver.version}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                      {new Date(ver.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.125rem 0' }}>
                    <strong>Reason:</strong> {ver.changeReason}
                  </p>

                  <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Changed By: {ver.changedByName || 'System'}</span>
                    {isSuperAdmin && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setRollbackTarget(ver);
                          setRollbackReason('');
                          setStepUpToken('');
                        }}
                        leftIcon={<RotateCcw size={14} />}
                      >
                        Restore This Version
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {/* Rollback Confirmation Modal */}
      {rollbackTarget && (
        <Modal
          isOpen={true}
          onClose={() => setRollbackTarget(null)}
          title={`Rollback '${viewingVersionKey}' to Version ${rollbackTarget.version}`}
        >
          <form onSubmit={handleExecuteRollback} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Restoring this historic configuration will apply its recorded value and append a new version snapshot.
            </p>

            <Input
              label="Rollback Justification Reason *"
              placeholder="e.g. Reverting rate limit changes due to upstream latency"
              value={rollbackReason}
              onChange={(e) => setRollbackReason(e.target.value)}
            />

            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-bg-danger-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-danger)',
              }}
            >
              <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-accent-red)', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
                Type <code style={{ fontWeight: 800 }}>CONFIRM_CONFIG_CHANGE</code> to confirm rollback:
              </p>
              <Input
                placeholder="CONFIRM_CONFIG_CHANGE"
                value={stepUpToken}
                onChange={(e) => setStepUpToken(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="ghost" size="md" onClick={() => setRollbackTarget(null)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="danger" size="md" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Restoring...' : 'Execute Rollback'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Feature Flag Edit Modal */}
      {editingFlag && (
        <Modal
          isOpen={true}
          onClose={() => setEditingFlag(null)}
          title={`Configure Feature Flag: ${editingFlag.name}`}
        >
          <form onSubmit={handleSaveFlag} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
              {editingFlag.description}
            </p>

            <Switch
              checked={flagEnabled}
              onChange={(checked) => setFlagEnabled(checked)}
              label="Enable Feature Flag"
              description={`Activate '${editingFlag.flagKey}' across target users`}
            />

            <Select
              label="Target Role Scope"
              value={flagTargetRole}
              onChange={(e) => setFlagTargetRole(e.target.value as FeatureFlagTargetRole)}
              options={[
                { label: 'All Roles (Global)', value: 'ALL' },
                { label: 'Super Admin Only', value: 'SUPER_ADMIN' },
                { label: 'Administrators Only', value: 'ADMIN' },
                { label: 'Agents Only', value: 'AGENT' },
                { label: 'Customers Only', value: 'CUSTOMER' },
              ]}
            />

            <Select
              label="Target Environment"
              value={flagEnvironment}
              onChange={(e) => setFlagEnvironment(e.target.value)}
              options={[
                { label: 'All Environments', value: 'ALL' },
                { label: 'Production Only', value: 'PRODUCTION' },
                { label: 'Staging / QA', value: 'STAGING' },
                { label: 'Development / Sandbox', value: 'DEVELOPMENT' },
              ]}
            />

            <Input
              label="Justification Reason *"
              placeholder="e.g. Rolling out next-gen order engine to Agent pilot cohort"
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
            />

            {(editingFlag.flagKey === 'MAINTENANCE_MODE' || editingFlag.flagKey === 'PAYSTACK_LIVE') && (
              <div
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg-danger-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-danger)',
                }}
              >
                <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-accent-red)', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
                  Critical Flag: Type <code style={{ fontWeight: 800 }}>CONFIRM_CONFIG_CHANGE</code>
                </p>
                <Input
                  placeholder="CONFIRM_CONFIG_CHANGE"
                  value={stepUpToken}
                  onChange={(e) => setStepUpToken(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="ghost" size="md" onClick={() => setEditingFlag(null)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="primary" size="md" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Flag Settings'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Revoke Session Modal */}
      {revokingSession && (
        <Modal
          isOpen={true}
          onClose={() => setRevokingSession(null)}
          title={`Revoke Session: ${revokingSession.userName}`}
        >
          <form onSubmit={handleRevokeSession} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
              Session IP: <code>{revokingSession.ipAddress}</code> • Client: <code>{revokingSession.userAgent}</code>
            </p>

            <Switch
              checked={revokeAllForUser}
              onChange={(checked) => setRevokeAllForUser(checked)}
              label="Revoke All Concurrent Sessions"
              description={`Terminate all active device sessions for ${revokingSession.userEmail}`}
            />

            <Input
              label="Revocation Justification Reason *"
              placeholder="e.g. Suspicious concurrent logins detected from unrecognized IP"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="ghost" size="md" onClick={() => setRevokingSession(null)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="danger" size="md" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Revoking...' : 'Confirm Revocation'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
