import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useToast } from '../../context/ToastContext.js';
import {
  Bell,
  CheckCheck,
  Trash2,
  Package,
  CreditCard,
  Shield,
  X,
  Check,
} from 'lucide-react';
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
  const { success: toastSuccess, error: toastError } = useToast();
  const [statusTab, setStatusTab] = useState<'all' | 'unread'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'orders' | 'payments' | 'security'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await notificationsApi.listNotifications({ limit: 100 });

      if (res?.items && Array.isArray(res.items)) {
        const mapped: NotificationItem[] = res.items.map((n: NotificationItemDto) => {
          let category: 'orders' | 'payments' | 'security' = 'orders';
          if (
            n.type.toLowerCase().includes('wallet') ||
            n.type.toLowerCase().includes('payment') ||
            n.type.toLowerCase().includes('deposit') ||
            n.type.toLowerCase().includes('withdrawal') ||
            n.type.toLowerCase().includes('payout') ||
            n.type.toLowerCase().includes('disbursement')
          ) {
            category = 'payments';
          } else if (
            n.type.toLowerCase().includes('security') ||
            n.type.toLowerCase().includes('key') ||
            n.type.toLowerCase().includes('auth')
          ) {
            category = 'security';
          }

          const d = new Date(n.createdAt);
          const time = d.toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

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
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadTotal = notifications.filter((n) => n.unread).length;

  const filtered = notifications.filter((n) => {
    if (statusTab === 'unread' && !n.unread) return false;
    if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
    return true;
  });

  // Mark all unread notifications as read
  const handleMarkAllRead = async () => {
    if (unreadTotal === 0) return;
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
      toastSuccess('All Read', 'Marked all notifications as read.');
    } catch (err: any) {
      toastError('Action Failed', err.message || 'Could not mark notifications as read.');
    }
  };

  // Clear all notifications
  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    setIsClearing(true);
    try {
      await notificationsApi.clearNotifications();
      setNotifications([]);
      toastSuccess('Notifications Cleared', 'All notifications have been cleared.');
    } catch (err: any) {
      toastError('Clear Failed', err.message || 'Could not clear notifications.');
    } finally {
      setIsClearing(false);
    }
  };

  // Mark single notification as read
  const markSingleRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await notificationsApi.markAsRead(id);
    } catch {}
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  };

  // Dismiss / delete single notification
  const handleDeleteSingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsApi.deleteNotification(id);
    } catch {}
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toastSuccess('Dismissed', 'Notification removed.');
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
    <div
      style={{
        maxWidth: '1000px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(1rem, 2vw, var(--space-6))',
        minWidth: 0,
        overflowX: 'hidden',
      }}
    >
      {/* Page Header */}
      <div className="bb-page-header">
        <div className="bb-page-header-info">
          <span
            style={{
              fontSize: 'var(--font-size-3xs)',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-primary)',
            }}
          >
            System Center
          </span>
          <h1
            style={{
              fontSize: 'clamp(1.25rem, 3.5vw, var(--font-size-2xl))',
              fontWeight: 800,
              color: 'var(--color-text-primary)',
              margin: '0.125rem 0 0 0',
            }}
          >
            Notifications & Alerts
          </h1>
          <p
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              margin: '0.25rem 0 0 0',
            }}
          >
            Stay updated with order deliveries, payment receipts, and security events.
          </p>
        </div>

        {/* Action Buttons: Mark all read & Clear */}
        <div className="bb-page-header-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={unreadTotal === 0}
            leftIcon={<CheckCheck size={14} />}
            title="Mark all notifications as read"
          >
            Mark all read
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={notifications.length === 0 || isClearing}
            leftIcon={<Trash2 size={14} />}
            title="Clear all notifications"
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Primary Status Tabs: All vs Unread */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          paddingBottom: 'var(--space-2)',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        {/* All vs Unread Segmented Control */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: '3px',
            backgroundColor: 'var(--color-bg-surface-elevated)',
            border: '1px solid var(--border-card-default)',
            borderRadius: 'var(--radius-lg)',
            maxWidth: '100%',
          }}
        >
          <button
            type="button"
            onClick={() => setStatusTab('all')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              border: statusTab === 'all' ? '1px solid var(--border-card-default)' : '1px solid transparent',
              backgroundColor: statusTab === 'all' ? 'var(--color-bg-surface)' : 'transparent',
              color: statusTab === 'all' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: statusTab === 'all' ? 800 : 600,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              boxShadow: statusTab === 'all' ? 'var(--shadow-sm)' : 'none',
              transition: 'all var(--transition-normal)',
              minHeight: '34px',
            }}
          >
            All
            <span
              style={{
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                fontSize: '10px',
                fontWeight: 700,
                backgroundColor: statusTab === 'all' ? 'var(--color-brand-surface)' : 'var(--color-bg-surface-hover)',
                color: statusTab === 'all' ? 'var(--color-brand)' : 'var(--color-text-muted)',
              }}
            >
              {notifications.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusTab('unread')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              border: statusTab === 'unread' ? '1px solid var(--border-card-default)' : '1px solid transparent',
              backgroundColor: statusTab === 'unread' ? 'var(--color-bg-surface)' : 'transparent',
              color: statusTab === 'unread' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: statusTab === 'unread' ? 800 : 600,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              boxShadow: statusTab === 'unread' ? 'var(--shadow-sm)' : 'none',
              transition: 'all var(--transition-normal)',
              minHeight: '34px',
            }}
          >
            Unread
            {unreadTotal > 0 && (
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-brand-surface)',
                  color: 'var(--color-brand)',
                }}
              >
                {unreadTotal}
              </span>
            )}
          </button>
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', maxWidth: '100%' }}>
          {[
            { key: 'all', label: 'All Categories' },
            { key: 'orders', label: 'Orders & Deliveries' },
            { key: 'payments', label: 'Payments & Wallet' },
            { key: 'security', label: 'Security & Keys' },
          ].map((cat) => {
            const isSelected = categoryFilter === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategoryFilter(cat.key as any)}
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: '11px',
                  fontWeight: isSelected ? 700 : 500,
                  borderRadius: 'var(--radius-full)',
                  border: isSelected ? '1px solid var(--color-brand)' : '1px solid var(--border-card-default)',
                  backgroundColor: isSelected ? 'var(--color-brand-surface)' : 'var(--color-bg-surface)',
                  color: isSelected ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  minHeight: '30px',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications List Card */}
      <Card
        style={{
          padding: 'clamp(0.5rem, 2vw, var(--space-4))',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--border-card-default)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-card-default)',
        }}
      >
        {isLoading ? (
          <div style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Loading notifications...
            </p>
          </div>
        ) : filtered.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => markSingleRead(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'clamp(0.5rem, 2vw, var(--space-4))',
                  padding: 'clamp(0.75rem, 2vw, var(--space-4))',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: item.unread ? 'var(--color-bg-surface-elevated)' : 'var(--color-bg-surface)',
                  border: item.unread ? '1px solid var(--color-border-hover)' : '1px solid var(--border-card-subtle)',
                  borderLeft: item.unread ? '3px solid var(--color-brand)' : '1px solid var(--border-card-subtle)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  position: 'relative',
                  minWidth: 0,
                  boxShadow: item.unread ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  {getCategoryIcon(item.category)}
                </div>

                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.25rem 0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: item.unread ? 800 : 600,
                          color: 'var(--color-text-primary)',
                          wordBreak: 'break-word',
                        }}
                      >
                        {item.title}
                      </span>
                      {item.unread && (
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-brand)',
                            display: 'inline-block',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: 'auto' }}>
                      <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {item.time}
                      </span>

                      {/* Single Item Actions */}
                      {item.unread && (
                        <button
                          type="button"
                          onClick={(e) => markSingleRead(item.id, e)}
                          title="Mark as read"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-text-muted)',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            minHeight: '28px',
                            minWidth: '28px',
                            justifyContent: 'center',
                          }}
                        >
                          <Check size={14} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleDeleteSingle(item.id, e)}
                        title="Dismiss notification"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-text-muted)',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          minHeight: '28px',
                          minWidth: '28px',
                          justifyContent: 'center',
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <p
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                      margin: '0.25rem 0 0 0',
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                    }}
                  >
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bb-empty-state" style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
            <TactileIcon icon={Bell} color="orders" size="lg" style={{ marginBottom: 'var(--space-3)' }} />
            <h3
              style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 800,
                color: 'var(--color-text-primary)',
                margin: 0,
              }}
            >
              {statusTab === 'unread' ? 'No unread notifications' : "You're all caught up"}
            </h3>
            <p
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
                margin: '0.25rem 0 0 0',
              }}
            >
              {statusTab === 'unread'
                ? 'All notifications have been read. Switch to "All" to view previous notifications.'
                : 'No notifications matching your filter at this time.'}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};
