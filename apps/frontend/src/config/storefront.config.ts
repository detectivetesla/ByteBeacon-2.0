/**
 * ByteBeacon 2.0 Storefront Configuration & Domain Resolution Engine
 * Canonical public storefront base URL: https://apisolutions.store/store/
 * Main platform application URL: https://www.bytebeacon.online
 */

const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'app',
  'admin',
  'stage',
  'staging',
  'dev',
  'test',
  'mail',
  'smtp',
  'dashboard',
]);

export const isStorefrontHostname = (customHost?: string): boolean => {
  const host = (
    customHost ||
    (typeof window !== 'undefined' && window.location ? window.location.hostname : '')
  )
    .toLowerCase()
    .trim();

  if (!host) return false;

  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_IS_STOREFRONT_DOMAIN === 'true'
  ) {
    return true;
  }

  // Exact apex domain or any subdomain under apisolutions.store
  if (host === 'apisolutions.store' || host.endsWith('.apisolutions.store')) {
    return true;
  }

  // Staging / preview domain identifiers
  if (host.includes('storefront') || host.includes('apisolutions')) {
    return true;
  }

  return false;
};

export const extractStoreSlugFromHost = (customHost?: string): string | null => {
  const host = (
    customHost ||
    (typeof window !== 'undefined' && window.location ? window.location.hostname : '')
  )
    .toLowerCase()
    .trim();

  if (!host) return null;

  // e.g. fastdata.apisolutions.store
  if (host.endsWith('.apisolutions.store')) {
    const prefix = host.slice(0, -'.apisolutions.store'.length);
    const parts = prefix.split('.');
    const candidate = parts[parts.length - 1];
    if (candidate && !RESERVED_SUBDOMAINS.has(candidate)) {
      return candidate.replace(/[^a-z0-9-]/g, '-');
    }
  }

  return null;
};

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
    if (isStorefrontHostname(window.location.hostname)) {
      return `${window.location.origin}/store`;
    }
  }
  return 'https://apisolutions.store/store';
};

const getMainPlatformBaseUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const envUrl =
      import.meta.env.VITE_MAIN_PLATFORM_URL ||
      import.meta.env.MAIN_PLATFORM_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
      return envUrl.trim().replace(/\/+$/, '');
    }
  }
  return 'https://www.bytebeacon.online';
};

export const STOREFRONT_CONFIG = {
  PUBLIC_STOREFRONT_BASE_URL: getBaseUrl(),
  MAIN_PLATFORM_BASE_URL: getMainPlatformBaseUrl(),

  /**
   * Helper to check if current runtime host is the storefront domain
   */
  isStorefrontHost: isStorefrontHostname,

  /**
   * Helper to extract subdomain merchant slug
   */
  extractSlugFromSubdomain: extractStoreSlugFromHost,

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
   * Generates link to the main platform portal
   */
  getMainPlatformUrl: (path: string = '/'): string => {
    const base = getMainPlatformBaseUrl();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
  },

  /**
   * Generates the canonical WhatsApp direct chat link for merchant support.
   */
  getWhatsAppUrl: (phone: string, storeName?: string): string => {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('0') ? `233${cleanPhone.slice(1)}` : cleanPhone;
    const msg = encodeURIComponent(
      `Hello ${storeName || 'Merchant'}, I am shopping on your data store and would like some assistance.`
    );
    return `https://wa.me/${formattedPhone}?text=${msg}`;
  },
};


