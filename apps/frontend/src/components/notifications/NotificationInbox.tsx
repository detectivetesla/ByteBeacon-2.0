import React, { useState, useEffect, useCallback } from 'react';
import {
  adminApi,
  UserNotificationItemDto,
  UserNotificationCountsDto,
  NotificationSeverity,
} from '../../api/admin.api.js';
import {
  Bell,
  CheckCheck,
  Info,
  AlertTriangle,
  AlertOctagon,
  Shield,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '../ui/Badge/Badge.js';
import { Button } from '../ui/Button/Button.js';
import { useToast } from '../../context/ToastContext.js';

interface NotificationInboxProps {
  onNavigate?: (url: string) => void;
  className?: string;
}

export const NotificationInbox: React.FC<NotificationInboxProps> = ({
  onNavigate,
  className = '',
}) => {
  const { error: toastError, success: toastSuccess } = useToast();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<UserNotificationItemDto[]>([]);
  const [counts, setCounts] = useState<UserNotificationCountsDto>({ total: 0, unread: 0 });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filterUnread, setFilterUnread] = useState<boolean>(false);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await adminApi.getUserNotificationCounts();
      if (res) {
        setCounts(res);
      }
    } catch {
      // Background poll silently fails
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getUserNotifications({
        page: 1,
        limit: 20,
        unreadOnly: filterUnread,
      });
      if (res?.items) {
        setNotifications(res.items);
      }
    } catch (err: any) {
      toastError('Failed to Load Notifications', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [filterUnread, toastError]);

  useEffect(() => {
    fetchCounts();
    const timer = setInterval(fetchCounts, 30000);
    return () => clearInterval(timer);
  }, [fetchCounts]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await adminApi.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setCounts((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
    } catch (err: any) {
      toastError('Action Failed', err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await adminApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setCounts((prev) => ({ ...prev, unread: 0 }));
      toastSuccess('All Read', 'Marked all notifications as read.');
    } catch (err: any) {
      toastError('Action Failed', err.message);
    }
  };

  const handleItemClick = (item: UserNotificationItemDto) => {
    if (!item.isRead) {
      adminApi.markNotificationRead(item.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
      );
      setCounts((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
    }
    if (item.actionUrl && onNavigate) {
      onNavigate(item.actionUrl);
      setIsOpen(false);
    }
  };

  const getSeverityIcon = (severity: NotificationSeverity) => {
    switch (severity) {
      case NotificationSeverity.CRITICAL:
        return <AlertOctagon size={16} className="text-red-500 shrink-0 mt-0.5" />;
      case NotificationSeverity.SECURITY:
        return <Shield size={16} className="text-purple-500 shrink-0 mt-0.5" />;
      case NotificationSeverity.WARNING:
        return <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />;
      default:
        return <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 focus:outline-none transition-colors"
        aria-label="Open notifications"
      >
        <Bell size={20} />
        {counts.unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-gray-900">
            {counts.unread > 9 ? '9+' : counts.unread}
          </span>
        )}
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 max-w-[90vw] rounded-xl border border-gray-800 bg-gray-900 shadow-2xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-950/60">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white text-sm">Notifications</span>
                {counts.unread > 0 && (
                  <Badge variant="neutral" size="sm">
                    {counts.unread} unread
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {counts.unread > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
                  >
                    <CheckCheck size={13} />
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            {/* Filter Pill */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800/60 bg-gray-950/30 text-xs">
              <button
                onClick={() => setFilterUnread(false)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  !filterUnread
                    ? 'bg-gray-800 text-white font-medium'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                All ({counts.total})
              </button>
              <button
                onClick={() => setFilterUnread(true)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterUnread
                    ? 'bg-gray-800 text-white font-medium'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Unread ({counts.unread})
              </button>
            </div>

            {/* Content List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-800/40">
              {isLoading ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  <Bell size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="font-medium text-gray-400">No notifications</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {filterUnread
                      ? 'You have caught up on all alerts.'
                      : 'Important updates and events will appear here.'}
                  </p>
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-3.5 flex gap-3 hover:bg-gray-800/50 cursor-pointer transition-colors ${
                      !item.isRead ? 'bg-indigo-950/20' : ''
                    }`}
                  >
                    {getSeverityIcon(item.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <span
                          className={`text-xs font-semibold truncate ${
                            !item.isRead ? 'text-white' : 'text-gray-300'
                          }`}
                        >
                          {item.title}
                        </span>
                        {!item.isRead && (
                          <span
                            onClick={(e) => handleMarkAsRead(item.id, e)}
                            title="Mark as read"
                            className="h-2 w-2 rounded-full bg-indigo-500 shrink-0 mt-1 hover:scale-150 transition-transform"
                          />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                        {item.body}
                      </p>
                      <div className="flex items-center justify-between mt-2 text-[11px] text-gray-500">
                        <span>
                          {new Date(item.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {item.actionUrl && (
                          <span className="flex items-center gap-0.5 text-indigo-400 font-medium hover:underline">
                            View <ExternalLink size={10} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-gray-800 bg-gray-950/60 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-gray-400 hover:text-white"
                onClick={() => {
                  setIsOpen(false);
                  if (onNavigate) onNavigate('/admin/notifications');
                }}
              >
                View all notifications & alerts <ChevronRight size={13} className="ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
