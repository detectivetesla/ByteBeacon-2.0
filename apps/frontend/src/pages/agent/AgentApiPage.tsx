import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
import { Input } from '../../components/ui/index.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useToast } from '../../context/ToastContext.js';
import { apiKeysApi } from '../../api/apiKeys.api.js';
import { Key, Copy, Check, Eye, EyeOff, RefreshCw, Plus, Trash2, ShieldAlert } from 'lucide-react';

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  environment: 'LIVE' | 'SANDBOX';
  createdAt: string;
  lastUsed: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
}

export const AgentApiPage: React.FC = () => {
  const { toastSuccess, toastError, toastInfo } = useToast();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyEnv, setNewKeyEnv] = useState<'LIVE' | 'SANDBOX'>('LIVE');
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [revealedKeyIds, setRevealedKeyIds] = useState<Record<string, boolean>>({});
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);

  const fetchKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await apiKeysApi.listKeys();
      const mapped: ApiKeyItem[] = (items || []).map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.keyPrefix,
        environment: k.environment,
        createdAt: k.createdAt ? new Date(k.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently',
        lastUsed: k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Never',
        status: k.status,
      }));
      setApiKeys(mapped);
    } catch {
      setApiKeys([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleToggleReveal = (id: string) => {
    setRevealedKeyIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyKey = (keyString: string, id: string) => {
    navigator.clipboard.writeText(keyString);
    setCopiedKeyId(id);
    toastSuccess('Copied', 'API Key copied to clipboard.');
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleGenerateKey = async () => {
    if (!newKeyName.trim()) {
      toastError('Name Required', 'Please enter an identifier name for this API key.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiKeysApi.createKey({
        name: newKeyName.trim(),
        environment: newKeyEnv,
        scopes: ['orders:write', 'catalog:read', 'wallet:read'],
      });

      setGeneratedSecret(res.apiKey);
      toastSuccess('API Key Provisioned', 'Store your raw API secret safely. It will not be shown again.');
      fetchKeys();
    } catch (err: any) {
      toastError('Provisioning Failed', err.message || 'Unable to create API key.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    try {
      await apiKeysApi.revokeKey(id);
      toastInfo('Key Revoked', 'API Key has been permanently disabled.');
      fetchKeys();
    } catch (err: any) {
      toastError('Revocation Failed', err.message || 'Unable to revoke key.');
    }
  };

  const handleRollKey = async (id: string) => {
    try {
      const res = await apiKeysApi.rollKey(id);
      setGeneratedSecret(res.apiKey);
      toastSuccess('Key Rolled', 'A fresh secret has been provisioned. Save your new key immediately.');
      fetchKeys();
    } catch (err: any) {
      toastError('Roll Failed', err.message || 'Unable to roll key.');
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <TactileIcon icon={Key} color="api" size="sm" />
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              API Keys
            </h1>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Manage and rotate production & sandbox credentials for programmatic REST dispatch.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setNewKeyName('');
            setNewKeyEnv('LIVE');
            setGeneratedSecret(null);
            setCreateModalOpen(true);
          }}
          leftIcon={<Plus size={15} />}
        >
          Create API Key
        </Button>
      </div>

      {/* Keys List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {isLoading ? (
          <Card style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading API keys...
          </Card>
        ) : apiKeys.length === 0 ? (
          <Card style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No API keys provisioned yet. Click "Create API Key" above to generate your first integration credential.
          </Card>
        ) : (
          apiKeys.map((key) => {
            const isRevealed = !!revealedKeyIds[key.id];
            const displayPrefix = isRevealed
              ? key.prefix
              : `${key.prefix.substring(0, 10)}••••••••••••••••••••`;

            return (
            <Card
              key={key.id}
              style={{
                padding: 'var(--space-5)',
                backgroundColor: 'var(--color-bg-surface)',
                border: key.status === 'REVOKED' ? '1px solid var(--color-border-subtle)' : '1px solid var(--color-border-default)',
                opacity: key.status === 'REVOKED' ? 0.6 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                    {key.name}
                  </strong>
                  <Badge variant={key.environment === 'LIVE' ? 'success' : 'info'} size="sm">
                    {key.environment}
                  </Badge>
                  {key.status === 'REVOKED' && (
                    <Badge variant="danger" size="sm">
                      REVOKED
                    </Badge>
                  )}
                </div>

                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                  Created {key.createdAt} · Last used {key.lastUsed}
                </span>
              </div>

              {/* Key Box Row */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <code
                  style={{
                    flex: 1,
                    minWidth: '220px',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'var(--color-bg-base)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-xs)',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-primary-light)',
                    wordBreak: 'break-all',
                  }}
                >
                  {displayPrefix}
                </code>

                {key.status === 'ACTIVE' && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleToggleReveal(key.id)}>
                      {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>

                    <Button variant="outline" size="sm" onClick={() => handleCopyKey(key.prefix, key.id)}>
                      {copiedKeyId === key.id ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                      {copiedKeyId === key.id ? 'Copied' : 'Copy'}
                    </Button>

                    <Button variant="ghost" size="sm" onClick={() => handleRollKey(key.id)} leftIcon={<RefreshCw size={13} />}>
                      Roll
                    </Button>

                    <Button variant="ghost" size="sm" onClick={() => handleRevokeKey(key.id)} leftIcon={<Trash2 size={13} color="var(--color-danger)" />}>
                      Revoke
                    </Button>
                  </>
                )}
              </div>
            </Card>
          );
        }))}
      </div>

      {/* Security Best Practices Card */}
      <Card style={{ padding: 'var(--space-5)', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
          <ShieldAlert size={16} color="var(--color-warning)" />
          <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            Security Invariant
          </h3>
        </div>
        <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
          Never embed your live production API keys in client-side applications (React, iOS, Android). Always route orders through your secure backend proxy to protect your wallet balance.
        </p>
      </Card>

      {/* Create Key Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={generatedSecret ? 'API Key Generated' : 'Create API Key'}
        subtitle={
          generatedSecret
            ? 'Copy your secret now. For security reasons, full secrets are not displayed again.'
            : 'Generate a new credential to authenticate orders.'
        }
      >
        {generatedSecret ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div
              style={{
                backgroundColor: 'var(--color-bg-base)',
                border: '1px solid var(--color-brand)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-brand)',
                wordBreak: 'break-all',
              }}
            >
              {generatedSecret}
            </div>

            <Button
              variant="primary"
              size="md"
              fullWidth
              rightIcon={<Copy size={16} />}
              onClick={() => {
                navigator.clipboard.writeText(generatedSecret);
                toastSuccess('Copied', 'API secret copied to clipboard');
                setCreateModalOpen(false);
              }}
            >
              Copy Secret & Close
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Input
              label="Key Identifier"
              placeholder="e.g. Production Mobile Backend"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />

            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', display: 'block', marginBottom: '0.375rem' }}>
                Environment
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  variant={newKeyEnv === 'LIVE' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setNewKeyEnv('LIVE')}
                >
                  LIVE (Production)
                </Button>
                <Button
                  variant={newKeyEnv === 'SANDBOX' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setNewKeyEnv('SANDBOX')}
                >
                  SANDBOX (Test)
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
              <Button variant="ghost" size="sm" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleGenerateKey} disabled={isSubmitting}>
                {isSubmitting ? 'Generating...' : 'Generate Key'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
