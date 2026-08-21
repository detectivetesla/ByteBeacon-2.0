import React, { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Select } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { Download, RefreshCw, Package, Filter, CheckCircle2, Activity, AlertOctagon, Clock } from 'lucide-react';
import { adminApi, AdminOrderListItem } from '../../api/admin.api.js';

export const AdminOrdersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [networkFilter, setNetworkFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getOrders({
        page,
        limit: 25,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
        search: searchQuery.trim() || undefined,
      });

      if (res && Array.isArray(res.orders)) {
        setOrders(res.orders);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalOrders(res.pagination?.total || res.orders.length);
      } else {
        setOrders([]);
        setTotalPages(1);
        setTotalOrders(0);
      }
    } catch {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, networkFilter, searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const completedCount = orders.filter((o) => o.orderStatus === 'COMPLETED').length;
  const processingCount = orders.filter((o) => o.orderStatus === 'PROCESSING' || o.orderStatus === 'PENDING').length;
  const failedCount = orders.filter((o) => o.orderStatus === 'FAILED').length;

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Package} color="analytics" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-analytics-bright)' }}>
              Carrier Gateway Operations
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Platform Orders & Fulfillment
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Authoritative telecom delivery stream across MTN, Telecel, and AT Ghana. Total: {totalOrders.toLocaleString()} orders.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="ghost" size="sm" onClick={fetchOrders} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard
          title="Total Orders"
          value={totalOrders.toLocaleString()}
          subvalue="Recorded in stream"
          accent="blue"
          icon={<TactileIcon icon={Package} color="orders" size="sm" />}
        />
        <MetricCard
          title="Completed Deliveries"
          value={completedCount.toString()}
          subvalue="Successfully fulfilled"
          accent="green"
          icon={<TactileIcon icon={CheckCircle2} color="security" size="sm" />}
        />
        <MetricCard
          title="In-Flight Processing"
          value={processingCount.toString()}
          subvalue="Awaiting carrier ack"
          accent="cyan"
          icon={<TactileIcon icon={Activity} color="analytics" size="sm" />}
        />
        <MetricCard
          title="Failed Dispatches"
          value={failedCount.toString()}
          subvalue="Dead-letter candidates"
          accent="red"
          icon={<TactileIcon icon={AlertOctagon} color="red" size="sm" />}
        />
      </div>

      {/* Filter Bar */}
      <Card accentColor="cyan" style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
          <div style={{ width: '320px', maxWidth: '100%' }}>
            <SearchInput
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search order ID, phone, email..."
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Select
              value={networkFilter}
              onChange={(e) => {
                setNetworkFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Networks', value: 'ALL' },
                { label: 'MTN Ghana', value: 'MTN' },
                { label: 'Telecel Ghana', value: 'TELECEL' },
                { label: 'AT (AirtelTigo)', value: 'AIRTELTIGO' },
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
                { label: 'Completed', value: 'COMPLETED' },
                { label: 'Processing', value: 'PROCESSING' },
                { label: 'Pending', value: 'PENDING' },
                { label: 'Failed', value: 'FAILED' },
                { label: 'Refunded', value: 'REFUNDED' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card elevated style={{ padding: '0', overflow: 'hidden' }}>
        <Table
          headers={[
            'Order ID',
            'Customer Account',
            'Recipient Phone',
            'Network',
            'Bundle Size',
            'Amount',
            'Payment',
            'Order Status',
            'Created At',
          ]}
        >
          {orders.map((order) => {
            const amountGhs = ((order.amountPesewas || 0) / 100).toFixed(2);
            const bundleGb = ((order.dataAmountMb || 0) / 1024).toFixed(1);

            return (
              <tr key={order.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                  {order.id.slice(0, 10)}...
                </td>
                <td style={{ fontSize: 'var(--font-size-xs)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{order.userName || 'Customer'}</span>
                    <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {order.userEmail || '—'}
                    </span>
                  </div>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                  {order.recipientPhone}
                </td>
                <td>
                  <Badge
                    variant={
                      order.network === 'MTN'
                        ? 'warning'
                        : order.network === 'TELECEL'
                        ? 'danger'
                        : 'info'
                    }
                    size="sm"
                  >
                    {order.network}
                  </Badge>
                </td>
                <td style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                  {bundleGb} GB
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                  GH₵ {amountGhs}
                </td>
                <td>
                  <Badge
                    variant={
                      order.paymentStatus === 'PAID'
                        ? 'success'
                        : order.paymentStatus === 'FAILED'
                        ? 'danger'
                        : 'warning'
                    }
                    size="sm"
                  >
                    {order.paymentStatus}
                  </Badge>
                </td>
                <td>
                  <Badge
                    variant={
                      order.orderStatus === 'COMPLETED'
                        ? 'success'
                        : order.orderStatus === 'FAILED'
                        ? 'danger'
                        : order.orderStatus === 'REFUNDED'
                        ? 'brand'
                        : 'warning'
                    }
                    size="sm"
                  >
                    {order.orderStatus}
                  </Badge>
                </td>
                <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {order.createdAt ? new Date(order.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={totalOrders}
        itemsPerPage={25}
      />
    </div>
  );
};
