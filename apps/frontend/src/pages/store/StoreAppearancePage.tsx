import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Input, Textarea } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { storesApi } from '../../api/stores.api.js';
import { optimizeImageFile } from '../../utils/imageOptimizer.js';
import { STOREFRONT_CONFIG } from '../../config/storefront.config.js';
import {
  Check,
  Save,
  Store,
  Smartphone,
  Monitor,
  Upload,
  Trash2,
  Image as ImageIcon,
  ExternalLink,
  RotateCcw,
  Sparkles,
  Moon,
  Sun,
  Zap,
  ShieldCheck,
  Globe,
} from 'lucide-react';

interface PresetTheme {
  name: string;
  primary: string;
  accent: string;
  description: string;
}

const PRESET_THEMES: PresetTheme[] = [
  { name: 'Emerald Growth (Default)', primary: '#10B981', accent: '#A3E635', description: 'Trusted fintech green with lime accents' },
  { name: 'Ocean Blue', primary: '#0066FF', accent: '#00E599', description: 'Electric blue with vibrant mint highlight' },
  { name: 'Royal Violet', primary: '#8B5CF6', accent: '#EC4899', description: 'Modern purple with neon orchid accents' },
  { name: 'Midnight Indigo', primary: '#4F46E5', accent: '#06B6D4', description: 'Deep indigo with cyan contrast' },
  { name: 'Sunset Amber', primary: '#F59E0B', accent: '#FBBF24', description: 'Warm amber with radiant golden highlights' },
  { name: 'Crimson Passion', primary: '#E11D48', accent: '#FB7185', description: 'Bold energetic crimson with soft coral' },
  { name: 'Cyberpunk Neon', primary: '#06B6D4', accent: '#F43F5E', description: 'High-tech cyan with neon rose accent' },
  { name: 'Dark Slate & Lime', primary: '#0F172A', accent: '#84CC16', description: 'Stealth dark titanium with electric lime' },
];

export const StoreAppearancePage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();

  const [storeName, setStoreName] = useState('My Store');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('Instant Automated Telecommunications Data');
  const [description, setDescription] = useState('Direct automated data bundle delivery straight to your phone across MTN, Telecel, and AirtelTigo.');
  const [primaryColor, setPrimaryColor] = useState('#10B981');
  const [accentColor, setAccentColor] = useState('#A3E635');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  // UI States
  const [saving, setSaving] = useState(false);
  const [isOptimizingLogo, setIsOptimizingLogo] = useState(false);
  const [isOptimizingBanner, setIsOptimizingBanner] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [previewTheme, setPreviewTheme] = useState<'dark' | 'light'>('dark');

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    storesApi.getStore().then((st) => {
      if (st) {
        if (st.storeName) setStoreName(st.storeName);
        if (st.slug) setSlug(st.slug);
        if (st.tagline) setTagline(st.tagline);
        if (st.description) setDescription(st.description);
        if (st.primaryColor) setPrimaryColor(st.primaryColor);
        if (st.accentColor) setAccentColor(st.accentColor);
        if (st.logoUrl) setLogoUrl(st.logoUrl);
        if (st.bannerUrl) setBannerUrl(st.bannerUrl);
      }
    }).catch(() => {
      // Keep defaults
    });
  }, []);

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toastError('File Too Large', 'Please select a logo image under 10MB.');
      return;
    }

    setIsOptimizingLogo(true);
    try {
      const optimizedUri = await optimizeImageFile(file, { maxWidth: 400, maxHeight: 400, quality: 0.88 });
      setLogoUrl(optimizedUri);
      toastSuccess('Logo Optimized', 'Store logo updated in preview! Click Save Appearance to apply live.');
    } catch {
      toastError('Image Error', 'Failed to process selected logo image.');
    } finally {
      setIsOptimizingLogo(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleBannerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toastError('File Too Large', 'Please select a banner image under 15MB.');
      return;
    }

    setIsOptimizingBanner(true);
    try {
      const optimizedUri = await optimizeImageFile(file, { maxWidth: 1200, maxHeight: 450, quality: 0.85 });
      setBannerUrl(optimizedUri);
      toastSuccess('Banner Optimized', 'Cover banner updated in preview! Click Save Appearance to apply live.');
    } catch {
      toastError('Image Error', 'Failed to process selected banner image.');
    } finally {
      setIsOptimizingBanner(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSelectPreset = (preset: PresetTheme) => {
    setPrimaryColor(preset.primary);
    setAccentColor(preset.accent);
  };

  const handleResetDefaults = () => {
    setPrimaryColor('#10B981');
    setAccentColor('#A3E635');
    toastSuccess('Colors Reset', 'Reset color palette to default brand theme.');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const savedStore = await storesApi.saveStoreConfig({
        storeName: storeName.trim(),
        slug: cleanSlug || undefined,
        tagline: tagline.trim(),
        description: description.trim(),
        primaryColor: primaryColor.trim(),
        accentColor: accentColor.trim(),
        logoUrl: logoUrl.trim(),
        bannerUrl: bannerUrl.trim(),
      });

      if (savedStore) {
        if (savedStore.storeName) setStoreName(savedStore.storeName);
        if (savedStore.slug) setSlug(savedStore.slug);
        if (savedStore.tagline !== undefined) setTagline(savedStore.tagline || '');
        if (savedStore.description !== undefined) setDescription(savedStore.description || '');
        if (savedStore.primaryColor) setPrimaryColor(savedStore.primaryColor);
        if (savedStore.accentColor) setAccentColor(savedStore.accentColor);
        if (savedStore.logoUrl !== undefined) setLogoUrl(savedStore.logoUrl || '');
        if (savedStore.bannerUrl !== undefined) setBannerUrl(savedStore.bannerUrl || '');
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bytebeacon:store-updated'));
      }
      toastSuccess('Appearance Saved', 'Storefront theme and branding updated successfully!');
    } catch (err: any) {
      toastError('Save Failed', err.message || 'Unable to update store appearance.');
    } finally {
      setSaving(false);
    }
  };

  const liveStoreUrl = slug
    ? (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? STOREFRONT_CONFIG.getRelativeStorePath(slug)
        : STOREFRONT_CONFIG.getStoreUrl(slug))
    : '/';

  const isDarkPreview = previewTheme === 'dark';
  const previewBg = isDarkPreview ? '#0B0F19' : '#F8FAFC';
  const previewCardBg = isDarkPreview ? '#151C2C' : '#FFFFFF';
  const previewCardBorder = isDarkPreview ? '#232F46' : '#E2E8F0';
  const previewTextPrimary = isDarkPreview ? '#FFFFFF' : '#0F172A';
  const previewTextSecondary = isDarkPreview ? '#94A3B8' : '#64748B';

  return (
    <div className="store-page-container">
      {/* Header */}
      <div className="store-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
            <Sparkles size={14} color="#EC4899" />
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#EC4899' }}>
              Storefront Theme & Branding
            </span>
          </div>
          <h1 style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Store Appearance & Branding
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0', lineHeight: 1.4 }}>
            Customize your customer-facing brand visual identity, logo, cover banner, and live storefront theme.
          </p>
        </div>

        <div className="store-header-actions">
          {slug && (
            <a
              href={liveStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                color: 'var(--color-text-secondary)',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-default)',
                padding: '0.55rem 0.95rem',
                minHeight: '44px',
                borderRadius: 'var(--radius-lg)',
                textDecoration: 'none',
                transition: 'border-color 150ms ease',
                flex: '1 1 auto',
              }}
            >
              <Globe size={14} />
              <span>Live Storefront</span>
              <ExternalLink size={12} />
            </a>
          )}

          <Button
            variant="secondary"
            size="md"
            onClick={handleResetDefaults}
            leftIcon={<RotateCcw size={14} />}
            style={{ minHeight: '44px', flex: '1 1 auto' }}
          >
            Defaults
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            isLoading={saving}
            leftIcon={<Save size={14} />}
            style={{ minHeight: '44px', flex: '1 1 auto' }}
          >
            Save Appearance
          </Button>
        </div>
      </div>

      {/* Main Grid: Customizer Controls (Left) & Real-time Live Preview (Right) */}
      <div className="store-split-grid" style={{ alignItems: 'start' }}>
        {/* Left Column: Brand Assets & Customizer Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* 1. Brand Identity Assets */}
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
            <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-3)' }}>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                Brand Assets
              </h2>
              <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.2rem 0 0 0' }}>
                Upload your store logo and banner to establish trust with visiting customers.
              </p>
            </div>

            {/* Logo Section */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.4rem' }}>
                Store Logo
              </label>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {/* Logo Preview Square */}
                <div
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '16px',
                    backgroundColor: 'var(--color-bg-subtle)',
                    border: '2px dashed var(--color-border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Store Logo"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={() => setLogoUrl('')}
                    />
                  ) : (
                    <Store size={28} color="var(--color-text-muted)" />
                  )}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      ref={logoInputRef}
                      onChange={handleLogoFileUpload}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      style={{ display: 'none' }}
                    />

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      isLoading={isOptimizingLogo}
                      leftIcon={<Upload size={13} />}
                    >
                      Upload Logo
                    </Button>

                    {logoUrl && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setLogoUrl('')}
                        style={{ color: 'var(--color-error)' }}
                        leftIcon={<Trash2 size={13} />}
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <Input
                    type="text"
                    placeholder="Or paste direct logo image URL..."
                    value={logoUrl.startsWith('data:') ? 'Custom uploaded image' : logoUrl}
                    disabled={logoUrl.startsWith('data:')}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    style={{ fontSize: 'var(--font-size-2xs)' }}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    Recommended: 400x400 PNG, WebP, or SVG with transparent background.
                  </span>
                </div>
              </div>
            </div>

            {/* Banner Section */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.4rem' }}>
                Storefront Hero Banner (Cover)
              </label>

              {/* Banner Thumbnail */}
              <div
                style={{
                  width: '100%',
                  height: '110px',
                  borderRadius: '14px',
                  backgroundColor: bannerUrl ? 'transparent' : 'var(--color-bg-subtle)',
                  border: '2px dashed var(--color-border-default)',
                  backgroundImage: bannerUrl ? `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.5)), url(${bannerUrl})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  overflow: 'hidden',
                  marginBottom: '0.5rem',
                  position: 'relative',
                }}
              >
                {!bannerUrl && (
                  <>
                    <ImageIcon size={24} color="var(--color-text-muted)" />
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      No cover banner uploaded (Storefront will use brand gradient)
                    </span>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                <input
                  type="file"
                  ref={bannerInputRef}
                  onChange={handleBannerFileUpload}
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                />

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => bannerInputRef.current?.click()}
                  isLoading={isOptimizingBanner}
                  leftIcon={<Upload size={13} />}
                >
                  Upload Banner
                </Button>

                {bannerUrl && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setBannerUrl('')}
                    style={{ color: 'var(--color-error)' }}
                    leftIcon={<Trash2 size={13} />}
                  >
                    Remove Banner
                  </Button>
                )}
              </div>

              <Input
                type="text"
                placeholder="Or paste direct banner image URL..."
                value={bannerUrl.startsWith('data:') ? 'Custom uploaded banner' : bannerUrl}
                disabled={bannerUrl.startsWith('data:')}
                onChange={(e) => setBannerUrl(e.target.value)}
                style={{ fontSize: 'var(--font-size-2xs)' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                Recommended: 1200x450 landscape image. Displayed across the top hero section.
              </span>
            </div>

            {/* Store Information */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
                  Store Business Name
                </label>
                <Input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. FastData Reseller Hub"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
                  Custom Storefront URL Slug
                </label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span
                    style={{
                      padding: '0 0.75rem',
                      height: '42px',
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: 'var(--color-bg-subtle)',
                      border: '1px solid var(--color-border-default)',
                      borderRight: 'none',
                      borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    /store/
                  </span>
                  <Input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="my-store-name"
                    style={{ borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}
                  />
                </div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  Your live customer storefront link: {liveStoreUrl}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
                  Store Tagline / Slogan
                </label>
                <Input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Instant Automated Telecommunications Data"
                />
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  Displayed in the hero banner and shared social preview cards.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
                  Store Description
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Briefly describe your telecom bundle offerings and delivery guarantees..."
                />
              </div>
            </div>
          </Card>

          {/* 2. Brand Color Palette & Preset Themes */}
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
            <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-3)' }}>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                Theme & Color Palette
              </h2>
              <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.2rem 0 0 0' }}>
                Select a professionally curated brand theme or customize precise primary and accent colors.
              </p>
            </div>

            {/* Presets Grid */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                Curated Theme Palettes
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))', gap: '0.65rem' }}>
                {PRESET_THEMES.map((preset) => {
                  const isSelected = primaryColor.toLowerCase() === preset.primary.toLowerCase() &&
                                     accentColor.toLowerCase() === preset.accent.toLowerCase();

                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      style={{
                        padding: '0.65rem 0.8rem',
                        borderRadius: '12px',
                        backgroundColor: isSelected ? 'rgba(0, 102, 255, 0.08)' : 'var(--color-bg-subtle)',
                        border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border-subtle)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                        transition: 'all 150ms ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: preset.primary, display: 'inline-block' }} />
                          <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: preset.accent, display: 'inline-block' }} />
                        </div>
                        {isSelected && <Check size={14} color="var(--color-primary)" strokeWidth={3} />}
                      </div>
                      <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Primary & Accent Pickers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 'var(--space-4)' }}>
              {/* Primary */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
                  Primary Brand Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    style={{ width: '42px', height: '38px', borderRadius: '8px', border: '1px solid var(--color-border-default)', cursor: 'pointer', padding: '2px' }}
                  />
                  <Input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}
                  />
                </div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  Used for main CTA buttons, header highlights, and category tabs.
                </span>
              </div>

              {/* Accent */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
                  Accent Highlight Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    style={{ width: '42px', height: '38px', borderRadius: '8px', border: '1px solid var(--color-border-default)', cursor: 'pointer', padding: '2px' }}
                  />
                  <Input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}
                  />
                </div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  Used for delivery badges, glow accents, and discount callouts.
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Live Interactive Preview */}
        <div style={{ position: 'sticky', top: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Preview Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Live Storefront Preview
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {/* Device Mode Switcher */}
              <div style={{ display: 'flex', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '8px', padding: '2px', border: '1px solid var(--color-border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: previewDevice === 'mobile' ? 'var(--color-bg-surface)' : 'transparent',
                    color: previewDevice === 'mobile' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: previewDevice === 'mobile' ? 'var(--shadow-sm)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  <Smartphone size={13} />
                  <span>Mobile</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: previewDevice === 'desktop' ? 'var(--color-bg-surface)' : 'transparent',
                    color: previewDevice === 'desktop' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: previewDevice === 'desktop' ? 'var(--shadow-sm)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  <Monitor size={13} />
                  <span>Desktop</span>
                </button>
              </div>

              {/* Theme Toggle (Dark vs Light Preview) */}
              <div style={{ display: 'flex', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '8px', padding: '2px', border: '1px solid var(--color-border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setPreviewTheme('dark')}
                  title="Dark theme preview"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: isDarkPreview ? 'var(--color-bg-surface)' : 'transparent',
                    color: isDarkPreview ? '#F59E0B' : 'var(--color-text-muted)',
                    boxShadow: isDarkPreview ? 'var(--shadow-sm)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Moon size={13} />
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTheme('light')}
                  title="Light theme preview"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: !isDarkPreview ? 'var(--color-bg-surface)' : 'transparent',
                    color: !isDarkPreview ? '#0066FF' : 'var(--color-text-muted)',
                    boxShadow: !isDarkPreview ? 'var(--shadow-sm)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Sun size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Frame Container */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              padding: previewDevice === 'mobile' ? '1rem 0' : '0',
            }}
          >
            <div
              style={{
                width: previewDevice === 'mobile' ? 'min(100%, 340px)' : '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                borderRadius: previewDevice === 'mobile' ? '36px' : '18px',
                border: previewDevice === 'mobile' ? '8px solid #1E293B' : '1px solid var(--color-border-default)',
                boxShadow: previewDevice === 'mobile' ? '0 25px 50px -12px rgba(0, 0, 0, 0.45)' : 'var(--shadow-tactile-lg)',
                backgroundColor: previewBg,
                color: previewTextPrimary,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 250ms ease',
              }}
            >
              {/* Browser bar for Desktop view */}
              {previewDevice === 'desktop' && (
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: isDarkPreview ? '#090D16' : '#E2E8F0',
                    borderBottom: `1px solid ${isDarkPreview ? '#1E293B' : '#CBD5E1'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#EF4444', display: 'inline-block' }} />
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#F59E0B', display: 'inline-block' }} />
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }} />
                  </div>
                  <div
                    style={{
                      flex: 1,
                      backgroundColor: isDarkPreview ? '#131A29' : '#FFFFFF',
                      borderRadius: '6px',
                      padding: '3px 10px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: previewTextSecondary,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    https://bytebeacon.com/store/{slug || 'my-store'}
                  </div>
                </div>
              )}

              {/* Smartphone Dynamic Island / Speaker Pill for Mobile view */}
              {previewDevice === 'mobile' && (
                <div
                  style={{
                    width: '100%',
                    height: '24px',
                    backgroundColor: isDarkPreview ? '#0B0F19' : '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <div style={{ width: '70px', height: '14px', borderRadius: '10px', backgroundColor: '#000000' }} />
                </div>
              )}

              {/* 1. Header Bar */}
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: isDarkPreview ? '#0D1322' : '#FFFFFF',
                  borderBottom: `1px solid ${previewCardBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      backgroundColor: isDarkPreview ? '#1E293B' : '#F1F5F9',
                      border: `1px solid ${primaryColor}40`,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt={storeName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Store size={16} color={primaryColor} />
                    )}
                  </div>
                  <strong style={{ fontSize: '13px', fontWeight: 800, color: previewTextPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {storeName || 'My Store'}
                  </strong>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '100px',
                    backgroundColor: `${accentColor}18`,
                    border: `1px solid ${accentColor}40`,
                    color: accentColor,
                    fontSize: '10px',
                    fontWeight: 800,
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: accentColor }} />
                  <span>ONLINE</span>
                </div>
              </div>

              {/* 2. Hero Section */}
              <div
                style={{
                  position: 'relative',
                  padding: previewDevice === 'mobile' ? '1.5rem 1rem' : '2.25rem 1.5rem',
                  color: '#FFFFFF',
                  overflow: 'hidden',
                  background: bannerUrl
                    ? `linear-gradient(rgba(11, 15, 25, 0.78), rgba(11, 15, 25, 0.92)), url(${bannerUrl}) center/cover no-repeat`
                    : primaryColor === '#10B981'
                    ? 'linear-gradient(145deg, #052e16 0%, #064e3b 50%, #047857 100%)'
                    : `linear-gradient(135deg, ${primaryColor} 0%, #0A1128 75%)`,
                }}
              >
                {/* Glow ambient */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-30px',
                    right: '-30px',
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${accentColor}40 0%, transparent 70%)`,
                    pointerEvents: 'none',
                  }}
                />

                <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '100px',
                      backgroundColor: `${accentColor}25`,
                      border: `1px solid ${accentColor}60`,
                      color: accentColor,
                      fontSize: '10px',
                      fontWeight: 800,
                    }}
                  >
                    <Zap size={11} fill="currentColor" />
                    <span>Instant Telecom Delivery</span>
                  </div>

                  <h3 style={{ margin: 0, fontSize: previewDevice === 'mobile' ? '1.15rem' : '1.45rem', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.2 }}>
                    Buy Data Bundles
                  </h3>

                  <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.4 }}>
                    {tagline || 'Instant Automated Telecommunications Data'}
                  </p>

                  <button
                    type="button"
                    style={{
                      marginTop: '0.4rem',
                      alignSelf: 'flex-start',
                      backgroundColor: primaryColor,
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: `0 4px 12px ${primaryColor}40`,
                    }}
                  >
                    Shop Bundles &rarr;
                  </button>
                </div>
              </div>

              {/* 3. Product Catalog Sample */}
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: previewTextPrimary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Available Bundles
                  </span>
                  <span style={{ fontSize: '10px', color: accentColor, fontWeight: 700 }}>
                    Non-Expiry
                  </span>
                </div>

                {/* Sample Item 1: MTN */}
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '10px',
                    backgroundColor: previewCardBg,
                    border: `1px solid ${previewCardBorder}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#FFCC00', display: 'block' }}>MTN GHANA</span>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: previewTextPrimary }}>5.0 GB Data</div>
                    <span style={{ fontSize: '9px', color: previewTextSecondary }}>Instant automatic fulfillment</span>
                  </div>
                  <button
                    type="button"
                    style={{
                      backgroundColor: primaryColor,
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    GH₵ 25.00
                  </button>
                </div>

                {/* Sample Item 2: Telecel */}
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '10px',
                    backgroundColor: previewCardBg,
                    border: `1px solid ${previewCardBorder}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#E11D48', display: 'block' }}>TELECEL GHANA</span>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: previewTextPrimary }}>10.0 GB SuperPass</div>
                    <span style={{ fontSize: '9px', color: previewTextSecondary }}>30 Days Validity</span>
                  </div>
                  <button
                    type="button"
                    style={{
                      backgroundColor: primaryColor,
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    GH₵ 45.00
                  </button>
                </div>

                {/* Footer Security Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '6px', fontSize: '9px', color: previewTextSecondary }}>
                  <ShieldCheck size={11} color="#10B981" />
                  <span>Secured by Paystack · 100% Automated Carrier Settlement</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default StoreAppearancePage;
