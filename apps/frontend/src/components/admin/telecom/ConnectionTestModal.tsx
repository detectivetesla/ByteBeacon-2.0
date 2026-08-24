import React, { useState } from 'react';
import {
  TelecomProviderDetailDto,
  ProviderConnectionTestResult,
} from '@bytebeacon/shared';
import { adminApi } from '../../../api/admin.api.js';
import { Modal } from '../../ui/Modal/Modal.js';
import { Button } from '../../ui/Button/Button.js';
import { Badge } from '../../ui/Badge/Badge.js';
import { CheckCircle2, XCircle, Zap } from 'lucide-react';

interface ConnectionTestModalProps {
  provider: TelecomProviderDetailDto;
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectionTestModal: React.FC<ConnectionTestModalProps> = ({
  provider,
  isOpen,
  onClose,
}) => {
  const [environment, setEnvironment] = useState<'SANDBOX' | 'PRODUCTION'>('SANDBOX');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ProviderConnectionTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunTest = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const data = await adminApi.testProviderConnection(provider.id, environment);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Diagnostic test failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Connection Diagnostic: ${provider.name}`}
      subtitle="Live multi-stage DNS, TLS, reachability, authentication, and carrier health check."
      maxWidth="600px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              Environment:
            </span>
            {(['SANDBOX', 'PRODUCTION'] as const).map((env) => (
              <button
                key={env}
                type="button"
                onClick={() => setEnvironment(env)}
                style={{
                  padding: '0.25rem 0.625rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-2xs)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: environment === env ? 'var(--color-brand)' : 'var(--color-bg-surface-elevated)',
                  color: environment === env ? '#FFFFFF' : 'var(--color-text-secondary)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {env}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={handleRunTest}
            disabled={isRunning}
            leftIcon={<Zap size={14} />}
          >
            {isRunning ? 'Running Probes...' : 'Execute Diagnostic'}
          </Button>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-danger-surface)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)' }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface-muted)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Diagnostic Outcome: {result.environment}
                </div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', marginTop: '0.125rem', fontFamily: 'var(--font-mono)' }}>
                  {provider.apiBaseUrl}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Badge variant={result.result === 'PASSED' ? 'success' : 'danger'}>
                  {result.result}
                </Badge>
                <div style={{ fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                  {result.totalLatencyMs}ms total
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                Pipeline Stages
              </span>
              {result.steps.map((st, i) => (
                <div
                  key={i}
                  style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'var(--color-bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 'var(--font-size-xs)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {st.status === 'PASSED' ? (
                      <CheckCircle2 size={16} color="var(--color-success)" />
                    ) : (
                      <XCircle size={16} color="var(--color-danger)" />
                    )}
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{st.name}</div>
                      {st.details && <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>{st.details}</div>}
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>
                    {st.latencyMs}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-default)' }}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
