import React, { useState, useEffect } from 'react';
import {
  TelecomProviderDetailDto,
  ProviderCredentialDto,
} from '@bytebeacon/shared';
import { adminApi } from '../../../api/admin.api.js';
import { Modal } from '../../ui/Modal/Modal.js';
import { Button } from '../../ui/Button/Button.js';
import { Badge, NetworkBadge } from '../../ui/Badge/Badge.js';
import { ShieldCheck, RotateCcw, CheckCircle2, Lock } from 'lucide-react';

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Provider Dossier: ${provider.name}`}
      subtitle={`${provider.slug} • ${provider.providerType} ${provider.isAuthoritative ? '(Authoritative Engine)' : ''}`}
      maxWidth="700px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--color-border-default)' }}>
          {[
            { id: 'overview', label: 'Overview & Telemetry' },
            { id: 'credentials', label: 'Credentials Vault' },
            { id: 'capabilities', label: 'Capabilities' },
            { id: 'networks', label: 'Carrier Mappings' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '0.5rem 0.875rem',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                  backgroundColor: isActive ? 'var(--color-brand-surface)' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--color-brand)' : '2px solid transparent',
                  borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-danger-surface)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)' }}>
            {error}
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-surface-muted)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Avg Latency</div>
                <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{provider.avgLatencyMs}ms</div>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-surface-muted)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>P95 Latency</div>
                <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-warning)' }}>{provider.p95LatencyMs}ms</div>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-surface-muted)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Success Rate</div>
                <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-brand)' }}>{provider.successRate}%</div>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-surface-muted)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Total Requests</div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>{provider.totalRequestsCount.toLocaleString()}</div>
              </div>
            </div>

            <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface-muted)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--font-size-xs)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Interconnect Details</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '0.375rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>API Base URL</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{provider.apiBaseUrl}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '0.375rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Authentication</span>
                <span style={{ color: 'var(--color-text-primary)' }}>{provider.authMethod}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '0.375rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Environment</span>
                <span style={{ color: 'var(--color-text-primary)' }}>{provider.environment}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '0.375rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Webhook Endpoint</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{provider.webhookUrl || 'Not configured'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Last Health Check</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {provider.lastHealthCheck ? new Date(provider.lastHealthCheck).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>

            {provider.description && (
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                <strong style={{ color: 'var(--color-text-primary)' }}>Notes: </strong> {provider.description}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CREDENTIALS VAULT */}
        {activeTab === 'credentials' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Server-side encrypted credential store. Keys are masked to prevent exposure.
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRotateMode(!rotateMode)}
                leftIcon={<RotateCcw size={14} />}
              >
                {rotateMode ? 'Cancel' : 'Rotate API Key'}
              </Button>
            </div>

            {rotateMode && (
              <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface-muted)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-brand)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Rotate Provider Credentials (Vault)
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                    New API Key *
                  </label>
                  <input
                    type="password"
                    value={rotateData.newApiKey}
                    onChange={(e) => setRotateData({ ...rotateData, newApiKey: e.target.value })}
                    placeholder="Enter new API key"
                    style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                    Rotation Reason / Justification *
                  </label>
                  <input
                    type="text"
                    value={rotateData.reason}
                    onChange={(e) => setRotateData({ ...rotateData, reason: e.target.value })}
                    placeholder="e.g. Scheduled quarterly rotation or key compromise mitigation"
                    style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)' }}
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRotate}
                  disabled={isRotating}
                  leftIcon={<ShieldCheck size={14} />}
                >
                  {isRotating ? 'Rotating...' : 'Confirm Key Rotation in Vault'}
                </Button>
              </div>
            )}

            {isLoadingCreds ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Loading secure credential vault...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                  <div
                    key={cred.id}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-bg-surface-elevated)',
                      border: '1px solid var(--color-border-default)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {cred.apiKeyMasked}
                        </span>
                        <Badge variant="brand" size="sm">{cred.environment}</Badge>
                        <Badge variant="success" size="sm">{cred.status}</Badge>
                      </div>
                      {cred.webhookSecretMasked && (
                        <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
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

        {/* TAB 3: CAPABILITIES */}
        {activeTab === 'capabilities' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto' }}>
            {Object.entries(provider.capabilities || {}).map(([key, isSupported]) => (
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
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{key.replace(/_/g, ' ')}</span>
                <Badge variant={isSupported ? 'success' : 'neutral'}>
                  {isSupported ? 'SUPPORTED' : 'UNSUPPORTED'}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: CARRIER MAPPINGS */}
        {activeTab === 'networks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Carrier routes currently mapped to this provider:
            </span>
            {provider.supportedNetworks.map((net) => (
              <div
                key={net}
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-surface-elevated)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <NetworkBadge network={net} size="md" />
                <Badge variant="success" size="sm" dot>AVAILABLE / ACTIVE</Badge>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-default)' }}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close Dossier
          </Button>
        </div>
      </div>
    </Modal>
  );
};
