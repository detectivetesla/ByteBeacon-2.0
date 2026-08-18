import React, { useState, useRef, useEffect } from 'react';
import { SelectOption } from './Select.js';
import styles from './Select.module.css';
import { ChevronDown, Search, Check, AlertCircle, X } from 'lucide-react';

export interface MultiSelectProps {
  label?: string;
  options: SelectOption[];
  value?: (string | number)[];
  onChange?: (values: (string | number)[]) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  options = [],
  value = [],
  onChange,
  placeholder = 'Select options...',
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

  const selectedOptions = options.filter((o) => value.includes(o.value));

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

  const handleToggle = (val: string | number) => {
    if (value.includes(val)) {
      onChange?.(value.filter((v) => v !== val));
    } else {
      onChange?.([...value, val]);
    }
  };

  const handleRemove = (val: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(value.filter((v) => v !== val));
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
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          style={{
            width: '100%',
            minHeight: '42px',
            padding: '0.35rem 0.65rem',
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
            gap: '0.5rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: isOpen
              ? '0 0 0 3px rgba(0, 102, 255, 0.16)'
              : '0 1px 2px rgba(0, 0, 0, 0.04)',
            transition: 'all 120ms ease',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flex: 1 }}>
            {selectedOptions.length > 0 ? (
              selectedOptions.map((opt) => (
                <span
                  key={opt.value}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: 'rgba(0, 102, 255, 0.1)',
                    color: 'var(--color-primary)',
                    fontSize: 'var(--font-size-2xs)',
                    fontWeight: 700,
                  }}
                >
                  <span>{opt.label}</span>
                  {!disabled && (
                    <span
                      onClick={(e) => handleRemove(opt.value, e)}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <X size={10} />
                    </span>
                  )}
                </span>
              ))
            ) : (
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                {placeholder}
              </span>
            )}
          </div>

          <ChevronDown
            size={16}
            color="var(--color-text-muted)"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms ease',
              flexShrink: 0,
            }}
          />
        </div>

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
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '4px' }}>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => {
                  const isSelected = value.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => handleToggle(opt.value)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.45rem 0.65rem',
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
                      }}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check size={14} color="var(--color-primary)" />}
                    </button>
                  );
                })
              ) : (
                <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                  No options
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
