import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button/Button.js';
import { useTheme } from '../../context/ThemeContext.js';
import { Menu, X, Sun, Moon } from 'lucide-react';


export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-header)',
        backgroundColor: 'var(--color-bg-surface-glass)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border-default)',
        transition: 'background-color var(--transition-normal), border-color var(--transition-normal)',
      }}
    >
      <style>{`
        .mobile-toggle {
          display: flex;
        }
        @media (min-width: 768px) {
          .desktop-nav { display: flex !important; }
          .mobile-toggle { display: none !important; }
        }
      `}</style>
      <div
        style={{
          maxWidth: 'var(--container-xl)',
          margin: '0 auto',
          padding: '0 var(--space-6)',
          height: '68px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
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
          <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
            ByteBeacon
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '2rem',
          }}
          className="desktop-nav"
        >
          <a
            href="#networks"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('networks')?.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 600, transition: 'color var(--transition-fast)', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
          >
            Buy Data
          </a>
          <Link
            to="/track"
            style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 600, transition: 'color var(--transition-fast)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
          >
            Track Order
          </Link>
          <Link
            to="/agent"
            style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 600, transition: 'color var(--transition-fast)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
          >
            Agents
          </Link>
          <Link
            to="/developer"
            style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 600, transition: 'color var(--transition-fast)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
          >
            API Docs
          </Link>
        </nav>

        {/* Action Controls & Theme Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-bg-surface-elevated)',
              border: '1px solid var(--color-border-default)',
              color: 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-tactile-sm)',
              transition: 'all var(--transition-fast)',
            }}
            aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {resolvedTheme === 'dark' ? <Sun size={18} strokeWidth={2.5} /> : <Moon size={18} strokeWidth={2.5} />}
          </button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/signin')}
          >
            Sign In
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/signup')}
          >
            Get Started
          </Button>

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              padding: '0.5rem',
              color: 'var(--color-text-primary)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-bg-surface-elevated)',
              border: '1px solid var(--color-border-default)',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} strokeWidth={2.5} /> : <Menu size={20} strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            borderBottom: '1px solid var(--color-border-default)',
            padding: 'var(--space-4) var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {[
            { label: 'Buy Data', isScroll: true, scrollTarget: 'networks' },
            { label: 'Track Order', to: '/track' },
            { label: 'Agent Portal', to: '/agent' },
            { label: 'API Docs', to: '/developer' },
          ].map((item) => {
            const linkStyle: React.CSSProperties = {
              display: 'flex',
              alignItems: 'center',
              padding: '0.625rem 0.875rem',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              backgroundColor: 'transparent',
              transition: 'all var(--transition-fast)',
              textDecoration: 'none',
              cursor: 'pointer',
            };

            if (item.isScroll) {
              return (
                <a
                  key={item.label}
                  href={`#${item.scrollTarget}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileMenuOpen(false);
                    document.getElementById(item.scrollTarget!)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  style={linkStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-hover)';
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }}
                >
                  {item.label}
                </a>
              );
            }

            return (
              <Link
                key={item.label}
                to={item.to!}
                onClick={() => setMobileMenuOpen(false)}
                style={linkStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-hover)';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }}
              >
                {item.label}
              </Link>
            );
          })}

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: 'var(--color-border-subtle)', margin: 'var(--space-2) 0' }} />

          {/* CTA buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: '0 0.375rem' }}>
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => { setMobileMenuOpen(false); navigate('/signin'); }}
            >
              Sign In
            </Button>
            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={() => { setMobileMenuOpen(false); navigate('/signup'); }}
            >
              Get Started
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};
