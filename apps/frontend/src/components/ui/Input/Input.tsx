import React, { useState, useId } from 'react';
import styles from './Input.module.css';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  prefixText?: string;
  suffixText?: string;
  isLoading?: boolean;
  isSuccess?: boolean;
  optional?: boolean;
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      hint,
      leftIcon,
      rightIcon,
      prefixText,
      suffixText,
      isLoading,
      isSuccess,
      optional,
      id,
      className = '',
      style,
      disabled,
      required,
      onFocus,
      onBlur,
      containerClassName = '',
      containerStyle,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id || (label ? `input_${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : generatedId);
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const [isFocused, setIsFocused] = useState(false);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const displayHint = hint || helperText;

    const containerClasses = [
      styles.inputContainer,
      isFocused ? styles.focused : '',
      error ? styles.error : '',
      isSuccess && !error ? styles.success : '',
      disabled ? styles.disabled : '',
      containerClassName,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={styles.wrapper} style={style}>
        {label && (
          <div className={styles.labelRow}>
            <label htmlFor={inputId} className={styles.label}>
              <span>{label}</span>
              {required && <span className={styles.required}>*</span>}
            </label>
            {optional && !required && <span className={styles.optionalBadge}>Optional</span>}
          </div>
        )}

        <div className={containerClasses} style={containerStyle}>
          {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}
          {prefixText && <span className={styles.prefixText}>{prefixText}</span>}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled || isLoading}
            required={required}
            className={`${styles.input} ${className}`.trim()}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : displayHint ? hintId : undefined}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />

          {suffixText && <span className={styles.suffixText}>{suffixText}</span>}
          {isLoading && <span className={styles.spinner} />}
          {!isLoading && rightIcon && <span className={styles.rightIcon}>{rightIcon}</span>}
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

Input.displayName = 'Input';

export const TextInput = Input;

export interface FormFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  id?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  hint,
  required,
  optional,
  id,
  children,
  className = '',
  style,
}) => {
  return (
    <div className={`${styles.wrapper} ${className}`.trim()} style={style}>
      {label && (
        <div className={styles.labelRow}>
          <label htmlFor={id} className={styles.label}>
            <span>{label}</span>
            {required && <span className={styles.required}>*</span>}
          </label>
          {optional && !required && <span className={styles.optionalBadge}>Optional</span>}
        </div>
      )}

      {children}

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

export const FormError: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  return (
    <span className={styles.errorText} role="alert">
      <AlertCircle size={13} style={{ flexShrink: 0 }} />
      <span>{message}</span>
    </span>
  );
};

export const FormHint: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <span className={styles.helperText}>{children}</span>;
};

// Re-exports for backwards compatibility
export { PasswordInput } from './PasswordInput.js';
export { PhoneInput } from './PhoneInput.js';
export { AmountInput } from './AmountInput.js';
export { NumberInput } from './NumberInput.js';
export { SearchInput } from './SearchInput.js';
export { OTPInput } from './OTPInput.js';

