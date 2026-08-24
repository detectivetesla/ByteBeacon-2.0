import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { Bell, CheckCheck, Package, CreditCard, Shield } from 'lucide-react';
import { notificationsApi, NotificationItemDto } from '../../api/wallet.api.js';

interface NotificationItem {
  id: string;
  category: 'orders' | 'payments' | 'security';
  title: string;
  detail: string;
  time: string;
  unread: boolean;
}

export const NotificationsPage: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'orders' | 'payments' | 'security'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationsApi.listNotifications({ limit: 50 });

      if (res?.items && Array.isArray(res.items)) {
        const mapped: NotificationItem[] = res.items.map((n: NotificationItemDto) => {
          let category: 'orders' | 'payments' | 'security' = 'orders';
          if (n.type.toLowerCase().includes('wallet') || n.type.toLowerCase().includes('payment') || n.type.toLowerCase().includes('deposit')) {
            category = 'payments';
          } else if (n.type.toLowerCase().includes('security') || n.type.toLowerCase().includes('key') || n.type.toLowerCase().includes('auth')) {
            category = 'security';
          }

          const d = new Date(n.createdAt);
          const time = d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

          return {
            id: n.id,
            category,
            title: n.title,
            detail: n.body,
            time,
            unread: !n.isRead,
          };
        });
        setNotifications(mapped);
      } else {
        setNotifications([]);
      }
    } catch {
      setNotifications([]);
    }
  }, []);


  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const filtered = notifications.filter((n) => filter === 'all' || n.category === filter);
  const unreadTotal = notifications.filter((n) => n.unread).length;

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
    } catch {}
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const markSingleRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
    } catch {}
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  };


  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'orders':
        return <TactileIcon icon={Package} color="orders" size="sm" />;
      case 'payments':
        return <TactileIcon icon={CreditCard} color="wallet" size="sm" />;
      case 'security':
        return <TactileIcon icon={Shield} color="security" size="sm" />;
      default:
        return <TactileIcon icon={Bell} color="orders" size="sm" />;
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
            System Center
          </span>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0' }}>
            Notifications & Alerts
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Stay updated with order deliveries, payment receipts, and security events.
          </p>
        </div>

        {unreadTotal > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} leftIcon={<CheckCheck size={14} />}>
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: `All (${notifications.length})` },
          { key: 'orders', label: 'Orders & Deliveries' },
          { key: 'payments', label: 'Payments & Wallet' },
          { key: 'security', label: 'Security & Keys' },
        ].map((tab) => {
          const isSelected = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key as any)}
              style={{
                padding: '0.4rem 0.875rem',
                fontSize: 'var(--font-size-xs)',
                fontWeight: isSelected ? 700 : 500,
                borderRadius: 'var(--radius-full)',
                border: isSelected ? '1px solid var(--color-brand)' : '1px solid var(--color-border-default)',
                backgroundColor: isSelected ? 'var(--color-brand-surface)' : 'var(--color-bg-surface)',
                color: isSelected ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      <Card elevated style={{ padding: 'var(--space-4)' }}>
        {filtered.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => markSingleRead(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: item.unread ? 'var(--color-bg-surface-elevated)' : 'transparent',
                  border: item.unread ? '1px solid var(--color-border-hover)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {getCategoryIcon(item.category)}

                <div style={{ flexGrow: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: item.unread ? 800 : 600, color: 'var(--color-text-primary)' }}>
                        {item.title}
                      </span>
                      {item.unread && (
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-brand)' }} />
                      )}
                    </div>

                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                      {item.time}
                    </span>
                  </div>

                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0', lineHeight: 1.4 }}>
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
            <TactileIcon icon={Bell} color="orders" size="lg" style={{ marginBottom: 'var(--space-3)' }} />
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              You're all caught up
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
              No notifications matching your filter at this time.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};
