import { describe, it, expect, vi } from 'vitest';
import { GmplWebhookService } from '../../src/core/providers/gmpl-webhook.service.js';
import { ITelecomProvider } from '../../src/core/providers/telecom/telecom-provider.interface.js';
import { ProviderStatus, OrderStatus } from '@bytebeacon/shared';
import { UnauthorizedError } from '../../src/core/errors/app-error.js';
import type pg from 'pg';

describe('GMPL Webhook & Out-of-Order Stale Protection', () => {
  it('should reject forged webhook signatures with UnauthorizedError', async () => {
    const mockProvider = {
      verifyWebhookSignature: vi.fn().mockReturnValue(false),
    } as unknown as ITelecomProvider;

    const webhookService = new GmplWebhookService({} as pg.Pool, null, mockProvider);

    await expect(
      webhookService.handleWebhook('{"event":"order.completed"}', 'bad_sig', 'corr_1'),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should deduplicate repeated webhook events and prevent replay', async () => {
    const mockProvider = {
      verifyWebhookSignature: vi.fn().mockReturnValue(true),
    } as unknown as ITelecomProvider;

    const recordedEvents = new Set<string>();

    const mockDb = {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
          if (q.includes('FROM provider_events WHERE')) {
            const eventId = params[0] as string;
            if (recordedEvents.has(eventId)) {
              return Promise.resolve({ rows: [{ id: 'existing_evt' }] });
            }
            return Promise.resolve({ rows: [] });
          }
          if (q.includes('FROM provider_orders')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'po_1',
                  orderId: 'ord_1',
                  currentStatus: ProviderStatus.RECEIVED,
                  lastEventAt: null,
                  lastEventVersion: 0,
                  orderStatus: OrderStatus.SUBMITTED,
                },
              ],
            });
          }
          if (q.includes('INSERT INTO provider_events')) {
            const eventId = params[1] as string;
            recordedEvents.add(eventId);
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      }),
    } as unknown as pg.Pool;

    const webhookService = new GmplWebhookService(mockDb, null, mockProvider);

    const payload = JSON.stringify({
      event: 'order.status_updated',
      event_id: 'evt_dedup_unique_1',
      timestamp: new Date().toISOString(),
      data: {
        order_id: 'gmpl_ord_1',
        reference: 'pst_sub_ord_1',
        status: 'PROCESSING',
        network: 'MTN',
      },
    });

    // 1st delivery -> PROCESSED
    const res1 = await webhookService.handleWebhook(payload, 'valid_sig', 'corr_1');
    expect(res1.status).toBe('PROCESSED');

    // 2nd duplicate delivery -> DUPLICATE
    const res2 = await webhookService.handleWebhook(payload, 'valid_sig', 'corr_1');
    expect(res2.status).toBe('DUPLICATE');
  });

  it('should block out-of-order stale events from regressing order state (COMPLETED -> PROCESSING rejected)', async () => {
    const mockProvider = {
      verifyWebhookSignature: vi.fn().mockReturnValue(true),
    } as unknown as ITelecomProvider;

    let unappliedEventLogged = false;

    const mockDb = {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockImplementation((q: string, _params: unknown[]) => {
          if (q.includes('FROM provider_events WHERE')) {
            return Promise.resolve({ rows: [] });
          }
          if (q.includes('FROM provider_orders')) {
            // Local state is already COMPLETED at 10:06 (v2)
            return Promise.resolve({
              rows: [
                {
                  id: 'po_1',
                  orderId: 'ord_completed_1',
                  currentStatus: ProviderStatus.COMPLETED,
                  lastEventAt: new Date('2026-08-14T10:06:00Z'),
                  lastEventVersion: 2,
                  orderStatus: OrderStatus.COMPLETED,
                },
              ],
            });
          }
          if (q.includes('INSERT INTO provider_events') && q.includes('false')) {
            unappliedEventLogged = true;
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      }),
    } as unknown as pg.Pool;

    const webhookService = new GmplWebhookService(mockDb, null, mockProvider);

    // Incoming Event C: PROCESSING at 10:04 (v1) arriving late
    const stalePayload = JSON.stringify({
      event: 'order.status_updated',
      event_id: 'evt_stale_1004',
      event_version: 1,
      timestamp: '2026-08-14T10:04:00Z',
      data: {
        order_id: 'gmpl_ord_1',
        reference: 'pst_sub_ord_completed_1',
        status: 'PROCESSING',
        network: 'MTN',
      },
    });

    const result = await webhookService.handleWebhook(stalePayload, 'valid_sig', 'corr_stale');

    // Stale event is rejected and logged as unapplied
    expect(result.status).toBe('STALE');
    expect(unappliedEventLogged).toBe(true);
  });
});
