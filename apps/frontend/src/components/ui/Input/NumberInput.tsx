import React from 'react';
import { Input, InputProps } from './Input.js';
import { ChevronUp, ChevronDown } from 'lucide-react';
import styles from './Input.module.css';

export interface NumberInputProps extends Omit<InputProps, 'type' | 'rightIcon'> {
  min?: number;
  max?: number;
  step?: number;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ min = 0, max, step = 1, value, onChange, ...props }, ref) => {
    const numValue = typeof value === 'number' ? value : Number(value) || 0;

    const handleIncrement = () => {
      const nextVal = numValue + step;
      if (max !== undefined && nextVal > max) return;
      if (onChange) {
        const syntheticEvent = {
          target: { value: String(nextVal) },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    };

    const handleDecrement = () => {
      const nextVal = numValue - step;
      if (min !== undefined && nextVal < min) return;
      if (onChange) {
        const syntheticEvent = {
          target: { value: String(nextVal) },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    };

    return (
      <Input
        ref={ref}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        rightIcon={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <button
              type="button"
              tabIndex={-1}
              onClick={handleIncrement}
              className={styles.iconButton}
              style={{ padding: '0 2px' }}
            >
              <ChevronUp size={11} />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={handleDecrement}
              className={styles.iconButton}
              style={{ padding: '0 2px' }}
            >
              <ChevronDown size={11} />
            </button>
          </div>
        }
        {...props}
      />
    );
  },
);

NumberInput.displayName = 'NumberInput';
