import React from 'react';

export interface Column<T> {
  header: string;
  accessor?: keyof T;
  render?: (row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
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
    }
  | {
      headers: string[];
      children: React.ReactNode;
      columns?: never;
      data?: never;
      keyExtractor?: never;
      onRowClick?: never;
      style?: React.CSSProperties;
    };

export function Table<T = any>(props: TableProps<T>) {
  if ('headers' in props && props.headers) {
    const { headers, children, style } = props;
    return (
      <div style={{ width: '100%', overflowX: 'auto', ...style }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
              {headers.map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
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

  const { columns, data, keyExtractor, onRowClick, style } = props;
  return (
    <div style={{ width: '100%', overflowX: 'auto', ...style }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
            {columns.map((col, i) => (
              <th
                key={i}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
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
