import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

export interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={18} strokeWidth={2.8} color="var(--color-primary)" />;
      case 'info':
        return <Info size={18} strokeWidth={2.8} color="var(--color-accent-cyan)" />;
      case 'warning':
        return <AlertTriangle size={18} strokeWidth={2.8} color="var(--color-accent-amber)" />;
      case 'error':
        return <AlertCircle size={18} strokeWidth={2.8} color="var(--color-accent-red)" />;
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-tactile-lg)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        minWidth: '280px',
        maxWidth: '420px',
        pointerEvents: 'auto',
        animation: 'toastSlideIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div style={{ marginTop: '2px' }}>{getIcon()}</div>

      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
          }}
        >
          {toast.title}
        </div>
        {toast.description && (
          <div
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              marginTop: '0.125rem',
              lineHeight: 1.4,
            }}
          >
            {toast.description}
          </div>
        )}
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss toast"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-text-muted)',
          cursor: 'pointer',
          padding: '0.125rem',
          marginLeft: '0.25rem',
          display: 'flex',
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
};

export { useToast, ToastProvider } from '../../../context/ToastContext.js';
