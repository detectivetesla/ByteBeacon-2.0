import React, { useState } from 'react';
import {
  TelecomProviderDetailDto,
  ProviderIncidentSeverity,
  ProviderIncidentStatus,
  ProviderIncidentDto,
} from '@bytebeacon/shared';
import { adminApi } from '../../../api/admin.api';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🚨</span> {incident ? 'Update Provider Incident' : 'Report Provider Incident'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
              {error}
            </div>
          )}

          {!incident && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Affected Provider *</label>
              <select
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.providerType})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Incident Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. MTN Top-up Gateway Timeouts"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
              >
                <option value={ProviderIncidentSeverity.LOW}>LOW</option>
                <option value={ProviderIncidentSeverity.MEDIUM}>MEDIUM</option>
                <option value={ProviderIncidentSeverity.HIGH}>HIGH</option>
                <option value={ProviderIncidentSeverity.CRITICAL}>CRITICAL</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
              >
                <option value={ProviderIncidentStatus.INVESTIGATING}>INVESTIGATING</option>
                <option value={ProviderIncidentStatus.IDENTIFIED}>IDENTIFIED</option>
                <option value={ProviderIncidentStatus.MONITORING}>MONITORING</option>
                <option value={ProviderIncidentStatus.RESOLVED}>RESOLVED</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Carrier Impact</label>
              <select
                value={affectedNetwork}
                onChange={(e) => setAffectedNetwork(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
              >
                <option value="ALL">ALL NETWORKS</option>
                <option value="MTN">MTN ONLY</option>
                <option value="TELECEL">TELECEL ONLY</option>
                <option value="AIRTELTIGO">AIRTELTIGO ONLY</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Failure Rate (%)</label>
            <input
              type="number"
              value={failureRatePercent}
              onChange={(e) => setFailureRatePercent(Number(e.target.value))}
              min={0}
              max={100}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Summary / Symptoms *</label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Describe failure rate spikes, HTTP 504 gateway timeouts..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Mitigation & Action Notes</label>
            <textarea
              rows={2}
              value={mitigationNotes}
              onChange={(e) => setMitigationNotes(e.target.value)}
              placeholder="Traffic rerouted to secondary provider; ticket #991 raised with aggregator NOC."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
            >
              {isSubmitting ? 'Saving...' : incident ? 'Update Incident' : 'Report Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
