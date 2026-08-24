import React, { useState } from 'react';
import {
  TelecomProviderDetailDto,
  ProviderIncidentSeverity,
  ProviderIncidentStatus,
  ProviderIncidentDto,
} from '@bytebeacon/shared';
import { adminApi } from '../../../api/admin.api.js';
import { Modal } from '../../ui/Modal/Modal.js';
import { Button } from '../../ui/Button/Button.js';
import { AlertTriangle } from 'lucide-react';

interface ProviderIncidentModalProps {
  providers: TelecomProviderDetailDto[];
  incident?: ProviderIncidentDto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProviderIncidentModal: React.FC<ProviderIncidentModalProps> = ({
  providers,
  incident,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [providerId, setProviderId] = useState(incident?.providerId || providers[0]?.id || '');
  const [title, setTitle] = useState(incident?.title || '');
  const [severity, setSeverity] = useState(incident?.severity || ProviderIncidentSeverity.HIGH);
  const [status, setStatus] = useState(incident?.status || ProviderIncidentStatus.INVESTIGATING);
  const [affectedNetwork, setAffectedNetwork] = useState(incident?.affectedNetwork || 'ALL');
  const [failureRatePercent, setFailureRatePercent] = useState(incident?.failureRatePercent || 0);
  const [summary, setSummary] = useState(incident?.summary || '');
  const [mitigationNotes, setMitigationNotes] = useState(incident?.mitigationNotes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !summary) {
      setError('Title and summary are mandatory');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      if (incident) {
        await adminApi.updateProviderIncident(incident.id, {
          title,
          severity,
          status,
          affectedNetwork,
          failureRatePercent: Number(failureRatePercent),
          summary,
          mitigationNotes,
        });
      } else {
        await adminApi.createProviderIncident({
          providerId,
          title,
          severity,
          status,
          affectedNetwork,
          failureRatePercent: Number(failureRatePercent),
          summary,
          mitigationNotes,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to save incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={incident ? 'Update Provider Incident' : 'Report Provider Incident'}
      subtitle="Log carrier degradation, latency spikes, and track operational NOC mitigations."
      maxWidth="600px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {error && (
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-danger-surface)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)' }}>
            {error}
          </div>
        )}

        {!incident && (
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
              Affected Provider *
            </label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)' }}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.providerType})</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
            Incident Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. MTN Top-up Gateway Timeouts"
            style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
              Severity
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as any)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)' }}
            >
              <option value={ProviderIncidentSeverity.LOW}>LOW</option>
              <option value={ProviderIncidentSeverity.MEDIUM}>MEDIUM</option>
              <option value={ProviderIncidentSeverity.HIGH}>HIGH</option>
              <option value={ProviderIncidentSeverity.CRITICAL}>CRITICAL</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)' }}
            >
              <option value={ProviderIncidentStatus.INVESTIGATING}>INVESTIGATING</option>
              <option value={ProviderIncidentStatus.IDENTIFIED}>IDENTIFIED</option>
              <option value={ProviderIncidentStatus.MONITORING}>MONITORING</option>
              <option value={ProviderIncidentStatus.RESOLVED}>RESOLVED</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
              Carrier Impact
            </label>
            <select
              value={affectedNetwork}
              onChange={(e) => setAffectedNetwork(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)' }}
            >
              <option value="ALL">ALL NETWORKS</option>
              <option value="MTN">MTN ONLY</option>
              <option value="TELECEL">TELECEL ONLY</option>
              <option value="AIRTELTIGO">AIRTELTIGO ONLY</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
            Failure Rate (%)
          </label>
          <input
            type="number"
            value={failureRatePercent}
            onChange={(e) => setFailureRatePercent(Number(e.target.value))}
            min={0}
            max={100}
            style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
            Summary / Symptoms *
          </label>
          <textarea
            rows={2}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Describe failure rate spikes, HTTP 504 gateway timeouts..."
            style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
            Mitigation & Action Notes
          </label>
          <textarea
            rows={2}
            value={mitigationNotes}
            onChange={(e) => setMitigationNotes(e.target.value)}
            placeholder="Traffic rerouted to secondary provider; ticket raised with upstream carrier NOC."
            style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-default)' }}>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" size="sm" disabled={isSubmitting} leftIcon={<AlertTriangle size={14} />}>
            {isSubmitting ? 'Saving...' : incident ? 'Update Incident' : 'Report Incident'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
