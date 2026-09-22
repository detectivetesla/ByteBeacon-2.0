import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { useToast } from '../../context/ToastContext.js';
import { storesApi, StoreProfileDto } from '../../api/stores.api.js';
import {
  Link as LinkIcon,
  Copy,
  ExternalLink,
  QrCode,
  Download,
  MessageCircle,
  CheckCircle2,
  Code2,
  Loader2,
} from 'lucide-react';

import { STOREFRONT_CONFIG } from '../../config/storefront.config.js';

export const StoreLinkPage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();
  const [store, setStore] = useState<StoreProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [customMsg, setCustomMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await storesApi.getStore('my-store');
        setStore(res);
        if (res) {
          setCustomMsg(
            `🚀 Buy fast, instant data bundles for MTN, Telecel, and AT at unbeatable reseller rates on ${res.storeName}! Non-expiry, instant delivery. Order now:`,
          );
        }
      } catch (err: any) {
        toastError('Failed to load store', err.message || 'Could not fetch store link');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toastError]);

  const storeSlug = store?.slug || 'my-store';
  const storeUrl = STOREFRONT_CONFIG.getStoreUrl(storeSlug);
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=15&data=${encodeURIComponent(storeUrl)}`;

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(storeUrl);
      setCopiedLink(true);
      toastSuccess('Link Copied!', 'Storefront URL copied to clipboard.');
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleDownloadQr = async () => {
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${storeSlug}-qr-code.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toastSuccess('QR Code Downloaded', 'Saved QR code to your device.');
    } catch {
      window.open(qrCodeUrl, '_blank');
    }
  };

  const handleWhatsAppShare = () => {
    const text = `${customMsg} ${storeUrl}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleCopyEmbed = () => {
    const iframeCode = `<iframe src="${storeUrl}" width="100%" height="800px" style="border:none;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);" title="${store?.storeName || 'Data Store'}"></iframe>`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(iframeCode);
      setCopiedEmbed(true);
      toastSuccess('Embed Code Copied', 'Paste into your blog or website HTML.');
      setTimeout(() => setCopiedEmbed(false), 3000);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="store-page-container">
      {/* Header */}
      <div className="store-header-row">
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10B981' }}>
            Distribution & Marketing
          </span>
          <h1 style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Store Link & Promotion
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0', lineHeight: 1.4 }}>
            Share your public storefront URL, download your scannable QR flyer, and promote across WhatsApp and social media.
          </p>
        </div>
      </div>

      {/* Main Link Card */}
      <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
              <LinkIcon size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                Public Storefront URL
              </h2>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                Live, customer-facing checkout portal
              </span>
            </div>
          </div>
          <Badge variant="success" size="sm">
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981', marginRight: '6px' }} />
            Active & Accepting Payments
          </Badge>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', backgroundColor: 'var(--color-bg-surface-elevated)', padding: '0.65rem 1rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-subtle)' }}>
          <span style={{ flex: '1 1 200px', minWidth: 'min(100%, 180px)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', wordBreak: 'break-all', fontWeight: 600 }}>
            {storeUrl}
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <Button
              variant={copiedLink ? 'primary' : 'outline'}
              size="sm"
              onClick={handleCopyLink}
              leftIcon={copiedLink ? <CheckCircle2 size={13} /> : <Copy size={13} />}
              style={{ minHeight: '38px', ...(copiedLink ? { backgroundColor: '#10B981', color: '#000000', fontWeight: 800 } : {}) }}
            >
              {copiedLink ? 'Copied' : 'Copy Link'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(storeUrl, '_blank')}
              leftIcon={<ExternalLink size={13} />}
              style={{ minHeight: '38px' }}
            >
              Open Store
            </Button>
          </div>
        </div>
      </Card>

      {/* 2-Column: QR Code & WhatsApp Marketing */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 'var(--space-6)' }}>
        {/* QR Flyer */}
        <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6', marginBottom: 'var(--space-3)' }}>
            <QrCode size={20} />
          </div>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            Customer Scan & Pay QR
          </h3>
          <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', margin: '0.25rem 0 var(--space-4) 0', maxWidth: '300px' }}>
            Print for your shop counter, sticker, or include in flyers. Customers scan to order immediately.
          </p>

          <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: 'var(--space-4)' }}>
            <img
              src={qrCodeUrl}
              alt="Storefront QR Code"
              style={{ width: '180px', height: '180px', display: 'block' }}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadQr}
            leftIcon={<Download size={14} />}
            style={{ fontWeight: 700 }}
          >
            Download QR Flyer (PNG)
          </Button>
        </Card>

        {/* WhatsApp & Social Promotion */}
        <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(37, 211, 102, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#25D366' }}>
              <MessageCircle size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                WhatsApp 1-Click Blast
              </h3>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                Broadcast instantly to WhatsApp contacts & status
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              Broadcast Message
            </label>
            <textarea
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-bg-surface-elevated)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-xs)',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={handleWhatsAppShare}
            leftIcon={<MessageCircle size={16} />}
            style={{ backgroundColor: '#25D366', color: '#FFFFFF', fontWeight: 800, width: '100%', minHeight: '44px' }}
          >
            Share on WhatsApp
          </Button>

          <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              Other Social Channels
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                size="xs"
                onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(customMsg)}&url=${encodeURIComponent(storeUrl)}`, '_blank')}
              >
                Twitter / X
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(storeUrl)}&text=${encodeURIComponent(customMsg)}`, '_blank')}
              >
                Telegram
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storeUrl)}`, '_blank')}
              >
                Facebook
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Website Embed Card */}
      <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A855F7' }}>
              <Code2 size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                Embed on Your Website or Blog
              </h3>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                Insert an interactive data store widget into any HTML page
              </span>
            </div>
          </div>
          <Button
            variant={copiedEmbed ? 'primary' : 'outline'}
            size="sm"
            onClick={handleCopyEmbed}
            leftIcon={copiedEmbed ? <CheckCircle2 size={13} /> : <Copy size={13} />}
            style={copiedEmbed ? { backgroundColor: '#10B981', color: '#000000', fontWeight: 800 } : {}}
          >
            {copiedEmbed ? 'Copied' : 'Copy HTML Snippet'}
          </Button>
        </div>

        <pre
          style={{
            margin: 0,
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-bg-surface-elevated)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-2xs)',
            fontFamily: 'var(--font-mono)',
            overflowX: 'auto',
          }}
        >
          {`<iframe src="${storeUrl}" width="100%" height="800px" style="border:none;border-radius:16px;" title="${store?.storeName || 'Data Store'}"></iframe>`}
        </pre>
      </Card>
    </div>
  );
};
