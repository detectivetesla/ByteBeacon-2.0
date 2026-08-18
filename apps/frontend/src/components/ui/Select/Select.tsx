import React, { useId } from 'react';
import styles from './Select.module.css';
import { AlertCircle } from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  options?: SelectOption[];
  error?: string;
  hint?: string;
  helperText?: string;
  optional?: boolean;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      options = [],
      error,
      hint,
      helperText,
      optional,
      placeholder,
      id,
      className = '',
      style,
      required,
      children,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const selectId = id || (label ? `select_${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : generatedId);
    const errorId = `${selectId}-error`;
    const hintId = `${selectId}-hint`;
    const displayHint = hint || helperText;

    return (
      <div className={styles.wrapper} style={style}>
        {label && (
          <div className={styles.labelRow}>
            <label htmlFor={selectId} className={styles.label}>
              <span>{label}</span>
              {required && <span className={styles.required}>*</span>}
            </label>
            {optional && !required && <span className={styles.optionalBadge}>Optional</span>}
          </div>
        )}

        <div className={styles.selectWrapper}>
          <select
            ref={ref}
            id={selectId}
            required={required}
            className={`${styles.select} ${error ? styles.error : ''} ${className}`.trim()}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : displayHint ? hintId : undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.length > 0
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
        </div>

        {error ? (
          <span id={errorId} className={styles.errorText} role="alert">
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </span>
        ) : displayHint ? (
          <span id={hintId} className={styles.helperText}>
            {displayHint}
          </span>
        ) : null}
      </div>
    );
  },
);

Select.displayName = 'Select';
