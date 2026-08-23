import React, { useState } from 'react';
import {
  TelecomProviderDetailDto,
  ProviderConnectionTestResult,
} from '@bytebeacon/shared';
import { adminApi } from '../../../api/admin.api';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>⚡</span> Connection Diagnostic: {provider.name}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live multi-stage DNS, TLS, reachability, authentication, and health check.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-xs font-semibold text-slate-300">Environment:</label>
            <div className="flex gap-2">
              {(['SANDBOX', 'PRODUCTION'] as const).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setEnvironment(env)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    environment === env
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {env}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleRunTest}
              disabled={isRunning}
              className="ml-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              {isRunning ? 'Running Diagnostic Probe...' : '⚡ Execute Diagnostic'}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-3 pt-2">
              <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Overall Diagnostic Outcome</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Target: {provider.apiBaseUrl} • Environment: {result.environment}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    result.result === 'PASSED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {result.result}
                  </span>
                  <div className="text-[11px] font-mono text-slate-300 mt-1">{result.totalLatencyMs}ms total</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300 px-1">Pipeline Stages</div>
                {result.steps.map((st, i) => (
                  <div key={i} className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className={st.status === 'PASSED' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {st.status === 'PASSED' ? '✓' : '✗'}
                      </span>
                      <div>
                        <div className="font-bold text-white">{st.name}</div>
                        {st.details && <div className="text-[11px] text-slate-400">{st.details}</div>}
                      </div>
                    </div>
                    <div className="font-mono text-slate-400 text-right">
                      {st.latencyMs}ms
                    </div>
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
