import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { ITelecomProvider } from '../../src/core/providers/telecom/telecom-provider.interface.js';
import { IPaymentProvider } from '../../src/core/payments/payment-provider.interface.js';
import type pg from 'pg';

describe('Integration Health Reporting API', () => {
  it('GET /health/integrations should return granular health status for all dependencies', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      connect: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    } as unknown as pg.Pool;

    const mockTelecom = {
      providerName: 'GMPL',
      healthCheck: vi.fn().mockResolvedValue({
        providerName: 'GMPL',
        status: 'UP',
        latencyMs: 15,
      }),
      verifyWebhookSignature: vi.fn(),
    } as unknown as ITelecomProvider;

    const mockPayment = {
      healthCheck: vi.fn().mockResolvedValue({
        providerName: 'Paystack',
        status: 'UP',
        latencyMs: 25,
      }),
      verifyWebhookSignature: vi.fn(),
    } as unknown as IPaymentProvider;

    const app = createApp({
      dbPool: mockDb,
      telecomProvider: mockTelecom,
      paymentProvider: mockPayment,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health/integrations',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body.status).toBe('HEALTHY');
    expect(body.integrations.gmpl.status).toBe('UP');
    expect(body.integrations.paystack.status).toBe('UP');
    expect(body.integrations.database.status).toBe('UP');
    expect(body.integrations.redis.status).toBe('UP');
    expect(body.timestamp).toBeDefined();
  });
});
