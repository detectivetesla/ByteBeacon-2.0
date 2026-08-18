import React, { useId } from 'react';

export interface RadioOption {
  label: React.ReactNode;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name?: string;
  label?: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  hint?: string;
  orientation?: 'horizontal' | 'vertical';
  style?: React.CSSProperties;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  label,
  options,
  value,
  onChange,
  error,
  hint,
  orientation = 'vertical',
  style,
}) => {
  const generatedName = useId();
  const groupName = name || generatedName;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', ...style }}>
      {label && (
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {label}
        </span>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: orientation === 'vertical' ? 'column' : 'row',
          gap: orientation === 'vertical' ? '8px' : '16px',
          flexWrap: 'wrap',
        }}
      >
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <label
              key={opt.value}
              style={{
                display: 'inline-flex',
                alignItems: opt.description ? 'flex-start' : 'center',
                gap: '8px',
                cursor: opt.disabled ? 'not-allowed' : 'pointer',
                opacity: opt.disabled ? 0.55 : 1,
                userSelect: 'none',
              }}
            >
              <div style={{ position: 'relative', width: '18px', height: '18px', marginTop: opt.description ? '2px' : 0 }}>
                <input
                  type="radio"
                  name={groupName}
                  value={opt.value}
                  checked={isSelected}
                  disabled={opt.disabled}
                  onChange={() => onChange?.(opt.value)}
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    width: 0,
                    height: 0,
                    margin: 0,
                  }}
                />
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-bg-surface-elevated)',
                    border: isSelected
                      ? '5px solid var(--color-primary)'
                      : error
                      ? '1px solid var(--color-danger)'
                      : '1px solid var(--color-border-default)',
                    transition: 'all 120ms ease',
                    boxShadow: isSelected ? '0 1px 3px rgba(0, 102, 255, 0.25)' : 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {opt.label}
                </span>
                {opt.description && (
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', marginTop: '1px' }}>
                    {opt.description}
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {error ? (
        <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-danger)', fontWeight: 600 }}>
          {error}
        </span>
      ) : hint ? (
        <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
};
