import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeatureFlagService } from '../../src/infrastructure/features/feature-flag.service.js';
import type pg from 'pg';

describe('Phase 10.2: Feature Flag Engine & Emergency Kill-Switches', () => {
  let flagService: FeatureFlagService;

  beforeEach(() => {
    flagService = new FeatureFlagService(null);
  });

  afterEach(() => {
    delete process.env.FF_NEW_ORDER_ENGINE;
    delete process.env.FF_PAYSTACK_LIVE;
  });

  describe('Default Fallback Flags', () => {
    it('should resolve default enabled flags (NEW_ORDER_ENGINE, AGENT_STORES, MTN_PRECHECK)', async () => {
      expect(await flagService.isEnabled('NEW_ORDER_ENGINE')).toBe(true);
      expect(await flagService.isEnabled('AGENT_STORES')).toBe(true);
      expect(await flagService.isEnabled('MTN_PRECHECK')).toBe(true);
    });

    it('should resolve default disabled flags (PAYSTACK_LIVE, MAINTENANCE_MODE)', async () => {
      expect(await flagService.isEnabled('PAYSTACK_LIVE')).toBe(false);
      expect(await flagService.isEnabled('MAINTENANCE_MODE')).toBe(false);
    });

    it('should return false for completely unknown flag names', async () => {
      expect(await flagService.isEnabled('UNKNOWN_EXPERIMENT_XYZ')).toBe(false);
    });
  });

  describe('Emergency Runtime Overrides / Kill-Switches', () => {
    it('should allow setting an instant kill-switch in memory to disable an active subsystem', async () => {
      expect(await flagService.isEnabled('NEW_ORDER_ENGINE')).toBe(true);

      // Trigger emergency kill-switch
      flagService.setOverride('NEW_ORDER_ENGINE', false);
      expect(await flagService.isEnabled('NEW_ORDER_ENGINE')).toBe(false);

      // Clear kill-switch
      flagService.clearOverride('NEW_ORDER_ENGINE');
      expect(await flagService.isEnabled('NEW_ORDER_ENGINE')).toBe(true);
    });

    it('should respect environment variable overrides before defaults', async () => {
      process.env.FF_PAYSTACK_LIVE = 'true';
      expect(await flagService.isEnabled('PAYSTACK_LIVE')).toBe(true);

      process.env.FF_NEW_ORDER_ENGINE = 'false';
      expect(await flagService.isEnabled('NEW_ORDER_ENGINE')).toBe(false);
    });
  });

  describe('Database Flag Evaluation & Role Targeting', () => {
    it('should evaluate database overrides and respect allowed roles', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [{ is_enabled: true, allowed_roles: ['ADMIN', 'SUPER_ADMIN'] }],
        }),
      } as unknown as pg.Pool;

      const dbFlagService = new FeatureFlagService(mockDb);

      // Customer should be rejected
      expect(
        await dbFlagService.isEnabled('BETA_FEATURE', { role: 'CUSTOMER' }),
      ).toBe(false);

      // Admin should be allowed
      expect(
        await dbFlagService.isEnabled('BETA_FEATURE', { role: 'ADMIN' }),
      ).toBe(true);
    });
  });
});
