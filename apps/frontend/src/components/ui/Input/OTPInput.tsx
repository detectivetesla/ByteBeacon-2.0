import React, { useRef, useState, useEffect } from 'react';
import { FormField } from './Input.js';

export interface OTPInputProps {
  length?: number;
  value?: string;
  onChange?: (otp: string) => void;
  onComplete?: (otp: string) => void;
  label?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  value = '',
  onChange,
  onComplete,
  label = 'Verification Code',
  error,
  hint,
  disabled = false,
}) => {
  const [digits, setDigits] = useState<string[]>(() => {
    const arr = Array(length).fill('');
    for (let i = 0; i < Math.min(value.length, length); i++) {
      arr[i] = value[i];
    }
    return arr;
  });

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const arr = Array(length).fill('');
    for (let i = 0; i < Math.min(value.length, length); i++) {
      arr[i] = value[i];
    }
    setDigits(arr);
  }, [value, length]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (!val) {
      const newDigits = [...digits];
      newDigits[index] = '';
      setDigits(newDigits);
      const combined = newDigits.join('');
      onChange?.(combined);
      return;
    }

    const digit = val[val.length - 1]; // Last entered digit
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    const combined = newDigits.join('');
    onChange?.(combined);

    if (combined.length === length && !newDigits.includes('')) {
      onComplete?.(combined);
    } else if (index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text/plain').replace(/[^0-9]/g, '').slice(0, length);
    if (!pasted) return;

    const newDigits = Array(length).fill('');
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);
    const combined = newDigits.join('');
    onChange?.(combined);

    if (pasted.length === length) {
      onComplete?.(combined);
      inputsRef.current[length - 1]?.focus();
    } else {
      inputsRef.current[pasted.length]?.focus();
    }
  };

  return (
    <FormField label={label} error={error} hint={hint}>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
        }}
      >
        {digits.map((digit, idx) => {
          const isFilled = Boolean(digit);
          return (
            <input
              key={idx}
              ref={(el) => (inputsRef.current[idx] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              disabled={disabled}
              onChange={(e) => handleChange(idx, e)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              onPaste={handlePaste}
              style={{
                width: '42px',
                height: '48px',
                textAlign: 'center',
                fontSize: 'var(--font-size-lg)',
                fontWeight: 900,
                fontFamily: 'var(--font-mono)',
                backgroundColor: 'var(--color-bg-surface-elevated)',
                border: error
                  ? '1.5px solid var(--color-danger)'
                  : isFilled
                  ? '1.5px solid var(--color-brand)'
                  : '1.5px solid var(--color-border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-primary)',
                caretColor: 'var(--color-brand-bright)',
                outline: 'none',
                boxShadow: error
                  ? '0 0 0 3px var(--color-danger-surface)'
                  : isFilled
                  ? '0 0 0 3px var(--color-brand-surface)'
                  : 'none',
                transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
              }}
            />
          );
        })}
      </div>
    </FormField>
  );
};
