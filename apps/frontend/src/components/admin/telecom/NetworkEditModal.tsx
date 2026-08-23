import React, { useState } from 'react';
import {
  TelecomNetworkDto,
  TelecomProviderStatus,
  UpdateTelecomNetworkRequest,
} from '@bytebeacon/shared';
import { adminApi } from '../../../api/admin.api';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📡</span> Edit Carrier Network: {network.name} ({network.code})
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
              >
                <option value={TelecomProviderStatus.ACTIVE}>ACTIVE</option>
                <option value={TelecomProviderStatus.INACTIVE}>INACTIVE</option>
                <option value={TelecomProviderStatus.DEGRADED}>DEGRADED</option>
                <option value={TelecomProviderStatus.MAINTENANCE}>MAINTENANCE</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Active Status</label>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                />
                <span className="text-xs text-white">Enable Traffic Routing</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Carrier Direct Endpoint URL</label>
            <input
              type="url"
              value={formData.endpointUrl || ''}
              onChange={(e) => setFormData({ ...formData, endpointUrl: e.target.value })}
              placeholder="https://api.provider.com/v1/carrier"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Carrier Webhook Endpoint</label>
            <input
              type="text"
              value={formData.webhookUrl || ''}
              onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
              placeholder="/api/v1/fulfillment/webhook"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Daily Volume Limit (MB)</label>
              <input
                type="number"
                value={formData.dailyVolumeLimitMb}
                onChange={(e) => setFormData({ ...formData, dailyVolumeLimitMb: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Daily Order Limit</label>
              <input
                type="number"
                value={formData.dailyOrderLimit}
                onChange={(e) => setFormData({ ...formData, dailyOrderLimit: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Min Bundle (MB)</label>
              <input
                type="number"
                value={formData.minBundleMb}
                onChange={(e) => setFormData({ ...formData, minBundleMb: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Max Bundle (MB)</label>
              <input
                type="number"
                value={formData.maxBundleMb}
                onChange={(e) => setFormData({ ...formData, maxBundleMb: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>
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
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
