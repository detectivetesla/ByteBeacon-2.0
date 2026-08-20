import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Input } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { storesApi } from '../../api/stores.api.js';
import {
  Check,
  Save,
  Store,
  Smartphone,
} from 'lucide-react';

const PRESET_PRIMARY_COLORS = [
  { label: 'Beacon Blue', hex: '#0066FF' },
  { label: 'Emerald Green', hex: '#10B981' },
  { label: 'Royal Violet', hex: '#8B5CF6' },
  { label: 'Midnight Indigo', hex: '#6366F1' },
  { label: 'Sunset Amber', hex: '#F59E0B' },
  { label: 'Crimson Red', hex: '#E11D48' },
];

export const StoreAppearancePage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();

  const [primaryColor, setPrimaryColor] = useState('#0066FF');
  const [accentColor, setAccentColor] = useState('#00E599');
  const [storeName, setStoreName] = useState('DataHub Express');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    storesApi.getStore().then((st) => {
      if (st) {
        if (st.primaryColor) setPrimaryColor(st.primaryColor);
        if (st.accentColor) setAccentColor(st.accentColor);
        if (st.storeName) setStoreName(st.storeName);
      }
    }).catch(() => {
      // Use defaults if store not yet provisioned
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await storesApi.saveStoreConfig({
        primaryColor,
        accentColor,
      });
      toastSuccess('Appearance Saved', 'Storefront theme and branding updated successfully.');
    } catch (err: any) {
      toastError('Save Failed', err.message || 'Unable to update store appearance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#EC4899' }}>
            Storefront Theme
          </span>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
            Store Appearance & Branding
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Customize your customer-facing color scheme and live storefront visual layout.
          </p>
        </div>

        <Button variant="primary" size="md" onClick={handleSave} isLoading={saving} leftIcon={<Save size={14} />}>
          Save Appearance
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* Left: Customizer Controls */}
        <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            Color Palette
          </h2>

          {/* Primary Color Picker */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
              Primary Brand Color
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {PRESET_PRIMARY_COLORS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => setPrimaryColor(preset.hex)}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    backgroundColor: preset.hex,
                    border: primaryColor === preset.hex ? '3px solid #FFFFFF' : '2px solid transparent',
                    boxShadow: primaryColor === preset.hex ? '0 0 0 2px var(--color-primary)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                  }}
                  title={preset.label}
                >
                  {primaryColor === preset.hex && <Check size={16} strokeWidth={3} />}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer' }}
              />
              <Input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                style={{ width: '110px', fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>

          {/* Accent Color Picker */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
              Accent Highlight Color
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer' }}
              />
              <Input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                style={{ width: '110px', fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>
        </Card>

        {/* Right: Live Preview Mockup Card */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 'var(--space-2)' }}>
            <Smartphone size={15} color="var(--color-text-muted)" />
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Customer Live Preview
            </span>
          </div>

          <Card
            style={{
              padding: 0,
              borderRadius: 'var(--radius-2xl)',
              overflow: 'hidden',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              boxShadow: 'var(--shadow-tactile-lg)',
              border: '1px solid #334155',
            }}
          >
            {/* Header of Store Preview */}
            <div
              style={{
                padding: 'var(--space-4)',
                backgroundColor: primaryColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Store size={15} color="#FFFFFF" />
                </div>
                <strong style={{ fontSize: 'var(--font-size-xs)', color: '#FFFFFF' }}>{storeName}</strong>
              </div>
              <span style={{ fontSize: '10px', backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                24/7 ONLINE
              </span>
            </div>

            {/* Body of Store Preview */}
            <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ textAlign: 'center', padding: 'var(--space-2) 0' }}>
                <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800 }}>Buy Data Bundles</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94A3B8' }}>Instant delivery straight to your phone</p>
              </div>

              {/* Sample Product Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ padding: '0.5rem 0.65rem', borderRadius: '8px', backgroundColor: '#1E293B', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155' }}>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: 900, color: '#FFCC00' }}>MTN GHANA</span>
                    <div style={{ fontSize: '12px', fontWeight: 800 }}>5.0 GB Non-Expiry</div>
                  </div>
                  <button style={{ backgroundColor: primaryColor, color: '#FFFFFF', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                    GH₵ 25.00
                  </button>
                </div>

                <div style={{ padding: '0.5rem 0.65rem', borderRadius: '8px', backgroundColor: '#1E293B', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155' }}>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: 900, color: '#E11D48' }}>TELECEL</span>
                    <div style={{ fontSize: '12px', fontWeight: 800 }}>10.0 GB SuperPass</div>
                  </div>
                  <button style={{ backgroundColor: primaryColor, color: '#FFFFFF', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                    GH₵ 45.00
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
