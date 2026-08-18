import React, { useState } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Select } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Plus } from 'lucide-react';

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'customer' | 'agent' | 'admin' | 'super_admin';
  status: 'ACTIVE' | 'SUSPENDED';
  joinedDate: string;
}

const SAMPLE_USERS: UserRow[] = [
  { id: 'usr_1', name: 'Dev Customer', email: 'dev.customer@bytebeacon.local', phone: '024 000 0001', role: 'customer', status: 'ACTIVE', joinedDate: 'Aug 14, 2026' },
  { id: 'usr_2', name: 'Dev Agent', email: 'dev.agent@bytebeacon.local', phone: '024 000 0002', role: 'agent', status: 'ACTIVE', joinedDate: 'Aug 14, 2026' },
  { id: 'usr_3', name: 'Dev Admin', email: 'dev.admin@bytebeacon.local', phone: '024 000 0003', role: 'admin', status: 'ACTIVE', joinedDate: 'Aug 14, 2026' },
  { id: 'usr_4', name: 'Dev Super Admin', email: 'dev.superadmin@bytebeacon.local', phone: '024 000 0004', role: 'super_admin', status: 'ACTIVE', joinedDate: 'Aug 14, 2026' },
  { id: 'usr_5', name: 'Kwame Mensah', email: 'kwame@example.com', phone: '024 555 1234', role: 'customer', status: 'ACTIVE', joinedDate: 'Aug 12, 2026' },
  { id: 'usr_6', name: 'DataHub Agency', email: 'agent@datahub.gh', phone: '020 888 9900', role: 'agent', status: 'ACTIVE', joinedDate: 'Aug 10, 2026' },
];

export const AdminUsersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const filtered = SAMPLE_USERS.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone.includes(searchQuery);
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
            Identity & Access Management
          </span>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.125rem' }}>
            User Accounts
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            Manage customer profiles, agent reseller accounts, and administrative team permissions.
          </p>
        </div>

        <Button variant="primary" size="md" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Plus size={16} />
          Add User Account
        </Button>
      </div>

      {/* Filters */}
      <Card style={{ padding: 'var(--space-4)' }}>
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
              <Badge variant={user.role.includes('admin') ? 'danger' : user.role === 'agent' ? 'info' : 'neutral'}>
                {user.role.toUpperCase()}
              </Badge>
            </td>
            <td>
              <Badge variant={user.status === 'ACTIVE' ? 'success' : 'danger'}>
                {user.status}
              </Badge>
            </td>
            <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
              {user.joinedDate}
            </td>
            <td>
              <Button variant="ghost" size="sm" style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-2xs)' }}>
                Edit
              </Button>
            </td>
          </tr>
        ))}
      </Table>

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
