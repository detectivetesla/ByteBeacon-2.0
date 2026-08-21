import React, { useState } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Select, SearchInput, Textarea } from '../../components/ui/index.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useToast } from '../../context/ToastContext.js';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Store,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface AdminStoreRecord {
  id: string;
  storeName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  paymentStatus: 'PAID' | 'PAYMENT_PENDING' | 'PAYMENT_REQUIRED';
  approvalStatus: 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED';
  storeStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  paymentReference: string;
  createdAt: string;
  adminNotes?: string;
}

const INITIAL_ADMIN_STORES: AdminStoreRecord[] = [
  {
    id: 'str-1',
    storeName: 'DataHub Express',
    slug: 'datahub-express',
    ownerName: 'Martin Nomotsu',
    ownerEmail: 'nomotsumartin@gmail.com',
    ownerPhone: '024 412 3456',
    paymentStatus: 'PAID',
    approvalStatus: 'AWAITING_APPROVAL',
    storeStatus: 'INACTIVE',
    paymentReference: 'STRPAY-2026-0817-9841',
    createdAt: 'Today, 09:30',
  },
  {
    id: 'str-2',
    storeName: 'Accra Fast Bundles',
    slug: 'accra-fast-bundles',
    ownerName: 'Emmanuel Mensah',
    ownerEmail: 'emmanuel.m@example.com',
    ownerPhone: '020 998 8776',
    paymentStatus: 'PAID',
    approvalStatus: 'APPROVED',
    storeStatus: 'ACTIVE',
    paymentReference: 'STRPAY-2026-0815-1102',
    createdAt: '2 days ago',
    adminNotes: 'Verified agent credentials and KYC documents.',
  },
  {
    id: 'str-3',
    storeName: 'Kumasi Telecom Center',
    slug: 'kumasi-telecom',
    ownerName: 'Abena Agyemang',
    ownerEmail: 'abena.a@example.com',
    ownerPhone: '027 554 4332',
    paymentStatus: 'PAID',
    approvalStatus: 'APPROVED',
    storeStatus: 'SUSPENDED',
    paymentReference: 'STRPAY-2026-0810-7764',
    createdAt: '1 week ago',
    adminNotes: 'Suspended pending customer complaints review.',
  },
];

export const AdminStoresPage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();
  const [stores, setStores] = useState<AdminStoreRecord[]>(INITIAL_ADMIN_STORES);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedStore, setSelectedStore] = useState<AdminStoreRecord | null>(null);
  const [noteInput, setNoteInput] = useState('');

  const filteredStores = stores.filter((s) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'AWAITING_APPROVAL' && s.approvalStatus !== 'AWAITING_APPROVAL') return false;
      if (statusFilter === 'ACTIVE' && s.storeStatus !== 'ACTIVE') return false;
      if (statusFilter === 'SUSPENDED' && s.storeStatus !== 'SUSPENDED') return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.storeName.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        s.ownerName.toLowerCase().includes(q) ||
        s.ownerEmail.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleApprove = (storeId: string) => {
    setStores((prev) =>
      prev.map((s) =>
        s.id === storeId
          ? { ...s, approvalStatus: 'APPROVED', storeStatus: 'ACTIVE', adminNotes: noteInput || 'Approved by admin.' }
          : s,
      ),
    );
    setSelectedStore(null);
    setNoteInput('');
    toastSuccess('Store Approved', 'The store application has been approved and activated.');
  };

  const handleReject = (storeId: string) => {
    if (!noteInput) {
      toastError('Reason Required', 'Please provide a reason for rejecting the application.');
      return;
    }
    setStores((prev) =>
      prev.map((s) =>
        s.id === storeId
          ? { ...s, approvalStatus: 'REJECTED', storeStatus: 'INACTIVE', adminNotes: noteInput }
          : s,
      ),
    );
    setSelectedStore(null);
    setNoteInput('');
    toastSuccess('Store Rejected', 'The store application has been rejected.');
  };

  const handleSuspend = (storeId: string) => {
    setStores((prev) =>
      prev.map((s) =>
        s.id === storeId
          ? { ...s, storeStatus: 'SUSPENDED', adminNotes: noteInput || 'Suspended by admin.' }
          : s,
      ),
    );
    setSelectedStore(null);
    setNoteInput('');
    toastSuccess('Store Suspended', 'The store has been suspended.');
  };

  const handleReactivate = (storeId: string) => {
    setStores((prev) =>
      prev.map((s) =>
        s.id === storeId
          ? { ...s, storeStatus: 'ACTIVE', adminNotes: 'Reactivated by admin.' }
          : s,
      ),
    );
    setSelectedStore(null);
    toastSuccess('Store Reactivated', 'The store has been reactivated.');
  };

  const pendingReviewCount = stores.filter((s) => s.approvalStatus === 'AWAITING_APPROVAL').length;
  const activeStoresCount = stores.filter((s) => s.storeStatus === 'ACTIVE').length;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <TactileIcon icon={Store} color="speed" size="lg" />
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#F97316' }}>
            Operations & Moderation
          </span>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
            Agent Store Approvals
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Review paid store applications, audit Paystack transactions, and approve or moderate storefronts.
          </p>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard
          title="Total Store Applications"
          value={stores.length.toString()}
          subvalue="Registered tenant storefronts"
          accent="blue"
          icon={<TactileIcon icon={Store} color="orders" size="sm" />}
        />
        <MetricCard
          title="Awaiting Review"
          value={pendingReviewCount.toString()}
          subvalue={pendingReviewCount === 0 ? 'Queue clear' : 'Pending verification'}
          accent="amber"
          icon={<TactileIcon icon={Clock} color="speed" size="sm" />}
        />
        <MetricCard
          title="Live Active Storefronts"
          value={activeStoresCount.toString()}
          subvalue="Online retail endpoints"
          accent="green"
          icon={<TactileIcon icon={ShieldCheck} color="security" size="sm" />}
        />
      </div>

      {/* Filter Bar */}
      <Card elevated accentColor="orange" style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { label: 'All Store Applications', value: 'ALL' },
              { label: 'Awaiting Review', value: 'AWAITING_APPROVAL' },
              { label: 'Active Stores', value: 'ACTIVE' },
              { label: 'Suspended Stores', value: 'SUSPENDED' },
            ]}
          />

          <div style={{ flex: '1 1 200px' }}>
            <SearchInput
              placeholder="Search store name, slug, owner email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Stores List Table */}
      <Card elevated style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Store Name / Slug</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Agent Owner</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Payment</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Approval</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Store Status</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStores.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <strong style={{ display: 'block', color: 'var(--color-text-primary)' }}>{s.storeName}</strong>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      /store/{s.slug}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{s.ownerName}</div>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>{s.ownerEmail}</span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <Badge variant={s.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm">
                      {s.paymentStatus}
                    </Badge>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <Badge
                      variant={s.approvalStatus === 'APPROVED' ? 'success' : s.approvalStatus === 'AWAITING_APPROVAL' ? 'warning' : 'danger'}
                      size="sm"
                      dot
                    >
                      {s.approvalStatus}
                    </Badge>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <Badge
                      variant={s.storeStatus === 'ACTIVE' ? 'success' : s.storeStatus === 'SUSPENDED' ? 'danger' : 'neutral'}
                      size="sm"
                    >
                      {s.storeStatus}
                    </Badge>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <Button variant="outline" size="sm" onClick={() => { setSelectedStore(s); setNoteInput(s.adminNotes || ''); }}>
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Review & Approval Modal */}
      {selectedStore && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedStore(null)} />

          <div
            style={{
              position: 'relative',
              maxWidth: '540px',
              width: '100%',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-2xl)',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-tactile-lg)',
              zIndex: 110,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: '#F97316', textTransform: 'uppercase' }}>Store Review</span>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 900, color: 'var(--color-text-primary)' }}>
                  {selectedStore.storeName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStore(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            {/* Details Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', display: 'block' }}>Owner</span>
                <strong style={{ fontSize: 'var(--font-size-xs)' }}>{selectedStore.ownerName}</strong>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', display: 'block' }}>Email</span>
                <strong style={{ fontSize: 'var(--font-size-xs)' }}>{selectedStore.ownerEmail}</strong>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', display: 'block' }}>Paystack Reference</span>
                <strong style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}>{selectedStore.paymentReference}</strong>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', display: 'block' }}>Payment Status</span>
                <strong style={{ fontSize: 'var(--font-size-xs)', color: '#10B981' }}>{selectedStore.paymentStatus} (GH₵ 500.00)</strong>
              </div>
            </div>

            {/* Internal Note Input */}
            <Textarea
              label="Internal Admin / Audit Note"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Add audit notes, verification remarks, or rejection reasons..."
              rows={3}
            />

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {selectedStore.approvalStatus === 'AWAITING_APPROVAL' && (
                <>
                  <Button variant="danger" size="sm" onClick={() => handleReject(selectedStore.id)}>
                    Reject Application
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => handleApprove(selectedStore.id)} leftIcon={<CheckCircle2 size={13} />}>
                    Approve & Activate
                  </Button>
                </>
              )}

              {selectedStore.storeStatus === 'ACTIVE' && (
                <Button variant="danger" size="sm" onClick={() => handleSuspend(selectedStore.id)} leftIcon={<AlertTriangle size={13} />}>
                  Suspend Store
                </Button>
              )}

              {selectedStore.storeStatus === 'SUSPENDED' && (
                <Button variant="primary" size="sm" onClick={() => handleReactivate(selectedStore.id)} leftIcon={<RotateCcw size={13} />}>
                  Reactivate Store
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
