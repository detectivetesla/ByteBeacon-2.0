import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
import { Input } from '../../components/ui/Input/Input.js';
import { Avatar } from '../../components/ui/Avatar/Avatar.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { adminApi, AdminUserDetail } from '../../api/admin.api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import {
  User,
  ArrowLeft,
  Shield,
  Wallet,
  Package,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  LogOut,
  PlusCircle,
  MinusCircle,
  Key,
  Lock,
  Mail,
  Smartphone,
  Store,
  Clock,
  Send,
  Edit3,
  FileText,
  ShieldCheck,
} from 'lucide-react';

export const AdminUserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'wallet' | 'orders' | 'activity' | 'sessions'>('overview');
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Edit profile modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhoneVerified, setEditPhoneVerified] = useState(false);
  const [editEmailVerified, setEditEmailVerified] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Wallet adjustment modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustAmountGhs, setAdjustAmountGhs] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Role change modal
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('customer');
  const [roleReason, setRoleReason] = useState('');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Send Notification modal
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [notifyChannel, setNotifyChannel] = useState<'EMAIL' | 'SMS' | 'IN_APP'>('EMAIL');
  const [notifySubject, setNotifySubject] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [isSendingNotify, setIsSendingNotify] = useState(false);

  // Suspend modal
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendRevokeSessions, setSuspendRevokeSessions] = useState(true);
  const [isSuspending, setIsSuspending] = useState(false);

  const fetchUser = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await adminApi.getUserDetails(id);
      if (res?.user) {
        setUserDetail(res);
        setSelectedRole(res.user.role);
        setEditName(res.user.fullName || '');
        setEditPhone(res.user.phone || '');
        setEditPhoneVerified(res.user.phoneVerified);
        setEditEmailVerified(res.user.emailVerified);
      }
    } catch (err: any) {
      toastError('Failed to load user', err.message || 'Unable to retrieve user details.');
    } finally {
      setIsLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setIsUpdatingProfile(true);
    try {
      await adminApi.updateUserProfile(id, {
        fullName: editName.trim(),
        phone: editPhone.trim(),
        phoneVerified: editPhoneVerified,
        emailVerified: editEmailVerified,
      });
      toastSuccess('Profile Updated', 'User profile details successfully saved.');
      setIsEditModalOpen(false);
      fetchUser();
    } catch (err: any) {
      toastError('Update Failed', err.message || 'Could not update profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleToggleSuspend = async () => {
    if (!id || !userDetail) return;
    const isSuspended = userDetail.user.status === 'SUSPENDED';

    if (isSuspended) {
      try {
        await adminApi.reactivateUser(id);
        toastSuccess('Account Reactivated', `${userDetail.user.email} is now active.`);
        fetchUser();
      } catch (err: any) {
        toastError('Operation Failed', err.message || 'Could not reactivate user.');
      }
    } else {
      setIsSuspendModalOpen(true);
    }
  };

  const handleExecuteSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !userDetail) return;

    setIsSuspending(true);
    try {
      await adminApi.suspendUser(id, {
        reason: suspendReason.trim() || 'Administrative suspension',
        revokeSessions: suspendRevokeSessions,
      });
      toastSuccess('Account Suspended', `${userDetail.user.email} has been suspended.`);
      setIsSuspendModalOpen(false);
      setSuspendReason('');
      fetchUser();
    } catch (err: any) {
      toastError('Suspension Failed', err.message || 'Could not suspend user.');
    } finally {
      setIsSuspending(false);
    }
  };

  const handleAdjustWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    const amountGhs = parseFloat(adjustAmountGhs);
    if (isNaN(amountGhs) || amountGhs <= 0) {
      toastError('Invalid Amount', 'Please enter a valid positive number in GHS.');
      return;
    }

    if (!adjustReason || adjustReason.trim().length < 5) {
      toastError('Reason Required', 'Please provide a detailed reason (minimum 5 characters).');
      return;
    }

    const amountPesewas = Math.round(amountGhs * 100);
    setIsAdjusting(true);

    try {
      await adminApi.adjustUserWallet(id, {
        amountPesewas,
        type: adjustType,
        reason: adjustReason.trim(),
      });
      toastSuccess('Wallet Adjusted', `Successfully ${adjustType === 'CREDIT' ? 'credited' : 'debited'} GH₵ ${amountGhs.toFixed(2)} via double-entry voucher.`);
      setIsAdjustModalOpen(false);
      setAdjustAmountGhs('');
      setAdjustReason('');
      fetchUser();
    } catch (err: any) {
      toastError('Adjustment Failed', err.message || 'Failed to post financial journal entry.');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setIsUpdatingRole(true);
    try {
      await adminApi.updateUserRole(id, selectedRole, roleReason.trim() || 'Administrative role change');
      toastSuccess('Role Updated', `User role changed to ${selectedRole}. Active sessions invalidated.`);
      setIsRoleModalOpen(false);
      setRoleReason('');
      fetchUser();
    } catch (err: any) {
      toastError('Role Change Denied', err.message || 'Unauthorized role transition.');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!notifySubject.trim() || !notifyMessage.trim()) {
      toastError('Missing Fields', 'Subject and message are required.');
      return;
    }

    setIsSendingNotify(true);
    try {
      await adminApi.sendUserDirectNotification(id, {
        channel: notifyChannel,
        subject: notifySubject.trim(),
        message: notifyMessage.trim(),
      });
      toastSuccess('Notification Queued', `Message sent via ${notifyChannel}.`);
      setIsNotifyModalOpen(false);
      setNotifySubject('');
      setNotifyMessage('');
      fetchUser();
    } catch (err: any) {
      toastError('Delivery Failed', err.message || 'Could not dispatch notification.');
    } finally {
      setIsSendingNotify(false);
    }
  };

  const handleRevokeSessions = async () => {
    if (!id) return;
    try {
      await adminApi.revokeUserSessions(id);
      toastSuccess('Sessions Revoked', 'All active device sessions have been terminated.');
      fetchUser();
    } catch (err: any) {
      toastError('Failed', err.message || 'Unable to revoke sessions.');
    }
  };

  const handlePasswordReset = async () => {
    if (!id || !userDetail) return;
    try {
      await adminApi.requestUserPasswordReset(id);
      toastSuccess('Reset Flow Initiated', `Password reset token generated for ${userDetail.user.email}.`);
      fetchUser();
    } catch (err: any) {
      toastError('Reset Failed', err.message || 'Could not initiate reset.');
    }
  };

  if (isLoading && !userDetail) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <RefreshCw size={24} className="animate-spin" color="var(--color-brand)" />
      </div>
    );
  }

  const u = userDetail?.user;
  const metrics = userDetail?.metrics;
  const balanceGhs = ((u?.walletBalancePesewas || 0) / 100).toFixed(2);
  const totalSpentGhs = ((metrics?.totalSpentPesewas || 0) / 100).toFixed(2);
  const dailySpentGhs = ((metrics?.dailySpentPesewas || 0) / 100).toFixed(2);
  const totalRefundsGhs = ((metrics?.totalRefundsPesewas || 0) / 100).toFixed(2);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/users')}
          leftIcon={<ArrowLeft size={16} />}
        >
          Back to User Directory
        </Button>
      </div>

      {/* 11.3.11 User Profile Header Banner */}
      <Card elevated accentColor="blue" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Avatar name={u?.fullName || u?.email?.split('@')[0] || 'User'} size="lg" status={u?.status === 'ACTIVE' ? 'online' : 'offline'} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  {u?.fullName || u?.email?.split('@')[0] || 'User Dossier'}
                </h1>
                <Badge
                  variant={
                    u?.role === 'super_admin'
                      ? 'brand'
                      : u?.role === 'admin'
                      ? 'info'
                      : u?.role === 'agent'
                      ? 'warning'
                      : 'neutral'
                  }
                  size="md"
                >
                  {u?.role?.replace('_', ' ').toUpperCase()}
                </Badge>
                <Badge variant={u?.status === 'ACTIVE' ? 'success' : 'danger'} size="md" dot>
                  {u?.status}
                </Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0', fontFamily: 'var(--font-mono)' }}>
                {u?.email} • {u?.phone || 'No phone'} • User ID: {u?.id}
              </p>
            </div>
          </div>

          {/* Quick Actions Toolbar */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)} leftIcon={<Edit3 size={14} />}>
              Edit Profile
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsNotifyModalOpen(true)} leftIcon={<Send size={14} />}>
              Notify
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsAdjustModalOpen(true)} leftIcon={<Wallet size={14} />}>
              Adjust Wallet
            </Button>
            {isSuperAdmin && (
              <Button variant="outline" size="sm" onClick={() => setIsRoleModalOpen(true)} leftIcon={<Shield size={14} />}>
                Change Role
              </Button>
            )}
            <Button
              variant={u?.status === 'ACTIVE' ? 'danger' : 'success'}
              size="sm"
              onClick={handleToggleSuspend}
            >
              {u?.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
            </Button>
          </div>
        </div>
      </Card>

      {/* 11.3.12 Real Computed User Overview Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard
          title="Wallet Balance"
          value={`GH₵ ${balanceGhs}`}
          subvalue="Authoritative ledger float"
          accent="green"
          icon={<TactileIcon icon={Wallet} color="security" size="sm" />}
        />
        <MetricCard
          title="Total Orders"
          value={(metrics?.totalOrders || 0).toLocaleString()}
          subvalue={`Lifetime orders count`}
          accent="blue"
          icon={<TactileIcon icon={Package} color="orders" size="sm" />}
        />
        <MetricCard
          title="Total Spent"
          value={`GH₵ ${totalSpentGhs}`}
          subvalue="Lifetime purchase volume"
          accent="cyan"
          icon={<TactileIcon icon={Activity} color="analytics" size="sm" />}
        />
        <MetricCard
          title="Daily Spent"
          value={`GH₵ ${dailySpentGhs}`}
          subvalue={`${metrics?.dailyOrders || 0} orders today`}
          accent="amber"
          icon={<TactileIcon icon={Clock} color="speed" size="sm" />}
        />
        <MetricCard
          title="Total Refunds"
          value={`GH₵ ${totalRefundsGhs}`}
          subvalue="Resolved reversals"
          accent="purple"
          icon={<TactileIcon icon={RefreshCw} color="api" size="sm" />}
        />
      </div>

      {/* Tabs Row */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border-subtle)' }}>
        {[
          { key: 'overview', label: 'Overview & Profile', icon: <User size={14} /> },
          { key: 'wallet', label: `Wallet & Ledger (GH₵ ${balanceGhs})`, icon: <Wallet size={14} /> },
          { key: 'orders', label: `Orders (${userDetail?.recentOrders?.length || 0})`, icon: <Package size={14} /> },
          { key: 'activity', label: `Activity & Audit (${userDetail?.activity?.length || 0})`, icon: <Activity size={14} /> },
          { key: 'sessions', label: `Sessions (${userDetail?.activeSessions?.length || 0})`, icon: <Lock size={14} /> },
        ].map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.key as any)}
            leftIcon={tab.icon}
            style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* TAB 1: Overview & Profile */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {/* Account Profile Card */}
          <Card elevated accentColor="blue" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
              <TactileIcon icon={User} color="orders" size="sm" />
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0 }}>
                11.3.13 Profile Information
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Full Name</span>
                <strong>{u?.fullName || 'Not specified'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Email Address</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{u?.email}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Phone Number</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{u?.phone || 'Unlinked'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Email Verified</span>
                <Badge variant={u?.emailVerified ? 'success' : 'warning'} size="sm">{u?.emailVerified ? 'Verified' : 'Unverified'}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Phone Verified</span>
                <Badge variant={u?.phoneVerified ? 'success' : 'warning'} size="sm">{u?.phoneVerified ? 'Verified' : 'Unverified'}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Registered</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{u?.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Last Active</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{u?.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</span>
              </div>
            </div>
          </Card>

          {/* Security & Authentication Card */}
          <Card elevated accentColor="purple" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
              <TactileIcon icon={Lock} color="api" size="sm" />
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0 }}>
                11.3.25 Security & Access Control
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Security Domain</span>
                <Badge variant="brand" size="sm">{u?.securityDomain || 'CUSTOMER'}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>MFA Status</span>
                <Badge variant={u?.mfaEnabled ? 'success' : 'neutral'} size="sm">{u?.mfaEnabled ? 'MFA Enabled' : 'Disabled'}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Failed Login Attempts</span>
                <strong>{u?.failedLoginAttempts || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Account Lock Status</span>
                <Badge variant={u?.lockedUntil ? 'danger' : 'success'} size="sm">{u?.lockedUntil ? 'Locked' : 'Unlocked'}</Badge>
              </div>
              <div style={{ marginTop: 'var(--space-2)' }}>
                <Button variant="outline" size="sm" fullWidth onClick={handlePasswordReset} leftIcon={<Key size={13} />}>
                  Force Password Reset
                </Button>
              </div>
            </div>
          </Card>

          {/* 11.3.28 Agent-Specific Storefront Card */}
          {u?.role === 'agent' && (
            <Card elevated accentColor="orange" style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
                <TactileIcon icon={Store} color="speed" size="sm" />
                <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0 }}>
                  Agent Storefront & API Integration
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Store Name</span>
                  <strong>{userDetail?.agentData?.store?.storeName || 'No Storefront'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Storefront Slug</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>/store/{userDetail?.agentData?.store?.slug || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Active API Keys</span>
                  <Badge variant="info" size="sm">{userDetail?.agentData?.apiKeys?.length || 0} Keys Provisioned</Badge>
                </div>
              </div>
            </Card>
          )}

          {/* 11.3.30 Admin-Specific Permissions Card */}
          {(u?.role === 'admin' || u?.role === 'super_admin') && (
            <Card elevated accentColor="purple" style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
                <TactileIcon icon={ShieldCheck} color="api" size="sm" />
                <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0 }}>
                  Administrative Authority & Grants
                </h3>
              </div>
              <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                Assigned granular permissions enforced via RBAC Engine.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                {(userDetail?.adminData?.permissions || ['orders.read', 'orders.create', 'wallet.read', 'agents.read']).map((p) => (
                  <Badge key={p} variant="neutral" size="sm">
                    {p}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: Wallet & Ledger */}
      {activeTab === 'wallet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                11.3.17 Double-Entry Financial Ledger
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.125rem 0 0' }}>
                Authoritative journal lines posted to this user account. Balanced against PLATFORM_RESERVE.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={() => setIsAdjustModalOpen(true)} leftIcon={<Wallet size={14} />}>
              Adjust Wallet
            </Button>
          </div>

          <Card elevated accentColor="green" style={{ padding: 0, overflow: 'hidden' }}>
            <Table
              headers={['Entry Type', 'Amount (GHS)', 'Account Type', 'Reference', 'Description', 'Timestamp']}
            >
              {(userDetail?.recentLedgerLines || []).map((line, idx) => (
                <tr key={line.id || idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td>
                    <Badge variant={line.entryType === 'CREDIT' ? 'success' : 'danger'} size="sm">
                      {line.entryType}
                    </Badge>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: line.entryType === 'CREDIT' ? 'var(--color-success-bright)' : 'var(--color-text-primary)' }}>
                    GH₵ {((line.amountPesewas || 0) / 100).toFixed(2)}
                  </td>
                  <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                    {line.accountType || 'CUSTOMER_WALLET'}
                  </td>
                  <td style={{ fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                    {line.referenceType || 'LEDGER_TX'}
                  </td>
                  <td style={{ fontSize: 'var(--font-size-xs)' }}>
                    {line.description || 'System transaction'}
                  </td>
                  <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {line.createdAt ? new Date(line.createdAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}

      {/* TAB 3: Orders */}
      {activeTab === 'orders' && (
        <Card elevated accentColor="cyan" style={{ padding: 0, overflow: 'hidden' }}>
          <Table
            headers={['Order ID', 'Recipient', 'Network', 'Bundle Size', 'Amount', 'Payment', 'Order Status', 'Date']}
          >
            {(userDetail?.recentOrders || []).map((o) => (
              <tr key={o.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)' }}>
                  {o.id.slice(0, 8)}...
                </td>
                <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {o.recipientPhone}
                </td>
                <td>
                  <Badge variant="neutral" size="sm">{o.network}</Badge>
                </td>
                <td>{o.dataAmountMb >= 1000 ? `${o.dataAmountMb / 1000} GB` : `${o.dataAmountMb} MB`}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  GH₵ {((o.amountPesewas || 0) / 100).toFixed(2)}
                </td>
                <td>
                  <Badge variant={o.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm">
                    {o.paymentStatus || 'PAID'}
                  </Badge>
                </td>
                <td>
                  <Badge
                    variant={
                      o.orderStatus === 'COMPLETED'
                        ? 'success'
                        : o.orderStatus === 'PROCESSING'
                        ? 'info'
                        : o.orderStatus === 'FAILED'
                        ? 'danger'
                        : 'neutral'
                    }
                    size="sm"
                    dot
                  >
                    {o.orderStatus}
                  </Badge>
                </td>
                <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {/* TAB 4: Activity & Audit */}
      {activeTab === 'activity' && (
        <Card elevated accentColor="purple" style={{ padding: 0, overflow: 'hidden' }}>
          <Table
            headers={['Action', 'Actor Type', 'Actor ID', 'Details / Metadata', 'Timestamp']}
          >
            {(userDetail?.activity || []).map((act, idx) => (
              <tr key={act.id || idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <td>
                  <Badge variant="brand" size="sm">{act.action}</Badge>
                </td>
                <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                  {act.actorType}
                </td>
                <td style={{ fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                  {act.actorId?.slice(0, 10)}...
                </td>
                <td style={{ fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)' }}>
                  {act.metadata ? JSON.stringify(act.metadata) : '—'}
                </td>
                <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {act.createdAt ? new Date(act.createdAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {/* TAB 5: Sessions & Security */}
      {activeTab === 'sessions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                11.3.24 Active Device Sessions
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.125rem 0 0' }}>
                Track live browser and mobile tokens with remote termination capabilities.
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={handleRevokeSessions} leftIcon={<LogOut size={14} />}>
              Revoke All Sessions
            </Button>
          </div>

          <Card elevated accentColor="purple" style={{ padding: 0, overflow: 'hidden' }}>
            <Table
              headers={['Device / User Agent', 'IP Address', 'Device ID', 'Last Active', 'Session Status']}
            >
              {(userDetail?.activeSessions || []).map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                    {s.userAgent || 'Web Browser'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)' }}>
                    {s.ipAddress || '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                    {s.deviceId || '—'}
                  </td>
                  <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString() : '—'}
                  </td>
                  <td>
                    <Badge variant={s.isRevoked ? 'danger' : 'success'} size="sm">
                      {s.isRevoked ? 'REVOKED' : 'ACTIVE'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="blue" style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: '0 0 var(--space-4)' }}>
              Edit User Profile
            </h2>
            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Input
                label="Full Name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
              <Input
                label="Phone Number"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                required
              />
              <div style={{ display: 'flex', gap: '1rem', marginTop: 'var(--space-2)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editPhoneVerified}
                    onChange={(e) => setEditPhoneVerified(e.target.checked)}
                  />
                  Phone Verified
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editEmailVerified}
                    onChange={(e) => setEditEmailVerified(e.target.checked)}
                  />
                  Email Verified
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-3)' }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isUpdatingProfile}>
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* 11.3.15 & 11.3.16 Safe Double-Entry Wallet Adjustment Modal */}
      {isAdjustModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="green" style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
              11.3.15 Double-Entry Wallet Adjustment
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              Balanced against PLATFORM_RESERVE escrow. Never direct overwrite.
            </p>

            <form onSubmit={handleAdjustWallet} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  type="button"
                  variant={adjustType === 'CREDIT' ? 'primary' : 'outline'}
                  size="sm"
                  fullWidth
                  onClick={() => setAdjustType('CREDIT')}
                  leftIcon={<PlusCircle size={14} />}
                >
                  Credit Wallet
                </Button>
                <Button
                  type="button"
                  variant={adjustType === 'DEBIT' ? 'danger' : 'outline'}
                  size="sm"
                  fullWidth
                  onClick={() => setAdjustType('DEBIT')}
                  leftIcon={<MinusCircle size={14} />}
                >
                  Debit Wallet
                </Button>
              </div>

              <Input
                label="Amount (GH₵)"
                type="number"
                step="0.01"
                min="0.01"
                value={adjustAmountGhs}
                onChange={(e) => setAdjustAmountGhs(e.target.value)}
                placeholder="0.00"
                required
              />

              <Input
                label="Mandatory Audit Reason (min 5 chars)"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Manual MoMo deposit resolution"
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-3)' }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdjustModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant={adjustType === 'CREDIT' ? 'primary' : 'danger'} size="sm" isLoading={isAdjusting}>
                  Confirm {adjustType}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* 11.3.32 Role Change Modal */}
      {isRoleModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="purple" style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
              11.3.32 Change Account Role
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              Modifying roles will immediately invalidate all active sessions.
            </p>

            <form onSubmit={handleUpdateRole} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>New Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  <option value="customer">Customer</option>
                  <option value="agent">Agent Reseller</option>
                  <option value="admin">Operations Admin</option>
                  <option value="super_admin">Super Administrator</option>
                </select>
              </div>

              <Input
                label="Reason for Role Change"
                value={roleReason}
                onChange={(e) => setRoleReason(e.target.value)}
                placeholder="e.g. Approved Agent onboarding application"
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-3)' }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsRoleModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isUpdatingRole}>
                  Confirm Role Change
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* 11.3.35 Direct User Notification Modal */}
      {isNotifyModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="blue" style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: '0 0 var(--space-4)' }}>
              11.3.35 Send Notification to User
            </h2>
            <form onSubmit={handleSendNotification} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Channel</label>
                <select
                  value={notifyChannel}
                  onChange={(e) => setNotifyChannel(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  <option value="EMAIL">Email Relay</option>
                  <option value="SMS">SMS Gateway</option>
                  <option value="IN_APP">In-App Notification</option>
                </select>
              </div>

              <Input
                label="Subject"
                value={notifySubject}
                onChange={(e) => setNotifySubject(e.target.value)}
                placeholder="Important account update"
                required
              />

              <div>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Message Content</label>
                <textarea
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  rows={4}
                  required
                  placeholder="Enter the body of the notification..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-default)',
                    fontFamily: 'inherit',
                    fontSize: 'var(--font-size-xs)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-3)' }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsNotifyModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isSendingNotify}>
                  Send Notification
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* 11.3.27 Suspension Modal */}
      {isSuspendModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="red" style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
              11.3.27 Suspend User Account
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              Suspension immediately prevents storefront checkouts and authentication.
            </p>

            <form onSubmit={handleExecuteSuspend} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Input
                label="Mandatory Reason for Suspension"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g. Fraudulent transaction activity flagged"
                required
              />

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)', cursor: 'pointer', marginTop: 'var(--space-2)' }}>
                <input
                  type="checkbox"
                  checked={suspendRevokeSessions}
                  onChange={(e) => setSuspendRevokeSessions(e.target.checked)}
                />
                Revoke all active device & API sessions
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-3)' }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsSuspendModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="danger" size="sm" isLoading={isSuspending}>
                  Suspend Account
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
