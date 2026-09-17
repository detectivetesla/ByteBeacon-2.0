// Vercel Serverless Function: Dynamic Social Preview Image / Logo Generator
// Serves binary images / SVGs for Open Graph (og:image) and Twitter Card previews.
// Resolves base64 data URIs into real binary images so WhatsApp & Facebook scrapers can render them.

export default async function handler(req: any, res: any) {
  const rawSlug = (req.query?.slug || req.query?.store || '').toString();
  const slug = rawSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const isCard = req.query?.type === 'card';

  const humanize = (s: string) => {
    return s
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const escapeXml = (str?: string | null): string => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const backendBase = process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || 'https://bytebeacon-2-0.onrender.com/api/v1';

  let store: any = null;
  if (slug) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const apiRes = await fetch(`${backendBase}/stores/public/${encodeURIComponent(slug)}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ByteBeacon-OG-Generator/1.0',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (apiRes.ok) {
        const data = await apiRes.json();
        store = data?.data?.store || null;
      }
    } catch {
      // Fallback
    }
  }

  const logoUrl = store?.logoUrl;

  // If the user requested the raw logo and the store has an uploaded logo
  if (!isCard && logoUrl && typeof logoUrl === 'string' && logoUrl.trim()) {
    const trimmed = logoUrl.trim();
    const dataMatch = trimmed.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (dataMatch) {
      const mimeType = dataMatch[1];
      const base64Data = dataMatch[2];
      const buffer = Buffer.from(base64Data, 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      return res.status(200).send(buffer);
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return res.redirect(302, trimmed);
    }
  }

  // Otherwise, render full 1200x630 high-res social card (or logo badge if requested)
  const storeName = (store?.storeName || (slug ? humanize(slug) : 'Mobile Data Store')).trim();
  const primaryColor = /^#[0-9A-Fa-f]{6}$/.test(store?.primaryColor) ? store.primaryColor : '#0066FF';
  const tagline = (store?.tagline || store?.description || 'Fast, reliable and instant mobile data activation across MTN, Telecel, and AT').trim();
  const safeName = escapeXml(storeName);
  const safeColor = primaryColor;
  const initial = escapeXml((storeName || 'D').trim().charAt(0).toUpperCase() || 'D');
  const safeTagline = escapeXml(tagline);

  let logoMarkup = '';
  if (logoUrl && typeof logoUrl === 'string' && logoUrl.trim()) {
    const cleanLogo = escapeXml(logoUrl.trim());
    logoMarkup = `
      <clipPath id="logoClip">
        <rect x="120" y="110" width="110" height="110" rx="28" />
      </clipPath>
      <rect x="120" y="110" width="110" height="110" rx="28" fill="${safeColor}" />
      <image href="${cleanLogo}" x="120" y="110" width="110" height="110" preserveAspectRatio="xMidYMid slice" clip-path="url(#logoClip)" />
    `;
  } else {
    logoMarkup = `
      <rect x="120" y="110" width="110" height="110" rx="28" fill="${safeColor}" />
      <text x="175" y="182" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="64" font-weight="900" fill="#FFFFFF" text-anchor="middle">${initial}</text>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" fill="none">
    <defs>
      <radialGradient id="glow" cx="0.5" cy="0.3" r="0.8">
        <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.3" />
        <stop offset="100%" stop-color="#0A0C10" stop-opacity="1" />
      </radialGradient>
      <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#191E28" />
        <stop offset="100%" stop-color="#0D1117" />
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="#0A0C10" />
    <rect width="1200" height="630" fill="url(#glow)" />
    
    <!-- Outer Card Frame -->
    <rect x="60" y="50" width="1080" height="530" rx="32" fill="url(#cardGrad)" stroke="${safeColor}" stroke-width="2" stroke-opacity="0.5" />
    
    <!-- Logo or Initial Avatar Badge -->
    ${logoMarkup}
    
    <!-- Verified Badge -->
    <rect x="256" y="146" width="220" height="42" rx="21" fill="#10B981" fill-opacity="0.15" stroke="#10B981" stroke-width="1.5" />
    <text x="366" y="173" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" fill="#10B981" text-anchor="middle">✓ VERIFIED AGENT STORE</text>
    
    <!-- Storefront Name -->
    <text x="120" y="285" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="54" font-weight="800" fill="#FFFFFF">${safeName}</text>
    
    <!-- Tagline -->
    <text x="120" y="340" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="500" fill="#94A3B8">${safeTagline}</text>
    
    <!-- Network Pills -->
    <g transform="translate(120, 390)">
      <!-- MTN -->
      <rect x="0" y="0" width="150" height="54" rx="14" fill="#EAB308" />
      <text x="75" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#0F172A" text-anchor="middle">MTN</text>
      
      <!-- Telecel -->
      <rect x="175" y="0" width="175" height="54" rx="14" fill="#DC2626" />
      <text x="262" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#FFFFFF" text-anchor="middle">TELECEL</text>
      
      <!-- AirtelTigo -->
      <rect x="375" y="0" width="150" height="54" rx="14" fill="#2563EB" />
      <text x="450" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#FFFFFF" text-anchor="middle">AT</text>
    </g>
    
    <!-- Footer Divider & Text -->
    <line x1="120" y1="485" x2="1080" y2="485" stroke="#334155" stroke-width="1" />
    <text x="120" y="530" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="600" fill="#64748B">Instant Activation · Safe Mobile Money Checkout · Non-Expiry Bundles</text>
    <text x="1080" y="530" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" fill="#94A3B8" text-anchor="end">apisolutions.store</text>
  </svg>`;

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  return res.status(200).send(svg);
}
