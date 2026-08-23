import React, { useState } from 'react';
import { Input, InputProps } from './Input.js';
import { Eye, EyeOff, Lock, AlertTriangle, Check, ShieldCheck } from 'lucide-react';
import { validatePassword } from '../../../utils/password.js';
import styles from './Input.module.css';

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'leftIcon' | 'rightIcon'> {
  showStrengthMeter?: boolean;
  showIcon?: boolean;
  showRequirements?: boolean;
  requirementsTitle?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      showStrengthMeter = false,
      showIcon = true,
      showRequirements = false,
      requirementsTitle = 'Password requirements:',
      value,
      onChange,
      ...props
    },
    ref,
  ) => {
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

    // Calculate password validation & strength
    const passwordStr = typeof value === 'string' ? value : '';
    const { score, strength, rules } = validatePassword(passwordStr);

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
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  style={{
                    flex: 1,
                    height: '100%',
                    borderRadius: '2px',
                    backgroundColor:
                      score >= step ? strength.color : 'var(--color-bg-surface-elevated)',
                    transition: 'background-color 150ms ease',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: strength.color, fontWeight: 700 }}>
                {strength.label}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                {score}/5 criteria met
              </span>
            </div>
          </div>
        )}

        {showRequirements && (
          <div
            style={{
              marginTop: '4px',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm, 6px)',
              backgroundColor: 'var(--color-bg-surface-elevated)',
              border: '1px solid var(--color-border-default)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--color-text-secondary)',
              }}
            >
              <ShieldCheck size={13} color="var(--color-primary)" />
              <span>{requirementsTitle}</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
                gap: '4px 8px',
              }}
            >
              {rules.map((rule) => {
                const isPassed = rule.passed;
                const isTyping = passwordStr.length > 0;

                return (
                  <div
                    key={rule.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      color: isPassed
                        ? 'var(--color-success)'
                        : isTyping
                        ? 'var(--color-text-muted)'
                        : 'var(--color-text-secondary)',
                      fontWeight: isPassed ? 600 : 500,
                      transition: 'color 150ms ease',
                    }}
                  >
                    {isPassed ? (
                      <Check size={12} strokeWidth={3} color="var(--color-success)" style={{ flexShrink: 0 }} />
                    ) : (
                      <div
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--color-text-muted)',
                          opacity: 0.6,
                          marginLeft: '3px',
                          marginRight: '4px',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span>{rule.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
