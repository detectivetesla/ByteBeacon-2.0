import React, { useRef, useEffect } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface ResponsiveTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: 'underline' | 'pill';
  className?: string;
  style?: React.CSSProperties;
}

export const ResponsiveTabs: React.FC<ResponsiveTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  variant = 'underline',
  className = '',
  style,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to active tab on mobile
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = activeRef.current;
      const scrollLeft = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
      } else {
        container.scrollLeft = Math.max(0, scrollLeft);
      }
    }
  }, [activeTab]);

  const isPill = variant === 'pill';

  return (
    <div
      className={`bb-responsive-tabs ${className}`}
      style={{
        width: '100%',
        position: 'relative',
        ...style,
      }}
    >
      <style>{`
        .bb-tabs-scroll-container {
          display: flex;
          align-items: center;
          gap: ${isPill ? 'var(--space-2)' : '0'};
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
          ${!isPill ? 'border-bottom: 1px solid var(--color-border-subtle);' : ''}
          padding-bottom: ${isPill ? '0' : '0'};
        }
        .bb-tabs-scroll-container::-webkit-scrollbar {
          display: none;
        }
        .bb-tab-item {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          white-space: nowrap;
          cursor: pointer;
          border: none;
          outline: none;
          font-family: var(--font-sans);
          font-weight: 600;
          font-size: var(--font-size-xs);
          transition: all var(--transition-fast);
          -webkit-tap-highlight-color: transparent;
          flex-shrink: 0;
          min-height: var(--touch-target-min, 44px);
        }
        .bb-tab-underline {
          background: none;
          padding: 0.625rem 1rem;
          color: var(--color-text-muted);
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }
        .bb-tab-underline.active {
          color: var(--color-text-primary);
          font-weight: 700;
          border-bottom-color: var(--color-brand);
        }
        .bb-tab-underline:hover:not(.active):not(:disabled) {
          color: var(--color-text-secondary);
        }
        .bb-tab-pill {
          background-color: transparent;
          padding: 0.45rem 0.875rem;
          border-radius: var(--radius-full);
          color: var(--color-text-secondary);
          border: 1px solid transparent;
        }
        .bb-tab-pill.active {
          background-color: var(--color-bg-surface-elevated);
          color: var(--color-text-primary);
          font-weight: 700;
          border-color: var(--color-border-hover);
          box-shadow: var(--shadow-tactile-sm);
        }
        .bb-tab-pill:hover:not(.active):not(:disabled) {
          background-color: var(--color-bg-surface-elevated);
        }
        .bb-tab-item:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>

      <div className="bb-tabs-scroll-container" ref={scrollRef} role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              ref={isActive ? activeRef : undefined}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              className={`bb-tab-item ${isPill ? 'bb-tab-pill' : 'bb-tab-underline'} ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  style={{
                    fontSize: 'var(--font-size-3xs)',
                    fontWeight: 700,
                    padding: '0.1rem 0.375rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: isActive ? 'var(--color-brand)' : 'var(--color-bg-surface-elevated)',
                    color: isActive ? '#FFFFFF' : 'var(--color-text-muted)',
                    minWidth: '18px',
                    textAlign: 'center',
                    display: 'inline-block',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
