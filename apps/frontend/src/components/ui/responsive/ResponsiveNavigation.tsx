import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Wallet,
  Users,
  Bell,
  Menu,
  Store,
  CreditCard,
  Zap,
} from 'lucide-react';

export interface MobileNavItem {
  label: string;
  path?: string;
  icon: React.ReactNode;
  isAction?: boolean;
  onClick?: () => void;
  badge?: string | number;
}

export interface ResponsiveNavigationProps {
  role?: 'customer' | 'agent' | 'admin' | 'super_admin' | 'store';
  onMoreClick: () => void;
  unreadAlertCount?: number;
  unreadNotificationCount?: number;
  activeColor?: string;
  customItems?: MobileNavItem[];
}

export const ResponsiveNavigation: React.FC<ResponsiveNavigationProps> = ({
  role = 'customer',
  onMoreClick,
  unreadAlertCount = 0,
  unreadNotificationCount = 0,
  activeColor = 'var(--color-brand)',
  customItems,
}) => {
  const location = useLocation();

  const getRoleItems = (): MobileNavItem[] => {
    if (customItems) return customItems;

    switch (role) {
      case 'admin':
      case 'super_admin':
        return [
          {
            label: 'Overview',
            path: '/admin/overview',
            icon: <LayoutDashboard size={20} strokeWidth={2.4} />,
          },
          {
            label: 'Orders',
            path: '/admin/orders',
            icon: <Package size={20} strokeWidth={2.4} />,
          },
          {
            label: 'Users',
            path: '/admin/users',
            icon: <Users size={20} strokeWidth={2.4} />,
          },
          {
            label: 'Alerts',
            path: '/admin/notifications',
            icon: <Bell size={20} strokeWidth={2.4} />,
            badge: unreadAlertCount || unreadNotificationCount || undefined,
          },
          {
            label: 'More',
            isAction: true,
            onClick: onMoreClick,
            icon: <Menu size={20} strokeWidth={2.4} />,
          },
        ];

      case 'agent':
        return [
          {
            label: 'Overview',
            path: '/agent/dashboard',
            icon: <LayoutDashboard size={20} strokeWidth={2.4} />,
          },
          {
            label: 'Orders',
            path: '/agent/orders',
            icon: <Package size={20} strokeWidth={2.4} />,
          },
          {
            label: 'Store',
            path: '/agent/store',
            icon: <Store size={20} strokeWidth={2.4} />,
          },
          {
            label: 'Wallet',
            path: '/agent/wallet',
            icon: <Wallet size={20} strokeWidth={2.4} />,
          },
          {
            label: 'More',
            isAction: true,
            onClick: onMoreClick,
            icon: <Menu size={20} strokeWidth={2.4} />,
          },
        ];

      case 'store':
        return [
          {
            label: 'Overview',
            path: '/store-console/overview',
            icon: <LayoutDashboard size={20} strokeWidth={2.4} />,
          },
          {
            label: 'Orders',
            path: '/store-console/orders',
            icon: <ShoppingBag size={20} strokeWidth={2.4} />,
          },
          {
            label: 'Products',
            path: '/store-console/products',
            icon: <Zap size={20} strokeWidth={2.4} />,
          },
          {
            label: 'Customers',
            path: '/store-console/customers',
            icon: <Users size={20} strokeWidth={2.4} />,
          },
          {
            label: 'More',
            isAction: true,
            onClick: onMoreClick,
            icon: <Menu size={20} strokeWidth={2.4} />,
          },
        ];

      case 'customer':
      default:
        return [
          {
            label: 'Overview',
            path: '/app/dashboard',
            icon: <LayoutDashboard size={20} strokeWidth={2.4} />,
          },
          {
            label: 'Buy Data',
            path: '/app/buy-data',
            icon: <Zap size={20} strokeWidth={2.4} />,
          },
          {
            label: 'Orders',
            path: '/app/orders',
            icon: <Package size={20} strokeWidth={2.4} />,
          },
          {
            label: 'Wallet',
            path: '/app/wallet',
            icon: <Wallet size={20} strokeWidth={2.4} />,
          },
          {
            label: 'More',
            isAction: true,
            onClick: onMoreClick,
            icon: <Menu size={20} strokeWidth={2.4} />,
          },
        ];
    }
  };

  const navItems = getRoleItems();

  return (
    <div
      className="bb-mobile-bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(var(--mobile-nav-height, 62px) + var(--safe-area-bottom, 0px))',
        paddingBottom: 'var(--safe-area-bottom, 0px)',
        backgroundColor: 'var(--color-bg-surface)',
        borderTop: '1px solid var(--color-border-default)',
        boxShadow: 'var(--shadow-floating)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 90,
      }}
    >
      <style>{`
        .bb-mobile-bottom-nav {
          display: flex;
        }
        @media (min-width: 768px) {
          .bb-mobile-bottom-nav {
            display: none !important;
          }
        }
      `}</style>

      {navItems.map((item, index) => {
        const isActive = item.path
          ? location.pathname === item.path ||
            (item.path !== '/app/dashboard' &&
             item.path !== '/agent/dashboard' &&
             item.path !== '/admin/dashboard' &&
             item.path !== '/admin/overview' &&
             location.pathname.startsWith(item.path))
          : false;

        const content = (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              minWidth: '56px',
              minHeight: '44px',
              padding: '4px 6px',
              color: isActive ? activeColor : 'var(--color-text-muted)',
              transition: 'all var(--transition-fast)',
              position: 'relative',
              cursor: 'pointer',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {/* Active Pill Indicator */}
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  top: '0',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '20px',
                  height: '3px',
                  borderRadius: '0 0 3px 3px',
                  backgroundColor: activeColor,
                }}
              />
            )}

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {item.icon}
              {Boolean(item.badge) && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-8px',
                    minWidth: '16px',
                    height: '16px',
                    padding: '0 4px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-danger, #EF4444)',
                    color: '#FFFFFF',
                    fontSize: '10px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 4px rgba(239, 68, 68, 0.4)',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </div>

            <span
              style={{
                fontSize: '10px',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
              }}
            >
              {item.label}
            </span>
          </div>
        );

        if (item.isAction) {
          return (
            <button
              key={index}
              type="button"
              onClick={item.onClick}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label={item.label}
            >
              {content}
            </button>
          );
        }

        return (
          <Link
            key={index}
            to={item.path || '#'}
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label={item.label}
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
};
