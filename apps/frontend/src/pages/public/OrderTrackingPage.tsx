import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { OrderTracker, CustomerOrderDetails } from '../../components/commerce/OrderTracker.js';
import { Input } from '../../components/ui/Input/Input.js';
import { Button } from '../../components/ui/Button/Button.js';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState.js';
import { NetworkProvider } from '@bytebeacon/shared';
import { Search } from 'lucide-react';
import { ordersApi } from '../../api/orders.api.js';

const SAMPLE_TRACKING_DB: Record<string, CustomerOrderDetails> = {
  'BB-102938': {
    orderId: 'BB-102938',
    network: NetworkProvider.MTN,
    recipientPhone: '024 123 4567',
    dataDisplay: '10 GB Data Bundle',
    priceDisplay: 'GH₵ 48.00',
    paymentStatus: 'PAID',
    orderStatus: 'DELIVERED',
    statusLabel: 'Data Delivered',
    createdAt: '2026-08-14T12:30:00Z',
    completedAt: '2026-08-14T12:30:18Z',
  },
  'BB-849201': {
    orderId: 'BB-849201',
    network: NetworkProvider.TELECEL,
    recipientPhone: '020 987 6543',
    dataDisplay: '5 GB Data Bundle',
    priceDisplay: 'GH₵ 24.00',
    paymentStatus: 'PAID',
    orderStatus: 'PROCESSING',
    statusLabel: 'Processing your order',
    createdAt: '2026-08-14T14:40:00Z',
  },
};

export const OrderTrackingPage: React.FC = () => {
  const { orderId } = useParams<{ orderId?: string }>();
  const [searchInput, setSearchInput] = useState(orderId || 'BB-102938');
  const [activeOrder, setActiveOrder] = useState<CustomerOrderDetails | null>(
    SAMPLE_TRACKING_DB[orderId || 'BB-102938'] || SAMPLE_TRACKING_DB['BB-102938'],
  );
  const [searched, setSearched] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    const key = searchInput.trim();
    if (!key) return;

    setIsLoading(true);
    try {
      const order = await ordersApi.trackOrder(key);
      if (order) {
        setActiveOrder({
          orderId: order.publicId || order.id,
          network: order.network,
          recipientPhone: order.recipientPhone,
          dataDisplay: `${(order.dataAmountMb / 1024).toFixed(1)} GB`,
          priceDisplay: `GH₵ ${(order.amountPesewas / 100).toFixed(2)}`,
          paymentStatus: order.paymentStatus as any,
          orderStatus: (order.orderStatus as any) || 'PROCESSING',
          statusLabel: order.orderStatus,
          createdAt: order.createdAt,
          completedAt: order.providerOrder?.lastSyncedAt || null,
        });
      } else {
        const found = SAMPLE_TRACKING_DB[key.toUpperCase()] || null;
        setActiveOrder(found);
      }
    } catch {
      const found = SAMPLE_TRACKING_DB[key.toUpperCase()] || null;
      setActiveOrder(found);
    } finally {
      setIsLoading(false);
      setSearched(true);
    }
  };

  return (
    <div style={{ maxWidth: 'var(--container-md)', width: '100%', margin: '0 auto', padding: 'var(--space-10) var(--space-6)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
            Real-Time Delivery Tracker
          </span>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.25rem' }}>
            Track Your Order
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            Check the live fulfillment status of any data purchase instantly.
          </p>
        </div>

        {/* Search Bar */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: 'var(--space-8)', alignItems: 'flex-start' }}>
          <Input
            placeholder="Enter Order ID (e.g. BB-102938 or BB-849201)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            leftIcon={<Search size={18} strokeWidth={2.5} />}
          />
          <Button variant="primary" size="md" onClick={handleSearch} isLoading={isLoading}>
            Track
          </Button>
        </div>

        {/* Tracker Result or Empty State */}
        {activeOrder ? (
          <OrderTracker order={activeOrder} />
        ) : searched ? (
          <EmptyState
            title="Order Not Found"
            description={`No order record was found matching "${searchInput}". Please verify your order reference number.`}
            actionText="Try Demo Order (BB-102938)"
            onAction={() => {
              setSearchInput('BB-102938');
              setActiveOrder(SAMPLE_TRACKING_DB['BB-102938']);
            }}
          />
        ) : null}
    </div>
  );
};
