import { optimizeImageFile } from '../../utils/imageOptimizer.js';
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Input, PhoneInput, Textarea } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { storesApi, StoreProfileDto } from '../../api/stores.api.js';
import { STOREFRONT_CONFIG } from '../../config/storefront.config.js';
import {
  Mail,
  Globe,
  Save,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Sparkles,
  ShieldCheck,
  Upload,
  Trash2,
  Image as ImageIcon,
  Share2,
} from 'lucide-react';

export const StoreProfilePage: React.FC = () => {
  const location = useLocation();
  const { toastSuccess, toastError } = useToast();

  const isLinkView = location.pathname.endsWith('/link');

  const [storeData, setStoreData] = useState<StoreProfileDto | null>(null);
  const [storeName, setStoreName] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0066FF');
  const [accentColor, setAccentColor] = useState('#10B981');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [isOptimizingLogo, setIsOptimizingLogo] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toastError('File Too Large', 'Please select an image file under 10MB.');
      return;
    }

    setIsOptimizingLogo(true);
    setLogoLoadError(false);
    try {
      const optimizedUri = await optimizeImageFile(file, { maxWidth: 400, maxHeight: 400, quality: 0.88 });
      setLogoUrl(optimizedUri);
      toastSuccess('Logo Ready', 'Logo optimized and preview updated! Click Save Store Profile to apply.');
    } catch {
      toastError('Image Error', 'Failed to process selected image file.');
    } finally {
      setIsOptimizingLogo(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const fetchStoreProfile = async () => {
    try {
      const st = await storesApi.getStore();
      if (st) {
        setStoreData(st);
        if (st.storeName) setStoreName(st.storeName);
        if (st.slug) setSlug(st.slug);
        if (st.tagline) setTagline(st.tagline);
        if (st.description) setDescription(st.description);
        if (st.contactPhone) setContactPhone(st.contactPhone);
        if (st.contactEmail) setContactEmail(st.contactEmail);
        if (st.contactWhatsapp) setContactWhatsapp(st.contactWhatsapp);
        if (st.primaryColor) setPrimaryColor(st.primaryColor);
        if (st.accentColor) setAccentColor(st.accentColor);
        if (st.logoUrl) setLogoUrl(st.logoUrl);
      }
    } catch {
      // Use defaults if initial load fails
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreProfile();
  }, []);

  const cleanSlug = (slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  const directStoreUrl = STOREFRONT_CONFIG.getDirectStoreUrl(cleanSlug);
  const namespacedStoreUrl = STOREFRONT_CONFIG.getStoreUrl(cleanSlug);
  const subdomainStoreUrl = STOREFRONT_CONFIG.getSubdomainStoreUrl(cleanSlug);

  const handleCopyLink = (url: string, key: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      setCopiedKey(key);
      toastSuccess('Link Copied', `${url} copied to clipboard.`);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const handleSlugChange = (val: string) => {
    const formatted = val
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-');
    setSlug(formatted);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedSlug = cleanSlug.replace(/^-|-$/g, '');
    if (!storeName.trim()) {
      toastError('Validation Error', 'Store business name is required.');
      return;
    }
    if (!normalizedSlug || normalizedSlug.length < 2) {
      toastError('Validation Error', 'Custom URL slug must be at least 2 characters.');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<StoreProfileDto> = {
        storeName: storeName.trim(),
        slug: normalizedSlug,
        tagline: tagline.trim(),
        description: description.trim(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim(),
        contactWhatsapp: contactWhatsapp.trim(),
        primaryColor,
        accentColor,
        logoUrl: logoUrl.trim(),
      };

      const result = await storesApi.saveStoreConfig(payload);

      if (result) {
        setStoreData(result);
        if (result.slug) setSlug(result.slug);
        if (result.storeName) setStoreName(result.storeName);
        if (result.logoUrl !== undefined) setLogoUrl(result.logoUrl || '');
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bytebeacon:store-updated'));
      }

      toastSuccess(
        'Storefront Saved',
        `Store profile, logo, and custom link updated to ${STOREFRONT_CONFIG.getDirectStoreUrl(normalizedSlug)}`
      );
    } catch (err: any) {
      toastError('Save Failed', err.message || 'Unable to update store profile.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10B981' }}>
            Storefront Identity & Links
          </span>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
            {isLinkView ? 'Storefront URL & Custom Link' : 'Store Profile & Identity'}
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Manage your customer storefront link, custom URL slug, branding, and merchant support channels.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {storeData?.storeStatus === 'ACTIVE' && storeData?.approvalStatus === 'APPROVED' ? (
            <Badge variant="success" size="md">
              <ShieldCheck size={14} style={{ marginRight: '0.25rem' }} />
              Live & Verified
            </Badge>
          ) : (
            <Badge variant="warning" size="md">
              Application In Review
            </Badge>
          )}
        </div>
      </div>

      {/* Public Storefront Link Hub */}
      <Card
        style={{
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-2xl)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          boxShadow: '0 4px 20px -2px rgba(16, 185, 129, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Globe size={22} />
            </div>
            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Primary Customer Storefront URL
              </span>
              <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                {directStoreUrl}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopyLink(directStoreUrl, 'primary')}
              leftIcon={copiedKey === 'primary' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
              style={{ fontWeight: 700 }}
            >
              {copiedKey === 'primary' ? 'Copied!' : 'Copy Link'}
            </Button>
            <a
              href={directStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#10B981',
                color: '#000000',
                textDecoration: 'none',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 800,
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
              }}
            >
              <span>Visit Storefront</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* Alternative link formats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-3)',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--color-border-subtle)',
          }}
        >
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--color-bg-surface-elevated)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Store Path Link
              </span>
              <div style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                {namespacedStoreUrl}
              </div>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => handleCopyLink(namespacedStoreUrl, 'namespaced')}
            >
              {copiedKey === 'namespaced' ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
            </Button>
          </div>

          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--color-bg-surface-elevated)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Merchant Subdomain Link
              </span>
              <div style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                {subdomainStoreUrl}
              </div>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => handleCopyLink(subdomainStoreUrl, 'subdomain')}
            >
              {copiedKey === 'subdomain' ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
            </Button>
          </div>
        </div>

        <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Sparkles size={12} color="#10B981" />
          <span>
            All purchases made through your link deposit 100% payments via Paystack and credit your reseller profit markup automatically.
          </span>
        </div>
      </Card>

      {/* Store Profile & Custom Slug Form */}
      <form onSubmit={handleSave}>
        <Card
          style={{
            padding: 'var(--space-6)',
            borderRadius: 'var(--radius-2xl)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
          }}
        >
          {/* Storefront Logo & White-Label Branding */}
          <div
            style={{
              padding: 'var(--space-4) var(--space-5)',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--color-bg-surface-elevated)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                <ImageIcon size={15} color="#10B981" />
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  Storefront Logo & Custom Branding
                </h3>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Upload your custom logo to replace all platform icons on your customer storefront, browser tab favicon, and social previews.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              {/* Live Preview Squircle */}
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '16px',
                  backgroundColor: primaryColor,
                  border: '2px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
                }}
              >
                {logoUrl && !logoLoadError ? (
                  <img
                    src={logoUrl}
                    alt="Store Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onLoad={() => setLogoLoadError(false)}
                    onError={() => setLogoLoadError(true)}
                  />
                ) : (
                  <span style={{ fontSize: '24px', fontWeight: 900, color: '#000000' }}>
                    {(storeName.charAt(0) || 'S').toUpperCase()}
                  </span>
                )}
              </div>

              {/* Upload Controls & URL input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: '260px' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.45rem 0.95rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#10B981',
                      color: '#000000',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 800,
                      cursor: isOptimizingLogo ? 'wait' : 'pointer',
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    <Upload size={14} />
                    <span>{isOptimizingLogo ? 'Optimizing Picture...' : 'Upload Picture from Local'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoFileUpload}
                      disabled={isOptimizingLogo}
                      style={{ display: 'none' }}
                    />
                  </label>

                  {logoUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => {
                        setLogoUrl('');
                        setLogoLoadError(false);
                      }}
                      leftIcon={<Trash2 size={13} color="#EF4444" />}
                      style={{ color: '#EF4444', fontWeight: 700 }}
                    >
                      Remove Logo
                    </Button>
                  )}

                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                    PNG, JPG, SVG, WebP up to 10MB
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <Input
                    placeholder="Or paste direct image URL (e.g. https://.../logo.png)"
                    value={logoUrl}
                    onChange={(e) => {
                      setLogoUrl(e.target.value);
                      setLogoLoadError(false);
                    }}
                    style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}
                  />

                  {/* Live Image Validation Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {logoLoadError && logoUrl && (
                      <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 600 }}>
                        ⚠️ Unable to load image from this URL. Please verify link points to an image (.png, .jpg, .svg, .webp).
                      </span>
                    )}
                    {!logoLoadError && logoUrl && (
                      <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 600 }}>
                        ✓ Image active and ready to save
                      </span>
                    )}
                    {logoUrl && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) && (
                      <a
                        href={logoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '11px', color: '#3B82F6', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}
                      >
                        <span>Test link in new tab</span>
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Store Identity & Custom Slug
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.2rem 0 0 0' }}>
              Your Custom URL Slug defines your storefront link across the apisolutions.store network.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            <Input
              label="Store Business Name"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="e.g. DataHub Express"
              required
            />

            <div>
              <Input
                label="Custom URL Slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="e.g. datahub-express"
                required
              />
              <div style={{ marginTop: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Preview: https://apisolutions.store/{cleanSlug || 'your-slug'}
                </span>
                {cleanSlug && cleanSlug.length >= 2 ? (
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: '#10B981', fontWeight: 700 }}>
                    ✓ Valid slug format
                  </span>
                ) : (
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                    Letters, numbers, and hyphens
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Live Social Sharing Card Preview (WhatsApp, Facebook, Twitter, iMessage) */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(51, 65, 85, 0.6)',
            borderRadius: '16px',
            padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Share2 size={16} color="#38BDF8" />
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  Social Link Share Preview (WhatsApp, Twitter, Facebook &amp; iMessage)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  leftIcon={copiedLink ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
                  onClick={() => {
                    const targetSlug = cleanSlug || slug || 'your-store';
                    const fullUrl = `https://apisolutions.store/${targetSlug}`;
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(fullUrl);
                    }
                    setCopiedLink(true);
                    toastSuccess('Storefront link copied to clipboard!');
                    setTimeout(() => setCopiedLink(false), 2500);
                  }}
                >
                  {copiedLink ? 'Link Copied!' : 'Copy Link'}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  leftIcon={copiedMsg ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
                  onClick={() => {
                    const targetSlug = cleanSlug || slug || 'your-store';
                    const fullUrl = `https://apisolutions.store/${targetSlug}`;
                    const promo = `⚡ Buy cheap & instant MTN, Telecel & AT mobile data bundles from ${storeName || 'my store'}:\n👉 ${fullUrl}`;
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(promo);
                    }
                    setCopiedMsg(true);
                    toastSuccess('WhatsApp promotional message copied!');
                    setTimeout(() => setCopiedMsg(false), 2500);
                  }}
                >
                  {copiedMsg ? 'Copied Message!' : 'Copy WhatsApp Text'}
                </Button>
                <a
                  href={`https://apisolutions.store/${cleanSlug || slug || ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <Button type="button" size="xs" variant="ghost" leftIcon={<ExternalLink size={13} />}>
                    Open Link
                  </Button>
                </a>
              </div>
            </div>

            {/* Simulated Open Graph unfurl card */}
            <div style={{
              background: '#0B0F17',
              border: '1px solid #1E293B',
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
            }}>
              <div style={{
                height: '140px',
                background: `linear-gradient(135deg, ${primaryColor}33 0%, #0F172A 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                borderBottom: '1px solid #1E293B',
              }}>
                {logoUrl && !logoLoadError ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    style={{ maxHeight: '80px', maxWidth: '160px', objectFit: 'contain', borderRadius: '12px' }}
                  />
                ) : (
                  <div style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '18px',
                    backgroundColor: primaryColor,
                    color: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '32px',
                    boxShadow: '0 8px 24px -4px rgba(0,0,0,0.6)',
                  }}>
                    {(storeName || 'D').charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '12px',
                  background: 'rgba(0, 0, 0, 0.7)',
                  backdropFilter: 'blur(4px)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#10B981',
                }}>
                  ✓ Verified Store
                </div>
              </div>

              <div style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>
                <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>
                  apisolutions.store
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#F8FAFC', marginBottom: '4px' }}>
                  {storeName || 'Your Store Business Name'} - Buy Affordable Data Bundles
                </div>
                <div style={{ fontSize: '12px', color: '#94A3B8', lineHeight: 1.4 }}>
                  {tagline || description || 'Instant automated mobile telecom data delivery across MTN, Telecel, and AT in Ghana.'}
                </div>
              </div>
            </div>
          </div>

          <Input
            label="Tagline (Catchy Headline)"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="e.g. Instant Automated Telecom Data Bundles at Best Rates"
          />

          <Textarea
            label="Storefront Description (About Your Store)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain your services to customers visiting your storefront..."
            rows={3}
          />

          <div style={{ paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Customer Support Contacts
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.2rem 0 0 0' }}>
              These contact details are shown on your customer storefront so buyers can contact you for inquiries.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
            <PhoneInput
              label="Support Phone Number"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="024XXXXXXX"
            />

            <Input
              label="Support Email Address"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="support@yourstore.com"
              leftIcon={<Mail size={14} color="var(--color-text-muted)" />}
            />

            <PhoneInput
              label="Support WhatsApp (Instant Chat)"
              value={contactWhatsapp}
              onChange={(e) => setContactWhatsapp(e.target.value)}
              placeholder="024XXXXXXX"
            />
          </div>

          <div style={{ marginTop: 'var(--space-2)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button
              variant="primary"
              size="md"
              type="submit"
              isLoading={saving}
              leftIcon={<Save size={15} />}
              style={{ fontWeight: 800, backgroundColor: '#10B981', color: '#000000' }}
            >
              Save Store Profile & Custom Link
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
};
