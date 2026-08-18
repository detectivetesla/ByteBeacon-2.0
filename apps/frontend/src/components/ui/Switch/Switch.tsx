import React, { useId } from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: string;
  disabled?: boolean;
  id?: string;
  style?: React.CSSProperties;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
  style,
}) => {
  const generatedId = useId();
  const switchId = id || generatedId;

  return (
    <label
      htmlFor={switchId}
      style={{
        display: 'inline-flex',
        alignItems: description ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: '12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        userSelect: 'none',
        ...style,
      }}
    >
      {(label || description) && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {label && (
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {label}
            </span>
          )}
          {description && (
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {description}
            </span>
          )}
        </div>
      )}

      <div style={{ position: 'relative', width: '38px', height: '22px', flexShrink: 0, marginTop: description ? '2px' : 0 }}>
        <input
          type="checkbox"
          id={switchId}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
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
            width: '38px',
            height: '22px',
            borderRadius: '11px',
            backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-bg-surface-elevated)',
            border: checked ? '1px solid var(--color-primary)' : '1px solid var(--color-border-default)',
            transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: checked ? '0 1px 4px rgba(0, 102, 255, 0.25)' : 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '3px',
            left: checked ? '19px' : '3px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
            transition: 'left 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </label>
  );
};
