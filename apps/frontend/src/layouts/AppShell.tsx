import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { usePermissions } from '../auth/hooks/usePermissions.js';
import { useTheme } from '../context/ThemeContext.js';
import { Avatar } from '../components/ui/Avatar/Avatar.js';
import { Button } from '../components/ui/Button/Button.js';
import { NavGroupConfig } from '../components/navigation/navigation.config.js';
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Bell,
  Store,
  Wallet,
  Settings,
  LogOut,
  Moon,
  Sun,
  ExternalLink,
  Copy,
  Check,
  CheckCheck,
  User,
} from 'lucide-react';

export interface AppShellProps {
  portalTitle: string;
  portalSubtitle: string;
  portalLogoIcon?: React.ReactNode;
  portalRoleBadge: string;
  portalRoleColor?: string;
  navigationGroups: NavGroupConfig[];
  children: React.ReactNode;
  userRole?: 'customer' | 'agent' | 'admin' | 'super_admin';
  balancePesewas?: number;
  onTopUpClick?: () => void;
  storeSlug?: string;
}

interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  unread: boolean;
  type: 'order' | 'payment' | 'system';
}

const SAMPLE_NOTIFICATIONS: NotificationItem[] = [
  { id: 'n1', title: 'Data Bundle Delivered', detail: '5 GB MTN bundle credited to 024 123 4567', time: '12m ago', unread: true, type: 'order' },
  { id: 'n2', title: 'Wallet Balance Topped Up', detail: 'GH₵ 250.00 MoMo deposit verified', time: '1h ago', unread: true, type: 'payment' },
  { id: 'n3', title: 'Carrier Route Healthy', detail: 'Telecel provisioning latency normal (1.2s)', time: '3h ago', unread: false, type: 'system' },
];

export const AppShell: React.FC<AppShellProps> = ({
  portalTitle,
  portalSubtitle,
  portalRoleBadge,
  portalRoleColor = 'var(--color-brand)',
  navigationGroups,
  children,
  userRole = 'customer',
  balancePesewas,
  onTopUpClick,
  storeSlug = 'my-store',
}) => {
  const { user, logout } = useAuth();
  const { can } = usePermissions();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Collapsible sidebar state stored in localStorage
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bytebeacon_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Mobile drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Popover menus
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [copiedStore, setCopiedStore] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(SAMPLE_NOTIFICATIONS);

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const storeRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => n.unread).length;
  const storeUrl = `https://bytebeacon.com/store/${storeSlug}`;

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('bytebeacon_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (storeRef.current && !storeRef.current.contains(e.target as Node)) {
        setStoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileDrawerOpen]);

  // Keyboard shortcuts (Escape to close overlays)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileDrawerOpen(false);
        setProfileMenuOpen(false);
        setNotificationsOpen(false);
        setStoreMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCopyStoreUrl = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopiedStore(true);
    setTimeout(() => setCopiedStore(false), 2000);
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const formatBalance = (pesewas?: number) => {
    const val = (pesewas || 0) / 100;
    return `GH₵ ${val.toFixed(2)}`;
  };

  const renderNavGroup = (group: NavGroupConfig, isMobile = false) => {
    const permittedItems = group.items.filter((item) => can(item.permission));
    if (permittedItems.length === 0) return null;

    return (
      <div key={group.title} style={{ marginBottom: 'var(--space-4)' }}>
        {(!collapsed || isMobile) && (
          <div
            style={{
              fontSize: 'var(--font-size-3xs)',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-text-muted)',
              padding: '0 0.75rem',
              marginBottom: '0.375rem',
            }}
          >
            {group.title}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {permittedItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/app/dashboard' && item.path !== '/agent/dashboard' && item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => isMobile && setMobileDrawerOpen(false)}
                title={collapsed && !isMobile ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: collapsed && !isMobile ? '0.625rem 0' : '0.5rem 0.75rem',
                  justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: isActive ? 'var(--color-bg-surface-elevated)' : 'transparent',
                  border: isActive ? '1px solid var(--color-border-hover)' : '1px solid transparent',
                  textDecoration: 'none',
                  transition: 'all var(--transition-fast)',
                  position: 'relative',
                }}
              >
                {/* Active Indicator Strip */}
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '20%',
                      height: '60%',
                      width: '3px',
                      borderRadius: '0 2px 2px 0',
                      backgroundColor: item.color || portalRoleColor,
                    }}
                  />
                )}

                <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {item.icon}
                </span>

                {(!collapsed || isMobile) && (
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexGrow: 1 }}>
                    {item.label}
                  </span>
                )}

                {(!collapsed || isMobile) && item.badge && (
                  <span
                    style={{
                      fontSize: 'var(--font-size-3xs)',
                      fontWeight: 700,
                      padding: '0.1rem 0.4rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--color-info-surface)',
                      color: 'var(--color-info)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-bg-base)', width: '100%' }}>
      <style>{`
        .app-desktop-sidebar {
          width: ${collapsed ? '76px' : '260px'};
          background-color: var(--color-bg-surface);
          border-right: 1px solid var(--color-border-default);
          display: flex;
          flex-direction: column;
          justifyContent: space-between;
          padding: var(--space-5) ${collapsed ? 'var(--space-2)' : 'var(--space-4)'};
          flex-shrink: 0;
          transition: width 250ms cubic-bezier(0.16, 1, 0.3, 1), padding 250ms ease;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          overflow-x: hidden;
          z-index: 40;
        }

        .app-desktop-sidebar::-webkit-scrollbar {
          width: 4px;
        }
        .app-desktop-sidebar::-webkit-scrollbar-thumb {
          background: var(--color-border-subtle);
          border-radius: 4px;
        }

        .app-mobile-menu-trigger {
          display: none !important;
        }

        @media (max-width: 834px) {
          .app-desktop-sidebar {
            display: none !important;
          }
          .app-mobile-menu-trigger {
            display: flex !important;
          }
        }
      `}</style>

      {/* =========================================================================
          1. DESKTOP COLLAPSIBLE SIDEBAR
          ========================================================================= */}
      <aside className="app-desktop-sidebar">
        <div>
          {/* Logo & Portal Branding */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', marginBottom: 'var(--space-6)' }}>
            <Link
              to={location.pathname.startsWith('/agent') ? '/agent/dashboard' : location.pathname.startsWith('/admin') ? '/admin/dashboard' : '/app/dashboard'}
              style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }}
            >
              <img
                src="/logo.png"
                alt="ByteBeacon"
                style={{
                  width: '44px',
                  height: '44px',
                  objectFit: 'contain',
                  flexShrink: 0,
                }}
              />

              {!collapsed && (
                <div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>
                    {portalTitle}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-3xs)', color: portalRoleColor, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 800 }}>
                    {portalSubtitle}
                  </div>
                </div>
              )}
            </Link>

            {/* Collapse Toggle Button */}
            {!collapsed && (
              <button
                type="button"
                onClick={toggleCollapse}
                title="Collapse sidebar"
                style={{
                  background: 'none',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-xs)',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
              >
                <ChevronLeft size={14} strokeWidth={2.4} />
              </button>
            )}
          </div>

          {/* Re-expand button if collapsed */}
          {collapsed && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
              <button
                type="button"
                onClick={toggleCollapse}
                title="Expand sidebar"
                style={{
                  background: 'none',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-xs)',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <ChevronRight size={14} strokeWidth={2.4} />
              </button>
            </div>
          )}

          {/* Grouped Navigation Links */}
          <nav>
            {navigationGroups.map((group) => renderNavGroup(group, false))}
          </nav>
        </div>

        {/* Sidebar Footer: Profile Capsule */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'space-between',
              gap: '0.625rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
              <Avatar name={user?.fullName || user?.email || 'User'} role={userRole} status="online" size="sm" />
              {!collapsed && (
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.fullName || user?.email?.split('@')[0]}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-3xs)', color: portalRoleColor, fontWeight: 700, textTransform: 'uppercase' }}>
                    {portalRoleBadge}
                  </div>
                </div>
              )}
            </div>

            {!collapsed && (
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/signin');
                }}
                title="Sign out"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  padding: '4px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-danger)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
              >
                <LogOut size={16} strokeWidth={2.2} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* =========================================================================
          2. MOBILE SLIDE-OVER DRAWER
          ========================================================================= */}
      {mobileDrawerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            display: 'flex',
          }}
        >
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(3px)',
            }}
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer Body */}
          <div
            style={{
              position: 'relative',
              width: '82%',
              maxWidth: '320px',
              height: '100%',
              backgroundColor: 'var(--color-bg-surface)',
              borderRight: '1px solid var(--color-border-default)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: 'var(--space-6) var(--space-5)',
              zIndex: 310,
              boxShadow: 'var(--shadow-tactile-lg)',
              overflowY: 'auto',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <img
                    src="/logo.png"
                    alt="ByteBeacon"
                    style={{
                      width: '42px',
                      height: '42px',
                      objectFit: 'contain',
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
                      {portalTitle}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-3xs)', color: portalRoleColor, fontWeight: 800, textTransform: 'uppercase' }}>
                      {portalSubtitle}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px',
                    cursor: 'pointer',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <X size={18} strokeWidth={2.4} />
                </button>
              </div>

              {/* Navigation */}
              <nav>
                {navigationGroups.map((group) => renderNavGroup(group, true))}
              </nav>
            </div>

            {/* User details & logout */}
            <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 'var(--space-4)' }}>
                <Avatar name={user?.fullName || user?.email || 'User'} role={userRole} status="online" size="md" />
                <div style={{ minWidth: 0, flexGrow: 1 }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.fullName || user?.email}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-3xs)', color: portalRoleColor, fontWeight: 700, textTransform: 'uppercase' }}>
                    {portalRoleBadge}
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                fullWidth
                onClick={() => {
                  setMobileDrawerOpen(false);
                  logout();
                  navigate('/signin');
                }}
                leftIcon={<LogOut size={14} strokeWidth={2.4} />}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. MAIN CONTENT WORKSPACE & UNIVERSAL TOPBAR
          ========================================================================= */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
        {/* Topbar Header */}
        <header
          style={{
            height: '64px',
            backgroundColor: 'var(--color-bg-surface)',
            borderBottom: '1px solid var(--color-border-default)',
            padding: '0 var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 30,
            gap: '1rem',
          }}
        >
          {/* Left: Mobile hamburger trigger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="app-mobile-menu-trigger"
              onClick={() => setMobileDrawerOpen(true)}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-bg-surface-elevated)',
                cursor: 'pointer',
                color: 'var(--color-text-primary)',
              }}
              aria-label="Open menu"
            >
              <Menu size={18} strokeWidth={2.4} />
            </button>
          </div>

          {/* Right: Actions, Badges, Store link, Notifications & Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Storefront Link (Agents only) */}
            {userRole === 'agent' && (
              <div style={{ position: 'relative' }} ref={storeRef}>
                <button
                  type="button"
                  onClick={() => setStoreMenuOpen(!storeMenuOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-agent-surface)',
                    border: '1px solid var(--color-agent-border)',
                    color: 'var(--color-agent)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Store size={14} strokeWidth={2.4} />
                  <span>My Store ↗</span>
                </button>

                {storeMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 8px)',
                      width: '240px',
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border-default)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: 'var(--shadow-tactile-lg)',
                      padding: 'var(--space-3)',
                      zIndex: 100,
                    }}
                  >
                    <div style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                      Branded Storefront Link
                    </div>
                    <code style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-agent)', display: 'block', wordBreak: 'break-all', marginBottom: 'var(--space-3)' }}>
                      {storeUrl}
                    </code>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button variant="outline" size="sm" fullWidth onClick={handleCopyStoreUrl}>
                        {copiedStore ? <Check size={12} /> : <Copy size={12} />}
                        {copiedStore ? 'Copied' : 'Copy'}
                      </Button>
                      <Button variant="primary" size="sm" fullWidth onClick={() => window.open(storeUrl, '_blank')}>
                        <ExternalLink size={12} />
                        Preview
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Wallet Balance Capsule */}
            {balancePesewas !== undefined && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.3rem 0.75rem',
                  backgroundColor: 'var(--color-warning-surface)',
                  border: '1px solid var(--color-warning-border)',
                  borderRadius: 'var(--radius-full)',
                  color: 'var(--color-warning)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  cursor: onTopUpClick ? 'pointer' : 'default',
                }}
                onClick={onTopUpClick}
                title={onTopUpClick ? 'Click to fund wallet' : undefined}
              >
                <Wallet size={14} strokeWidth={2.4} />
                <span style={{ fontFamily: 'var(--font-data)' }}>{formatBalance(balancePesewas)}</span>
              </div>
            )}

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
              }}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Notifications Popover */}
            <div style={{ position: 'relative' }} ref={notificationRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                style={{
                  position: 'relative',
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-bg-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                }}
                aria-label="Notifications"
              >
                <Bell size={16} strokeWidth={2.2} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-brand)',
                      boxShadow: '0 0 6px var(--color-brand)',
                    }}
                  />
                )}
              </button>

              {notificationsOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    width: '320px',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: 'var(--shadow-tactile-lg)',
                    padding: 'var(--space-4)',
                    zIndex: 100,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                      Notifications ({unreadCount})
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary)',
                          fontSize: 'var(--font-size-3xs)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <CheckCheck size={12} />
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '240px', overflowY: 'auto' }}>
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          padding: 'var(--space-2) var(--space-3)',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: n.unread ? 'var(--color-bg-surface-elevated)' : 'transparent',
                          border: n.unread ? '1px solid var(--color-border-hover)' : '1px solid transparent',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {n.title}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                            {n.time}
                          </span>
                        </div>
                        <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0', lineHeight: 1.3 }}>
                          {n.detail}
                        </p>
                      </div>
                    ))}
                  </div>

                  <Link
                    to={location.pathname.startsWith('/agent') ? '/agent/notifications' : location.pathname.startsWith('/admin') ? '/admin/notifications' : '/app/notifications'}
                    onClick={() => setNotificationsOpen(false)}
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      fontSize: 'var(--font-size-2xs)',
                      fontWeight: 700,
                      color: 'var(--color-primary)',
                      marginTop: 'var(--space-3)',
                      paddingTop: 'var(--space-2)',
                      borderTop: '1px solid var(--color-border-subtle)',
                      textDecoration: 'none',
                    }}
                  >
                    View All Notifications →
                  </Link>
                </div>
              )}
            </div>

            {/* Profile Avatar & Dropdown */}
            <div style={{ position: 'relative' }} ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label="User Profile"
              >
                <Avatar name={user?.fullName || user?.email || 'User'} role={userRole} status="online" size="md" />
              </button>

              {profileMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    width: '240px',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: 'var(--shadow-tactile-lg)',
                    padding: 'var(--space-4)',
                    zIndex: 100,
                  }}
                >
                  <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                      {user?.fullName || user?.email}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-3xs)', color: portalRoleColor, fontWeight: 700, textTransform: 'uppercase', marginTop: '0.1rem' }}>
                      {portalRoleBadge}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate(location.pathname.startsWith('/agent') ? '/agent/profile' : location.pathname.startsWith('/admin') ? '/admin/profile' : '/app/profile');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--color-text-primary)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <User size={14} />
                      My Profile
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate(location.pathname.startsWith('/agent') ? '/agent/settings' : location.pathname.startsWith('/admin') ? '/admin/settings' : '/app/settings');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--color-text-primary)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Settings size={14} />
                      Account Settings
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        logout();
                        navigate('/signin');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--color-danger)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-danger-surface)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <main style={{ flex: 1, padding: 'var(--space-6)', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
};
