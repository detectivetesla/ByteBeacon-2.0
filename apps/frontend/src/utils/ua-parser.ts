/**
 * User-Agent parser and session info formatting utilities.
 * Extracts human-readable browser, OS, and device metadata from raw HTTP User-Agent strings.
 */

export interface ParsedUserAgent {
  browser: string;
  browserName: string;
  browserVersion: string;
  os: string;
  osName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
  deviceLabel: string;
  isMobile: boolean;
  raw: string;
}

export function parseUserAgent(userAgent?: string | null): ParsedUserAgent {
  const ua = (userAgent || '').trim();
  if (!ua) {
    return {
      browser: 'Web Browser',
      browserName: 'Browser',
      browserVersion: '',
      os: 'Unknown OS',
      osName: 'Unknown',
      deviceType: 'unknown',
      deviceLabel: 'Unknown Client',
      isMobile: false,
      raw: '',
    };
  }

  // Detect Device Type
  const isTablet = /(?:ipad|tablet|(?:android(?!.*mobile))|(?:playbook|silk)|kindle)/i.test(ua);
  const isMobilePhone = !isTablet && /(?:mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop|windows phone|android.*mobile)/i.test(ua);
  const isBot = /(?:bot|crawler|spider|curl|wget|postman|insomnia|slurp|facebookexternalhit)/i.test(ua);

  let deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown' = 'desktop';
  if (isBot) deviceType = 'bot';
  else if (isTablet) deviceType = 'tablet';
  else if (isMobilePhone) deviceType = 'mobile';
  else deviceType = 'desktop';

  // Detect OS
  let osName = 'Unknown OS';
  let osVersion = '';

  if (/Windows NT 10\.0/i.test(ua)) {
    osName = 'Windows';
    osVersion = '10/11';
  } else if (/Windows NT 6\.3/i.test(ua)) {
    osName = 'Windows';
    osVersion = '8.1';
  } else if (/Windows NT 6\.2/i.test(ua)) {
    osName = 'Windows';
    osVersion = '8';
  } else if (/Windows NT 6\.1/i.test(ua)) {
    osName = 'Windows';
    osVersion = '7';
  } else if (/Windows NT 6\.0/i.test(ua)) {
    osName = 'Windows';
    osVersion = 'Vista';
  } else if (/Windows NT 5\.1/i.test(ua)) {
    osName = 'Windows';
    osVersion = 'XP';
  } else if (/Windows/i.test(ua)) {
    osName = 'Windows';
  } else if (/iPhone OS (\d+[\d_]*)/i.test(ua)) {
    osName = 'iOS';
    const match = ua.match(/iPhone OS (\d+[\d_]*)/i);
    osVersion = match ? match[1].replace(/_/g, '.') : '';
  } else if (/iPad.*OS (\d+[\d_]*)/i.test(ua)) {
    osName = 'iPadOS';
    const match = ua.match(/iPad.*OS (\d+[\d_]*)/i);
    osVersion = match ? match[1].replace(/_/g, '.') : '';
  } else if (/Mac OS X (\d+[\d_]*)/i.test(ua)) {
    osName = 'macOS';
    const match = ua.match(/Mac OS X (\d+[\d_]*)/i);
    osVersion = match ? match[1].replace(/_/g, '.') : '';
  } else if (/Macintosh/i.test(ua)) {
    osName = 'macOS';
  } else if (/Android (\d+[\.\d]*)/i.test(ua)) {
    osName = 'Android';
    const match = ua.match(/Android (\d+[\.\d]*)/i);
    osVersion = match ? match[1] : '';
  } else if (/Android/i.test(ua)) {
    osName = 'Android';
  } else if (/CrOS/i.test(ua)) {
    osName = 'Chrome OS';
  } else if (/Ubuntu/i.test(ua)) {
    osName = 'Ubuntu Linux';
  } else if (/Linux/i.test(ua)) {
    osName = 'Linux';
  }

  const os = osVersion ? `${osName} ${osVersion}` : osName;

  // Detect Browser
  let browserName = 'Web Browser';
  let browserVersion = '';

  const edgeMatch = ua.match(/(?:Edg|Edge)\/(\d+[\.\d]*)/i);
  const oprMatch = ua.match(/(?:OPR|Opera)[\/ ](\d+[\.\d]*)/i);
  const samsungMatch = ua.match(/SamsungBrowser\/(\d+[\.\d]*)/i);
  const vivaldiMatch = ua.match(/Vivaldi\/(\d+[\.\d]*)/i);
  const firefoxMatch = ua.match(/(?:FxiOS|Firefox)\/(\d+[\.\d]*)/i);
  const chromeMatch = ua.match(/(?:CriOS|Chrome)\/(\d+[\.\d]*)/i);
  const safariMatch = ua.match(/Version\/(\d+[\.\d]*)\s+.*Safari/i);
  const postmanMatch = ua.match(/PostmanRuntime\/(\d+[\.\d]*)/i);
  const curlMatch = ua.match(/curl\/(\d+[\.\d]*)/i);

  if (edgeMatch) {
    browserName = 'Microsoft Edge';
    browserVersion = edgeMatch[1];
  } else if (oprMatch) {
    browserName = 'Opera';
    browserVersion = oprMatch[1];
  } else if (samsungMatch) {
    browserName = 'Samsung Internet';
    browserVersion = samsungMatch[1];
  } else if (vivaldiMatch) {
    browserName = 'Vivaldi';
    browserVersion = vivaldiMatch[1];
  } else if (/Brave/i.test(ua)) {
    browserName = 'Brave';
  } else if (firefoxMatch) {
    browserName = isMobilePhone ? 'Firefox Mobile' : 'Firefox';
    browserVersion = firefoxMatch[1];
  } else if (chromeMatch) {
    browserName = isMobilePhone ? 'Chrome Mobile' : 'Chrome';
    browserVersion = chromeMatch[1];
  } else if (safariMatch) {
    browserName = isMobilePhone ? 'Mobile Safari' : 'Safari';
    browserVersion = safariMatch[1];
  } else if (postmanMatch) {
    browserName = 'Postman';
    browserVersion = postmanMatch[1];
  } else if (/curl/i.test(ua)) {
    browserName = 'cURL';
    browserVersion = curlMatch ? curlMatch[1] : '';
  } else if (/ByteBeacon/i.test(ua)) {
    browserName = 'ByteBeacon Client';
  }

  const majorVersion = browserVersion ? browserVersion.split('.')[0] : '';
  const browser = majorVersion ? `${browserName} ${majorVersion}` : browserName;

  // Device label
  let deviceLabel = 'Desktop PC';
  if (deviceType === 'bot') {
    deviceLabel = 'API / Tool Client';
  } else if (/iPhone/i.test(ua)) {
    deviceLabel = 'Apple iPhone';
  } else if (/iPad/i.test(ua)) {
    deviceLabel = 'Apple iPad';
  } else if (osName === 'macOS') {
    deviceLabel = 'Apple Mac';
  } else if (osName === 'Windows') {
    deviceLabel = 'Windows PC';
  } else if (deviceType === 'mobile' && osName === 'Android') {
    deviceLabel = 'Android Smartphone';
  } else if (deviceType === 'tablet') {
    deviceLabel = 'Tablet Device';
  } else if (osName.includes('Linux')) {
    deviceLabel = 'Linux PC';
  }

  return {
    browser,
    browserName,
    browserVersion,
    os,
    osName,
    deviceType,
    deviceLabel,
    isMobile: deviceType === 'mobile' || deviceType === 'tablet',
    raw: ua,
  };
}

/**
 * Format relative time (e.g. 'Just now', '2m ago', '3h ago', 'Yesterday', '4d ago')
 */
export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid date';

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'Just now';

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 45) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

/**
 * Format IP Address with classification (Loopback/Local, Private, Public)
 */
export function formatIpInfo(ip?: string | null): {
  display: string;
  type: 'localhost' | 'private' | 'public' | 'unknown';
  label: string;
} {
  if (!ip || !ip.trim() || ip === '—') {
    return { display: '—', type: 'unknown', label: 'Unknown IP' };
  }
  const trimmed = ip.trim();
  if (trimmed === '127.0.0.1' || trimmed === '::1' || trimmed.toLowerCase() === 'localhost') {
    return { display: trimmed, type: 'localhost', label: 'Localhost' };
  }
  if (
    /^10\./.test(trimmed) ||
    /^192\.168\./.test(trimmed) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(trimmed)
  ) {
    return { display: trimmed, type: 'private', label: 'Private LAN' };
  }
  return { display: trimmed, type: 'public', label: 'Public IP' };
}
