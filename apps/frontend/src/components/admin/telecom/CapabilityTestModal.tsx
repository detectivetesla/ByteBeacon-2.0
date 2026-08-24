import React, { useState } from 'react';
import { TelecomProviderDetailDto } from '@bytebeacon/shared';
import { adminApi } from '../../../api/admin.api.js';
import { Modal } from '../../ui/Modal/Modal.js';
import { Button } from '../../ui/Button/Button.js';
import { Badge } from '../../ui/Badge/Badge.js';
import { Sliders, CheckCircle2, XCircle } from 'lucide-react';

interface CapabilityTestModalProps {
  provider: TelecomProviderDetailDto;
  isOpen: boolean;
  onClose: () => void;
}

export const CapabilityTestModal: React.FC<CapabilityTestModalProps> = ({
  provider,
  isOpen,
  onClose,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [capabilities, setCapabilities] = useState<Record<string, boolean> | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunCapabilityTest = async () => {
    setIsRunning(true);
    setError(null);
    setCapabilities(null);
    try {
      const data = await adminApi.testProviderCapabilities(provider.id);
      setCapabilities(data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Capability test probe failed');
    } finally {
      setIsRunning(false);
    }
  };

  const capabilityDescriptions: Record<string, string> = {
    NETWORKS: 'Multi-MNO carrier interconnect (MTN, Telecel, AirtelTigo)',
    CATALOG: 'Live bundle discovery & real-time pricing synchronization',
    BENEFICIARY_VALIDATION: 'Pre-flight MSISDN and subscriber validity verification',
    SINGLE_ORDERS: 'Single data bundle top-up dispatch',
    BULK_ORDERS: 'High-throughput batch recipient fulfillment',
    ORDER_STATUS: 'Polling & asynchronous fulfillment status retrieval',
    WEBHOOKS: 'HMAC-SHA256 authenticated callback processing',
    RECONCILIATION: 'Automated end-of-day ledger & batch reconciliation',
    REFUNDS: 'Native upstream carrier refund support',
    SANDBOX: 'Full synthetic sandbox execution environment',
    PRECHECK: 'Batch MSISDN eligibility pre-screening',
    WALLET_BALANCE: 'Automated aggregator float & balance queries',
  };

  const entries = capabilities ? Object.entries(capabilities) : Object.entries(provider.capabilities || {});

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Capability Inspection: ${provider.name}`}
      subtitle="Inspects upstream telecom feature availability and carrier API capabilities."
      maxWidth="640px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            Provider: <strong style={{ color: 'var(--color-text-primary)' }}>{provider.name}</strong> ({provider.slug})
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={handleRunCapabilityTest}
            disabled={isRunning}
            leftIcon={<Sliders size={14} />}
          >
            {isRunning ? 'Probing Capabilities...' : 'Probe Upstream Capabilities'}
          </Button>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-danger-surface)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '340px', overflowY: 'auto' }}>
          {entries.map(([key, isSupported]) => (
            <div
              key={key}
              style={{
                padding: '0.625rem 0.75rem',
                backgroundColor: 'var(--color-bg-surface-elevated)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 'var(--font-size-xs)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isSupported ? (
                  <CheckCircle2 size={16} color="var(--color-success)" />
                ) : (
                  <XCircle size={16} color="var(--color-text-muted)" />
                )}
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                    {capabilityDescriptions[key] || 'Telecom provider capability module'}
                  </div>
                </div>
              </div>
              <Badge variant={isSupported ? 'success' : 'neutral'}>
                {isSupported ? 'SUPPORTED' : 'UNSUPPORTED'}
              </Badge>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-default)' }}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
