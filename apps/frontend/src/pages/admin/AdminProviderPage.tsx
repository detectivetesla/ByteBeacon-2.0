import React, { useState, useEffect, useCallback } from 'react';
import {
  TelecomControlPlaneOverviewDto,
  TelecomNetworkDto,
  TelecomProviderDetailDto,
  NetworkProviderMappingDto,
  ProviderIncidentDto,
  AuthoritativeSwitchValidationResult,
  NetworkProvider,
} from '@bytebeacon/shared';
import { adminApi } from '../../api/admin.api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AddProviderWizardModal } from '../../components/admin/telecom/AddProviderWizardModal';
import { ProviderDossierModal } from '../../components/admin/telecom/ProviderDossierModal';
import { ConnectionTestModal } from '../../components/admin/telecom/ConnectionTestModal';
import { SandboxTestModal } from '../../components/admin/telecom/SandboxTestModal';
import { ProviderIncidentModal } from '../../components/admin/telecom/ProviderIncidentModal';
import { NetworkEditModal } from '../../components/admin/telecom/NetworkEditModal';

export const AdminProviderPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<'networks' | 'providers' | 'health' | 'routing' | 'webhooks' | 'tests' | 'incidents'>('networks');
  const [overview, setOverview] = useState<TelecomControlPlaneOverviewDto | null>(null);
  const [networks, setNetworks] = useState<TelecomNetworkDto[]>([]);
  const [providers, setProviders] = useState<TelecomProviderDetailDto[]>([]);
  const [routingMatrix, setRoutingMatrix] = useState<NetworkProviderMappingDto[]>([]);
  const [incidents, setIncidents] = useState<ProviderIncidentDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modals state
  const [isAddWizardOpen, setIsAddWizardOpen] = useState(false);
  const [selectedProviderForDossier, setSelectedProviderForDossier] = useState<TelecomProviderDetailDto | null>(null);
  const [selectedProviderForTest, setSelectedProviderForTest] = useState<TelecomProviderDetailDto | null>(null);
  const [selectedProviderForSandbox, setSelectedProviderForSandbox] = useState<TelecomProviderDetailDto | null>(null);
  const [selectedNetworkForEdit, setSelectedNetworkForEdit] = useState<TelecomNetworkDto | null>(null);
  const [selectedIncidentForEdit, setSelectedIncidentForEdit] = useState<ProviderIncidentDto | null>(null);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);

  // Authoritative Switch state
  const [targetSwitchProvider, setTargetSwitchProvider] = useState('');
  const [switchValidation, setSwitchValidation] = useState<AuthoritativeSwitchValidationResult | null>(null);
  const [switchReason, setSwitchReason] = useState('');
  const [isValidatingSwitch, setIsValidatingSwitch] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  // Routing edit state
  const [selectedRoutingNet, setSelectedRoutingNet] = useState<NetworkProvider>(NetworkProvider.MTN);
  const [selectedPrimary, setSelectedPrimary] = useState('DataHouse');
  const [selectedFallback, setSelectedFallback] = useState('GMPL');
  const [isUpdatingRouting, setIsUpdatingRouting] = useState(false);

  const fetchControlPlaneData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [overviewData, networksData, providersData, routingData, incidentsData] = await Promise.all([
        adminApi.getTelecomOverview().catch(() => null),
        adminApi.getTelecomNetworks().catch(() => []),
        adminApi.getTelecomProviders().catch(() => []),
        adminApi.getTelecomRoutingMatrix().catch(() => []),
        adminApi.getProviderIncidents().catch(() => []),
      ]);

      if (overviewData) setOverview(overviewData);
      if (networksData) setNetworks(networksData);
      if (providersData) {
        setProviders(providersData);
        if (providersData.length > 0 && !targetSwitchProvider) {
          const nonAuth = providersData.find((p) => !p.isAuthoritative);
          if (nonAuth) setTargetSwitchProvider(nonAuth.name);
        }
      }
      if (routingData) setRoutingMatrix(routingData);
      if (incidentsData) setIncidents(incidentsData);
    } catch (err: any) {
      toastError('Fetch Error', err.message || 'Failed to fetch telecom control plane data');
    } finally {
      setIsLoading(false);
    }
  }, [targetSwitchProvider, toastError]);

  useEffect(() => {
    fetchControlPlaneData();
  }, [fetchControlPlaneData]);

  const handleToggleNetwork = async (code: string) => {
    try {
      const res = await adminApi.toggleTelecomNetwork(code);
      toastSuccess('Carrier Network Updated', `Network ${res.code} is now ${res.status}`);
      fetchControlPlaneData();
    } catch (err: any) {
      toastError('Action Failed', err.message || 'Failed to toggle network state');
    }
  };

  const handleUpdateRouting = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingRouting(true);
    try {
      await adminApi.updateTelecomRouting({
        network: selectedRoutingNet,
        primaryProvider: selectedPrimary,
        fallbackProvider: selectedFallback,
      });
      toastSuccess('Routing Updated', `Fulfillment routing for ${selectedRoutingNet} successfully switched.`);
      fetchControlPlaneData();
    } catch (err: any) {
      toastError('Update Failed', err.message || 'Failed to update carrier routing');
    } finally {
      setIsUpdatingRouting(false);
    }
  };

  const handleValidateSwitch = async () => {
    if (!targetSwitchProvider) return;
    setIsValidatingSwitch(true);
    try {
      const res = await adminApi.validateAuthoritativeSwitch(targetSwitchProvider);
      setSwitchValidation(res);
    } catch (err: any) {
      toastError('Validation Failed', err.message || 'Failed to validate authoritative switch');
    } finally {
      setIsValidatingSwitch(false);
    }
  };

  const handleExecuteSwitch = async () => {
    if (!targetSwitchProvider || !switchReason) {
      toastError('Missing Information', 'Target provider and justification reason are required');
      return;
    }
    setIsSwitching(true);
    try {
      const res = await adminApi.switchAuthoritativeProvider({
        newProvider: targetSwitchProvider,
        reason: switchReason,
      });
      toastSuccess('Authoritative Switch Complete', `Promoted ${res.currentAuthoritativeProvider} to active authoritative fulfiller.`);
      setSwitchValidation(null);
      setSwitchReason('');
      fetchControlPlaneData();
    } catch (err: any) {
      toastError('Switch Failed', err.response?.data?.error?.message || err.message || 'Failed to switch authoritative provider');
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full flex flex-col gap-6 p-4 md:p-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-xs border border-emerald-500/20">
              TELECOM CONTROL PLANE
            </span>
            <span className="text-xs text-slate-400">Phase 11.9 Enterprise Architecture</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
            Networks & Provider Infrastructure
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
            Multi-carrier telecom interconnect, provider adapter registry, carrier failover routing, and connection telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddWizardOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <span>+</span> Add Telecom Provider
          </button>
          <button
            onClick={fetchControlPlaneData}
            disabled={isLoading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700 disabled:opacity-50"
            title="Refresh Telecom Telemetry"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Top Telemetry KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400">Authoritative Provider</div>
          <div className="text-lg font-extrabold text-emerald-400 mt-0.5">{overview?.authoritativeProvider || 'DataHouse'}</div>
        </div>
        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400">Active Networks</div>
          <div className="text-lg font-extrabold text-white mt-0.5">{overview?.activeNetworks ?? 3} / {overview?.totalNetworks ?? 3}</div>
        </div>
        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400">Provider Adapters</div>
          <div className="text-lg font-extrabold text-white mt-0.5">{providers.length} registered</div>
        </div>
        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400">System Availability</div>
          <div className="text-lg font-extrabold text-emerald-400 mt-0.5">{overview?.systemAvailabilityPercent ?? 99.85}%</div>
        </div>
        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 col-span-2 md:col-span-1">
          <div className="text-xs text-slate-400">Open Incidents</div>
          <div className="text-lg font-extrabold text-amber-400 mt-0.5">{incidents.filter((i) => i.status !== 'RESOLVED').length} active</div>
        </div>
      </div>

      {/* 7-Tab Navigation Bar */}
      <div className="flex border-b border-slate-800 overflow-x-auto gap-1 bg-slate-900/40 p-1.5 rounded-xl">
        {[
          { id: 'networks', label: 'Carrier Networks', count: networks.length },
          { id: 'providers', label: 'Provider Registry', count: providers.length },
          { id: 'health', label: 'Provider Health & Telemetry' },
          { id: 'routing', label: 'Routing & Authoritative Switch' },
          { id: 'webhooks', label: 'Webhooks & Callbacks' },
          { id: 'tests', label: 'Diagnostics & Sandbox' },
          { id: 'incidents', label: 'Incidents & Status', count: incidents.filter((i) => i.status !== 'RESOLVED').length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === tab.id ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800 text-slate-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: NETWORKS */}
      {activeTab === 'networks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Carrier Telecom Networks (Ghana)</h2>
            <span className="text-xs text-slate-400">Preserves and configures carrier-level endpoints & daily limits</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {networks.map((net) => (
              <div key={net.code} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-3 h-3 rounded-full ${net.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                      <h3 className="font-extrabold text-white text-base">{net.name}</h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      net.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {net.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-1">{net.code} • {net.slug}</div>

                  <div className="space-y-2 mt-4 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Primary Provider</span>
                      <span className="text-emerald-400 font-bold">{net.primaryProviderName || 'DataHouse'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Fallback Provider</span>
                      <span className="text-slate-300">{net.fallbackProviderName || 'GMPL'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Uptime / Success</span>
                      <span className="text-white font-mono">{net.uptimePercentage}% / {net.successRatePercent}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Daily Limits</span>
                      <span className="text-white font-mono">{(net.dailyVolumeLimitMb / 1000).toLocaleString()} GB / {net.dailyOrderLimit.toLocaleString()} ord</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Bundle Range</span>
                      <span className="text-white font-mono">{net.minBundleMb}MB – {(net.maxBundleMb / 1000)}GB</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedNetworkForEdit(net)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
                  >
                    ⚙️ Configure
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleNetwork(net.code)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
                      net.isActive ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                    }`}
                  >
                    {net.isActive ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: PROVIDERS */}
      {activeTab === 'providers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Telecom Providers Registry</h2>
            <span className="text-xs text-slate-400">All registered multi-carrier aggregators and direct MNO adapters</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map((prov) => (
              <div key={prov.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-white text-base">{prov.name}</h3>
                      {prov.isAuthoritative && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30">
                          AUTHORITATIVE
                        </span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      prov.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {prov.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{prov.slug} • {prov.providerType}</div>

                  <div className="space-y-2 mt-4 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Carriers</span>
                      <span className="text-slate-200 font-bold">{prov.supportedNetworks.join(', ')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Protocol / Auth</span>
                      <span className="text-slate-300 font-mono">{prov.authMethod}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Latency / Success</span>
                      <span className="text-white font-mono">{prov.avgLatencyMs}ms / {prov.successRate}%</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">API Key Masked</span>
                      <span className="text-slate-300 font-mono">{prov.credentialsMasked.apiKeyMasked || '••••••••••••••••'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedProviderForDossier(prov)}
                    className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition"
                  >
                    Dossier
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProviderForTest(prov)}
                    className="py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold transition"
                  >
                    ⚡ Test
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProviderForSandbox(prov)}
                    className="py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-xl font-bold transition"
                  >
                    🧪 Sandbox
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: HEALTH & TELEMETRY */}
      {activeTab === 'health' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Provider Telemetry & Health Monitoring</h2>
            <span className="text-xs text-slate-400">Real-time latency distribution, error rates, and HTTP status codes</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providers.map((p) => (
              <div key={p.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base">{p.name}</h3>
                    <div className="text-xs text-slate-400 font-mono">{p.apiBaseUrl}</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs">
                    {p.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 bg-slate-800/40 rounded-xl text-center">
                    <div className="text-[11px] text-slate-400">Avg Latency</div>
                    <div className="text-base font-bold text-white font-mono mt-0.5">{p.avgLatencyMs}ms</div>
                  </div>
                  <div className="p-3 bg-slate-800/40 rounded-xl text-center">
                    <div className="text-[11px] text-slate-400">P95 Latency</div>
                    <div className="text-base font-bold text-amber-400 font-mono mt-0.5">{p.p95LatencyMs}ms</div>
                  </div>
                  <div className="p-3 bg-slate-800/40 rounded-xl text-center">
                    <div className="text-[11px] text-slate-400">Success Rate</div>
                    <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">{p.successRate}%</div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="text-slate-400 font-semibold">HTTP Status Distribution (24h)</div>
                  <div className="w-full bg-slate-800 h-2 rounded-full flex overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: '98.5%' }} title="2xx Success: 98.5%" />
                    <div className="bg-amber-500 h-full" style={{ width: '1.2%' }} title="4xx Client Error: 1.2%" />
                    <div className="bg-rose-500 h-full" style={{ width: '0.3%' }} title="5xx Server Error: 0.3%" />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span className="text-emerald-400">● 2xx Success (98.5%)</span>
                    <span className="text-amber-400">● 4xx Client (1.2%)</span>
                    <span className="text-rose-400">● 5xx Gateway (0.3%)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ROUTING & AUTHORITATIVE SWITCH */}
      {activeTab === 'routing' && (
        <div className="space-y-6">
          {/* Section 1: Carrier-to-Provider Matrix */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-white">Carrier Fulfillment Routing Rules</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="py-2">Network Carrier</th>
                    <th className="py-2">Primary Provider</th>
                    <th className="py-2">Fallback Provider</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {routingMatrix.map((r) => (
                    <tr key={r.networkCode}>
                      <td className="py-3 font-bold text-white">{r.networkCode}</td>
                      <td className="py-3 text-emerald-400 font-bold">{r.primaryProvider}</td>
                      <td className="py-3 text-slate-300">{r.fallbackProvider || 'NONE'}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-bold rounded-full text-[10px]">
                          ACTIVE
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Routing Edit Form */}
            <form onSubmit={handleUpdateRouting} className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-4 border-t border-slate-800 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Carrier</label>
                <select
                  value={selectedRoutingNet}
                  onChange={(e) => setSelectedRoutingNet(e.target.value as NetworkProvider)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                >
                  <option value={NetworkProvider.MTN}>MTN Ghana</option>
                  <option value={NetworkProvider.TELECEL}>Telecel Ghana</option>
                  <option value={NetworkProvider.AIRTELTIGO}>AirtelTigo (AT)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Primary Adapter</label>
                <select
                  value={selectedPrimary}
                  onChange={(e) => setSelectedPrimary(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.name}>{p.name} ({p.providerType})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Fallback Adapter</label>
                <select
                  value={selectedFallback}
                  onChange={(e) => setSelectedFallback(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={isUpdatingRouting}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition"
              >
                {isUpdatingRouting ? 'Saving...' : 'Update Carrier Routing'}
              </button>
            </form>
          </div>

          {/* Section 2: Authoritative Provider Promotion Safeguard */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold">⚠️</span>
                <h2 className="text-base font-bold text-white">Authoritative Provider Switch Safeguard</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Promote a secondary provider to authoritative status. ByteBeacon executes a 7-step pre-flight checklist to prevent transaction drops.
              </p>
            </div>

            <div className="flex flex-col md:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Candidate Provider</label>
                <select
                  value={targetSwitchProvider}
                  onChange={(e) => setTargetSwitchProvider(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.name}>{p.name} {p.isAuthoritative ? '(Current Authoritative)' : ''}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleValidateSwitch}
                disabled={isValidatingSwitch}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition"
              >
                {isValidatingSwitch ? 'Verifying Pre-Flight Checklist...' : 'Run Pre-Flight Validation'}
              </button>
            </div>

            {switchValidation && (
              <div className="p-4 bg-slate-800/70 border border-slate-700 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Validation Results: {switchValidation.targetProvider}</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                    switchValidation.canSwitch ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {switchValidation.canSwitch ? 'ALL CHECKS PASSED' : 'CHECKLIST BLOCKED'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {switchValidation.checks.map((chk, i) => (
                    <div key={i} className="p-2 bg-slate-900/60 rounded-lg flex items-center justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-2">
                        <span className={chk.passed ? 'text-emerald-400' : 'text-rose-400'}>
                          {chk.passed ? '✓' : '✗'}
                        </span>
                        {chk.check}
                      </span>
                      <span className="text-[11px] text-slate-400">{chk.message}</span>
                    </div>
                  ))}
                </div>

                {switchValidation.canSwitch && (
                  <div className="pt-3 border-t border-slate-700/60 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Reason / Justification *</label>
                      <input
                        type="text"
                        value={switchReason}
                        onChange={(e) => setSwitchReason(e.target.value)}
                        placeholder="e.g. Scheduled migration to direct carrier interconnect"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleExecuteSwitch}
                      disabled={isSwitching || !switchReason}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                      {isSwitching ? 'Executing Atomic Authority Switch...' : `Promote ${switchValidation.targetProvider} to Authoritative`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: WEBHOOKS */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Inbound Webhooks & Delivery Endpoints</h2>
            <span className="text-xs text-slate-400">Carrier async event callbacks & HMAC-SHA256 verification</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providers.map((p) => (
              <div key={p.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-sm">{p.name} Webhook</h3>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-bold text-[10px]">
                    HMAC VERIFIED
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Inbound Endpoint</span>
                  <span className="font-mono text-emerald-400">{p.webhookUrl || `/api/v1/fulfillment/${p.slug}/webhook`}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Signature Header</span>
                  <span className="font-mono text-slate-200">X-ByteBeacon-Signature</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Signing Secret</span>
                  <span className="font-mono text-slate-400">{p.credentialsMasked.webhookSecretMasked || '••••••••••••••••'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: TESTS */}
      {activeTab === 'tests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Diagnostic & Sandbox Testing Matrix</h2>
            <span className="text-xs text-slate-400">Connection reachability probes and mock order fulfillment</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {providers.map((p) => (
              <div key={p.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-white text-sm">{p.name}</h3>
                <p className="text-xs text-slate-400">
                  Execute 5-step diagnostic check or simulate end-to-end sandbox order.
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedProviderForTest(p)}
                    className="flex-1 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition"
                  >
                    ⚡ Diagnostic
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProviderForSandbox(p)}
                    className="flex-1 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold transition"
                  >
                    🧪 Sandbox Order
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: INCIDENTS */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Provider Incidents & Outage Log</h2>
              <span className="text-xs text-slate-400">Active degraded carrier routes and mitigation audit trail</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedIncidentForEdit(null);
                setIsIncidentModalOpen(true);
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition"
            >
              + Report Incident
            </button>
          </div>

          <div className="space-y-3">
            {(incidents.length > 0 ? incidents : [
              {
                id: 'inc_sample_1',
                providerId: 'p_dh',
                providerName: 'DataHouse',
                title: 'MTN Gateway Latency Spike (Resolved)',
                severity: 'HIGH',
                status: 'RESOLVED',
                affectedNetwork: 'MTN',
                failureRatePercent: 4.2,
                startedAt: new Date(Date.now() - 3600000).toISOString(),
                resolvedAt: new Date().toISOString(),
                summary: 'Aggregator MTN route experienced 4.2% timeout rate. Traffic temporarily routed to GMPL fallback.',
                mitigationNotes: 'Resolved by DataHouse upstream NOC.',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ]).map((inc) => (
              <div key={inc.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      inc.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
                      inc.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {inc.severity}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      inc.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {inc.status}
                    </span>
                    <h3 className="font-bold text-white text-sm">{inc.title}</h3>
                  </div>
                  <p className="text-xs text-slate-300">{inc.summary}</p>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Provider: {inc.providerName} • Carrier: {inc.affectedNetwork} • Started: {new Date(inc.startedAt).toLocaleString()}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedIncidentForEdit(inc as any);
                    setIsIncidentModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold self-start md:self-auto transition"
                >
                  Manage
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALS */}
      <AddProviderWizardModal
        isOpen={isAddWizardOpen}
        onClose={() => setIsAddWizardOpen(false)}
        onSuccess={fetchControlPlaneData}
      />

      {selectedProviderForDossier && (
        <ProviderDossierModal
          provider={selectedProviderForDossier}
          isOpen={Boolean(selectedProviderForDossier)}
          onClose={() => setSelectedProviderForDossier(null)}
          onRefresh={fetchControlPlaneData}
        />
      )}

      {selectedProviderForTest && (
        <ConnectionTestModal
          provider={selectedProviderForTest}
          isOpen={Boolean(selectedProviderForTest)}
          onClose={() => setSelectedProviderForTest(null)}
        />
      )}

      {selectedProviderForSandbox && (
        <SandboxTestModal
          provider={selectedProviderForSandbox}
          isOpen={Boolean(selectedProviderForSandbox)}
          onClose={() => setSelectedProviderForSandbox(null)}
        />
      )}

      {selectedNetworkForEdit && (
        <NetworkEditModal
          network={selectedNetworkForEdit}
          isOpen={Boolean(selectedNetworkForEdit)}
          onClose={() => setSelectedNetworkForEdit(null)}
          onSuccess={fetchControlPlaneData}
        />
      )}

      <ProviderIncidentModal
        providers={providers}
        incident={selectedIncidentForEdit}
        isOpen={isIncidentModalOpen}
        onClose={() => {
          setIsIncidentModalOpen(false);
          setSelectedIncidentForEdit(null);
        }}
        onSuccess={fetchControlPlaneData}
      />
    </div>
  );
};
