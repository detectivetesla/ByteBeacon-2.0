import React from 'react';
import { Input, InputProps } from './Input.js';

export interface AmountInputProps extends Omit<InputProps, 'type' | 'prefixText'> {
  currency?: string;
  minAmount?: number;
  maxAmount?: number;
  quickAmounts?: number[];
  onSelectQuickAmount?: (amount: number) => void;
}

export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  (
    {
      currency = 'GH₵',
      minAmount,
      maxAmount,
      quickAmounts,
      onSelectQuickAmount,
      value,
      onChange,
      placeholder = '0.00',
      hint,
      ...props
    },
    ref,
  ) => {
    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Allow only numbers and at most one decimal point
      if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
        onChange?.(e);
      }
    };

    let computedHint = hint;
    if (!computedHint) {
      if (minAmount !== undefined && maxAmount !== undefined) {
        computedHint = `Min: ${currency} ${minAmount.toFixed(2)} · Max: ${currency} ${maxAmount.toFixed(2)}`;
      } else if (minAmount !== undefined) {
        computedHint = `Minimum: ${currency} ${minAmount.toFixed(2)}`;
      } else if (maxAmount !== undefined) {
        computedHint = `Maximum: ${currency} ${maxAmount.toFixed(2)}`;
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          prefixText={currency}
          value={value}
          onChange={handleNumberChange}
          placeholder={placeholder}
          hint={computedHint}
          {...props}
        />

        {quickAmounts && quickAmounts.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
            {quickAmounts.map((amt) => {
              const isSelected = String(value) === String(amt);
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    onSelectQuickAmount?.(amt);
                    if (onChange) {
                      const syntheticEvent = {
                        target: { value: String(amt) },
                      } as React.ChangeEvent<HTMLInputElement>;
                      onChange(syntheticEvent);
                    }
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected
                      ? '1px solid var(--color-brand)'
                      : '1px solid var(--color-border-default)',
                    backgroundColor: isSelected
                      ? 'var(--color-brand-surface)'
                      : 'var(--color-bg-surface-elevated)',
                    color: isSelected ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                    fontSize: 'var(--font-size-2xs)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                >
                  +{currency} {amt}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);

AmountInput.displayName = 'AmountInput';
