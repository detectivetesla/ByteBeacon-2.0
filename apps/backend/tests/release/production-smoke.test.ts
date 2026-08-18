import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../../src/app.js';
import type pg from 'pg';

describe('Phase 10.4: Production Pre-Flight Smoke Test Suite', () => {
  let mockDb: pg.Pool;

  beforeEach(() => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('SELECT 1')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }] });
        }
        if (sql.includes('FROM schema_migrations')) {
          return Promise.resolve({
            rows: [
              { version: '00000000000000', name: 'init' },
              { version: '00000000000006', name: 'indexes' },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;
  });

  const mockConfig = {
    NODE_ENV: 'production',
    PORT: 3000,
    JWT_SECRET: 'test_super_secret_jwt_key_must_be_32bytes_long!',
    ALLOW_MOCK_PROVIDERS: true,
  } as any;

  it('GET /healthz should return 200 OK and valid health metadata', async () => {
    const app = createApp({
      config: mockConfig,
      dbPool: mockDb,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/healthz',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('GET /metrics should return 200 OK with Prometheus-formatted metrics text', async () => {
    const app = createApp({
      config: mockConfig,
      dbPool: mockDb,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/metrics',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.body).toContain('http_requests_total');
    expect(res.body).toContain('process_uptime_seconds');
  });

  it('GET /api/v1/openapi.json should return 200 OK with OpenAPI 3.1 schema', async () => {
    const app = createApp({
      config: mockConfig,
      dbPool: mockDb,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/openapi.json',
    });

    expect(res.statusCode).toBe(200);
    const schema = JSON.parse(res.body);
    expect(schema.openapi).toBe('3.1.0');
    expect(schema.info.title).toContain('ByteBeacon');
  });
});
