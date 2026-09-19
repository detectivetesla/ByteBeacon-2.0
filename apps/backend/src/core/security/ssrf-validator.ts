import net from 'node:net';

export const ALLOWED_WEBHOOK_EVENTS = [
  'order.completed',
  'order.processing',
  'order.failed',
  'beneficiary.approved',
  'beneficiary.rejected',
  'wallet.credited',
  'wallet.debited',
] as const;

export type AllowedWebhookEvent = (typeof ALLOWED_WEBHOOK_EVENTS)[number];

const PRIVATE_IPV4_RANGES = [
  // 127.0.0.0/8 (Loopback)
  { start: 0x7f000000, end: 0x7fffffff },
  // 10.0.0.0/8 (Private)
  { start: 0x0a000000, end: 0x0affffff },
  // 172.16.0.0/12 (Private)
  { start: 0xac100000, end: 0xac1fffff },
  // 192.168.0.0/16 (Private)
  { start: 0xc0a80000, end: 0xc0a8ffff },
  // 169.254.0.0/16 (Link-local / Cloud Metadata 169.254.169.254)
  { start: 0xa9fe0000, end: 0xa9feffff },
  // 0.0.0.0/8 (Current network)
  { start: 0x00000000, end: 0x00ffffff },
  // 100.64.0.0/10 (Shared address space)
  { start: 0x64400000, end: 0x647fffff },
];

function ipv4ToInt(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

function isPrivateIpv4(ip: string): boolean {
  const intIp = ipv4ToInt(ip);
  return PRIVATE_IPV4_RANGES.some((range) => intIp >= range.start && intIp <= range.end);
}

/**
 * Validates a webhook destination URL against Server-Side Request Forgery (SSRF).
 * Blocks RFC 1918 private IPs, AWS/GCP/Azure link-local metadata (169.254.169.254),
 * loopback addresses, internal hostnames, and non-HTTPS protocols in production.
 */
export function validateWebhookDestinationUrl(urlStr: string): { valid: boolean; error?: string } {
  if (!urlStr || typeof urlStr !== 'string') {
    return { valid: false, error: 'A valid webhook destination URL is required' };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  const isProd = process.env.NODE_ENV === 'production';

  // In production, strictly require HTTPS
  if (isProd && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Webhook URL must use the secure https:// protocol' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, error: 'Webhook URL protocol must be HTTP or HTTPS' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block obvious internal and loopback domains
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.lan')
  ) {
    if (isProd) {
      return { valid: false, error: 'Localhost and internal domains cannot be used as webhook endpoints' };
    }
  }

  // Check IPv4
  if (net.isIPv4(hostname)) {
    if (isPrivateIpv4(hostname)) {
      if (isProd || (!hostname.startsWith('127.') && hostname !== '0.0.0.0')) {
        return {
          valid: false,
          error: 'Webhook destination cannot point to a private, loopback, or cloud metadata IP address',
        };
      }
    }
  }

  // Check IPv6
  const cleanHost = hostname.replace(/^\[|\]$/g, '');
  if (net.isIPv6(cleanHost)) {
    if (
      cleanHost === '::1' ||
      cleanHost === '::' ||
      cleanHost.startsWith('fc00:') ||
      cleanHost.startsWith('fe80:') ||
      cleanHost.startsWith('fd')
    ) {
      if (isProd) {
        return {
          valid: false,
          error: 'Webhook destination cannot point to a private or loopback IPv6 address',
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Validates that requested webhook event types match the supported platform event list.
 */
export function validateWebhookEvents(events: string[]): { valid: boolean; error?: string } {
  if (!events || !Array.isArray(events) || events.length === 0) {
    return { valid: false, error: 'At least one event subscription string is required' };
  }

  const allowedSet = new Set<string>(ALLOWED_WEBHOOK_EVENTS);
  for (const ev of events) {
    if (!allowedSet.has(ev)) {
      return {
        valid: false,
        error: `Unsupported webhook event: "${ev}". Allowed events: ${ALLOWED_WEBHOOK_EVENTS.join(', ')}`,
      };
    }
  }

  return { valid: true };
}
