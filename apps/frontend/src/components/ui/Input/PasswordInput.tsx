import React, { useState } from 'react';
import { Input, InputProps } from './Input.js';
import { Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react';
import styles from './Input.module.css';

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'leftIcon' | 'rightIcon'> {
  showStrengthMeter?: boolean;
  showIcon?: boolean;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ showStrengthMeter = false, showIcon = true, value, onChange, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [capsLockActive, setCapsLockActive] = useState(false);

    // Caps lock detection
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.getModifierState) {
        setCapsLockActive(e.getModifierState('CapsLock'));
      }
      props.onKeyDown?.(e);
    };

    const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.getModifierState) {
        setCapsLockActive(e.getModifierState('CapsLock'));
      }
      props.onKeyUp?.(e);
    };

    // Calculate password strength
    const passwordStr = typeof value === 'string' ? value : '';
    let strengthScore = 0;
    if (passwordStr.length >= 8) strengthScore++;
    if (/[A-Z]/.test(passwordStr)) strengthScore++;
    if (/[0-9]/.test(passwordStr)) strengthScore++;
    if (/[^A-Za-z0-9]/.test(passwordStr)) strengthScore++;

    const getStrengthLabel = (score: number) => {
      if (score <= 1) return { label: 'Weak', color: 'var(--color-danger)' };
      if (score === 2) return { label: 'Fair', color: '#F59E0B' };
      if (score === 3) return { label: 'Good', color: '#3B82F6' };
      return { label: 'Strong password', color: 'var(--color-success)' };
    };

    const strength = getStrengthLabel(strengthScore);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
        <Input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          leftIcon={showIcon ? <Lock size={15} color="var(--color-text-muted)" /> : undefined}
          rightIcon={
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              className={styles.iconButton}
              title={showPassword ? 'Hide password' : 'Show password'}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          autoComplete={props.autoComplete || 'current-password'}
          {...props}
        />

        {capsLockActive && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: 'var(--font-size-3xs)',
              color: '#F59E0B',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
            }}
          >
            <AlertTriangle size={11} />
            <span>Caps Lock is ON</span>
          </div>
        )}

        {showStrengthMeter && passwordStr.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
            <div style={{ display: 'flex', gap: '3px', width: '100%', height: '4px' }}>
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  style={{
                    flex: 1,
                    height: '100%',
                    borderRadius: '2px',
                    backgroundColor:
                      strengthScore >= step ? strength.color : 'var(--color-bg-surface-elevated)',
                    transition: 'background-color 150ms ease',
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: '10px', color: strength.color, fontWeight: 700 }}>
              {strength.label}
            </span>
          </div>
        )}
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
