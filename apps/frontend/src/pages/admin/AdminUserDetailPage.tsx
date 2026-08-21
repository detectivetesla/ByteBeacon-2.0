import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
import { Input } from '../../components/ui/Input/Input.js';
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
} from 'lucide-react';

export const AdminUserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'wallet' | 'orders' | 'sessions'>('overview');
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Wallet adjustment modal state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustAmountGhs, setAdjustAmountGhs] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Role change modal state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('customer');
  const [roleReason, setRoleReason] = useState('');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const fetchUser = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await adminApi.getUserDetails(id);
      if (res?.user) {
        setUserDetail(res);
        setSelectedRole(res.user.role);
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

  const handleToggleSuspend = async () => {
    if (!id || !userDetail) return;
    const isSuspended = userDetail.user.status === 'SUSPENDED';
    try {
      if (isSuspended) {
        await adminApi.reactivateUser(id);
        toastSuccess('Account Reactivated', `${userDetail.user.email} is now active.`);
      } else {
        await adminApi.suspendUser(id, 'Administrative suspension');
        toastSuccess('Account Suspended', `${userDetail.user.email} has been suspended.`);
      }
      fetchUser();
    } catch (err: any) {
      toastError('Operation Failed', err.message || 'Could not update user status.');
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

    const amountPesewas = Math.round(amountGhs * 100);
    setIsAdjusting(true);

    try {
      await adminApi.adjustUserWallet(id, {
        amountPesewas,
        type: adjustType,
        reason: adjustReason.trim() || 'Manual administrative adjustment',
      });
      toastSuccess('Wallet Adjusted', `Successfully ${adjustType === 'CREDIT' ? 'credited' : 'debited'} GH₵ ${amountGhs.toFixed(2)}.`);
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
      toastSuccess('Role Updated', `User role changed to ${selectedRole}.`);
      setIsRoleModalOpen(false);
      setRoleReason('');
      fetchUser();
    } catch (err: any) {
      toastError('Role Change Denied', err.message || 'Unauthorized role transition.');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleRevokeSessions = async () => {
    if (!id) return;
    try {
      await adminApi.revokeUserSessions(id);
      toastSuccess('Sessions Revoked', 'All active login sessions terminated.');
      fetchUser();
    } catch (err: any) {
      toastError('Failed', err.message || 'Unable to revoke sessions.');
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
  const balanceGhs = ((u?.walletBalancePesewas || 0) / 100).toFixed(2);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', overflowX: 'hidden' }}>
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/admin/users')}
        leftIcon={<ArrowLeft size={16} />}
        style={{ marginBottom: 'var(--space-4)' }}
      >
        Back to User Directory
      </Button>

      {/* Header Banner Card */}
      <Card elevated accentColor="blue" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <TactileIcon icon={User} color={u?.role === 'super_admin' ? 'api' : u?.role === 'agent' ? 'speed' : 'orders'} size="lg" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  {u?.fullName || u?.email?.split('@')[0] || 'User Profile'}
                </h1>
                <Badge
                  variant={u?.role === 'super_admin' ? 'brand' : u?.role === 'admin' ? 'info' : u?.role === 'agent' ? 'warning' : 'neutral'}
                  size="sm"
                >
                  {u?.role?.replace('_', ' ').toUpperCase()}
                </Badge>
                <Badge variant={u?.status === 'ACTIVE' ? 'success' : 'danger'} size="sm">
                  {u?.status}
                </Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0', fontFamily: 'var(--font-mono)' }}>
                {u?.email} • {u?.phone || 'No phone'} • ID: {u?.id}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdjustModalOpen(true)}
              leftIcon={<Wallet size={14} />}
            >
              Adjust Wallet
            </Button>
            {isSuperAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRoleModalOpen(true)}
                leftIcon={<Shield size={14} />}
              >
                Change Role
              </Button>
            )}
            <Button
              variant={u?.status === 'ACTIVE' ? 'danger' : 'success'}
              size="sm"
              onClick={handleToggleSuspend}
            >
              {u?.status === 'ACTIVE' ? 'Suspend Account' : 'Reactivate'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs Row */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: 'var(--space-6)' }}>
        {[
          { key: 'overview', label: 'Overview & Identity', icon: <User size={14} /> },
          { key: 'wallet', label: `Wallet (GH₵ ${balanceGhs})`, icon: <Wallet size={14} /> },
          { key: 'orders', label: `Orders (${userDetail?.recentOrders?.length || 0})`, icon: <Package size={14} /> },
          { key: 'sessions', label: `Sessions (${userDetail?.activeSessions?.length || 0})`, icon: <Activity size={14} /> },
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

      {/* TAB CONTENT: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
          <Card elevated accentColor="purple" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
              <TactileIcon icon={Lock} color="api" size="sm" />
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0 }}>
                Security & Authentication
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Security Domain</span>
                <span style={{ fontWeight: 700 }}>{u?.securityDomain}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>MFA Verification</span>
                <span style={{ fontWeight: 700 }}>{u?.mfaEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Phone Verified</span>
                <span style={{ fontWeight: 700 }}>{u?.phoneVerified ? 'Verified' : 'Pending'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Registered</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{u?.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          </Card>

          <Card elevated accentColor="green" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
              <TactileIcon icon={Wallet} color="security" size="sm" />
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0 }}>
                Financial Summary
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Authoritative Balance</span>
                <span style={{ fontWeight: 800, color: 'var(--color-brand)', fontFamily: 'var(--font-mono)' }}>
                  GH₵ {balanceGhs}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Balance in Pesewas</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{u?.walletBalancePesewas} pesewas</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Total Orders Placed</span>
                <span style={{ fontWeight: 700 }}>{userDetail?.recentOrders?.length || 0}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB CONTENT: Wallet & Ledger */}
      {activeTab === 'wallet' && (
        <Card elevated accentColor="green" style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TactileIcon icon={Wallet} color="security" size="sm" />
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase' }}>
                Double-Entry Ledger Lines
              </h3>
            </div>
            <Button size="sm" onClick={() => setIsAdjustModalOpen(true)} leftIcon={<PlusCircle size={14} />}>
              Post Adjustment
            </Button>
          </div>

          <Table
            columns={[
              {
                header: 'Type',
                accessor: 'entryType',
                render: (row) => (
                  <Badge variant={row.entryType === 'CREDIT' ? 'success' : 'danger'} size="sm">
                    {row.entryType}
                  </Badge>
                ),
              },
              {
                header: 'Amount',
                accessor: 'amountPesewas',
                render: (row) => (
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                    GH₵ {(row.amountPesewas / 100).toFixed(2)}
                  </span>
                ),
              },
              {
                header: 'Reference',
                accessor: 'referenceType',
                render: (row) => (
                  <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {row.referenceType}
                  </span>
                ),
              },
              {
                header: 'Description',
                accessor: 'description',
                render: (row) => <span style={{ fontSize: 'var(--font-size-xs)' }}>{row.description}</span>,
              },
              {
                header: 'Timestamp',
                accessor: 'createdAt',
                render: (row) => (
                  <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                ),
              },
            ]}
            data={userDetail?.recentLedgerLines || []}
            keyExtractor={(item) => item.id}
            emptyText="No ledger transactions on record for this user."
          />
        </Card>
      )}

      {/* TAB CONTENT: Orders */}
      {activeTab === 'orders' && (
        <Card elevated accentColor="cyan" style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
            <TactileIcon icon={Package} color="analytics" size="sm" />
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase' }}>
              Recent Orders
            </h3>
          </div>
          <Table
            columns={[
              {
                header: 'Order ID',
                accessor: 'id',
                render: (row) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>{row.id}</span>,
              },
              {
                header: 'Recipient Phone',
                accessor: 'recipientPhone',
                render: (row) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>{row.recipientPhone}</span>,
              },
              {
                header: 'Network',
                accessor: 'network',
                render: (row) => (
                  <Badge variant={row.network === 'MTN' ? 'warning' : row.network === 'TELECEL' ? 'danger' : 'info'} size="sm">
                    {row.network}
                  </Badge>
                ),
              },
              {
                header: 'Bundle Size',
                accessor: 'dataAmountMb',
                render: (row) => <span>{(row.dataAmountMb / 1024).toFixed(1)} GB</span>,
              },
              {
                header: 'Amount',
                accessor: 'amountPesewas',
                render: (row) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>GH₵ {(row.amountPesewas / 100).toFixed(2)}</span>,
              },
              {
                header: 'Status',
                accessor: 'orderStatus',
                render: (row) => (
                  <Badge variant={row.orderStatus === 'COMPLETED' ? 'success' : row.orderStatus === 'FAILED' ? 'danger' : 'warning'} size="sm">
                    {row.orderStatus}
                  </Badge>
                ),
              },
            ]}
            data={userDetail?.recentOrders || []}
            keyExtractor={(item) => item.id}
            emptyText="No orders placed by this user."
          />
        </Card>
      )}

      {/* TAB CONTENT: Sessions */}
      {activeTab === 'sessions' && (
        <Card elevated accentColor="purple" style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TactileIcon icon={Activity} color="api" size="sm" />
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase' }}>
                Active Device Sessions
              </h3>
            </div>
            <Button variant="danger" size="sm" onClick={handleRevokeSessions} leftIcon={<LogOut size={14} />}>
              Revoke All Devices
            </Button>
          </div>

          <Table
            columns={[
              {
                header: 'Device / User Agent',
                accessor: 'userAgent',
                render: (row) => (
                  <span style={{ fontSize: 'var(--font-size-xs)', maxWidth: '300px', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {row.userAgent || 'Unknown Device'}
                  </span>
                ),
              },
              {
                header: 'IP Address',
                accessor: 'ipAddress',
                render: (row) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>{row.ipAddress || '127.0.0.1'}</span>,
              },
              {
                header: 'Last Active',
                accessor: 'lastActiveAt',
                render: (row) => <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>{row.lastActiveAt ? new Date(row.lastActiveAt).toLocaleString() : 'Recent'}</span>,
              },
              {
                header: 'Status',
                accessor: 'isRevoked',
                render: (row) => <Badge variant={row.isRevoked ? 'danger' : 'success'} size="sm">{row.isRevoked ? 'REVOKED' : 'ACTIVE'}</Badge>,
              },
            ]}
            data={userDetail?.activeSessions || []}
            keyExtractor={(item) => item.id}
            emptyText="No active device sessions."
          />
        </Card>
      )}

      {/* MODAL: Wallet Adjustment */}
      {isAdjustModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="green" style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, marginBottom: 'var(--space-4)', margin: 0 }}>
              Adjust User Wallet Balance
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              Posts a double-entry journal line. Current balance: <strong>GH₵ {balanceGhs}</strong>.
            </p>

            <form onSubmit={handleAdjustWallet} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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
                label="Amount (GHS)"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 50.00"
                value={adjustAmountGhs}
                onChange={(e) => setAdjustAmountGhs(e.target.value)}
                required
              />

              <Input
                label="Mandatory Reason"
                type="text"
                placeholder="e.g. Manual refund compensation for failed order"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdjustModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant={adjustType === 'CREDIT' ? 'primary' : 'danger'} size="sm" isLoading={isAdjusting}>
                  Confirm Adjustment
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: Change Role */}
      {isRoleModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="purple" style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0, marginBottom: 'var(--space-2)' }}>
              Reassign User Role
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              Super Admin authorization required. Revokes active sessions on change.
            </p>

            <form onSubmit={handleUpdateRole} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>Select Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{
                  padding: '0.625rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-default)',
                }}
              >
                <option value="customer">Customer</option>
                <option value="agent">Agent / Reseller</option>
                <option value="admin">Operations Admin</option>
                <option value="super_admin">Super Administrator</option>
              </select>

              <Input
                label="Reason for Role Change"
                type="text"
                placeholder="e.g. Promoted to reseller partner"
                value={roleReason}
                onChange={(e) => setRoleReason(e.target.value)}
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsRoleModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isUpdatingRole}>
                  Save Role
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
