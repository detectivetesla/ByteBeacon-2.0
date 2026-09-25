import React from 'react';
import styles from './FilterBar.module.css';
import { SearchInput } from '../Input/SearchInput.js';
import { Select, SelectOption } from '../Select/Select.js';
import { Button } from '../Button/Button.js';
import { Filter, X, RotateCcw } from 'lucide-react';

export interface FilterBarProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const FilterBar: React.FC<FilterBarProps> & {
  Search: typeof FilterBarSearch;
  Select: typeof FilterBarSelect;
  PresetGroup: typeof FilterBarPresetGroup;
  Actions: typeof FilterBarActions;
  Clear: typeof FilterBarClear;
  DrawerTrigger: typeof FilterBarDrawerTrigger;
  Chips: typeof FilterBarChips;
} = ({ children, className = '', style }) => {
  return (
    <div className={`${styles.filterBar} ${className}`.trim()} style={style}>
      {children}
    </div>
  );
};

/* --- FilterBar.Search --- */
export interface FilterBarSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const FilterBarSearch: React.FC<FilterBarSearchProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  className = '',
  style,
}) => {
  return (
    <div className={`${styles.searchWrap} ${className}`.trim()} style={style}>
      <SearchInput
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        debounceMs={debounceMs}
        onClear={() => onChange('')}
      />
    </div>
  );
};

/* --- FilterBar.Select --- */
export interface FilterBarSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: (SelectOption | { label: string; value: string | number })[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const FilterBarSelect: React.FC<FilterBarSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  className = '',
  style,
}) => {
  return (
    <div className={`${styles.controlItem} ${className}`.trim()} style={style}>
      <Select
        size="sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={options}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </div>
  );
};

/* --- FilterBar.PresetGroup --- */
export interface PresetOption {
  id: string;
  label: string;
}

export interface FilterBarPresetGroupProps {
  value: string;
  onChange: (presetId: string) => void;
  presets: PresetOption[];
  className?: string;
  style?: React.CSSProperties;
}

export const FilterBarPresetGroup: React.FC<FilterBarPresetGroupProps> = ({
  value,
  onChange,
  presets,
  className = '',
  style,
}) => {
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-sm)',
        padding: '2px',
        height: '36px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {presets.map((p) => {
        const isSelected = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            style={{
              padding: '0.2rem 0.55rem',
              borderRadius: 'var(--radius-xs)',
              border: 'none',
              backgroundColor: isSelected ? 'var(--color-brand-surface)' : 'transparent',
              color: isSelected ? 'var(--color-brand)' : 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-2xs)',
              fontWeight: isSelected ? 700 : 500,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              whiteSpace: 'nowrap',
              height: '28px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
};

/* --- FilterBar.Actions --- */
export const FilterBarActions: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => {
  return (
    <div className={styles.actionsGroup} style={style}>
      {children}
    </div>
  );
};

/* --- FilterBar.Clear --- */
export interface FilterBarClearProps {
  onClear: () => void;
  activeCount?: number;
  label?: string;
}

export const FilterBarClear: React.FC<FilterBarClearProps> = ({
  onClear,
  activeCount = 0,
  label = 'Clear all',
}) => {
  if (activeCount === 0) return null;

  return (
    <button type="button" onClick={onClear} className={styles.clearButton}>
      <RotateCcw size={12} />
      <span>{label}</span>
      {activeCount > 0 && <span className={styles.filterBadge}>{activeCount}</span>}
    </button>
  );
};

/* --- FilterBar.DrawerTrigger --- */
export interface FilterBarDrawerTriggerProps {
  onClick: () => void;
  activeCount?: number;
  label?: string;
}

export const FilterBarDrawerTrigger: React.FC<FilterBarDrawerTriggerProps> = ({
  onClick,
  activeCount = 0,
  label = 'Filters',
}) => {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      leftIcon={<Filter size={13} />}
      style={{ height: '36px' }}
    >
      <span>{label}</span>
      {activeCount > 0 && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '16px',
            height: '16px',
            padding: '0 4px',
            fontSize: 'var(--font-size-3xs)',
            fontWeight: 700,
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-brand)',
            color: '#FFFFFF',
            marginLeft: '0.25rem',
          }}
        >
          {activeCount}
        </span>
      )}
    </Button>
  );
};

/* --- FilterBar.Chips --- */
export interface FilterChipItem {
  id: string;
  label: string;
  valueDisplay: string;
  onRemove: () => void;
}

export const FilterBarChips: React.FC<{
  chips: FilterChipItem[];
  onClearAll?: () => void;
  style?: React.CSSProperties;
}> = ({ chips, onClearAll, style }) => {
  if (chips.length === 0) return null;

  return (
    <div className={styles.chipsRow} style={style}>
      <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
        Active filters:
      </span>
      {chips.map((c) => (
        <span key={c.id} className={styles.chip} onClick={c.onRemove} title="Click to remove">
          <span>
            {c.label}: <strong>{c.valueDisplay}</strong>
          </span>
          <span className={styles.chipClose}>
            <X size={11} />
          </span>
        </span>
      ))}
      {onClearAll && chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 'var(--font-size-2xs)',
            color: 'var(--color-brand)',
            cursor: 'pointer',
            fontWeight: 600,
            padding: '0 0.25rem',
          }}
        >
          Clear all
        </button>
      )}
    </div>
  );
};

// Assign subcomponents
FilterBar.Search = FilterBarSearch;
FilterBar.Select = FilterBarSelect;
FilterBar.PresetGroup = FilterBarPresetGroup;
FilterBar.Actions = FilterBarActions;
FilterBar.Clear = FilterBarClear;
FilterBar.DrawerTrigger = FilterBarDrawerTrigger;
FilterBar.Chips = FilterBarChips;
