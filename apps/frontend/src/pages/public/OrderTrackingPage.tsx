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
        const raw = order as any;
        const network = raw.product?.network || raw.network || 'MTN';
        const dataDisplay = raw.product?.volumeDisplay || raw.dataDisplay || (raw.dataAmountMb ? `${(raw.dataAmountMb / 1024).toFixed(raw.dataAmountMb % 1024 === 0 ? 0 : 1)} GB` : 'Data Bundle');
        const priceDisplay = raw.amountDisplay || (raw.amountPesewas ? `GH₵ ${(raw.amountPesewas / 100).toFixed(2)}` : 'GH₵ 0.00');
        const orderStatus = raw.status || raw.orderStatus || 'PROCESSING';
        const statusLabel = raw.statusLabel || raw.orderStatus || 'Processing';
        const orderId = raw.orderId || raw.publicId || raw.id || trimmed;
        const completedAt = raw.completedAt || raw.providerOrder?.lastSyncedAt || null;

        setActiveOrder({
          orderId,
          network,
          recipientPhone: raw.recipientPhone || 'N/A',
          dataDisplay,
          priceDisplay,
          paymentStatus: (raw.paymentStatus as any) || 'PAID',
          orderStatus: orderStatus as any,
          statusLabel,
          createdAt: raw.createdAt || new Date().toISOString(),
          completedAt,
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
            placeholder="Enter Order Reference (e.g. ORD-XXXX) or Recipient Phone Number"
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <OrderTracker order={activeOrder} />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => performSearch(activeOrder.orderId)}
              isLoading={isLoading}
            >
              ↻ Refresh Live Status
            </Button>
          </div>
        </div>
      ) : searched && !isLoading ? (
        <EmptyState
          title="Order Not Found"
          description={`No order record was found matching "${searchInput}". Please verify your order reference number or recipient phone number.`}
        />
      ) : null}
    </div>
  );
};
