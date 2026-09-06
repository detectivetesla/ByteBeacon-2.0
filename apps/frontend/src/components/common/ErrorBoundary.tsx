import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '../ui/Button/Button.js';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ByteBeacon Uncaught Error Boundary caught error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-6)',
            backgroundColor: 'var(--color-bg-base)',
            fontFamily: 'var(--font-sans)',
            color: 'var(--color-text-primary)',
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              width: '100%',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-2xl)',
              boxShadow: 'var(--shadow-floating, 0 20px 25px -5px rgba(0, 0, 0, 0.1))',
              padding: 'var(--space-8)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-4)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
            >
              <AlertTriangle size={32} style={{ color: '#EF4444' }} />
            </div>

            <h1
              style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 900,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.02em',
                marginBottom: 'var(--space-2)',
              }}
            >
              Something went wrong
            </h1>

            <p
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
                marginBottom: 'var(--space-6)',
              }}
            >
              The portal encountered an unexpected display error. Please reload the page to restore your session.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={this.handleReload}
                leftIcon={<RefreshCw size={16} />}
              >
                Reload Page
              </Button>

              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={this.handleGoHome}
                leftIcon={<Home size={16} />}
              >
                Return to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
