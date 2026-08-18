import React, { useId } from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: string;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, error, checked, disabled, id, onChange, style, ...props }, ref) => {
    const generatedId = useId();
    const checkboxId = id || generatedId;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...style }}>
        <label
          htmlFor={checkboxId}
          style={{
            display: 'inline-flex',
            alignItems: description ? 'flex-start' : 'center',
            gap: '8px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.55 : 1,
            userSelect: 'none',
          }}
        >
          <div style={{ position: 'relative', width: '18px', height: '18px', marginTop: description ? '2px' : 0 }}>
            <input
              ref={ref}
              type="checkbox"
              id={checkboxId}
              checked={checked}
              disabled={disabled}
              onChange={onChange}
              style={{
                position: 'absolute',
                opacity: 0,
                width: 0,
                height: 0,
                margin: 0,
              }}
              {...props}
            />
            <div
              style={{
                width: '18px',
                height: '18px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: checked
                  ? 'var(--color-primary)'
                  : 'var(--color-bg-surface-elevated)',
                border: error
                  ? '1px solid var(--color-danger)'
                  : checked
                  ? '1px solid var(--color-primary)'
                  : '1px solid var(--color-border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 120ms ease',
                boxShadow: checked ? '0 1px 3px rgba(0, 102, 255, 0.25)' : 'none',
              }}
            >
              {checked && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {label && (
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {label}
              </span>
            )}
            {description && (
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', marginTop: '1px' }}>
                {description}
              </span>
            )}
          </div>
        </label>

        {error && (
          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-danger)', fontWeight: 600, marginLeft: '26px' }}>
            {error}
          </span>
        )}
      </div>
    );
  },
);

Checkbox.displayName = 'Checkbox';
