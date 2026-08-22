import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface ResponsivePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  style?: React.CSSProperties;
}

export const ResponsivePagination: React.FC<ResponsivePaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
  style,
}) => {
  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <div
      className={`bb-responsive-pagination ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) 0',
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <style>{`
        .bb-pagination-info {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }
        .bb-pagination-controls {
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }
        .bb-pagination-btn {
          min-width: 36px;
          height: 36px;
          padding: 0 0.5rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border-default);
          background-color: var(--color-bg-surface);
          color: var(--color-text-primary);
          font-size: var(--font-size-xs);
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .bb-pagination-btn:hover:not(:disabled) {
          border-color: var(--color-border-hover);
          background-color: var(--color-bg-surface-elevated);
        }
        .bb-pagination-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .bb-pagination-btn.active {
          background-color: var(--color-brand);
          color: #FFFFFF;
          border-color: var(--color-brand);
        }
        @media (max-width: 639px) {
          .bb-pagination-desktop-numbers {
            display: none !important;
          }
          .bb-pagination-page-size {
            display: none !important;
          }
          .bb-pagination-btn {
            min-width: 44px;
            height: 44px;
          }
        }
      `}</style>

      {/* Item summary info */}
      <div className="bb-pagination-info">
        {totalItems !== undefined ? (
          <span>
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong>{Math.min(currentPage * pageSize, totalItems)}</strong> of{' '}
            <strong>{totalItems}</strong> records
          </span>
        ) : (
          <span>Page <strong>{currentPage}</strong> of <strong>{totalPages || 1}</strong></span>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="bb-pagination-controls">
        {/* First Page (Desktop only) */}
        <button
          type="button"
          className="bb-pagination-btn bb-pagination-desktop-numbers"
          onClick={() => onPageChange(1)}
          disabled={!canPrev}
          title="First page"
        >
          <ChevronsLeft size={16} />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          className="bb-pagination-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canPrev}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
          <span style={{ marginLeft: '4px', fontSize: '11px' }}>Prev</span>
        </button>

        {/* Current page indicator on mobile */}
        <span
          style={{
            padding: '0 0.5rem',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
          }}
        >
          {currentPage} / {totalPages || 1}
        </span>

        {/* Next Page */}
        <button
          type="button"
          className="bb-pagination-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canNext}
          aria-label="Next page"
        >
          <span style={{ marginRight: '4px', fontSize: '11px' }}>Next</span>
          <ChevronRight size={16} />
        </button>

        {/* Last Page (Desktop only) */}
        <button
          type="button"
          className="bb-pagination-btn bb-pagination-desktop-numbers"
          onClick={() => onPageChange(totalPages)}
          disabled={!canNext}
          title="Last page"
        >
          <ChevronsRight size={16} />
        </button>

        {/* Page size selector if enabled */}
        {onPageSizeChange && (
          <div className="bb-pagination-page-size" style={{ marginLeft: 'var(--space-2)' }}>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                height: '36px',
                padding: '0 0.5rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};
