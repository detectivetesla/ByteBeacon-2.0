import React, { useState } from 'react';
import { Search, Filter, X, RotateCcw } from 'lucide-react';
import { Button } from '../Button/Button.js';
import { ResponsiveDrawer } from './ResponsiveDrawer.js';

export interface ResponsiveFilterBarProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  activeFilterCount?: number;
  filterControls?: React.ReactNode;
  actions?: React.ReactNode;
  onResetFilters?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const ResponsiveFilterBar: React.FC<ResponsiveFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  activeFilterCount = 0,
  filterControls,
  actions,
  onResetFilters,
  className = '',
  style,
}) => {
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  return (
    <div
      className={`bb-responsive-filterbar ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <style>{`
        .bb-filterbar-desktop-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
          width: 100%;
        }
        .bb-filterbar-desktop-filters {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
          flex: 1;
        }
        .bb-filterbar-mobile-trigger {
          display: none;
        }
        @media (max-width: 767px) {
          .bb-filterbar-desktop-filters {
            display: none !important;
          }
          .bb-filterbar-mobile-trigger {
            display: flex !important;
          }
          .bb-filterbar-desktop-row {
            flex-direction: column;
            align-items: stretch;
          }
          .bb-filterbar-mobile-actions-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--space-2);
          }
        }
      `}</style>

      {/* Main Bar Row */}
      <div className="bb-filterbar-desktop-row">
        {/* Search Input if enabled */}
        {onSearchChange !== undefined && (
          <div
            style={{
              position: 'relative',
              flex: '1 1 240px',
              minWidth: '200px',
            }}
          >
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={searchQuery || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: '100%',
                height: '42px',
                paddingLeft: '38px',
                paddingRight: searchQuery ? '36px' : '12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-xs)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Desktop Filter Controls */}
        {filterControls && (
          <div className="bb-filterbar-desktop-filters">
            {filterControls}
            {activeFilterCount > 0 && onResetFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '4px 8px',
                }}
              >
                <RotateCcw size={12} />
                Reset
              </button>
            )}
          </div>
        )}

        {/* Mobile Filter Trigger Button & Actions Row */}
        <div className="bb-filterbar-mobile-actions-row">
          {filterControls && (
            <div className="bb-filterbar-mobile-trigger">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileFilterOpen(true)}
                leftIcon={<Filter size={14} />}
              >
                Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </Button>
            </div>
          )}

          {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>{actions}</div>}
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {filterControls && (
        <ResponsiveDrawer
          isOpen={mobileFilterOpen}
          onClose={() => setMobileFilterOpen(false)}
          title="Filter Records"
          subtitle={activeFilterCount > 0 ? `${activeFilterCount} active filters` : 'Narrow down results'}
          footer={
            <div style={{ display: 'flex', width: '100%', gap: 'var(--space-3)' }}>
              {onResetFilters && (
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    onResetFilters();
                    setMobileFilterOpen(false);
                  }}
                >
                  Reset
                </Button>
              )}
              <Button
                variant="primary"
                fullWidth
                onClick={() => setMobileFilterOpen(false)}
              >
                Apply Filters
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {filterControls}
          </div>
        </ResponsiveDrawer>
      )}
    </div>
  );
};
