import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelecomCircuitBreaker } from '../../src/core/providers/telecom-circuit-breaker.js';

describe('TelecomCircuitBreaker', () => {
  let breaker: TelecomCircuitBreaker;

  beforeEach(() => {
    breaker = new TelecomCircuitBreaker({
      failureThreshold: 3,
      cooldownPeriodMs: 100,
      providerName: 'DATAHOUSE_TEST',
    });
  });

  it('initializes in CLOSED state and is available', () => {
    expect(breaker.getState()).toBe('CLOSED');
    expect(breaker.isAvailable()).toBe(true);
    expect(breaker.providerName).toBe('DATAHOUSE_TEST');
  });

  it('executes successful verification and returns data with isAvailable=true', async () => {
    const mockAction = vi.fn().mockResolvedValue({ status: 'OK' });
    const result = await breaker.executeVerification(mockAction);

    expect(result.isAvailable).toBe(true);
    expect(result.data).toEqual({ status: 'OK' });
    expect(result.error).toBeUndefined();
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('trips to OPEN after consecutive failures reach failureThreshold', async () => {
    const failingAction = vi.fn().mockRejectedValue(new Error('Gateway Timeout 504'));

    // Failure 1
    const res1 = await breaker.executeVerification(failingAction);
    expect(res1.isAvailable).toBe(false);
    expect(res1.error).toContain('Gateway Timeout 504');
    expect(breaker.getState()).toBe('CLOSED');

    // Failure 2
    const res2 = await breaker.executeVerification(failingAction);
    expect(res2.isAvailable).toBe(false);
    expect(breaker.getState()).toBe('CLOSED');

    // Failure 3 (Threshold reached: 3)
    const res3 = await breaker.executeVerification(failingAction);
    expect(res3.isAvailable).toBe(false);
    expect(breaker.getState()).toBe('OPEN');
    expect(breaker.isAvailable()).toBe(false);
  });

  it('fails fast when circuit is OPEN without executing action', async () => {
    // Trip the breaker
    const failingAction = vi.fn().mockRejectedValue(new Error('Connection Refused'));
    for (let i = 0; i < 3; i++) {
      await breaker.executeVerification(failingAction);
    }
    expect(breaker.getState()).toBe('OPEN');

    // Attempt call while OPEN
    const actionNotCalled = vi.fn().mockResolvedValue({ status: 'SHOULD_NOT_RUN' });
    const result = await breaker.executeVerification(actionNotCalled);

    expect(actionNotCalled).not.toHaveBeenCalled();
    expect(result.isAvailable).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error).toContain('Circuit breaker is OPEN');
  });

  it('transitions to HALF_OPEN after cooldown and recovers to CLOSED on success', async () => {
    // Trip the breaker
    const failingAction = vi.fn().mockRejectedValue(new Error('Downstream error'));
    for (let i = 0; i < 3; i++) {
      await breaker.executeVerification(failingAction);
    }
    expect(breaker.getState()).toBe('OPEN');

    // Wait for cooldown period (100ms)
    await new Promise((r) => setTimeout(r, 120));

    expect(breaker.getState()).toBe('HALF_OPEN');

    // Successful probe
    const recoverAction = vi.fn().mockResolvedValue({ recovered: true });
    const result = await breaker.executeVerification(recoverAction);

    expect(result.isAvailable).toBe(true);
    expect(result.data).toEqual({ recovered: true });
    expect(breaker.getState()).toBe('CLOSED');
    expect(breaker.isAvailable()).toBe(true);
  });

  it('transitions from HALF_OPEN back to OPEN if probe fails', async () => {
    // Trip the breaker
    const failingAction = vi.fn().mockRejectedValue(new Error('Downstream error'));
    for (let i = 0; i < 3; i++) {
      await breaker.executeVerification(failingAction);
    }
    expect(breaker.getState()).toBe('OPEN');

    // Wait for cooldown period (100ms)
    await new Promise((r) => setTimeout(r, 120));
    expect(breaker.getState()).toBe('HALF_OPEN');

    // Failed probe
    const probeFailAction = vi.fn().mockRejectedValue(new Error('Still down'));
    const result = await breaker.executeVerification(probeFailAction);

    expect(result.isAvailable).toBe(false);
    expect(breaker.getState()).toBe('OPEN');
    expect(breaker.isAvailable()).toBe(false);
  });

  it('allows manual reset back to CLOSED', async () => {
    const failingAction = vi.fn().mockRejectedValue(new Error('Failed'));
    for (let i = 0; i < 3; i++) {
      await breaker.executeVerification(failingAction);
    }
    expect(breaker.getState()).toBe('OPEN');

    breaker.reset();
    expect(breaker.getState()).toBe('CLOSED');
    expect(breaker.isAvailable()).toBe(true);
  });
});
