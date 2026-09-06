import { describe, it, expect, vi } from 'vitest';
import { sanitizeText, sanitizeObject, initConsoleScrubber } from '../console-scrubber.js';

describe('ByteBeacon Console & Payload Scrubber', () => {
  describe('sanitizeText', () => {
    it('replaces getmorepayless and datahouse URLs with ByteBeacon equivalents', () => {
      expect(
        sanitizeText('Requests fire straight to https://api.getmorepaylessdatahouse.net/api/v1')
      ).toBe('Requests fire straight to https://api.bytebeacon.com/api/v1');

      expect(
        sanitizeText('Visit https://www.getmorepaylessdatahouse.net/agent/api for keys')
      ).toBe('Visit /agent/api for keys');
    });

    it('replaces DataHouse, GMPL, and Portal-02 vendor names with ByteBeacon', () => {
      expect(sanitizeText('Instant fulfillment via DataHouse Telecom Gateway')).toBe(
        'Instant fulfillment via ByteBeacon Telecom Gateway'
      );
      expect(sanitizeText('Fulfill bundles via GMPL direct API')).toBe(
        'Fulfill bundles via ByteBeacon direct API'
      );
      expect(sanitizeText('Connected to Portal-02 engine')).toBe(
        'Connected to ByteBeacon engine'
      );
    });

    it('leaves clean ByteBeacon text untouched', () => {
      expect(sanitizeText('ByteBeacon platform is fully operational')).toBe(
        'ByteBeacon platform is fully operational'
      );
    });
  });

  describe('sanitizeObject', () => {
    it('deeply cleans nested objects and arrays containing vendor references', () => {
      const dirty = {
        title: 'Order Status from DataHouse',
        carriers: ['MTN', 'GMPL Gateway', 'Telecel'],
        meta: {
          provider: 'DataHouse',
          upstreamUrl: 'https://api.getmorepaylessdatahouse.net/api/v1/orders',
        },
      };

      const clean = sanitizeObject(dirty);

      expect(clean.title).toBe('Order Status from ByteBeacon');
      expect(clean.carriers[1]).toBe('ByteBeacon Gateway');
      expect(clean.meta.provider).toBe('ByteBeacon');
      expect(clean.meta.upstreamUrl).toBe('https://api.bytebeacon.com/api/v1/orders');
    });

    it('sanitizes Error instances including message and stack traces', () => {
      const err = new Error('DataHouse API returned error code 500');
      const cleanErr = sanitizeObject(err);

      expect(cleanErr.message).not.toContain('DataHouse');
      expect(cleanErr.message).toBe('ByteBeacon API returned error code 500');
    });
  });

  describe('initConsoleScrubber', () => {
    it('intercepts console.log and sanitizes arguments before printing', () => {
      const originalLog = console.log;
      const spy = vi.fn();
      console.log = spy;

      // Initialize scrubber
      initConsoleScrubber();

      console.log('Order error from DataHouse upstream service', { provider: 'GMPL' });

      expect(spy).toHaveBeenCalledWith(
        'Order error from ByteBeacon upstream service',
        expect.objectContaining({ provider: 'ByteBeacon' })
      );

      console.log = originalLog;
    });
  });
});
