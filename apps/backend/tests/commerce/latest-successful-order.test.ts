import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import type pg from 'pg';
import {
  computeOrderTelemetry,
  formatOrderDateTime,
  getLatestSuccessfulOrdersTelemetry,
} from '../../src/core/commerce/latest-order-telemetry.js';
import { orderRoutes } from '../../src/routes/commerce/order.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { RateLimiterService } from '../../src/core/security/rate-limiter.service.js';

describe('Latest Successful Order Telemetry Suite', () => {
  it('formats dates consistently as MMM d, h:mm a', () => {
    const d1 = new Date('2026-09-13T23:55:00.000Z');
    const formatted = formatOrderDateTime(d1);
    expect(formatted).toMatch(/[A-Z][a-z]{2}\s\d+,\s\d+:\d{2}\s(AM|PM)/);
  });

  it('computes accurate durations, display strings, and delivery estimates', () => {
    const placed = new Date('2026-09-13T23:55:00.000Z');
    const delivered = new Date('2026-09-14T00:03:00.000Z'); // 8 minutes later

    const telemetry = computeOrderTelemetry('MTN', placed, delivered);

    expect(telemetry.network).toBe('MTN');
    expect(telemetry.networkDisplayName).toBe('MTN');
    expect(telemetry.durationSeconds).toBe(480);
    expect(telemetry.durationMinutes).toBe(8);
    expect(telemetry.durationDisplay).toBe('Took about 8 mins.');
    expect(telemetry.estimatedDeliveryDisplay).toBe('Est. delivery: Less than 10 mins.');
    expect(telemetry.placedAt).toBe(placed.toISOString());
    expect(telemetry.deliveredAt).toBe(delivered.toISOString());
  });

  it('maps network display names correctly for MTN, Telecel, and AT', () => {
    const now = new Date();
    const future = new Date(now.getTime() + 180000); // 3 mins

    const mtn = computeOrderTelemetry('MTN', now, future);
    expect(mtn.networkDisplayName).toBe('MTN');
    expect(mtn.estimatedDeliveryDisplay).toBe('Est. delivery: Less than 5 mins.');

    const telecel = computeOrderTelemetry('TELECEL', now, future);
    expect(telecel.networkDisplayName).toBe('Telecel');

    const at = computeOrderTelemetry('AIRTELTIGO', now, future);
    expect(at.networkDisplayName).toBe('AT');
  });

  it('uses database rows when available and produces valid byNetwork map', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: 'ord-1',
            public_id: 'PUB-MTN-001',
            network: 'MTN',
            order_status: 'COMPLETED',
            provider_status: 'COMPLETED',
            created_at: new Date(Date.now() - 600000).toISOString(), // 10 mins ago
            updated_at: new Date(Date.now() - 120000).toISOString(), // 2 mins ago
          },
        ],
      }),
    } as unknown as pg.Pool;

    const result = await getLatestSuccessfulOrdersTelemetry(mockDb, 'MTN');

    expect(result.latest).toBeDefined();
    expect(result.latest?.network).toBe('MTN');
    expect(result.latest?.durationMinutes).toBe(8);
    expect(result.latest?.durationDisplay).toBe('Took about 8 mins.');
    expect(result.byNetwork['MTN']).toBeDefined();
    expect(result.byNetwork['TELECEL']).toBeDefined();
    expect(result.byNetwork['AIRTELTIGO']).toBeDefined();
    expect(result.byNetwork['AT']).toBeDefined();
  });

  it('returns graceful dynamic fallbacks when database has 0 completed orders', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as pg.Pool;

    const result = await getLatestSuccessfulOrdersTelemetry(mockDb);

    expect(result.latest).toBeDefined();
    expect(result.byNetwork['MTN']).toBeDefined();
    expect(result.byNetwork['TELECEL']).toBeDefined();
    expect(result.byNetwork['AIRTELTIGO']).toBeDefined();
    expect(result.byNetwork['MTN'].durationDisplay).toMatch(/Took about \d+ mins\./);
    expect(result.byNetwork['MTN'].estimatedDeliveryDisplay).toMatch(/Est\. delivery:/);
  });

  it('GET /api/v1/orders/latest-successful returns 200 with complete telemetry payload', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as pg.Pool;

    const tokenService = new TokenService('test-secret-key-that-is-at-least-32-characters-long');
    const apiKeyService = new ApiKeyService(mockDb);
    const rbacService = new RbacService(mockDb);
    const rateLimiter = new RateLimiterService();

    const app = Fastify();
    await app.register(
      async (subApp) => {
        await orderRoutes(subApp, {
          db: mockDb,
          orderService: {} as any,
          tokenService,
          apiKeyService,
          rbacService,
          rateLimiter,
        });
      },
      { prefix: '/api/v1' },
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/orders/latest-successful?network=MTN',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.latest).toBeDefined();
    expect(body.data.latest.network).toBe('MTN');
    expect(body.data.latest.networkDisplayName).toBe('MTN');
    expect(body.data.latest.durationDisplay).toBeDefined();
    expect(body.data.latest.estimatedDeliveryDisplay).toBeDefined();
    expect(body.data.byNetwork).toBeDefined();
  });
});
