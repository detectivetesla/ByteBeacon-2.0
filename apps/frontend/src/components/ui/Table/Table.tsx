import React from 'react';

export interface Column<T> {
  header: string | React.ReactNode;
  accessor?: keyof T;
  render?: (row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  mobileLabel?: string;
  hideOnMobile?: boolean;
}

export type TableProps<T = any> =
  | {
      columns: Column<T>[];
      data: T[];
      keyExtractor: (row: T) => string;
      onRowClick?: (row: T) => void;
      headers?: never;
      children?: never;
      style?: React.CSSProperties;
      enableCardView?: boolean;
      emptyMessage?: string;
      emptyText?: string;
    }
  | {
      headers: (string | React.ReactNode)[];
      children: React.ReactNode;
      columns?: never;
      data?: never;
      keyExtractor?: never;
      onRowClick?: never;
      style?: React.CSSProperties;
      enableCardView?: boolean;
      emptyMessage?: string;
      emptyText?: string;
    };

export function Table<T = any>(props: TableProps<T>) {
  if ('headers' in props && props.headers) {
    const { headers, children, style } = props;
    return (
      <div
        style={{
          width: '100%',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          borderRadius: 'var(--radius-lg)',
          ...style,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
              {headers.map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    );
  }

  const { columns, data, keyExtractor, onRowClick, style, enableCardView = true, emptyMessage, emptyText } = props;
  const resolvedEmpty = emptyText || emptyMessage || 'No records found';

  if (data.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-8) var(--space-4)',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: 'var(--font-size-sm)',
          backgroundColor: 'var(--color-bg-surface-elevated)',
          borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--color-border-default)',
          ...style,
        }}
      >
        {resolvedEmpty}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', ...style }}>
      <style>{`
        .bb-table-desktop {
          display: block;
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .bb-table-mobile-cards {
          display: none;
        }
        @media (max-width: 767px) {
          ${enableCardView ? `
            .bb-table-desktop { display: none !important; }
            .bb-table-mobile-cards {
              display: flex !important;
              flex-direction: column;
              gap: var(--space-3);
              width: 100%;
            }
          ` : `
            .bb-table-desktop table { min-width: 640px; }
          `}
        }
      `}</style>

      {/* Desktop Table View */}
      <div className="bb-table-desktop">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
              {columns.map((col, i) => (
                <th
                  key={i}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--color-text-secondary)',
                    width: col.width,
                    textAlign: col.align || 'left',
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                style={{
                  borderBottom: '1px solid var(--color-border-subtle)',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  if (onRowClick) e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  if (onRowClick) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {columns.map((col, i) => (
                  <td
                    key={i}
                    style={{
                      padding: 'var(--space-4)',
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-primary)',
                      textAlign: col.align || 'left',
                    }}
                  >
                    {col.render
                      ? col.render(row)
                      : col.accessor
                      ? String(row[col.accessor] ?? '')
                      : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Structured Card View */}
      {enableCardView && (
        <div className="bb-table-mobile-cards">
          {data.map((row) => (
            <div
              key={keyExtractor(row)}
              onClick={() => onRowClick?.(row)}
              style={{
                backgroundColor: 'var(--color-bg-surface-elevated)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
                boxShadow: 'var(--shadow-tactile-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'border-color var(--transition-fast), background-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                if (onRowClick) e.currentTarget.style.borderColor = 'var(--color-brand)';
              }}
              onMouseLeave={(e) => {
                if (onRowClick) e.currentTarget.style.borderColor = 'var(--color-border-default)';
              }}
            >
              {columns
                .filter((col) => !col.hideOnMobile)
                .map((col, idx) => {
                  const content = col.render
                    ? col.render(row)
                    : col.accessor
                    ? String(row[col.accessor] ?? '')
                    : null;

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        paddingBottom: idx < columns.length - 1 ? '0.35rem' : 0,
                        borderBottom: idx < columns.length - 1 ? '1px dashed var(--color-border-subtle)' : 'none',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 'var(--font-size-3xs)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {col.mobileLabel || col.header}
                      </span>
                      <div
                        style={{
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 600,
                          color: 'var(--color-text-primary)',
                          textAlign: 'right',
                        }}
                      >
                        {content}
                      </div>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
  style?: React.CSSProperties;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  style,
}) => {
  if (totalPages <= 1 && (!totalItems || totalItems <= 10)) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-4) 0',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-secondary)',
        ...style,
      }}
    >
      <span>
        Page {currentPage} of {totalPages || 1}
        {totalItems !== undefined && ` (${totalItems} total)`}
      </span>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          style={{
            padding: '0.375rem 0.75rem',
            backgroundColor: 'var(--color-bg-surface-elevated)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-sm)',
            color: currentPage <= 1 ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
          }}
        >
          Previous
        </button>

        <button
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          style={{
            padding: '0.375rem 0.75rem',
            backgroundColor: 'var(--color-bg-surface-elevated)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-sm)',
            color: currentPage >= totalPages ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
};
