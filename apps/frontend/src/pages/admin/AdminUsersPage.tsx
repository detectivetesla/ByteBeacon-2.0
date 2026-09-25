import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Select, Input } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Avatar } from '../../components/ui/Avatar/Avatar.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useToast } from '../../context/ToastContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { adminApi, AdminUserListItem, AdminUserStats } from '../../api/admin.api.js';
import { downloadFileFromResponse } from '../../utils/exportUtils.js';
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
  X,
  UserX,
} from 'lucide-react';

export const AdminUsersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { toastSuccess, toastError } = useToast();

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
    if (selectedIds.length === users.length && users.length > 0) {
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

      const dateStr = new Date().toISOString().slice(0, 10);
      const ext = exportFormat === 'CSV' ? 'csv' : 'json';
      const fallbackFilename = `bytebeacon-users-${dateStr}.${ext}`;
      downloadFileFromResponse(res, fallbackFilename, ext);

      toastSuccess('Export Ready', `Downloaded user data in ${exportFormat} format.`);
      setIsExportModalOpen(false);
    } catch (err: any) {
      toastError('Export Failed', err.message || 'Could not export user list.');
    } finally {
      setIsExporting(false);
    }
  };

  // Active Filter Chips
  const activeFilters = useMemo(() => {
    const list: Array<{ id: string; label: string; onRemove: () => void }> = [];

    if (roleFilter !== 'ALL') {
      const roleLabels: Record<string, string> = {
        customer: 'Role: Customers',
        agent: 'Role: Agents',
        admin: 'Role: Admins',
        super_admin: 'Role: Super Admins',
      };
      list.push({
        id: 'role',
        label: roleLabels[roleFilter] || `Role: ${roleFilter}`,
        onRemove: () => { setRoleFilter('ALL'); setPage(1); },
      });
    }

    if (statusFilter !== 'ALL') {
      const statusLabels: Record<string, string> = {
        ACTIVE: 'Status: Active',
        SUSPENDED: 'Status: Suspended',
        PENDING_VERIFICATION: 'Status: Pending Verification',
      };
      list.push({
        id: 'status',
        label: statusLabels[statusFilter] || `Status: ${statusFilter}`,
        onRemove: () => { setStatusFilter('ALL'); setPage(1); },
      });
    }

    if (verificationFilter !== 'ALL') {
      list.push({
        id: 'verification',
        label: verificationFilter === 'VERIFIED' ? 'Verification: Verified' : 'Verification: Unverified',
        onRemove: () => { setVerificationFilter('ALL'); setPage(1); },
      });
    }

    if (mfaFilter !== 'ALL') {
      list.push({
        id: 'mfa',
        label: mfaFilter === 'MFA_ENABLED' ? 'Security: MFA Enabled' : 'Security: MFA Disabled',
        onRemove: () => { setMfaFilter('ALL'); setPage(1); },
      });
    }

    if (periodFilter !== 'all') {
      const periodLabels: Record<string, string> = {
        today: 'Period: Registered Today',
        '7d': 'Period: Last 7 Days',
        '30d': 'Period: Last 30 Days',
        '90d': 'Period: Last 90 Days',
      };
      list.push({
        id: 'period',
        label: periodLabels[periodFilter] || `Period: ${periodFilter}`,
        onRemove: () => { setPeriodFilter('all'); setPage(1); },
      });
    }

    if (searchQuery.trim()) {
      list.push({
        id: 'search',
        label: `Query: "${searchQuery}"`,
        onRemove: () => { setSearchQuery(''); setPage(1); },
      });
    }

    return list;
  }, [roleFilter, statusFilter, verificationFilter, mfaFilter, periodFilter, searchQuery]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setVerificationFilter('ALL');
    setMfaFilter('ALL');
    setPeriodFilter('all');
    setPage(1);
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header Toolbar with Standardized Tactile Action Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Users} color="orders" size="lg" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-brand-primary)' }}>
                Access Governance & User Directory
              </span>
              <Badge variant="brand" size="sm">Phase 11.5</Badge>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>•</span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Authoritative User Registry
              </span>
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              User Directory
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Manage and administer ByteBeacon accounts across Customers, Agents, and Administrators. Total: {totalUsers.toLocaleString()} accounts.
            </p>
          </div>
        </div>

        {/* Header Action Buttons: Standardized Tactile Elevated Buttons */}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.5rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-brand-primary)',
                boxShadow: 'var(--shadow-tactile-sm)',
                color: 'var(--color-brand-primary)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Users size={14} />
              <span>Bulk Actions ({selectedIds.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-tactile-sm)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Download size={14} />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={fetchUsers}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-tactile-sm)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddUserModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-tactile-sm)',
              color: 'var(--color-brand-primary, #0284C7)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Plus size={14} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* 2. Sleek, Standardized KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          title="Total Users"
          value={(stats?.total || 0).toLocaleString()}
          subvalue={`${stats?.active || 0} Active • ${stats?.suspended || 0} Suspended`}
          icon={<TactileIcon icon={Users} color="orders" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title="Customers"
          value={(stats?.customers || 0).toLocaleString()}
          subvalue="Retail telecom consumers"
          icon={<TactileIcon icon={UserCheck} color="security" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title="Agents"
          value={(stats?.agents || 0).toLocaleString()}
          subvalue="Storefront resellers"
          icon={<TactileIcon icon={Store} color="speed" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title="Administrators"
          value={((stats?.admins || 0) + (stats?.superAdmins || 0)).toLocaleString()}
          subvalue={`${stats?.superAdmins || 0} Super Admin • ${stats?.admins || 0} Admins`}
          icon={<TactileIcon icon={Shield} color="api" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
      </div>

      {/* 3. Compact, Standard Horizontal Advanced Filter Suite (No loud colors, no giant stacking) */}
      <Card
        elevated
        style={{
          padding: 'var(--space-4) var(--space-5)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-tactile-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        {/* Main Controls Row: Horizontal and Compact */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.65rem',
            justifyContent: 'space-between',
          }}
        >
          {/* Search Box */}
          <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
            <SearchInput
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, email, phone, User ID..."
            />
          </div>

          {/* Horizontal Dropdowns: Compact, Constrained Widths */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.45rem',
              alignItems: 'center',
            }}
          >
            {/* Roles */}
            <div style={{ width: '135px' }}>
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
            </div>

            {/* Statuses */}
            <div style={{ width: '135px' }}>
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
                  { label: 'Pending', value: 'PENDING_VERIFICATION' },
                ]}
              />
            </div>

            {/* Verification */}
            <div style={{ width: '145px' }}>
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
            </div>

            {/* Security */}
            <div style={{ width: '140px' }}>
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
            </div>

            {/* Time Period */}
            <div style={{ width: '130px' }}>
              <Select
                value={periodFilter}
                onChange={(e) => {
                  setPeriodFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Time', value: 'all' },
                  { label: 'Today', value: 'today' },
                  { label: 'Last 7 Days', value: '7d' },
                  { label: 'Last 30 Days', value: '30d' },
                  { label: 'Last 90 Days', value: '90d' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFilters.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.4rem',
              alignItems: 'center',
              paddingTop: '0.25rem',
              borderTop: '1px solid var(--color-border-subtle)',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', marginRight: '0.25rem' }}>
              Active Filters:
            </span>
            {activeFilters.map((af) => (
              <span
                key={af.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.2rem 0.55rem',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}
              >
                {af.label}
                <button
                  type="button"
                  onClick={af.onRemove}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--color-brand-primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.2rem 0.4rem',
              }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </Card>

      {/* 4. Desktop Table View with Standard Card Styling */}
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
        {/* Bulk Selection Notification Strip */}
        {selectedIds.length > 0 && (
          <div
            style={{
              padding: '0.65rem 1rem',
              backgroundColor: 'var(--color-bg-subtle)',
              borderBottom: '1px solid var(--color-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              <CheckSquare size={16} color="var(--color-brand-primary)" />
              <span><strong>{selectedIds.length}</strong> of {users.length} users selected on this page</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => { setBulkAction('ACTIVATE'); setIsBulkModalOpen(true); }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-success)',
                  cursor: 'pointer',
                }}
              >
                Activate Selected
              </button>
              <button
                type="button"
                onClick={() => { setBulkAction('SUSPEND'); setIsBulkModalOpen(true); }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-danger)',
                  cursor: 'pointer',
                }}
              >
                Suspend Selected
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <Table
          minWidth="1200px"
          headers={[
            <button
              type="button"
              key="select-all"
              onClick={handleToggleSelectAll}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                color: selectedIds.length > 0 && selectedIds.length === users.length ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
              }}
              title={selectedIds.length === users.length ? 'Deselect all' : 'Select all'}
            >
              {selectedIds.length > 0 && selectedIds.length === users.length ? (
                <CheckSquare size={16} />
              ) : (
                <Square size={16} />
              )}
            </button>,
            'User Profile',
            'Phone Number',
            'Role',
            'Status',
            'Security / MFA',
            'Joined Date',
            'Actions',
          ]}
        >
          {isLoading ? (
            <tr>
              <td colSpan={8} style={{ padding: 'var(--space-10) var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Loading user accounts...</p>
              </td>
            </tr>
          ) : users.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: 'var(--space-10) var(--space-4)', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-bg-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <UserX size={24} />
                  </div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                    No Users Found
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', maxWidth: '420px' }}>
                    No user accounts match the current filter criteria or search query.
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            users.map((user) => {
              const isSelected = selectedIds.includes(user.id);
              const displayName = user.fullName || user.email.split('@')[0];

              return (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: '1px solid var(--color-border-subtle)',
                    backgroundColor: isSelected ? 'rgba(2, 132, 199, 0.04)' : undefined,
                    transition: 'background-color var(--transition-fast)',
                  }}
                >
                  {/* Select Checkbox */}
                  <td style={{ padding: '0.85rem 1rem', width: '40px' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleSelectUser(user.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        color: isSelected ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
                      }}
                    >
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                  </td>

                  {/* User Profile */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Avatar name={displayName} size="sm" status={user.status === 'ACTIVE' ? 'online' : 'offline'} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/users/${user.id}`)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-brand-primary, #0284C7)',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '13px',
                            padding: 0,
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {displayName}
                        </button>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Phone Number */}
                  <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {user.phone || '—'}
                  </td>

                  {/* Role */}
                  <td style={{ padding: '0.85rem 1rem' }}>
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

                  {/* Status */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <Badge
                      variant={user.status === 'ACTIVE' ? 'success' : user.status === 'SUSPENDED' ? 'danger' : 'warning'}
                      size="sm"
                      dot
                    >
                      {user.status}
                    </Badge>
                  </td>

                  {/* Security / MFA */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {user.mfaEnabled ? (
                        <Badge variant="success" size="sm" dot>
                          MFA Active
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          MFA Off
                        </Badge>
                      )}
                      {user.isVerified && (
                        <Badge variant="info" size="sm">
                          Verified
                        </Badge>
                      )}
                    </div>
                  </td>

                  {/* Joined Date */}
                  <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/users/${user.id}`)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.35rem 0.65rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border-subtle)',
                        boxShadow: 'var(--shadow-tactile-sm)',
                        color: 'var(--color-text-primary)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      <Eye size={12} />
                      <span>Dossier</span>
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </Table>

        {/* Pagination in Card Footer */}
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={totalUsers}
            itemsPerPage={20}
          />
        </div>
      </Card>

      {/* 5. Standard Clean Add User Modal */}
      {isAddUserModalOpen && (
        <Modal
          isOpen={isAddUserModalOpen}
          onClose={() => setIsAddUserModalOpen(false)}
          title="Create New Platform User"
          subtitle="Register a new customer, agent reseller, or administrative account."
          maxWidth="500px"
        >
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
              <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, display: 'block', marginBottom: '0.25rem', color: 'var(--color-text-primary)' }}>
                Role Authority
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-subtle)',
                  outline: 'none',
                }}
              >
                <option value="customer">Customer (Direct Retail)</option>
                <option value="agent">Agent (Storefront Reseller)</option>
                {isSuperAdmin && <option value="admin">Operations Admin</option>}
                {isSuperAdmin && <option value="super_admin">Super Administrator</option>}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-3)' }}>
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddUserModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isCreatingUser}>
                Create Account
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 6. Standard Clean Bulk Actions Modal */}
      {isBulkModalOpen && (
        <Modal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          title="Bulk User Actions"
          subtitle={`Apply operational changes to ${selectedIds.length} selected accounts.`}
          maxWidth="460px"
        >
          <form onSubmit={handleExecuteBulk} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                type="button"
                variant={bulkAction === 'SUSPEND' ? 'danger' : 'secondary'}
                size="sm"
                fullWidth
                onClick={() => setBulkAction('SUSPEND')}
              >
                Suspend Users
              </Button>
              <Button
                type="button"
                variant={bulkAction === 'ACTIVATE' ? 'primary' : 'secondary'}
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
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsBulkModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant={bulkAction === 'SUSPEND' ? 'danger' : 'primary'} size="sm" isLoading={isExecutingBulk}>
                Execute Batch
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 7. Standard Clean Export Modal */}
      {isExportModalOpen && (
        <Modal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          title="Export User Records"
          subtitle={`Download filtered user directory (${totalUsers.toLocaleString()} records).`}
          maxWidth="420px"
        >
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
            <Button
              type="button"
              variant={exportFormat === 'CSV' ? 'primary' : 'secondary'}
              size="sm"
              fullWidth
              onClick={() => setExportFormat('CSV')}
            >
              CSV Format
            </Button>
            <Button
              type="button"
              variant={exportFormat === 'JSON' ? 'primary' : 'secondary'}
              size="sm"
              fullWidth
              onClick={() => setExportFormat('JSON')}
            >
              JSON Format
            </Button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsExportModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleExport} isLoading={isExporting}>
              Download Export
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminUsersPage;
