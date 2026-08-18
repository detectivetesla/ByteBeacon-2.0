import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

describe('Security Headers and CORS Restrictions', () => {
  it('should include strict security headers on HTTP responses', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
    });

    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
  });

  it('should allow default development origins (localhost & 127.0.0.1 on port 5173)', async () => {
    const config = loadConfig({
      NODE_ENV: 'development',
    });
    const app = createApp({ config });

    // Test localhost:5173
    const resLocalhost = await app.inject({
      method: 'OPTIONS',
      url: '/healthz',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'GET',
      },
    });
    expect(resLocalhost.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    // Test 127.0.0.1:5173
    const resIp = await app.inject({
      method: 'OPTIONS',
      url: '/healthz',
      headers: {
        origin: 'http://127.0.0.1:5173',
        'access-control-request-method': 'GET',
      },
    });
    expect(resIp.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
  });

  it('should allow explicitly configured CORS origins', async () => {
    const config = loadConfig({
      CORS_ORIGINS: 'https://app.bytebeacon.com',
    });
    const app = createApp({ config });

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/healthz',
      headers: {
        origin: 'https://app.bytebeacon.com',
        'access-control-request-method': 'GET',
      },
    });

    expect(response.headers['access-control-allow-origin']).toBe('https://app.bytebeacon.com');
  });

  it('should reject unauthorized CORS origins', async () => {
    const config = loadConfig({
      CORS_ORIGINS: 'https://app.bytebeacon.com',
    });
    const app = createApp({ config });

    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: {
        origin: 'https://evil-attacker-site.com',
      },
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
  });

  it('production startup must fail if CORS origins are missing or contain local dev origins', () => {
    // Missing CORS_ORIGINS in production
    expect(() => {
      loadConfig({
        NODE_ENV: 'production',
        CORS_ORIGINS: '',
      });
    }).toThrow(/Production requires explicit CORS_ORIGINS/);

    // Localhost in production
    expect(() => {
      loadConfig({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'http://localhost:5173',
      });
    }).toThrow(/Production CORS cannot include local development origins/);

    // Valid production config should succeed
    const prodConfig = loadConfig({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://bytebeacon.com,https://app.bytebeacon.com',
    });
    expect(prodConfig.CORS_ORIGINS).toEqual(['https://bytebeacon.com', 'https://app.bytebeacon.com']);
  });
});
