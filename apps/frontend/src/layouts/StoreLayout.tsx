import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { STORE_NAVIGATION_GROUPS } from '../components/navigation/navigation.config.js';
import { MaintenanceBanner } from '../components/navigation/MaintenanceBanner.js';
import { usePlatformStatus } from '../context/PlatformStatusContext.js';
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
} from 'lucide-react';

export const StoreLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isMaintenanceMode, maintenanceMessage } = usePlatformStatus();
  const location = useLocation();
  const navigate = useNavigate();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const storeSlug = 'datahub-express';
  const storeName = 'DataHub Express';

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const publicStoreUrl = `/store/${storeSlug}`;

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-app)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* 1. Desktop Sidebar */}
      <aside
        style={{
          width: isCollapsed ? '72px' : '260px',
          minWidth: isCollapsed ? '72px' : '260px',
          backgroundColor: 'var(--color-bg-surface)',
          borderRight: '1px solid var(--color-border-default)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 40,
          boxShadow: 'var(--shadow-tactile-sm)',
        }}
        className="store-sidebar-desktop"
      >
        {/* Top Header & Logo */}
        <div>
          <div
            style={{
              padding: 'var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'space-between',
              borderBottom: '1px solid var(--color-border-subtle)',
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
                    backgroundColor: '#3B82F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)',
                  }}
                >
                  <Store size={18} strokeWidth={2.4} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                    {storeName}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                  backgroundColor: '#3B82F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)',
                }}
              >
                <Store size={18} strokeWidth={2.4} />
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                padding: '4px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
                      letterSpacing: '0.08em',
                      color: 'var(--color-text-muted)',
                      padding: '0 var(--space-3) var(--space-1) var(--space-3)',
                    }}
                  >
                    {group.title}
                  </span>
                )}

                {group.items.map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== '/store-console/overview' && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={isCollapsed ? item.label : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isCollapsed ? '0' : '0.65rem',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        textDecoration: 'none',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: isActive ? 800 : 600,
                        color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        backgroundColor: isActive ? 'var(--color-bg-surface-elevated)' : 'transparent',
                        borderLeft: isActive && !isCollapsed ? `3px solid ${item.color || 'var(--color-primary)'}` : '3px solid transparent',
                        boxShadow: isActive ? 'inset 1px 1px 2px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 120ms ease',
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
                        }}
                      >
                        {item.icon}
                      </div>
                      {!isCollapsed && <span>{item.label}</span>}
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
      </aside>

      {/* 2. Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <MaintenanceBanner isMaintenanceMode={isMaintenanceMode} message={maintenanceMessage} />
        {/* Top Navbar */}
        <header
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
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              style={{
                display: 'none',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-primary)',
                padding: '4px',
              }}
              className="store-mobile-toggle"
            >
              <Menu size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#3B82F6',
                  letterSpacing: '0.06em',
                }}
              >
                STORE CONSOLE
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                / {location.pathname.split('/').pop()?.toUpperCase() || 'OVERVIEW'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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

            {/* Public Store Link CTA */}
            <a
              href={publicStoreUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: 'var(--color-success)',
                textDecoration: 'none',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
              }}
            >
              <span>Live Storefront</span>
              <ArrowUpRight size={13} />
            </a>

            {/* User Profile Capsule Dropdown */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
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
                  }}
                >
                  {user?.fullName?.charAt(0) || 'A'}
                </div>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
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
        <main style={{ flex: 1, padding: 'var(--space-6)', overflowY: 'auto' }}>
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
              backgroundColor: 'var(--color-bg-surface)',
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Store size={18} color="#3B82F6" />
                  <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{storeName}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                >
                  <X size={18} />
                </button>
              </div>

              <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {STORE_NAVIGATION_GROUPS.map((group) => (
                  <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', paddingLeft: '0.5rem' }}>
                      {group.title}
                    </span>
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.65rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: 'var(--radius-md)',
                            textDecoration: 'none',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: isActive ? 800 : 600,
                            color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                            backgroundColor: isActive ? 'var(--color-bg-surface-elevated)' : 'transparent',
                          }}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
              <Link
                to="/agent/dashboard"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  color: 'var(--color-text-muted)',
                  textDecoration: 'none',
                  fontSize: 'var(--font-size-xs)',
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
      `}</style>
    </div>
  );
};
