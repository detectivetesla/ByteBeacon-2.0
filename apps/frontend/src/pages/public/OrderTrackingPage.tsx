import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { OrderTracker, CustomerOrderDetails } from '../../components/commerce/OrderTracker.js';
import { Input } from '../../components/ui/Input/Input.js';
import { Button } from '../../components/ui/Button/Button.js';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState.js';
import { Search } from 'lucide-react';
import { ordersApi } from '../../api/orders.api.js';

export const OrderTrackingPage: React.FC = () => {
  const { orderId: paramOrderId } = useParams<{ orderId?: string }>();
  const [searchParams] = useSearchParams();
  const queryOrderId = searchParams.get('ref') || searchParams.get('orderId') || paramOrderId || '';

  const [searchInput, setSearchInput] = useState(queryOrderId);
  const [activeOrder, setActiveOrder] = useState<CustomerOrderDetails | null>(null);
  const [searched, setSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const performSearch = useCallback(async (key: string) => {
    const trimmed = key.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setSearched(true);

    try {
      const order = await ordersApi.trackOrder(trimmed);
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
        setActiveOrder(null);
      }
    } catch {
      setActiveOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (queryOrderId) {
      setSearchInput(queryOrderId);
      performSearch(queryOrderId);
    }
  }, [queryOrderId, performSearch]);

  const handleSearch = () => {
    performSearch(searchInput);
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
          Check the live fulfillment status of any mobile data purchase instantly.
        </p>
      </div>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: 'var(--space-8)', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <Input
            placeholder="Enter Order Reference (e.g. ORD-20260819-XXXX or UUID)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            leftIcon={<Search size={18} strokeWidth={2.5} />}
          />
        </div>
        <Button variant="primary" size="md" onClick={handleSearch} isLoading={isLoading}>
          Track
        </Button>
      </div>

      {/* Tracker Result or Empty State */}
      {activeOrder ? (
        <OrderTracker order={activeOrder} />
      ) : searched && !isLoading ? (
        <EmptyState
          title="Order Not Found"
          description={`No order record was found matching "${searchInput}". Please verify your order reference number.`}
        />
      ) : null}
    </div>
  );
};
