import React, { useState } from 'react';
import {
  TelecomProviderDetailDto,
  NetworkProvider,
  SandboxTransactionTestResult,
} from '@bytebeacon/shared';
import { adminApi } from '../../../api/admin.api';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🧪</span> Sandbox Order Runner: {provider.name}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Execute controlled mock data bundle transactions with end-to-end timing telemetry.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Carrier Network</label>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value as NetworkProvider)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
              >
                {provider.supportedNetworks.map((net) => (
                  <option key={net} value={net}>{net}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Test Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0244123456"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Volume (MB)</label>
              <input
                type="number"
                value={dataAmountMb}
                onChange={(e) => setDataAmountMb(Number(e.target.value))}
                step={500}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunSandbox}
            disabled={isRunning}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            {isRunning ? 'Simulating Sandbox Fulfillment...' : '🚀 Submit Sandbox Test Transaction'}
          </button>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-3 pt-2">
              <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Sandbox Response: {result.result}</span>
                  <span className="font-mono text-emerald-400 font-bold">{result.durationMs}ms</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">Provider Reference</span>
                  <span className="font-mono text-white">{result.providerReference}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">Carrier & Phone</span>
                  <span className="text-white">{result.network} • {result.recipientPhone}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Data Volume</span>
                  <span className="text-white">{result.dataAmountMb} MB</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-300 px-1">Pipeline Execution Steps</div>
                {result.steps.map((st, i) => (
                  <div key={i} className="p-2.5 bg-slate-800/40 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-300">
                      <span className="text-emerald-400">✓</span> {st.step}
                    </span>
                    <span className="font-mono text-slate-400">{st.latencyMs}ms</span>
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
