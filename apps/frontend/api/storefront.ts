// Vercel Serverless Function: Dynamic Social Prerender for Agent Storefronts
// Intercepts crawlers (WhatsApp, Facebook, Twitter, Telegram, iMessage, Discord, etc.)
// and serves dynamic Open Graph / Twitter Card HTML with the merchant's store name and logo.

export default async function handler(req: any, res: any) {
  const rawSlug = (req.query?.slug || req.query?.store || '').toString();
  const slug = rawSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const humanize = (s: string) => {
    return s
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const escapeHtml = (str?: string | null): string => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  if (!slug) {
    return res.redirect(302, 'https://apisolutions.store');
  }

  let store: any = null;
  const backendBase = process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || 'https://bytebeacon-2-0.onrender.com/api/v1';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const apiRes = await fetch(`${backendBase}/stores/public/${encodeURIComponent(slug)}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ByteBeacon-Storefront-Prerender/1.0',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (apiRes.ok) {
      const data = await apiRes.json();
      store = data?.data?.store || null;
    }
  } catch (err) {
    // Graceful fallback if backend call times out or fails
  }

  const storeName = (store?.storeName || humanize(slug) || 'Mobile Data Store').trim();
  const tagline = (
    store?.tagline ||
    store?.description ||
    `Fast, reliable and instant mobile data bundle delivery across MTN, Telecel, and AT in Ghana.`
  ).trim();
  const primaryColor = /^#[0-9A-Fa-f]{6}$/.test(store?.primaryColor) ? store.primaryColor : '#0066FF';
  const pageUrl = `https://apisolutions.store/${encodeURIComponent(slug)}`;
  const ogImageUrl = `https://apisolutions.store/api/og?slug=${encodeURIComponent(slug)}`;
  const title = `${storeName} · Buy Affordable Mobile Data`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(tagline)}">
  <meta name="theme-color" content="${primaryColor}">
  <meta name="apple-mobile-web-app-title" content="${escapeHtml(storeName)}">

  <!-- Canonical URL -->
  <link rel="canonical" href="${pageUrl}">

  <!-- Open Graph / Facebook / WhatsApp / LinkedIn / iMessage -->
  <meta property="og:site_name" content="${escapeHtml(storeName)}">
  <meta property="og:title" content="${escapeHtml(storeName)} - Buy Affordable Data Bundles">
  <meta property="og:description" content="${escapeHtml(tagline)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_GH">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:secure_url" content="${ogImageUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(storeName)} Store Logo">

  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(storeName)} - Buy Affordable Data Bundles">
  <meta name="twitter:description" content="${escapeHtml(tagline)}">
  <meta name="twitter:image" content="${ogImageUrl}">
  <meta name="twitter:image:alt" content="${escapeHtml(storeName)} Store Logo">

  <!-- Favicon / Apple Icons -->
  <link rel="icon" type="image/svg+xml" href="${ogImageUrl}">
  <link rel="apple-touch-icon" href="${ogImageUrl}">

  <style>
    body {
      margin: 0;
      padding: 40px 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0A0C10;
      color: #FFFFFF;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .card {
      max-width: 520px;
      width: 100%;
      background: #121721;
      border: 1px solid #1E293B;
      border-radius: 24px;
      padding: 36px 28px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6);
    }
    .badge {
      width: 76px;
      height: 76px;
      border-radius: 20px;
      background: ${primaryColor};
      color: #FFFFFF;
      font-size: 38px;
      font-weight: 900;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      box-shadow: 0 10px 25px -5px ${primaryColor}55;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    p {
      margin: 0 0 24px;
      color: #94A3B8;
      font-size: 15px;
      line-height: 1.5;
    }
    .btn {
      display: inline-block;
      background: ${primaryColor};
      color: #FFFFFF;
      font-weight: 700;
      padding: 14px 28px;
      border-radius: 12px;
      text-decoration: none;
      font-size: 15px;
      box-shadow: 0 4px 14px 0 ${primaryColor}66;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${escapeHtml(storeName.charAt(0).toUpperCase())}</div>
    <h1>${escapeHtml(storeName)}</h1>
    <p>${escapeHtml(tagline)}</p>
    <a href="${pageUrl}" class="btn">Visit Storefront &rarr;</a>
  </div>
  <script>
    // In actual browser navigation, transparently redirect to SPA route
    if (window.location.pathname.startsWith('/api/')) {
      window.location.replace('/${encodeURIComponent(slug)}');
    }
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  return res.status(200).send(html);
}
