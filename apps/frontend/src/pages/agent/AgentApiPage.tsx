import React, { useState } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
import { Input } from '../../components/ui/index.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useToast } from '../../context/ToastContext.js';
import { Key, Copy, Check, Eye, EyeOff, RefreshCw, Plus, Trash2, ShieldAlert } from 'lucide-react';

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  environment: 'LIVE' | 'TEST';
  createdAt: string;
  lastUsed: string;
  status: 'ACTIVE' | 'REVOKED';
}

export const AgentApiPage: React.FC = () => {
  const { toastSuccess, toastInfo } = useToast();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyEnv, setNewKeyEnv] = useState<'LIVE' | 'TEST'>('LIVE');
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);

  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [revealedKeyIds, setRevealedKeyIds] = useState<Record<string, boolean>>({});

  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([
    {
      id: 'key_1',
      name: 'Production Server Integration',
      prefix: 'ak_live_99f82a71d0e415b3ca61',
      environment: 'LIVE',
      createdAt: 'Aug 14, 2026',
      lastUsed: '2 mins ago',
      status: 'ACTIVE',
    },
    {
      id: 'key_2',
      name: 'Staging & QA Simulator',
      prefix: 'ak_test_88f9104ac7819e0b1122',
      environment: 'TEST',
      createdAt: 'Aug 10, 2026',
      lastUsed: '1 hour ago',
      status: 'ACTIVE',
    },
  ]);

  const handleToggleReveal = (id: string) => {
    setRevealedKeyIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyKey = (keyString: string, id: string) => {
    navigator.clipboard.writeText(keyString);
    setCopiedKeyId(id);
    toastSuccess('Copied', 'API Key copied to clipboard.');
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleGenerateKey = () => {
    const rawSecret = `ak_${newKeyEnv.toLowerCase()}_${Array.from({ length: 28 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    const newKey: ApiKeyItem = {
      id: `key_${Date.now()}`,
      name: newKeyName || (newKeyEnv === 'LIVE' ? 'Live Application Key' : 'Sandbox Test Key'),
      prefix: rawSecret,
      environment: newKeyEnv,
      createdAt: 'Just now',
      lastUsed: 'Never',
      status: 'ACTIVE',
    };
    setApiKeys([newKey, ...apiKeys]);
    setGeneratedSecret(rawSecret);
  };

  const handleRevokeKey = (id: string) => {
    setApiKeys(apiKeys.map((k) => (k.id === id ? { ...k, status: 'REVOKED' } : k)));
    toastInfo('Key Revoked', 'API Key has been permanently disabled.');
  };

  const handleRollKey = (id: string) => {
    const newSecret = `ak_live_${Array.from({ length: 28 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    setApiKeys(apiKeys.map((k) => (k.id === id ? { ...k, prefix: newSecret, lastUsed: 'Just rolled' } : k)));
    toastSuccess('Key Rolled', 'A fresh secret has been provisioned for this key.');
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
        {apiKeys.map((key) => {
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
        })}
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
                  variant={newKeyEnv === 'TEST' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setNewKeyEnv('TEST')}
                >
                  TEST (Sandbox)
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
              <Button variant="ghost" size="sm" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleGenerateKey}>
                Generate Key
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
