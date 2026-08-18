import React from 'react';
import { Button } from '../Button/Button.js';
import { TactileIcon } from '../TactileIcon/TactileIcon.js';
import { AlertCircle, RotateCcw } from 'lucide-react';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryText?: string;
  style?: React.CSSProperties;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  description = "We're having trouble connecting right now. Please try again.",
  onRetry,
  retryText = 'Retry',
  style,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--space-10) var(--space-6)',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-status-failed-border)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-tactile-sm)',
        ...style,
      }}
    >
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <TactileIcon icon={AlertCircle} color="red" size="lg" />
      </div>

      <h3
        style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 800,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-sans)',
          marginBottom: '0.375rem',
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          maxWidth: '400px',
          marginBottom: 'var(--space-6)',
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>

      {onRetry && (
        <Button
          variant="secondary"
          size="md"
          onClick={onRetry}
          leftIcon={<RotateCcw size={16} strokeWidth={2.5} />}
        >
          {retryText}
        </Button>
      )}
    </div>
  );
};
