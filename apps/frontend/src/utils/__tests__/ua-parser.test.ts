import { describe, it, expect } from 'vitest';
import { parseUserAgent, formatRelativeTime, formatIpInfo } from '../ua-parser.js';

describe('parseUserAgent', () => {
  it('parses Microsoft Edge on Windows 10/11 correctly', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0';
    const parsed = parseUserAgent(ua);
    expect(parsed.browserName).toBe('Microsoft Edge');
    expect(parsed.browser).toBe('Microsoft Edge 152');
    expect(parsed.os).toBe('Windows 10/11');
    expect(parsed.deviceType).toBe('desktop');
    expect(parsed.deviceLabel).toBe('Windows PC');
    expect(parsed.isMobile).toBe(false);
  });

  it('parses Mozilla Firefox on Windows correctly', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:155.0) Gecko/20100101 Firefox/155.0';
    const parsed = parseUserAgent(ua);
    expect(parsed.browserName).toBe('Firefox');
    expect(parsed.browser).toBe('Firefox 155');
    expect(parsed.os).toBe('Windows 10/11');
    expect(parsed.deviceType).toBe('desktop');
  });

  it('parses Chrome on macOS', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const parsed = parseUserAgent(ua);
    expect(parsed.browserName).toBe('Chrome');
    expect(parsed.os).toBe('macOS 10.15.7');
    expect(parsed.deviceLabel).toBe('Apple Mac');
  });

  it('parses Mobile Safari on iPhone', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
    const parsed = parseUserAgent(ua);
    expect(parsed.browserName).toBe('Mobile Safari');
    expect(parsed.os).toBe('iOS 17.4');
    expect(parsed.deviceType).toBe('mobile');
    expect(parsed.deviceLabel).toBe('Apple iPhone');
    expect(parsed.isMobile).toBe(true);
  });

  it('parses Android Mobile Chrome', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';
    const parsed = parseUserAgent(ua);
    expect(parsed.browserName).toBe('Chrome Mobile');
    expect(parsed.os).toBe('Android 14');
    expect(parsed.deviceType).toBe('mobile');
    expect(parsed.deviceLabel).toBe('Android Smartphone');
    expect(parsed.isMobile).toBe(true);
  });

  it('handles empty or unknown user agents gracefully', () => {
    const parsed = parseUserAgent('');
    expect(parsed.browser).toBe('Web Browser');
    expect(parsed.os).toBe('Unknown OS');
  });
});

describe('formatIpInfo', () => {
  it('identifies localhost loopback correctly', () => {
    expect(formatIpInfo('127.0.0.1')).toEqual({ display: '127.0.0.1', type: 'localhost', label: 'Localhost' });
    expect(formatIpInfo('::1')).toEqual({ display: '::1', type: 'localhost', label: 'Localhost' });
    expect(formatIpInfo('localhost')).toEqual({ display: 'localhost', type: 'localhost', label: 'Localhost' });
  });

  it('identifies private IPs', () => {
    expect(formatIpInfo('192.168.1.100').type).toBe('private');
    expect(formatIpInfo('10.0.0.5').type).toBe('private');
  });

  it('identifies public IPs', () => {
    expect(formatIpInfo('102.176.65.12').type).toBe('public');
  });
});

describe('formatRelativeTime', () => {
  it('formats recent timestamps as Just now', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('Just now');
  });

  it('formats past minutes', () => {
    const past = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(past)).toBe('5m ago');
  });

  it('handles null or empty timestamps gracefully', () => {
    expect(formatRelativeTime(null)).toBe('Never');
    expect(formatRelativeTime('')).toBe('Never');
  });
});
