import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Select, Input } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Avatar } from '../../components/ui/Avatar/Avatar.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useToast } from '../../context/ToastContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { adminApi, AdminUserListItem, AdminUserStats } from '../../api/admin.api.js';
import {
  Users,
  Plus,
  RefreshCw,
  Eye,
  Shield,
  UserCheck,
  Store,
  Download,
  CheckSquare,
  Square,
} from 'lucide-react';

export const AdminUsersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [verificationFilter, setVerificationFilter] = useState<string>('ALL');
  const [mfaFilter, setMfaFilter] = useState<string>('ALL');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'SUSPEND' | 'ACTIVATE' | 'NOTIFY'>('SUSPEND');
  const [bulkReason, setBulkReason] = useState('');
  const [isExecutingBulk, setIsExecutingBulk] = useState(false);

  // Add User modal
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('customer');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Export modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'CSV' | 'JSON'>('CSV');
  const [isExporting, setIsExporting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getUsers({
        page,
        limit: 20,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        verification: verificationFilter !== 'ALL' ? verificationFilter : undefined,
        mfa: mfaFilter !== 'ALL' ? mfaFilter : undefined,
        period: periodFilter !== 'all' ? periodFilter : undefined,
        search: searchQuery.trim() || undefined,
      });

      const userList = res?.users || (res as any)?.data?.users || (Array.isArray(res) ? res : []);
      const pagination = res?.pagination || (res as any)?.data?.pagination || { totalPages: 1, total: userList.length };
      const userStats = res?.stats || (res as any)?.data?.stats || null;

      setUsers(userList);
      setTotalPages(pagination.totalPages || 1);
      setTotalUsers(pagination.total ?? userList.length);
      if (userStats) {
        setStats(userStats);
      }
    } catch (err) {
      console.error('Failed to fetch user directory:', err);
      setUsers([]);
      setTotalPages(1);
      setTotalUsers(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, roleFilter, statusFilter, verificationFilter, mfaFilter, periodFilter, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleSelectAll = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map((u) => u.id));
    }
  };

  const handleToggleSelectUser = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newPhone.trim() || !newName.trim()) {
      toastError('Missing Fields', 'Email, phone number, and full name are required.');
      return;
    }

    setIsCreatingUser(true);
    try {
      await adminApi.createUser({
        email: newEmail.trim(),
        phone: newPhone.trim(),
        fullName: newName.trim(),
        password: newPassword.trim() || 'Password123!',
        role: newRole,
      });
      toastSuccess('User Created', `Account for ${newEmail} successfully registered.`);
      setIsAddUserModalOpen(false);
      setNewEmail('');
      setNewPhone('');
      setNewName('');
      setNewPassword('');
      fetchUsers();
    } catch (err: any) {
      toastError('Registration Failed', err.message || 'Could not create user account.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleExecuteBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;

    setIsExecutingBulk(true);
    try {
      await adminApi.bulkUsersAction({
        action: bulkAction,
        userIds: selectedIds,
        reason: bulkReason.trim() || 'Administrative bulk action',
      });
      toastSuccess('Bulk Action Complete', `${bulkAction} applied to ${selectedIds.length} users.`);
      setIsBulkModalOpen(false);
      setSelectedIds([]);
      setBulkReason('');
      fetchUsers();
    } catch (err: any) {
      toastError('Bulk Action Failed', err.message || 'Operation could not be completed.');
    } finally {
      setIsExecutingBulk(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res: any = await adminApi.exportUsers({
        format: exportFormat,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
      });

      if (exportFormat === 'CSV') {
        const blob = new Blob([res], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bytebeacon-users-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bytebeacon-users-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      toastSuccess('Export Ready', `Downloaded user data in ${exportFormat} format.`);
      setIsExportModalOpen(false);
    } catch (err: any) {
      toastError('Export Failed', err.message || 'Could not export user list.');
    } finally {
      setIsExporting(false);
    }
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 11.3.3 Header & Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Users} color="orders" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-info-bright)' }}>
              Access Governance & User Directory
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              User Directory
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
              Manage and administer ByteBeacon accounts across Customers, Agents, and Administrators. Total: {totalUsers.toLocaleString()} accounts.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkModalOpen(true)}
              style={{ borderColor: 'var(--color-brand)', color: 'var(--color-brand)' }}
            >
              Bulk Actions ({selectedIds.length})
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={() => setIsExportModalOpen(true)} leftIcon={<Download size={14} />}>
            Export
          </Button>

          <Button variant="ghost" size="sm" onClick={fetchUsers} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>

          <Button variant="primary" size="md" onClick={() => setIsAddUserModalOpen(true)} leftIcon={<Plus size={16} />}>
            Add User
          </Button>
        </div>
      </div>

      {/* 11.3.4 User Statistics from Real DB Queries */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard
          title="Total Users"
          value={(stats?.total || 0).toLocaleString()}
          subvalue={`${stats?.active || 0} Active • ${stats?.suspended || 0} Suspended`}
          accent="blue"
          icon={<TactileIcon icon={Users} color="orders" size="sm" />}
        />
        <MetricCard
          title="Customers"
          value={(stats?.customers || 0).toLocaleString()}
          subvalue="Retail telecom consumers"
          accent="green"
          icon={<TactileIcon icon={UserCheck} color="security" size="sm" />}
        />
        <MetricCard
          title="Agents"
          value={(stats?.agents || 0).toLocaleString()}
          subvalue="Storefront resellers"
          accent="orange"
          icon={<TactileIcon icon={Store} color="speed" size="sm" />}
        />
        <MetricCard
          title="Administrators"
          value={((stats?.admins || 0) + (stats?.superAdmins || 0)).toLocaleString()}
          subvalue={`${stats?.superAdmins || 0} Super Admin • ${stats?.admins || 0} Admins`}
          accent="purple"
          icon={<TactileIcon icon={Shield} color="api" size="sm" />}
        />
      </div>

      {/* 11.3.6 Server-Side Multi-Filter Card */}
      <Card accentColor="blue" style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div style={{ width: '360px', maxWidth: '100%' }}>
              <SearchInput
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, email, phone, User ID..."
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Roles', value: 'ALL' },
                  { label: 'Customers', value: 'customer' },
                  { label: 'Agents', value: 'agent' },
                  { label: 'Admins', value: 'admin' },
                  { label: 'Super Admins', value: 'super_admin' },
                ]}
              />

              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Statuses', value: 'ALL' },
                  { label: 'Active', value: 'ACTIVE' },
                  { label: 'Suspended', value: 'SUSPENDED' },
                  { label: 'Pending Verification', value: 'PENDING_VERIFICATION' },
                ]}
              />

              <Select
                value={verificationFilter}
                onChange={(e) => {
                  setVerificationFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Verification', value: 'ALL' },
                  { label: 'Verified Accounts', value: 'VERIFIED' },
                  { label: 'Unverified Accounts', value: 'UNVERIFIED' },
                ]}
              />

              <Select
                value={mfaFilter}
                onChange={(e) => {
                  setMfaFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Security', value: 'ALL' },
                  { label: 'MFA Enabled', value: 'MFA_ENABLED' },
                  { label: 'MFA Disabled', value: 'MFA_DISABLED' },
                ]}
              />

              <Select
                value={periodFilter}
                onChange={(e) => {
                  setPeriodFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Time', value: 'all' },
                  { label: 'Registered Today', value: 'today' },
                  { label: 'Last 7 Days', value: '7d' },
                  { label: 'Last 30 Days', value: '30d' },
                  { label: 'Last 90 Days', value: '90d' },
                ]}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 11.3.7 Desktop Table View */}
      <Card elevated style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <Table
            headers={[
              <span onClick={handleToggleSelectAll} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {selectedIds.length > 0 && selectedIds.length === users.length ? <CheckSquare size={16} /> : <Square size={16} />}
              </span>,
              'User Profile',
              'Phone Number',
              'Role',
              'Status',
              'Security / MFA',
              'Joined Date',
              'Actions',
            ]}
          >
            {users.map((user) => {
              const isSelected = selectedIds.includes(user.id);
              const displayName = user.fullName || user.email.split('@')[0];

              return (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: '1px solid var(--color-border-subtle)',
                    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.05)' : undefined,
                  }}
                >
                  <td style={{ width: '40px' }}>
                    <span onClick={() => handleToggleSelectUser(user.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      {isSelected ? <CheckSquare size={16} color="var(--color-brand)" /> : <Square size={16} color="var(--color-text-muted)" />}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Avatar name={displayName} size="sm" status={user.status === 'ACTIVE' ? 'online' : 'offline'} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                          {displayName}
                        </strong>
                        <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {user.phone || '—'}
                  </td>
                  <td>
                    <Badge
                      variant={
                        user.role === 'super_admin'
                          ? 'brand'
                          : user.role === 'admin'
                          ? 'info'
                          : user.role === 'agent'
                          ? 'warning'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {user.role.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </td>
                  <td>
                    <Badge variant={user.status === 'ACTIVE' ? 'success' : 'danger'} size="sm" dot>
                      {user.status}
                    </Badge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      {user.mfaEnabled ? (
                        <Badge variant="success" size="sm">MFA ON</Badge>
                      ) : (
                        <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>MFA Off</span>
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/admin/users/${user.id}`)}
                      leftIcon={<Eye size={13} />}
                      style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-2xs)' }}
                    >
                      Dossier
                    </Button>
                  </td>
                </tr>
              );
            })}
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={totalUsers}
        itemsPerPage={20}
      />

      {/* 11.3.3 Add User Modal */}
      {isAddUserModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="blue" style={{ maxWidth: '480px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: '0 0 var(--space-4)' }}>
              Create New Platform User
            </h2>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Input
                label="Full Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Kwesi Arthur"
                required
              />
              <Input
                label="Email Address"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="kwesi@example.com"
                required
              />
              <Input
                label="Phone Number"
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="024 123 4567"
                required
              />
              <Input
                label="Initial Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank for Password123!"
              />
              <div>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Role Authority</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  <option value="customer">Customer (Direct Retail)</option>
                  <option value="agent">Agent (Storefront Reseller)</option>
                  {isSuperAdmin && <option value="admin">Operations Admin</option>}
                  {isSuperAdmin && <option value="super_admin">Super Administrator</option>}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-3)' }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddUserModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isCreatingUser}>
                  Create Account
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* 11.3.34 Bulk Actions Modal */}
      {isBulkModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="amber" style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
              Bulk User Actions
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              Apply operational changes to <strong>{selectedIds.length}</strong> selected accounts.
            </p>

            <form onSubmit={handleExecuteBulk} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  type="button"
                  variant={bulkAction === 'SUSPEND' ? 'danger' : 'outline'}
                  size="sm"
                  fullWidth
                  onClick={() => setBulkAction('SUSPEND')}
                >
                  Suspend Users
                </Button>
                <Button
                  type="button"
                  variant={bulkAction === 'ACTIVATE' ? 'primary' : 'outline'}
                  size="sm"
                  fullWidth
                  onClick={() => setBulkAction('ACTIVATE')}
                >
                  Activate Users
                </Button>
              </div>

              <Input
                label="Mandatory Reason for Bulk Action"
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder="e.g. Mass KYC verification approval"
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsBulkModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant={bulkAction === 'SUSPEND' ? 'danger' : 'primary'} size="sm" isLoading={isExecutingBulk}>
                  Execute Batch
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* 11.3.33 Export Modal */}
      {isExportModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="blue" style={{ maxWidth: '400px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
              Export User Records
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              Download filtered user directory ({totalUsers.toLocaleString()} records).
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
              <Button
                type="button"
                variant={exportFormat === 'CSV' ? 'primary' : 'outline'}
                size="sm"
                fullWidth
                onClick={() => setExportFormat('CSV')}
              >
                CSV Format
              </Button>
              <Button
                type="button"
                variant={exportFormat === 'JSON' ? 'primary' : 'outline'}
                size="sm"
                fullWidth
                onClick={() => setExportFormat('JSON')}
              >
                JSON Format
              </Button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsExportModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={handleExport} isLoading={isExporting}>
                Download Export
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
