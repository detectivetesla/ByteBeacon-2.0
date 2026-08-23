import React, { useState, useEffect } from 'react';
import {
  TelecomProviderDetailDto,
  ProviderCredentialDto,
} from '@bytebeacon/shared';
import { adminApi } from '../../../api/admin.api';

interface ProviderDossierModalProps {
  provider: TelecomProviderDetailDto;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const ProviderDossierModal: React.FC<ProviderDossierModalProps> = ({
  provider,
  isOpen,
  onClose,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'credentials' | 'capabilities' | 'networks'>('overview');
  const [credentials, setCredentials] = useState<ProviderCredentialDto[]>([]);
  const [isLoadingCreds, setIsLoadingCreds] = useState(false);
  const [rotateMode, setRotateMode] = useState(false);
  const [rotateData, setRotateData] = useState({ newApiKey: '', reason: '', environment: 'PRODUCTION' });
  const [isRotating, setIsRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === 'credentials') {
      loadCredentials();
    }
  }, [isOpen, activeTab, provider.id]);

  const loadCredentials = async () => {
    setIsLoadingCreds(true);
    setError(null);
    try {
      const data = await adminApi.getProviderCredentials(provider.id);
      setCredentials(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load credentials');
    } finally {
      setIsLoadingCreds(false);
    }
  };

  const handleRotate = async () => {
    if (!rotateData.newApiKey || !rotateData.reason) {
      setError('New API key and rotation reason are required');
      return;
    }
    setIsRotating(true);
    setError(null);
    try {
      await adminApi.rotateProviderCredential(provider.id, {
        environment: rotateData.environment,
        newApiKey: rotateData.newApiKey,
        reason: rotateData.reason,
      });
      setRotateMode(false);
      setRotateData({ newApiKey: '', reason: '', environment: 'PRODUCTION' });
      await loadCredentials();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Credential rotation failed');
    } finally {
      setIsRotating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
              {provider.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{provider.name}</h2>
                {provider.isAuthoritative && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                    AUTHORITATIVE
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  provider.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {provider.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{provider.slug} • {provider.providerType}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition">
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/40">
          {[
            { id: 'overview', label: 'Overview & Telemetry' },
            { id: 'credentials', label: 'Credentials Vault' },
            { id: 'capabilities', label: 'Capabilities' },
            { id: 'networks', label: 'Carrier Mappings' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/60">
                  <div className="text-[11px] text-slate-400">Avg Latency</div>
                  <div className="text-lg font-bold text-white font-mono mt-0.5">{provider.avgLatencyMs}ms</div>
                </div>
                <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/60">
                  <div className="text-[11px] text-slate-400">P95 Latency</div>
                  <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">{provider.p95LatencyMs}ms</div>
                </div>
                <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/60">
                  <div className="text-[11px] text-slate-400">Success Rate</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">{provider.successRate}%</div>
                </div>
                <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/60">
                  <div className="text-[11px] text-slate-400">Total Requests</div>
                  <div className="text-lg font-bold text-slate-200 font-mono mt-0.5">{provider.totalRequestsCount.toLocaleString()}</div>
                </div>
              </div>

              <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700 space-y-2.5 text-xs">
                <div className="text-xs font-bold text-slate-200">Interconnect Details</div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">API Base URL</span>
                  <span className="text-white font-mono">{provider.apiBaseUrl}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">Authentication</span>
                  <span className="text-white">{provider.authMethod}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">Environment</span>
                  <span className="text-white">{provider.environment}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">Webhook URL</span>
                  <span className="text-white font-mono">{provider.webhookUrl || 'Not configured'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Last Health Check</span>
                  <span className="text-slate-300">{provider.lastHealthCheck ? new Date(provider.lastHealthCheck).toLocaleString() : 'Never'}</span>
                </div>
              </div>

              {provider.description && (
                <div className="p-3.5 bg-slate-800/20 rounded-xl border border-slate-800 text-xs text-slate-300">
                  <span className="font-semibold text-slate-400">Notes: </span>
                  {provider.description}
                </div>
              )}
            </div>
          )}

          {/* CREDENTIALS TAB */}
          {activeTab === 'credentials' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  Server-side encrypted credential store. Keys are masked to prevent exposure.
                </div>
                <button
                  type="button"
                  onClick={() => setRotateMode(!rotateMode)}
                  className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition"
                >
                  {rotateMode ? 'Cancel' : '🔄 Rotate API Key'}
                </button>
              </div>

              {rotateMode && (
                <div className="p-4 bg-slate-800/80 rounded-xl border border-emerald-500/30 space-y-3">
                  <div className="text-xs font-bold text-white">Rotate Provider Credentials</div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">New API Key *</label>
                    <input
                      type="password"
                      value={rotateData.newApiKey}
                      onChange={(e) => setRotateData({ ...rotateData, newApiKey: e.target.value })}
                      placeholder="Enter new API key"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Rotation Justification / Reason *</label>
                    <input
                      type="text"
                      value={rotateData.reason}
                      onChange={(e) => setRotateData({ ...rotateData, reason: e.target.value })}
                      placeholder="e.g. Scheduled quarterly rotation or key compromise mitigation"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRotate}
                    disabled={isRotating}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition"
                  >
                    {isRotating ? 'Rotating...' : 'Confirm Key Rotation'}
                  </button>
                </div>
              )}

              {isLoadingCreds ? (
                <div className="text-center py-6 text-xs text-slate-400">Loading secure credential vault...</div>
              ) : (
                <div className="space-y-2">
                  {(credentials.length > 0 ? credentials : [
                    {
                      id: 'cred_dh_live',
                      providerId: provider.id,
                      environment: 'PRODUCTION',
                      apiKeyMasked: provider.credentialsMasked.apiKeyMasked || 'dh_live_••••••••3821',
                      webhookSecretMasked: provider.credentialsMasked.webhookSecretMasked || 'whsec_••••••••4912',
                      status: 'ACTIVE',
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    },
                  ]).map((cred) => (
                    <div key={cred.id} className="p-3.5 bg-slate-800/50 border border-slate-700/70 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white">{cred.apiKeyMasked}</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                            {cred.environment}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px]">
                            {cred.status}
                          </span>
                        </div>
                        {cred.webhookSecretMasked && (
                          <div className="text-[11px] text-slate-400 font-mono mt-1">
                            Webhook Secret: {cred.webhookSecretMasked}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CAPABILITIES TAB */}
          {activeTab === 'capabilities' && (
            <div className="grid grid-cols-2 gap-2.5">
              {Object.entries(provider.capabilities || {}).map(([key, isSupported]) => (
                <div
                  key={key}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    isSupported ? 'border-emerald-500/30 bg-emerald-500/5 text-slate-200' : 'border-slate-800 bg-slate-850 text-slate-500'
                  }`}
                >
                  <span className="font-medium">{key.replace(/_/g, ' ')}</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    isSupported ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {isSupported ? 'SUPPORTED' : 'UNSUPPORTED'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* NETWORKS TAB */}
          {activeTab === 'networks' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400">Carrier routes currently mapped to this provider:</div>
              <div className="space-y-2">
                {provider.supportedNetworks.map((net) => (
                  <div key={net} className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{net}</span>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-bold rounded-full text-[10px]">
                      AVAILABLE / ACTIVE
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
