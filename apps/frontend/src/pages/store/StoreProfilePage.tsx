import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Input, PhoneInput, Textarea } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { storesApi } from '../../api/stores.api.js';
import { STOREFRONT_CONFIG } from '../../config/storefront.config.js';
import {
  Mail,
  Globe,
  Save,
  Copy,
  ExternalLink,
} from 'lucide-react';

export const StoreProfilePage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();

  const [storeName, setStoreName] = useState('DataHub Express');
  const [slug, setSlug] = useState('datahub-express');
  const [tagline, setTagline] = useState('Instant automated data bundles 24/7');
  const [description, setDescription] = useState('Fastest delivery of MTN, Telecel, and AirtelTigo bundles across Ghana.');
  const [contactPhone, setContactPhone] = useState('0244123456');
  const [contactEmail, setContactEmail] = useState('support@datahubexpress.com');
  const [contactWhatsapp, setContactWhatsapp] = useState('+233244123456');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    storesApi.getStore().then((st) => {
      if (st) {
        if (st.storeName) setStoreName(st.storeName);
        if (st.slug) setSlug(st.slug);
        if (st.tagline) setTagline(st.tagline);
        if (st.description) setDescription(st.description);
        if (st.contactPhone) setContactPhone(st.contactPhone);
        if (st.contactEmail) setContactEmail(st.contactEmail);
        if (st.contactWhatsapp) setContactWhatsapp(st.contactWhatsapp);
      }
    }).catch(() => {
      // Use defaults
    });
  }, []);

  const publicUrl = STOREFRONT_CONFIG.getStoreUrl(slug);


  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toastSuccess('Copied', 'Storefront link copied to clipboard.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await storesApi.saveStoreConfig({
        storeName,
        slug,
        tagline,
        description,
        contactPhone,
        contactEmail,
        contactWhatsapp,
      });
      toastSuccess('Profile Saved', 'Store profile details updated successfully.');
    } catch (err: any) {
      toastError('Save Failed', err.message || 'Unable to update store profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#3B82F6' }}>
          Store Configuration
        </span>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
          Store Profile & Details
        </h1>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
          Configure your storefront identity, business contacts, and public customer URL.
        </p>
      </div>

      {/* Public Storefront Link Banner */}
      <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)', backgroundColor: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#3B82F6', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={18} />
            </div>
            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: '#3B82F6', textTransform: 'uppercase' }}>Public Storefront Link</span>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                {publicUrl}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="outline" size="sm" onClick={handleCopyLink} leftIcon={<Copy size={13} />}>
              Copy Link
            </Button>
            <a
              href={`/store/${slug}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#3B82F6',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
              }}
            >
              <span>Visit Store</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </Card>

      {/* Form */}
      <form onSubmit={handleSave}>
        <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            Identity & Branding
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            <Input
              label="Store Name"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="e.g. DataHub Express"
              required
            />

            <Input
              label="Custom URL Slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              placeholder="e.g. datahub-express"
              required
            />
          </div>

          <Input
            label="Tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Short catchy tagline"
          />

          <Textarea
            label="Store Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />

          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 'var(--space-4) 0 0 0' }}>
            Customer Support Contacts
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
            <PhoneInput
              label="Support Phone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="024XXXXXXX"
            />

            <Input
              label="Support Email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="support@yourstore.com"
              leftIcon={<Mail size={14} color="var(--color-text-muted)" />}
            />

            <PhoneInput
              label="Support WhatsApp"
              value={contactWhatsapp}
              onChange={(e) => setContactWhatsapp(e.target.value)}
              placeholder="024XXXXXXX"
            />
          </div>

          <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" size="md" type="submit" isLoading={saving} leftIcon={<Save size={14} />}>
              Save Store Profile
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
};
