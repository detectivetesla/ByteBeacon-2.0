import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateWebhookDestinationUrl,
  validateWebhookEvents,
  ALLOWED_WEBHOOK_EVENTS,
} from '../../src/core/security/ssrf-validator.js';

describe('Webhook SSRF & Destination Validator', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('Protocol enforcement', () => {
    it('allows valid HTTPS destination URLs', () => {
      const result = validateWebhookDestinationUrl('https://example.com/api/webhooks/bytebeacon');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects HTTP destination URLs in production', () => {
      const result = validateWebhookDestinationUrl('http://example.com/api/webhooks/bytebeacon');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('secure https:// protocol');
    });

    it('rejects non-HTTP protocols', () => {
      expect(validateWebhookDestinationUrl('ftp://example.com').valid).toBe(false);
      expect(validateWebhookDestinationUrl('gopher://example.com').valid).toBe(false);
      expect(validateWebhookDestinationUrl('file:///etc/passwd').valid).toBe(false);
    });

    it('rejects empty or invalid URLs', () => {
      expect(validateWebhookDestinationUrl('').valid).toBe(false);
      expect(validateWebhookDestinationUrl('not-a-url').valid).toBe(false);
    });
  });

  describe('SSRF Protection (Private IPs & Cloud Metadata)', () => {
    it('rejects AWS/GCP cloud metadata IP (169.254.169.254)', () => {
      const result = validateWebhookDestinationUrl('https://169.254.169.254/latest/meta-data/');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('private, loopback, or cloud metadata IP');
    });

    it('rejects loopback addresses (127.0.0.1, 127.0.0.2)', () => {
      expect(validateWebhookDestinationUrl('https://127.0.0.1/webhook').valid).toBe(false);
      expect(validateWebhookDestinationUrl('https://127.0.1.1/webhook').valid).toBe(false);
    });

    it('rejects RFC 1918 10.0.0.0/8 private network addresses', () => {
      expect(validateWebhookDestinationUrl('https://10.0.0.1/webhook').valid).toBe(false);
      expect(validateWebhookDestinationUrl('https://10.255.255.255/webhook').valid).toBe(false);
    });

    it('rejects RFC 1918 172.16.0.0/12 private network addresses', () => {
      expect(validateWebhookDestinationUrl('https://172.16.0.1/webhook').valid).toBe(false);
      expect(validateWebhookDestinationUrl('https://172.31.255.255/webhook').valid).toBe(false);
    });

    it('rejects RFC 1918 192.168.0.0/16 private network addresses', () => {
      expect(validateWebhookDestinationUrl('https://192.168.1.1/webhook').valid).toBe(false);
      expect(validateWebhookDestinationUrl('https://192.168.0.100/webhook').valid).toBe(false);
    });

    it('rejects localhost domain in production', () => {
      expect(validateWebhookDestinationUrl('https://localhost/webhook').valid).toBe(false);
      expect(validateWebhookDestinationUrl('https://sub.localhost/webhook').valid).toBe(false);
      expect(validateWebhookDestinationUrl('https://server.internal/webhook').valid).toBe(false);
      expect(validateWebhookDestinationUrl('https://device.local/webhook').valid).toBe(false);
    });

    it('rejects IPv6 loopback (::1)', () => {
      expect(validateWebhookDestinationUrl('https://[::1]/webhook').valid).toBe(false);
    });
  });

  describe('Webhook Events Validation', () => {
    it('accepts allowed webhook event subscriptions', () => {
      const result = validateWebhookEvents(['order.completed', 'order.failed', 'beneficiary.approved']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects unknown event subscriptions', () => {
      const result = validateWebhookEvents(['order.completed', 'unsupported.event.action']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported webhook event');
    });

    it('rejects empty event subscription arrays', () => {
      expect(validateWebhookEvents([]).valid).toBe(false);
      expect(validateWebhookEvents(null as any).valid).toBe(false);
    });
  });
});
