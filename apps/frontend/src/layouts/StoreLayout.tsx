import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { STORE_NAVIGATION_GROUPS } from '../components/navigation/navigation.config.js';
import { MaintenanceBanner } from '../components/navigation/MaintenanceBanner.js';
import { usePlatformStatus } from '../context/PlatformStatusContext.js';
import { storesApi } from '../api/stores.api.js';
import { usePendingApprovals } from '../context/PendingApprovalsContext.js';
import { STOREFRONT_CONFIG } from '../config/storefront.config.js';
import {
  Store,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  ExternalLink,
  Sun,
  Moon,
  LogOut,
  ShieldCheck,
  ChevronDown,
  ArrowUpRight,
  Bell,
} from 'lucide-react';

export const StoreLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isMaintenanceMode, maintenanceMessage, isOrderProcessingPaused, orderProcessingMessage } = usePlatformStatus();
  const { pendingCount } = usePendingApprovals();
  const location = useLocation();
  const navigate = useNavigate();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [storeSlug, setStoreSlug] = useState('');
  const [storeName, setStoreName] = useState('Agent Store');
  const [logoUrl, setLogoUrl] = useState('');

  // Load active store profile
  const fetchStore = React.useCallback(() => {
    storesApi.getStore().then((st) => {
      if (st && st.id) {
        if (st.slug) setStoreSlug(st.slug);
        if (st.storeName) setStoreName(st.storeName);
        if (st.logoUrl) setLogoUrl(st.logoUrl);
        else setLogoUrl('');
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchStore();
    window.addEventListener('bytebeacon:store-updated', fetchStore);
    return () => {
      window.removeEventListener('bytebeacon:store-updated', fetchStore);
    };
  }, [fetchStore]);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const publicStoreUrl = storeSlug ? STOREFRONT_CONFIG.getStoreUrl(storeSlug) : '#';

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--gradient-portal-mesh, var(--gradient-portal-bg, var(--color-bg-base)))',
        backgroundAttachment: 'fixed',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-sans)',
        alignItems: 'stretch',
      }}
    >
      {/* 1. Desktop Sidebar */}
      <aside
        style={{
          width: isCollapsed ? '72px' : '260px',
          minWidth: isCollapsed ? '72px' : '260px',
          background: 'var(--sidebar-bg-gradient)',
          borderRight: '1px solid var(--sidebar-border)',
          flexShrink: 0,
          transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          minHeight: '100vh',
          alignSelf: 'stretch',
          position: 'relative',
          zIndex: 40,
          boxShadow: '2px 0 16px rgba(0, 0, 0, 0.25)',
        }}
        className="store-sidebar-desktop"
      >
        <div
          className="store-sidebar-desktop-inner"
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            maxHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
        {/* Top Header & Logo */}
        <div>
          <div
            style={{
              padding: 'var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'space-between',
              borderBottom: '1px solid var(--sidebar-border-subtle)',
              minHeight: '64px',
            }}
          >
            {!isCollapsed ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#16A34A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    flexShrink: 0,
                    overflow: 'hidden',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.35)',
                  }}
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt={storeName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Store size={18} strokeWidth={2.4} />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                    {storeName}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: '#34D399', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    ● Store Live
                  </span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.35)',
                }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt={storeName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Store size={18} strokeWidth={2.4} />
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--sidebar-border)',
                cursor: 'pointer',
                color: 'var(--sidebar-text)',
                padding: '4px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all var(--transition-fast)',
              }}
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>

          {/* Navigation Groups */}
          <nav style={{ padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflowY: 'auto', maxHeight: 'calc(100vh - 140px)' }}>
            {STORE_NAVIGATION_GROUPS.map((group) => (
              <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {!isCollapsed && (
                  <span
                    style={{
                      fontSize: 'var(--font-size-3xs)',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.09em',
                      color: 'var(--sidebar-text-muted)',
                      padding: '0 var(--space-3) var(--space-1) var(--space-3)',
                    }}
                  >
                    {group.title}
                  </span>
                )}

                {group.items.map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== '/store-console/overview' && location.pathname.startsWith(item.path));
                  const isPendingMtnItem = item.path.includes('pending-approvals');
                  const liveBadge = isPendingMtnItem && pendingCount > 0 ? (pendingCount > 99 ? '99+' : String(pendingCount)) : item.badge;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={isCollapsed ? `${item.label}${liveBadge ? ` (${liveBadge})` : ''}` : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isCollapsed ? '0' : '0.65rem',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        padding: '0.55rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        textDecoration: 'none',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? 'var(--sidebar-item-active-text)' : 'var(--sidebar-text)',
                        backgroundColor: isActive ? 'var(--sidebar-item-active-bg)' : 'transparent',
                        border: isActive ? '1px solid var(--sidebar-item-active-border)' : '1px solid transparent',
                        transition: 'all 120ms ease',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          color: isActive ? '#34D399' : 'currentColor',
                        }}
                      >
                        {item.icon}
                      </div>
                      {!isCollapsed && <span>{item.label}</span>}
                      {liveBadge && !isCollapsed && (
                        <span
                          style={{
                            marginLeft: 'auto',
                            padding: '0.1rem 0.45rem',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: isPendingMtnItem ? '#EF4444' : 'var(--color-brand-primary)',
                            color: '#FFFFFF',
                            fontSize: '10px',
                            fontWeight: 800,
                            lineHeight: 1.2,
                          }}
                        >
                          {liveBadge}
                        </span>
                      )}
                      {isActive && !isCollapsed && !liveBadge && (
                        <span
                          style={{
                            marginLeft: 'auto',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--sidebar-indicator-dot)',
                            boxShadow: '0 0 8px rgba(34, 197, 94, 0.9)',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      {liveBadge && isCollapsed && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '6px',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#EF4444',
                            boxShadow: '0 0 6px #EF4444',
                          }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom Quick Return to Agent Console & View Storefront */}
        <div style={{ padding: 'var(--space-3)', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {!isCollapsed ? (
            <>
              <a
                href={publicStoreUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  color: '#3B82F6',
                  textDecoration: 'none',
                  fontSize: 'var(--font-size-2xs)',
                  fontWeight: 700,
                }}
              >
                <span>View Public Store</span>
                <ArrowUpRight size={13} />
              </a>

              <Link
                to="/agent/dashboard"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-muted)',
                  textDecoration: 'none',
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 700,
                }}
              >
                ← Back to Agent Console
              </Link>
            </>
          ) : (
            <a
              href={publicStoreUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.45rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                color: '#3B82F6',
                textDecoration: 'none',
              }}
              title="View Public Storefront"
            >
              <ExternalLink size={15} />
            </a>
          )}
        </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <MaintenanceBanner
          isMaintenanceMode={isMaintenanceMode}
          message={maintenanceMessage}
          isOrderProcessingPaused={isOrderProcessingPaused}
          orderProcessingMessage={orderProcessingMessage}
        />
        {/* Top Navbar */}
        <header
          className="store-top-header"
          style={{
            height: '64px',
            backgroundColor: 'var(--color-bg-surface)',
            borderBottom: '1px solid var(--color-border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 var(--space-6)',
            position: 'sticky',
            top: 0,
            zIndex: 30,
            boxShadow: 'var(--shadow-tactile-sm)',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              style={{
                display: 'none',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-primary)',
                padding: '6px',
                minHeight: '40px',
                minWidth: '40px',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="store-mobile-toggle"
              aria-label="Open navigation menu"
            >
              <Menu size={22} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, overflow: 'hidden' }}>
              <span
                className="store-header-console-badge"
                style={{
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#3B82F6',
                  letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                }}
              >
                STORE CONSOLE
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                / {location.pathname.split('/').pop()?.replace(/-/g, ' ').toUpperCase() || 'OVERVIEW'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              style={{
                background: 'none',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Notifications Bell */}
            <Link
              to="/store-console/notifications"
              style={{
                background: 'none',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                position: 'relative',
              }}
              title="Store Alerts & Notifications"
            >
              <Bell size={15} />
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                }}
              />
            </Link>

            {/* Public Store Link CTA */}
            <a
              href={publicStoreUrl}
              target="_blank"
              rel="noreferrer"
              title="View Live Storefront"
              className="store-header-live-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: 'var(--color-success)',
                textDecoration: 'none',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
              }}
            >
              <span className="store-header-live-text">Live Storefront</span>
              <ArrowUpRight size={13} />
            </a>

            {/* User Profile Capsule Dropdown */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="store-header-user-capsule"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.3rem 0.6rem',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-bg-surface-elevated)',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: '#3B82F6',
                    color: '#FFFFFF',
                    fontSize: 'var(--font-size-3xs)',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {user?.fullName?.charAt(0) || 'A'}
                </div>
                <span className="store-header-user-name" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {user?.fullName || 'Agent Merchant'}
                </span>
                <ChevronDown size={13} color="var(--color-text-muted)" />
              </div>

              {profileDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    width: '220px',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-tactile-lg)',
                    padding: 'var(--space-2)',
                    zIndex: 50,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: '2px' }}>
                    <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
                      {storeName}
                    </strong>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                      {user?.email}
                    </span>
                  </div>

                  <Link
                    to="/store-console/profile"
                    onClick={() => setProfileDropdownOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.45rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-text-primary)',
                      textDecoration: 'none',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    <Store size={14} />
                    Store Profile
                  </Link>

                  <Link
                    to="/agent/dashboard"
                    onClick={() => setProfileDropdownOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.45rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-text-primary)',
                      textDecoration: 'none',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    <ShieldCheck size={14} />
                    Agent Console
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      logout();
                      navigate('/store-auth/login');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.45rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-danger)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-xs)',
                      textAlign: 'left',
                      marginTop: '2px',
                      borderTop: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <LogOut size={14} />
                    Sign Out Store
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page View Body */}
        <main
          className="store-main-viewport"
          style={{
            flex: 1,
            padding: 'var(--space-page-y, var(--space-6)) var(--space-page-x, var(--space-6))',
            overflowY: 'auto',
            overflowX: 'clip',
            background: 'transparent',
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <Outlet />
        </main>
      </div>

      {/* 3. Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
          }}
        >
          <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(3px)' }}
            onClick={() => setIsMobileOpen(false)}
          />

          <aside
            style={{
              position: 'relative',
              width: '280px',
              maxWidth: '85vw',
              background: 'var(--sidebar-bg-gradient)',
              borderRight: '1px solid var(--sidebar-border)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              zIndex: 110,
              boxShadow: 'var(--shadow-tactile-lg)',
              padding: 'var(--space-4)',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--sidebar-border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {logoUrl ? (
                    <img src={logoUrl} alt={storeName} style={{ width: '22px', height: '22px', borderRadius: '4px', objectFit: 'cover' }} />
                  ) : (
                    <Store size={18} color="#34D399" />
                  )}
                  <strong style={{ fontSize: 'var(--font-size-sm)', color: '#FFFFFF' }}>{storeName}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid var(--sidebar-border)', borderRadius: 'var(--radius-sm)', padding: '4px', cursor: 'pointer', color: '#FFFFFF' }}
                >
                  <X size={18} />
                </button>
              </div>

              <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {STORE_NAVIGATION_GROUPS.map((group) => (
                  <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--sidebar-text-muted)', textTransform: 'uppercase', paddingLeft: '0.5rem', letterSpacing: '0.09em' }}>
                      {group.title}
                    </span>
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.path;
                      const isPendingMtnItem = item.path.includes('pending-approvals');
                      const liveBadge = isPendingMtnItem && pendingCount > 0 ? (pendingCount > 99 ? '99+' : String(pendingCount)) : item.badge;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setIsMobileOpen(false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.65rem',
                            padding: '0.6rem 0.75rem',
                            minHeight: '44px',
                            borderRadius: 'var(--radius-md)',
                            textDecoration: 'none',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? 'var(--sidebar-item-active-text)' : 'var(--sidebar-text)',
                            backgroundColor: isActive ? 'var(--sidebar-item-active-bg)' : 'transparent',
                            border: isActive ? '1px solid var(--sidebar-item-active-border)' : '1px solid transparent',
                            position: 'relative',
                            boxSizing: 'border-box',
                          }}
                        >
                          <span style={{ color: isActive ? '#34D399' : 'currentColor', display: 'flex', alignItems: 'center' }}>
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                          {liveBadge && (
                            <span
                              style={{
                                marginLeft: 'auto',
                                padding: '0.1rem 0.45rem',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor: isPendingMtnItem ? '#EF4444' : 'var(--color-brand-primary)',
                                color: '#FFFFFF',
                                fontSize: '10px',
                                fontWeight: 800,
                                lineHeight: 1.2,
                              }}
                            >
                              {liveBadge}
                            </span>
                          )}
                          {isActive && !liveBadge && (
                            <span
                              style={{
                                marginLeft: 'auto',
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--sidebar-indicator-dot)',
                                boxShadow: '0 0 8px rgba(34, 197, 94, 0.9)',
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </div>

            <div style={{ borderTop: '1px solid var(--sidebar-border-subtle)', paddingTop: 'var(--space-3)' }}>
              <Link
                to="/agent/dashboard"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 0.5rem',
                  minHeight: '44px',
                  color: 'var(--sidebar-text-muted)',
                  textDecoration: 'none',
                  fontSize: 'var(--font-size-xs)',
                  boxSizing: 'border-box',
                }}
              >
                ← Back to Agent Console
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* Responsive media style injection */}
      <style>{`
        @media (max-width: 834px) {
          .store-sidebar-desktop {
            display: none !important;
          }
          .store-mobile-toggle {
            display: flex !important;
          }
        }
        @media (max-width: 639px) {
          .store-top-header {
            padding: 0 var(--space-3) !important;
            height: 56px !important;
          }
          .store-main-viewport {
            padding: var(--space-3) !important;
          }
          .store-header-live-text {
            display: none !important;
          }
          .store-header-user-name {
            display: none !important;
          }
          .store-header-console-badge {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
