import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { BadRequestError } from '../../src/core/errors/app-error.js';

describe('Non-Admin Vendor Information Leak Protection', () => {
  it('sanitizes vendor names in outgoing response payloads for customer and agent routes', async () => {
    const app = createApp();

    app.get('/api/v1/agent/test-vendor-mask', async () => {
      return {
        status: 'SUCCESS',
        data: {
          engine: 'DataHouse Telecom Gateway',
          fallback: 'GMPL',
          docs: 'https://api.getmorepaylessdatahouse.net/api/v1',
          keyLink: 'https://www.getmorepaylessdatahouse.net/agent/api',
          legacyHost: 'Portal-02',
        },
      };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/agent/test-vendor-mask',
    });

    expect(response.statusCode).toBe(200);
    const text = response.body;

    // Verify zero occurrences of vendor names in raw HTTP payload
    expect(text).not.toContain('DataHouse');
    expect(text).not.toContain('GMPL');
    expect(text).not.toContain('getmorepaylessdatahouse.net');
    expect(text).not.toContain('Portal-02');

    const body = JSON.parse(text);
    expect(body.data.engine).toBe('ByteBeacon Telecom Gateway');
    expect(body.data.fallback).toBe('ByteBeacon');
    expect(body.data.docs).toBe('https://api.bytebeacon.com/api/v1');
    expect(body.data.keyLink).toBe('/agent/api');
    expect(body.data.legacyHost).toBe('ByteBeacon');
  });

  it('sanitizes vendor names from error messages on non-admin routes', async () => {
    const app = createApp();

    app.get('/api/v1/orders/test-fail', async () => {
      throw new BadRequestError('DataHouse rejected transaction: GMPL upstream timeout', [
        { field: 'carrier', code: 'DOWN', message: 'DataHouse node 12 is offline' },
      ]);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/orders/test-fail',
    });

    expect(response.statusCode).toBe(400);
    const text = response.body;

    // Must never contain vendor names
    expect(text).not.toContain('DataHouse');
    expect(text).not.toContain('GMPL');

    const body = JSON.parse(text);
    expect(body.error.message).toBe('ByteBeacon rejected transaction: ByteBeacon upstream timeout');
    expect(body.error.details[0].message).toBe('ByteBeacon node 12 is offline');
  });

  it('preserves vendor details on admin routes for platform operator maintenance', async () => {
    const app = createApp();

    app.get('/api/v1/admin/telecom/providers/test', async () => {
      return {
        providers: ['DataHouse', 'GMPL', 'Portal-02'],
      };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/telecom/providers/test',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.providers).toContain('DataHouse');
    expect(body.providers).toContain('GMPL');
  });
});
