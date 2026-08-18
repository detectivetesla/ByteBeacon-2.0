import React, { useState, useRef, useEffect } from 'react';
import { SelectOption } from './Select.js';
import styles from './Select.module.css';
import { ChevronDown, Search, Check, AlertCircle, X } from 'lucide-react';

export interface SearchableSelectProps {
  label?: string;
  options: SelectOption[];
  value?: string | number;
  onChange?: (val: string | number) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Select an option...',
  error,
  hint,
  required,
  optional,
  disabled = false,
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => String(o.value) === String(value));

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSelect = (val: string | number) => {
    onChange?.(val);
    setIsOpen(false);
  };

  return (
    <div className={styles.wrapper} style={style} ref={containerRef}>
      {label && (
        <div className={styles.labelRow}>
          <label className={styles.label}>
            <span>{label}</span>
            {required && <span className={styles.required}>*</span>}
          </label>
          {optional && !required && <span className={styles.optionalBadge}>Optional</span>}
        </div>
      )}

      <div style={{ position: 'relative', width: '100%' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '100%',
            minHeight: '42px',
            padding: '0.55rem 0.75rem',
            fontFamily: 'inherit',
            fontSize: 'var(--font-size-sm)',
            color: selectedOption ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            backgroundColor: 'var(--color-bg-surface-elevated)',
            border: error
              ? '1px solid var(--color-danger)'
              : isOpen
              ? '1px solid var(--color-primary)'
              : '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: isOpen
              ? '0 0 0 3px rgba(0, 102, 255, 0.16)'
              : '0 1px 2px rgba(0, 0, 0, 0.04)',
            transition: 'all 120ms ease',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            size={16}
            color="var(--color-text-muted)"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms ease',
              flexShrink: 0,
            }}
          />
        </button>

        {isOpen && !disabled && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              zIndex: 50,
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-tactile-lg)',
              maxHeight: '260px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Search filter input inside dropdown */}
            <div
              style={{
                padding: '6px 8px',
                borderBottom: '1px solid var(--color-border-default)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--color-bg-surface-elevated)',
              }}
            >
              <Search size={14} color="var(--color-text-muted)" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-xs)',
                  outline: 'none',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Options list */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '4px' }}>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => {
                  const isSelected = String(opt.value) === String(value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt.value)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.5rem 0.75rem',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: isSelected ? 800 : 500,
                        color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                        backgroundColor: isSelected
                          ? 'rgba(0, 102, 255, 0.08)'
                          : 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: opt.disabled ? 'not-allowed' : 'pointer',
                        opacity: opt.disabled ? 0.5 : 1,
                      }}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check size={14} color="var(--color-primary)" />}
                    </button>
                  );
                })
              ) : (
                <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                  No matching options
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error ? (
        <span className={styles.errorText} role="alert">
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </span>
      ) : hint ? (
        <span className={styles.helperText}>{hint}</span>
      ) : null}
    </div>
  );
};
