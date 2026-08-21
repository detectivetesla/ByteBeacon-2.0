import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Select } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { Plus, RefreshCw, Users, Eye, Shield, UserCheck, Store, UserCog } from 'lucide-react';
import { adminApi, AdminUserListItem } from '../../api/admin.api.js';

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: 'ACTIVE' | 'SUSPENDED';
  joinedDate: string;
}

export const AdminUsersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getUsers({ page, limit: 50, search: searchQuery || undefined });
      if (res && Array.isArray(res.users)) {
        const mapped: UserRow[] = res.users.map((u: AdminUserListItem) => ({
          id: u.id,
          name: u.fullName || u.email.split('@')[0],
          email: u.email,
          phone: u.phoneNumber || '—',
          role: u.role,
          status: u.isActive ? 'ACTIVE' : 'SUSPENDED',
          joinedDate: u.createdAt
            ? new Date(u.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
            : '—',
        }));
        setUsers(mapped);
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone.includes(searchQuery);
    const matchesRole = roleFilter === 'ALL' || u.role.toLowerCase() === roleFilter.toLowerCase();
    return matchesSearch && matchesRole;
  });

  const customerCount = users.filter((u) => u.role === 'customer').length;
  const agentCount = users.filter((u) => u.role === 'agent').length;
  const adminCount = users.filter((u) => u.role.includes('admin')).length;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Users} color="orders" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-info-bright)' }}>
              Identity & Access Management
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              User Accounts Directory
            </h1>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
              Manage customer profiles, agent reseller accounts, and administrative team permissions.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button variant="ghost" size="sm" onClick={fetchUsers} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="primary" size="md" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Plus size={16} />
            Add User Account
          </Button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard
          title="Total User Accounts"
          value={users.length.toString()}
          subvalue="Registered on platform"
          accent="blue"
          icon={<TactileIcon icon={Users} color="orders" size="sm" />}
        />
        <MetricCard
          title="Active Customers"
          value={customerCount.toString()}
          subvalue="Direct retail consumers"
          accent="green"
          icon={<TactileIcon icon={UserCheck} color="security" size="sm" />}
        />
        <MetricCard
          title="Agent Resellers"
          value={agentCount.toString()}
          subvalue="Storefront operators"
          accent="orange"
          icon={<TactileIcon icon={Store} color="speed" size="sm" />}
        />
        <MetricCard
          title="Platform Administrators"
          value={adminCount.toString()}
          subvalue="Privileged staff roles"
          accent="purple"
          icon={<TactileIcon icon={Shield} color="api" size="sm" />}
        />
      </div>

      {/* Filters */}
      <Card accentColor="blue" style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
          <div style={{ width: '320px', maxWidth: '100%' }}>
            <SearchInput
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or phone..."
            />
          </div>

          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={[
              { label: 'All Roles', value: 'ALL' },
              { label: 'Customers', value: 'customer' },
              { label: 'Agents', value: 'agent' },
              { label: 'Admins', value: 'admin' },
              { label: 'Super Admins', value: 'super_admin' },
            ]}
          />
        </div>
      </Card>

      {/* Table */}
      <Card elevated style={{ padding: '0', overflow: 'hidden' }}>
        <Table headers={['User Name', 'Email Address', 'Phone Number', 'Role', 'Status', 'Joined Date', 'Actions']}>
          {filtered.map((user) => (
            <tr key={user.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <td style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                {user.name}
              </td>
              <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {user.email}
              </td>
              <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                {user.phone}
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
                <Badge variant={user.status === 'ACTIVE' ? 'success' : 'danger'} size="sm">
                  {user.status}
                </Badge>
              </td>
              <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                {user.joinedDate}
              </td>
              <td>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/admin/users/${user.id}`)}
                  leftIcon={<Eye size={12} />}
                  style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-2xs)' }}
                >
                  Dossier
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Pagination
        currentPage={page}
        totalPages={1}
        onPageChange={setPage}
        totalItems={filtered.length}
        itemsPerPage={10}
      />
    </div>
  );
};
