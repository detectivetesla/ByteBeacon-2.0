/**
 * ByteBeacon 2.0 Storefront Configuration
 * Canonical public storefront base URL: https://apisolutions.store/store/
 */

const getBaseUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const envUrl =
      import.meta.env.VITE_PUBLIC_STOREFRONT_BASE_URL ||
      import.meta.env.PUBLIC_STOREFRONT_BASE_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
      return envUrl.trim().replace(/\/+$/, '');
    }
  }
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return `${window.location.origin}/store`;
  }
  return 'https://www.bytebeacon.online/store';
};

export const STOREFRONT_CONFIG = {
  PUBLIC_STOREFRONT_BASE_URL: getBaseUrl(),

  /**
   * Generates the canonical full public URL for an agent's store.
   * e.g., https://apisolutions.store/store/fastdata
   */
  getStoreUrl: (slug: string): string => {
    const cleanSlug = (slug || '').toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
    const base = getBaseUrl();
    return cleanSlug ? `${base}/${cleanSlug}` : `${base}`;
  },

  /**
   * Generates the client-side relative SPA route path.
   * e.g., /store/fastdata
   */
  getRelativeStorePath: (slug: string): string => {
    const cleanSlug = (slug || '').toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
    return cleanSlug ? `/store/${cleanSlug}` : '/store';
  },

  /**
   * Generates the canonical WhatsApp direct chat link for merchant support.
   */
  getWhatsAppUrl: (phone: string, storeName?: string): string => {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('0') ? `233${cleanPhone.slice(1)}` : cleanPhone;
    const msg = encodeURIComponent(
      `Hello ${storeName || 'Merchant'}, I am shopping on your ByteBeacon data store and would like some assistance.`
    );
    return `https://wa.me/${formattedPhone}?text=${msg}`;
  },
};
