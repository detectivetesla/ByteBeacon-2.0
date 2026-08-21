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
  Download,
  CreditCard,
  Layers,
  ChevronRight,
  RotateCw,
  Trash2,
  ExternalLink,
} from 'lucide-react';

export const AdminUserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'wallet' | 'orders' | 'transactions' | 'activity' | 'sessions' | 'agent' | 'notifications'
  >('overview');
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

  // Order Lifecycle Drawer / Modal
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Reconciliation state
  const [isReconciling, setIsReconciling] = useState(false);

  // Export modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'CSV' | 'JSON'>('JSON');
  const [isExporting, setIsExporting] = useState(false);

  // Order status filter
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');

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
      toastError('Failed to load user dossier', err.message || 'Unable to retrieve user details.');
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

  const handleRunReconciliation = async () => {
    if (!id) return;
    setIsReconciling(true);
    try {
      const res = await adminApi.reconcileUserWallet(id);
      if (res?.data?.status === 'RECONCILED') {
        toastSuccess('Reconciliation Passed', 'Wallet projection matches financial ledger entries.');
      } else {
        toastError('Discrepancy Detected', `Wallet balance differs by GH₵ ${(res.data.discrepancyPesewas / 100).toFixed(2)}.`);
      }
      fetchUser();
    } catch (err: any) {
      toastError('Reconciliation Error', err.message || 'Could not execute reconciliation check.');
    } finally {
      setIsReconciling(false);
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

  const handleRevokeApiKey = async (keyId: string) => {
    if (!id) return;
    try {
      await adminApi.revokeUserApiKey(id, keyId);
      toastSuccess('API Key Revoked', 'The selected API key has been revoked.');
      fetchUser();
    } catch (err: any) {
      toastError('Revocation Failed', err.message || 'Could not revoke API key.');
    }
  };

  const handleRotateApiKey = async (keyId: string) => {
    if (!id) return;
    try {
      await adminApi.rotateUserApiKey(id, keyId);
      toastSuccess('API Key Rotated', 'Old key revoked and new prefix provisioned.');
      fetchUser();
    } catch (err: any) {
      toastError('Rotation Failed', err.message || 'Could not rotate API key.');
    }
  };

  const handleExportDossier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setIsExporting(true);
    try {
      await adminApi.exportUserDossier(id, exportFormat);
      toastSuccess('Dossier Exported', `User data successfully exported in ${exportFormat} format.`);
      setIsExportModalOpen(false);
    } catch (err: any) {
      toastError('Export Failed', err.message || 'Could not export user dossier.');
    } finally {
      setIsExporting(false);
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
  const fin = userDetail?.financialSummary;
  const ordSummary = userDetail?.orderSummary;
  const balanceGhs = ((u?.walletBalancePesewas || 0) / 100).toFixed(2);
  const totalSpentGhs = ((fin?.totalSpentPesewas || 0) / 100).toFixed(2);
  const totalRefundsGhs = ((fin?.totalRefundsPesewas || 0) / 100).toFixed(2);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAgent = u?.role === 'agent';

  // Order status filtering
  const filteredOrders = (userDetail?.recentOrders || []).filter((o) => {
    if (orderStatusFilter === 'ALL') return true;
    return o.orderStatus === orderStatusFilter;
  });

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Navigation Breadcrumb */}
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

      {/* 11.4.1 User Header Banner & Action Control Bar */}
      <Card elevated accentColor="blue" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Avatar name={u?.fullName || u?.email?.split('@')[0] || 'User'} size="lg" status={u?.status === 'ACTIVE' ? 'online' : 'offline'} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  {u?.fullName || u?.email?.split('@')[0] || 'User Control Center'}
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
                {fin?.reconciliationStatus === 'RECONCILED' ? (
                  <Badge variant="success" size="sm">✓ Reconciled</Badge>
                ) : (
                  <Badge variant="warning" size="sm">⚠ Discrepancy</Badge>
                )}
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0', fontFamily: 'var(--font-mono)' }}>
                {u?.email} • {u?.phone || 'No phone linked'} • User ID: {u?.id}
              </p>
              <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', margin: '0.125rem 0 0' }}>
                Registered: {u?.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'} • Last Active: {u?.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
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
            <Button variant="outline" size="sm" onClick={() => setIsExportModalOpen(true)} leftIcon={<Download size={14} />}>
              Export Dossier
            </Button>
            <Button variant="outline" size="sm" onClick={handleRunReconciliation} isLoading={isReconciling} leftIcon={<RefreshCw size={14} />}>
              Reconcile Wallet
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

      {/* 11.4.2 Snapshot Overview Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard
          title="Authoritative Wallet"
          value={`GH₵ ${balanceGhs}`}
          subvalue={fin?.reconciliationStatus === 'RECONCILED' ? 'Ledger verified' : `Discrepancy: GH₵ ${((fin?.discrepancyPesewas || 0)/100).toFixed(2)}`}
          accent="green"
          icon={<TactileIcon icon={Wallet} color="security" size="sm" />}
        />
        <MetricCard
          title="Total Lifetime Orders"
          value={(ordSummary?.totalOrders || userDetail?.metrics?.totalOrders || 0).toLocaleString()}
          subvalue={`${ordSummary?.completed || 0} completed • ${ordSummary?.failed || 0} failed`}
          accent="blue"
          icon={<TactileIcon icon={Package} color="orders" size="sm" />}
        />
        <MetricCard
          title="Total Spending"
          value={`GH₵ ${totalSpentGhs}`}
          subvalue="Lifetime purchase volume"
          accent="cyan"
          icon={<TactileIcon icon={Activity} color="analytics" size="sm" />}
        />
        <MetricCard
          title="Resolved Refunds"
          value={`GH₵ ${totalRefundsGhs}`}
          subvalue={`${ordSummary?.refunded || 0} refunded orders`}
          accent="purple"
          icon={<TactileIcon icon={RefreshCw} color="api" size="sm" />}
        />
        <MetricCard
          title="Reconciliation Audit"
          value={fin?.reconciliationStatus === 'RECONCILED' ? 'PASSED' : 'DISCREPANCY'}
          subvalue="Double-entry ledger check"
          accent={fin?.reconciliationStatus === 'RECONCILED' ? 'green' : 'amber'}
          icon={<TactileIcon icon={ShieldCheck} color={fin?.reconciliationStatus === 'RECONCILED' ? 'emerald' : 'speed'} size="sm" />}
        />
      </div>

      {/* Responsive Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border-subtle)', overflowX: 'auto', paddingBottom: '2px' }}>
        {[
          { key: 'overview', label: 'Overview', icon: <User size={14} /> },
          { key: 'wallet', label: `Wallet & Ledger (GH₵ ${balanceGhs})`, icon: <Wallet size={14} /> },
          { key: 'orders', label: `Orders (${ordSummary?.totalOrders || userDetail?.recentOrders?.length || 0})`, icon: <Package size={14} /> },
          { key: 'transactions', label: `Transactions (${userDetail?.transactions?.length || 0})`, icon: <CreditCard size={14} /> },
          { key: 'activity', label: `Audit Stream (${userDetail?.activity?.length || 0})`, icon: <Activity size={14} /> },
          { key: 'sessions', label: `Sessions (${userDetail?.activeSessions?.length || 0})`, icon: <Lock size={14} /> },
          ...(isAgent ? [{ key: 'agent', label: 'Agent & API Portal', icon: <Store size={14} /> }] : []),
          { key: 'notifications', label: `Notifications (${userDetail?.notifications?.length || 0})`, icon: <Send size={14} /> },
        ].map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.key as any)}
            leftIcon={tab.icon}
            style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', whiteSpace: 'nowrap' }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* TAB 1: Overview (11.4.2) */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {/* Financial Overview Card */}
          <Card elevated accentColor="green" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
              <TactileIcon icon={Wallet} color="security" size="sm" />
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0 }}>
                11.4.2 Financial Overview
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Wallet Balance (Current)</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>GH₵ {balanceGhs}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Ledger-Derived Balance</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>GH₵ {((fin?.ledgerDerivedBalancePesewas || 0)/100).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Total Deposits</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>GH₵ {((fin?.totalDepositsPesewas || 0)/100).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Total Purchases</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>GH₵ {totalSpentGhs}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Total Refunds</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>GH₵ {totalRefundsGhs}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Pending Operations</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>GH₵ {((fin?.pendingOperationsPesewas || 0)/100).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Reconciliation Status</span>
                <Badge variant={fin?.reconciliationStatus === 'RECONCILED' ? 'success' : 'warning'} size="sm">
                  {fin?.reconciliationStatus}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Orders Overview Card */}
          <Card elevated accentColor="blue" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
              <TactileIcon icon={Package} color="orders" size="sm" />
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0 }}>
                11.4.2 Orders Overview
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Total Orders</span>
                <strong>{ordSummary?.totalOrders || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Completed</span>
                <Badge variant="success" size="sm">{ordSummary?.completed || 0}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Processing</span>
                <Badge variant="info" size="sm">{ordSummary?.processing || 0}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Pending Approval</span>
                <Badge variant="warning" size="sm">{ordSummary?.pending || 0}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Failed</span>
                <Badge variant="danger" size="sm">{ordSummary?.failed || 0}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Refunded</span>
                <Badge variant="neutral" size="sm">{ordSummary?.refunded || 0}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Last Order</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {ordSummary?.lastOrderAt ? new Date(ordSummary.lastOrderAt).toLocaleDateString() : 'None'}
                </span>
              </div>
            </div>
          </Card>

          {/* Account Profile Details */}
          <Card elevated accentColor="purple" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
              <TactileIcon icon={User} color="api" size="sm" />
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0 }}>
                11.4.2 Account & Security Overview
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
                <span style={{ color: 'var(--color-text-muted)' }}>Security Domain</span>
                <Badge variant="brand" size="sm">{u?.securityDomain || 'CUSTOMER'}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>MFA Status</span>
                <Badge variant={u?.mfaEnabled ? 'success' : 'neutral'} size="sm">{u?.mfaEnabled ? 'Enabled' : 'Disabled'}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Failed Login Attempts</span>
                <strong>{u?.failedLoginAttempts || 0}</strong>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: Wallet & Financial Control (11.4.3 & 11.4.18) */}
      {activeTab === 'wallet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Financial Integrity & Reconciliation Bar */}
          <Card elevated accentColor={fin?.reconciliationStatus === 'RECONCILED' ? 'green' : 'amber'} style={{ padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {fin?.reconciliationStatus === 'RECONCILED' ? (
                    <CheckCircle size={18} color="var(--color-success-bright)" />
                  ) : (
                    <AlertTriangle size={18} color="var(--color-warning-bright)" />
                  )}
                  Wallet Reconciliation Status: {fin?.reconciliationStatus}
                </h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0' }}>
                  User Wallet Projection: <strong>GH₵ {balanceGhs}</strong> • Double-Entry Ledger Sum: <strong>GH₵ {((fin?.ledgerDerivedBalancePesewas || 0)/100).toFixed(2)}</strong>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="outline" size="sm" onClick={handleRunReconciliation} isLoading={isReconciling} leftIcon={<RefreshCw size={14} />}>
                  Run Reconciliation
                </Button>
                <Button variant="primary" size="sm" onClick={() => setIsAdjustModalOpen(true)} leftIcon={<Wallet size={14} />}>
                  Post Double-Entry Voucher
                </Button>
              </div>
            </div>
          </Card>

          {/* Ledger Journal Lines Table */}
          <Card elevated accentColor="green" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0 }}>
                11.4.3 Double-Entry Ledger History
              </h3>
            </div>
            <Table
              headers={['Entry Type', 'Amount (GHS)', 'Account Type', 'Reference Type', 'Reference ID', 'Description', 'Timestamp']}
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
                    {line.referenceType}
                  </td>
                  <td style={{ fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                    {line.referenceId?.slice(0, 12)}...
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

      {/* TAB 3: Orders & Lifecycle Visibility (11.4.4 & 11.4.5) */}
      {activeTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['ALL', 'COMPLETED', 'PROCESSING', 'FAILED', 'REFUNDED'].map((st) => (
                <Button
                  key={st}
                  variant={orderStatusFilter === st ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setOrderStatusFilter(st)}
                >
                  {st}
                </Button>
              ))}
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
              DataHouse Telecom Fulfillment is Authoritative
            </p>
          </div>

          <Card elevated accentColor="cyan" style={{ padding: 0, overflow: 'hidden' }}>
            <Table
              headers={['Order ID / Public ID', 'Recipient', 'Network', 'Bundle Size', 'Amount', 'Payment', 'ByteBeacon State', 'DataHouse State', 'Date', 'Action']}
            >
              {filteredOrders.map((o) => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)' }}>
                    {o.publicId || o.id.slice(0, 8)}
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
                  <td>
                    <Badge variant="neutral" size="sm">
                      {o.providerStatus || 'SUBMITTED'}
                    </Badge>
                  </td>
                  <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(o)}>
                      Inspect Pipeline
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}

      {/* TAB 4: Dedicated Transactions View (11.4.6) */}
      {activeTab === 'transactions' && (
        <Card elevated accentColor="purple" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0 }}>
              11.4.6 User Payments & Payment Gateway Transactions
            </h3>
          </div>
          <Table
            headers={['Transaction ID', 'Amount (GHS)', 'Gateway / Provider', 'Payment Method', 'Payment Status', 'Timestamp']}
          >
            {(userDetail?.transactions || []).map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)' }}>
                  {t.id.slice(0, 12)}...
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  GH₵ {((t.amountPesewas || 0) / 100).toFixed(2)}
                </td>
                <td>
                  <Badge variant="brand" size="sm">{t.provider || 'PAYSTACK'}</Badge>
                </td>
                <td style={{ fontSize: 'var(--font-size-xs)' }}>
                  {t.paymentMethod || 'MoMo'}
                </td>
                <td>
                  <Badge variant={t.status === 'PAID' ? 'success' : 'warning'} size="sm">
                    {t.status}
                  </Badge>
                </td>
                <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {t.createdAt ? new Date(t.createdAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {/* TAB 5: Activity & Audit Stream (11.4.7) */}
      {activeTab === 'activity' && (
        <Card elevated accentColor="purple" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0 }}>
              11.4.7 Complete Account Audit Log
            </h3>
          </div>
          <Table
            headers={['Action', 'Actor Type', 'Actor ID', 'IP Address', 'Metadata', 'Timestamp']}
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
                  {act.actorId ? `${act.actorId.slice(0, 10)}...` : 'System'}
                </td>
                <td style={{ fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)' }}>
                  {act.ipAddress || '—'}
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

      {/* TAB 6: Sessions & Security (11.4.8) */}
      {activeTab === 'sessions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                11.4.8 Active Device Sessions & Security Controls
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.125rem 0 0' }}>
                Server-side session invalidation and password reset triggers.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="outline" size="sm" onClick={handlePasswordReset} leftIcon={<Key size={14} />}>
                Force Password Reset
              </Button>
              <Button variant="danger" size="sm" onClick={handleRevokeSessions} leftIcon={<LogOut size={14} />}>
                Revoke All Sessions
              </Button>
            </div>
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

      {/* TAB 7: Agent & Developer Portal (11.4.11 - 11.4.13) */}
      {activeTab === 'agent' && isAgent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Agent Storefront Card */}
          <Card elevated accentColor="orange" style={{ padding: 'var(--space-5)' }}>
            <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: '0 0 var(--space-4)' }}>
              11.4.12 Agent Storefront Overview
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', fontSize: 'var(--font-size-xs)' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Store Name</span>
                <strong>{userDetail?.agentData?.store?.storeName || 'No Storefront'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Store Slug / URL</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>/store/{userDetail?.agentData?.store?.slug || '—'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Commission Rate</span>
                <strong>{((userDetail?.agentData?.store?.commissionRate || 0.05) * 100).toFixed(1)}%</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Estimated Commission Earned</span>
                <strong style={{ color: 'var(--color-success-bright)' }}>GH₵ {((userDetail?.agentData?.commissionEarnedPesewas || 0)/100).toFixed(2)}</strong>
              </div>
            </div>
          </Card>

          {/* API Keys Table */}
          <Card elevated accentColor="orange" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0 }}>
                11.4.13 Provisioned API Keys (Secrets Masked)
              </h3>
            </div>
            <Table
              headers={['Key Name', 'Prefix Identifier', 'Environment', 'Rate Limit Tier', 'Status', 'Last Used', 'Actions']}
            >
              {(userDetail?.agentData?.apiKeys || []).map((k) => (
                <tr key={k.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ fontWeight: 600 }}>{k.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)' }}>{k.keyPrefix}...</td>
                  <td><Badge variant="brand" size="sm">{k.environment}</Badge></td>
                  <td style={{ fontSize: 'var(--font-size-2xs)' }}>{k.rateLimitTier}</td>
                  <td><Badge variant={k.status === 'ACTIVE' ? 'success' : 'danger'} size="sm">{k.status}</Badge></td>
                  <td style={{ fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)' }}>
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}
                  </td>
                  <td>
                    {k.status === 'ACTIVE' && (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <Button variant="outline" size="sm" onClick={() => handleRotateApiKey(k.id)}>Rotate</Button>
                        <Button variant="danger" size="sm" onClick={() => handleRevokeApiKey(k.id)}>Revoke</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}

      {/* TAB 8: Notifications Stream & Dispatch (11.4.14) */}
      {activeTab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0 }}>
              11.4.14 Dispatched User Notifications
            </h3>
            <Button variant="primary" size="sm" onClick={() => setIsNotifyModalOpen(true)} leftIcon={<Send size={14} />}>
              Send Direct Notification
            </Button>
          </div>

          <Card elevated accentColor="blue" style={{ padding: 0, overflow: 'hidden' }}>
            <Table
              headers={['Channel', 'Subject / Message Title', 'Message Content Snippet', 'Timestamp']}
            >
              {(userDetail?.notifications || []).map((n) => (
                <tr key={n.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td><Badge variant="info" size="sm">{n.channel}</Badge></td>
                  <td style={{ fontWeight: 600 }}>{n.subject || 'Account Notification'}</td>
                  <td style={{ fontSize: 'var(--font-size-xs)' }}>{n.message || '—'}</td>
                  <td style={{ fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)' }}>
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}

      {/* ORDER LIFECYCLE DRAWER / MODAL (11.4.5) */}
      {selectedOrder && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="cyan" style={{ maxWidth: '640px', width: '100%', padding: 'var(--space-6)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0 }}>
                  Order Lifecycle Pipeline
                </h2>
                <p style={{ fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', margin: '0.125rem 0 0' }}>
                  Order ID: {selectedOrder.id} • Public ID: {selectedOrder.publicId || 'N/A'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)}>Close</Button>
            </div>

            {/* Lifecycle Pipeline Visualization */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', backgroundColor: 'var(--color-surface-subtle)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>1. Payment State</span>
                <Badge variant={selectedOrder.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm">{selectedOrder.paymentStatus}</Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>2. ByteBeacon Internal State</span>
                <Badge variant={selectedOrder.orderStatus === 'COMPLETED' ? 'success' : 'info'} size="sm">{selectedOrder.orderStatus}</Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>3. DataHouse Telecom Provider State</span>
                <Badge variant="neutral" size="sm">{selectedOrder.providerStatus || 'SUBMITTED'}</Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>4. Refund / Reconciliation State</span>
                <Badge variant="neutral" size="sm">{selectedOrder.refundStatus || 'NONE'}</Badge>
              </div>
            </div>

            <Card elevated accentColor="amber" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-warning-bright)', margin: 0 }}>
                <strong>DataHouse Authority Rule:</strong> DataHouse remains authoritative for telecom fulfillment. Administrators cannot force-complete orders manually.
              </p>
            </Card>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" size="sm" onClick={() => setSelectedOrder(null)}>
                Done
              </Button>
            </div>
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

      {/* Double-Entry Wallet Adjustment Modal (11.4.3) */}
      {isAdjustModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="green" style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
              Double-Entry Wallet Adjustment
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              Posts balanced journal voucher to financial_ledger paired against PLATFORM_RESERVE.
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

      {/* Role Change Modal */}
      {isRoleModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="purple" style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
              Change Account Role
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

      {/* Direct User Notification Modal */}
      {isNotifyModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="blue" style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: '0 0 var(--space-4)' }}>
              Send Notification to User
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

      {/* Suspension Modal */}
      {isSuspendModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="red" style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
              Suspend User Account
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

      {/* Export Dossier Modal (11.4.15) */}
      {isExportModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="blue" style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
              Export User Dossier
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              Generates full account record (profile, orders, ledger, activity) excluding secrets.
            </p>

            <form onSubmit={handleExportDossier} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  <option value="JSON">JSON Format</option>
                  <option value="CSV">CSV Format</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-3)' }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsExportModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isExporting}>
                  Download Dossier
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
