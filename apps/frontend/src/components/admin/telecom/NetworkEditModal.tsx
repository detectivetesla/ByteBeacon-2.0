import React, { useState } from 'react';
import {
  TelecomNetworkDto,
  TelecomProviderStatus,
  UpdateTelecomNetworkRequest,
} from '@bytebeacon/shared';
import { adminApi } from '../../../api/admin.api.js';
import { Modal } from '../../ui/Modal/Modal.js';
import { Button } from '../../ui/Button/Button.js';
import { NetworkBadge } from '../../ui/Badge/Badge.js';

interface NetworkEditModalProps {
  network: TelecomNetworkDto;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NetworkEditModal: React.FC<NetworkEditModalProps> = ({
  network,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<UpdateTelecomNetworkRequest>({
    status: network.status,
    isActive: network.isActive,
    endpointUrl: network.endpointUrl || '',
    webhookUrl: network.webhookUrl || '',
    dailyVolumeLimitMb: network.dailyVolumeLimitMb,
    dailyOrderLimit: network.dailyOrderLimit,
    minBundleMb: network.minBundleMb,
    maxBundleMb: network.maxBundleMb,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await adminApi.updateTelecomNetwork(network.code, formData);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to update network settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Configure Carrier: ${network.name}`}
      subtitle="Preserve and customize carrier interconnect routing, endpoints, and capacity quotas."
      maxWidth="580px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {error && (
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-danger-surface)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)' }}
            >
              <option value={TelecomProviderStatus.ACTIVE}>ACTIVE</option>
              <option value={TelecomProviderStatus.INACTIVE}>INACTIVE</option>
              <option value={TelecomProviderStatus.DEGRADED}>DEGRADED</option>
              <option value={TelecomProviderStatus.MAINTENANCE}>MAINTENANCE</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
              Traffic Routing
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                Enable Live Carrier Routing
              </span>
            </label>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
            Carrier Direct Endpoint URL
          </label>
          <input
            type="url"
            value={formData.endpointUrl || ''}
            onChange={(e) => setFormData({ ...formData, endpointUrl: e.target.value })}
            placeholder="https://api.provider.com/v1/carrier"
            style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
            Carrier Webhook Endpoint
          </label>
          <input
            type="text"
            value={formData.webhookUrl || ''}
            onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
            placeholder="/api/v1/fulfillment/webhook"
            style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
              Daily Volume Limit (MB)
            </label>
            <input
              type="number"
              value={formData.dailyVolumeLimitMb}
              onChange={(e) => setFormData({ ...formData, dailyVolumeLimitMb: Number(e.target.value) })}
              style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
              Daily Order Limit
            </label>
            <input
              type="number"
              value={formData.dailyOrderLimit}
              onChange={(e) => setFormData({ ...formData, dailyOrderLimit: Number(e.target.value) })}
              style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
              Min Bundle (MB)
            </label>
            <input
              type="number"
              value={formData.minBundleMb}
              onChange={(e) => setFormData({ ...formData, minBundleMb: Number(e.target.value) })}
              style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
              Max Bundle (MB)
            </label>
            <input
              type="number"
              value={formData.maxBundleMb}
              onChange={(e) => setFormData({ ...formData, maxBundleMb: Number(e.target.value) })}
              style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-default)' }}>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
