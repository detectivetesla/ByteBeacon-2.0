import React, { useState } from 'react';
import { TelecomProviderDetailDto } from '@bytebeacon/shared';
import { adminApi } from '../../../api/admin.api';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🔍</span> Capability Inspection: {provider.name}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspects upstream telecom feature availability and carrier API capabilities.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-300">
              Provider: <span className="font-bold text-white">{provider.name}</span> ({provider.slug})
            </div>
            <button
              type="button"
              onClick={handleRunCapabilityTest}
              disabled={isRunning}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              {isRunning ? 'Probing Capabilities...' : '🔍 Probe Upstream Capabilities'}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {entries.map(([key, isSupported]) => (
              <div
                key={key}
                className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className={isSupported ? 'text-emerald-400 font-bold' : 'text-slate-500 font-bold'}>
                      {isSupported ? '✓' : '✕'}
                    </span>
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {capabilityDescriptions[key] || 'Telecom provider capability module'}
                  </div>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isSupported
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-700/60 text-slate-400'
                  }`}
                >
                  {isSupported ? 'SUPPORTED' : 'UNSUPPORTED'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
