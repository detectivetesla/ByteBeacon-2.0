import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ResponsiveDrawer } from './ResponsiveDrawer.js';

export interface ResponsiveTableColumn<T> {
  header: string;
  accessor?: keyof T;
  render?: (row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  priority?: 'always' | 'secondary' | 'expandable';
  mobileLabel?: string;
  hideOnMobile?: boolean;
}

export interface ResponsiveTableProps<T = any> {
  columns: ResponsiveTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  enableCardView?: boolean;
  cardTitle?: (row: T) => React.ReactNode;
  cardSubtitle?: (row: T) => React.ReactNode;
  cardBadge?: (row: T) => React.ReactNode;
  cardActions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  expandableDetail?: (row: T) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function ResponsiveTable<T = any>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  enableCardView = true,
  cardTitle,
  cardSubtitle,
  cardBadge,
  cardActions,
  emptyMessage = 'No records found',
  emptyIcon,
  expandableDetail,
  className = '',
  style,
}: ResponsiveTableProps<T>) {
  const [inspectRow, setInspectRow] = useState<T | null>(null);
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRowIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (data.length === 0) {
    return (
      <div
        className={`bb-table-empty ${className}`}
        style={{
          padding: 'var(--space-10) var(--space-4)',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: 'var(--font-size-sm)',
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px dashed var(--color-border-default)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-3)',
          width: '100%',
          boxSizing: 'border-box',
          ...style,
        }}
      >
        {emptyIcon && <div style={{ opacity: 0.6 }}>{emptyIcon}</div>}
        <span>{emptyMessage}</span>
      </div>
    );
  }

  const primaryCol = columns.find((c) => c.priority === 'always') || columns[0];
  const secondaryCols = columns.filter((c) => c !== primaryCol && c.priority !== 'expandable' && !c.hideOnMobile);
  const expandableCols = columns.filter((c) => c.priority === 'expandable');

  return (
    <div className={`bb-responsive-table-wrapper ${className}`} style={{ width: '100%', ...style }}>
      <style>{`
        .bb-table-desktop-view {
          display: block;
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          background-color: var(--color-bg-surface);
          border-radius: var(--radius-xl);
          border: 1px solid var(--color-border-default);
          box-shadow: var(--shadow-tactile-sm);
        }
        .bb-table-desktop-view table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .bb-table-desktop-view th {
          padding: var(--space-3) var(--space-4);
          font-size: var(--font-size-xs);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--color-text-secondary);
          border-bottom: 1px solid var(--color-border-default);
          background-color: var(--color-bg-surface-elevated);
          white-space: nowrap;
        }
        .bb-table-desktop-view td {
          padding: var(--space-3) var(--space-4);
          font-size: var(--font-size-xs);
          color: var(--color-text-primary);
          border-bottom: 1px solid var(--color-border-subtle);
        }
        .bb-table-desktop-view tr:last-child td {
          border-bottom: none;
        }
        .bb-table-desktop-view tbody tr:hover {
          background-color: var(--color-bg-surface-elevated);
        }
        .bb-table-mobile-cards-view {
          display: none;
        }
        @media (max-width: 767px) {
          ${
            enableCardView
              ? `
            .bb-table-desktop-view { display: none !important; }
            .bb-table-mobile-cards-view {
              display: flex !important;
              flex-direction: column;
              gap: var(--space-3);
              width: 100%;
            }
          `
              : `
            .bb-table-desktop-view table { min-width: 640px; }
          `
          }
        }
      `}</style>

      {/* 1. Desktop Table View */}
      <div className="bb-table-desktop-view">
        <table>
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  style={{
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
            {data.map((row) => {
              const rowKey = keyExtractor(row);
              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick && onRowClick(row)}
                  style={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background-color var(--transition-fast)',
                  }}
                >
                  {columns.map((col, cIdx) => (
                    <td
                      key={cIdx}
                      style={{
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
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 2. Mobile Responsive Cards View */}
      {enableCardView && (
        <div className="bb-table-mobile-cards-view">
          {data.map((row) => {
            const rowKey = keyExtractor(row);
            const isExpanded = !!expandedRowIds[rowKey];

            return (
              <div
                key={rowKey}
                onClick={() => onRowClick && onRowClick(row)}
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-4)',
                  boxShadow: 'var(--shadow-tactile-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                  cursor: onRowClick ? 'pointer' : 'default',
                  boxSizing: 'border-box',
                }}
              >
                {/* Card Top: Primary Title + Badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-display)',
                        overflowWrap: 'break-word',
                      }}
                    >
                      {cardTitle
                        ? cardTitle(row)
                        : primaryCol.render
                        ? primaryCol.render(row)
                        : primaryCol.accessor
                        ? String(row[primaryCol.accessor] ?? '')
                        : null}
                    </div>
                    {cardSubtitle && (
                      <div
                        style={{
                          fontSize: 'var(--font-size-2xs)',
                          color: 'var(--color-text-secondary)',
                          marginTop: '0.15rem',
                          overflowWrap: 'break-word',
                        }}
                      >
                        {cardSubtitle(row)}
                      </div>
                    )}
                  </div>

                  {cardBadge && <div style={{ flexShrink: 0 }}>{cardBadge(row)}</div>}
                </div>

                {/* Key-Value Attributes Grid */}
                {secondaryCols.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '0.5rem var(--space-3)',
                      padding: 'var(--space-2) 0',
                      borderTop: '1px solid var(--color-border-subtle)',
                      borderBottom: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    {secondaryCols.map((col, idx) => (
                      <div key={idx} style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          {col.mobileLabel || col.header}
                        </span>
                        <span
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 500,
                            color: 'var(--color-text-primary)',
                            marginTop: '1px',
                            overflowWrap: 'break-word',
                          }}
                        >
                          {col.render
                            ? col.render(row)
                            : col.accessor
                            ? String(row[col.accessor] ?? '')
                            : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expanded Details Accordion */}
                {(isExpanded || expandableCols.length > 0) && isExpanded && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.375rem',
                      padding: 'var(--space-2) 0',
                      backgroundColor: 'var(--color-bg-surface-elevated)',
                      borderRadius: 'var(--radius-md)',
                      paddingInline: 'var(--space-3)',
                    }}
                  >
                    {expandableCols.map((col, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                          {col.mobileLabel || col.header}:
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-primary)', textAlign: 'right' }}>
                          {col.render
                            ? col.render(row)
                            : col.accessor
                            ? String(row[col.accessor] ?? '')
                            : '—'}
                        </span>
                      </div>
                    ))}
                    {expandableDetail && <div>{expandableDetail(row)}</div>}
                  </div>
                )}

                {/* Card Bottom Row: Expand trigger + Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: 'var(--space-1)' }}>
                  {expandableCols.length > 0 || expandableDetail ? (
                    <button
                      type="button"
                      onClick={(e) => toggleExpand(rowKey, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-brand)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        padding: '4px 0',
                      }}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={14} /> Less Details
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} /> More Details
                        </>
                      )}
                    </button>
                  ) : (
                    <div />
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {cardActions && cardActions(row)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Row Inspection Drawer if active */}
      {inspectRow && (
        <ResponsiveDrawer
          isOpen={!!inspectRow}
          onClose={() => setInspectRow(null)}
          title="Record Details"
        >
          {expandableDetail ? expandableDetail(inspectRow) : null}
        </ResponsiveDrawer>
      )}
    </div>
  );
}
