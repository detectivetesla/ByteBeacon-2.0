import React, { useState } from 'react';
import {
  TelecomProviderDetailDto,
  NetworkProvider,
  SandboxTransactionTestResult,
} from '@bytebeacon/shared';
import { adminApi } from '../../../api/admin.api.js';
import { Modal } from '../../ui/Modal/Modal.js';
import { Button } from '../../ui/Button/Button.js';
import { Badge } from '../../ui/Badge/Badge.js';
import { Terminal, CheckCircle2 } from 'lucide-react';

interface SandboxTestModalProps {
  provider: TelecomProviderDetailDto;
  isOpen: boolean;
  onClose: () => void;
}

export const SandboxTestModal: React.FC<SandboxTestModalProps> = ({
  provider,
  isOpen,
  onClose,
}) => {
  const [network, setNetwork] = useState<NetworkProvider>(provider.supportedNetworks[0] || NetworkProvider.MTN);
  const [phone, setPhone] = useState('0244123456');
  const [dataAmountMb, setDataAmountMb] = useState(1000);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SandboxTransactionTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunSandbox = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const data = await adminApi.testProviderSandboxTransaction(provider.id, {
        network,
        recipientPhone: phone,
        dataAmountMb: Number(dataAmountMb),
      });
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Sandbox test transaction failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Sandbox Order Simulator: ${provider.name}`}
      subtitle="Execute synthetic data bundle fulfillment with end-to-end timing telemetry."
      maxWidth="620px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
              Carrier Network
            </label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as NetworkProvider)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)' }}
            >
              {provider.supportedNetworks.map((net) => (
                <option key={net} value={net}>{net}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
              Test Phone Number
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0244123456"
              style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
              Volume (MB)
            </label>
            <input
              type="number"
              value={dataAmountMb}
              onChange={(e) => setDataAmountMb(Number(e.target.value))}
              step={500}
              style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}
            />
          </div>
        </div>

        <Button
          variant="primary"
          onClick={handleRunSandbox}
          disabled={isRunning}
          leftIcon={<Terminal size={14} />}
          style={{ width: '100%' }}
        >
          {isRunning ? 'Simulating Sandbox Fulfillment...' : 'Submit Sandbox Test Transaction'}
        </Button>

        {error && (
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-danger-surface)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)' }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface-muted)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)', display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: 'var(--font-size-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Sandbox Response: {result.result}</span>
                <Badge variant="success">{result.durationMs}ms</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '0.25rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Provider Ref</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{result.providerReference}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '0.25rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Target Subscriber</span>
                <span style={{ color: 'var(--color-text-primary)' }}>{result.network} • {result.recipientPhone}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Data Volume</span>
                <span style={{ fontWeight: 700, color: 'var(--color-brand)' }}>{result.dataAmountMb} MB</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                Pipeline Execution Steps
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-primary)' }}>
                    <CheckCircle2 size={16} color="var(--color-success)" />
                    {st.step}
                  </span>
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
