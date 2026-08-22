import React from 'react';

export interface ResponsiveFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  columns?: 1 | 2;
  children: React.ReactNode;
}

export const ResponsiveForm: React.FC<ResponsiveFormProps> = ({
  columns = 1,
  className = '',
  style,
  children,
  ...props
}) => {
  return (
    <form
      className={`bb-responsive-form ${className}`}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    >
      <style>{`
        .bb-form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--space-4);
          width: 100%;
        }
        @media (min-width: 768px) {
          .bb-form-grid-2 {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .bb-form-field {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
          width: 100%;
        }
        .bb-form-field label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .bb-form-field input,
        .bb-form-field select,
        .bb-form-field textarea {
          width: 100%;
          min-height: var(--touch-target-min, 44px);
          padding: 0.625rem 0.75rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border-default);
          background-color: var(--color-bg-surface);
          color: var(--color-text-primary);
          font-family: var(--font-sans);
          font-size: var(--font-size-sm);
          box-sizing: border-box;
          transition: border-color var(--transition-fast);
        }
        .bb-form-field input:focus,
        .bb-form-field select:focus,
        .bb-form-field textarea:focus {
          outline: none;
          border-color: var(--color-brand);
          box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.12);
        }
        .bb-form-field textarea {
          min-height: 88px;
          resize: vertical;
        }
        .bb-form-field .bb-form-hint {
          font-size: var(--font-size-2xs);
          color: var(--color-text-muted);
        }
        .bb-form-field .bb-form-error {
          font-size: var(--font-size-2xs);
          color: var(--color-danger, #EF4444);
          font-weight: 600;
        }
        .bb-form-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: var(--space-3);
          flex-wrap: wrap;
          padding-top: var(--space-4);
        }
        @media (max-width: 639px) {
          .bb-form-actions {
            flex-direction: column-reverse;
          }
          .bb-form-actions > * {
            width: 100%;
          }
        }
      `}</style>

      <div className={`bb-form-grid ${columns === 2 ? 'bb-form-grid-2' : ''}`}>
        {children}
      </div>
    </form>
  );
};

/* Convenience sub-components */
export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({ fullWidth, className = '', style, children, ...props }) => (
  <div
    className={`bb-form-field ${className}`}
    style={{
      ...(fullWidth ? { gridColumn: '1 / -1' } : {}),
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const FormActions: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div className={`bb-form-actions ${className}`} style={{ gridColumn: '1 / -1' }} {...props}>
    {children}
  </div>
);
