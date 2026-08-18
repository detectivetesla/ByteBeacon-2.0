import React, { useId } from 'react';
import styles from './Textarea.module.css';
import { AlertCircle } from 'lucide-react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  helperText?: string;
  optional?: boolean;
  showCharacterCount?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      hint,
      helperText,
      optional,
      showCharacterCount = false,
      maxLength,
      value,
      id,
      className = '',
      style,
      required,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const textareaId = id || (label ? `textarea_${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : generatedId);
    const errorId = `${textareaId}-error`;
    const hintId = `${textareaId}-hint`;
    const displayHint = hint || helperText;

    const currentLength = typeof value === 'string' ? value.length : 0;

    return (
      <div className={styles.wrapper} style={style}>
        {label && (
          <div className={styles.labelRow}>
            <label htmlFor={textareaId} className={styles.label}>
              <span>{label}</span>
              {required && <span className={styles.required}>*</span>}
            </label>
            {optional && !required && <span className={styles.optionalBadge}>Optional</span>}
          </div>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          value={value}
          maxLength={maxLength}
          required={required}
          className={`${styles.textarea} ${error ? styles.error : ''} ${className}`.trim()}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : displayHint ? hintId : undefined}
          {...props}
        />

        <div className={styles.footerRow}>
          {error ? (
            <span id={errorId} className={styles.errorText} role="alert">
              <AlertCircle size={13} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </span>
          ) : displayHint ? (
            <span id={hintId} className={styles.helperText}>
              {displayHint}
            </span>
          ) : <span />}

          {showCharacterCount && maxLength && (
            <span className={styles.charCount}>
              {currentLength}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
