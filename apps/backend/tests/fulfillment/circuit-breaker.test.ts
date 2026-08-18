import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker, CircuitBreakerOpenError } from '../../src/core/providers/circuit-breaker.js';

describe('Circuit Breaker Resilience Engine', () => {
  it('should transition CLOSED -> OPEN after reaching failure threshold and block requests', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 3,
      cooldownPeriodMs: 500,
      providerName: 'GMPL',
    });

    expect(cb.getState()).toBe('CLOSED');

    const failingAction = vi.fn().mockRejectedValue(new Error('GMPL outage'));

    // Attempt 1 -> Failure (still CLOSED)
    await expect(cb.execute(failingAction)).rejects.toThrow('GMPL outage');
    expect(cb.getState()).toBe('CLOSED');

    // Attempt 2 -> Failure (still CLOSED)
    await expect(cb.execute(failingAction)).rejects.toThrow('GMPL outage');
    expect(cb.getState()).toBe('CLOSED');

    // Attempt 3 -> Failure (Breaches threshold -> OPEN)
    await expect(cb.execute(failingAction)).rejects.toThrow('GMPL outage');
    expect(cb.getState()).toBe('OPEN');

    // Attempt 4 -> Fast fails immediately without calling failingAction
    await expect(cb.execute(failingAction)).rejects.toThrow(CircuitBreakerOpenError);
    expect(failingAction).toHaveBeenCalledTimes(3); // Was NOT called 4th time
  });

  it('should transition OPEN -> HALF_OPEN after cooldown and recover to CLOSED upon success', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      cooldownPeriodMs: 100, // 100ms cooldown for test speed
      providerName: 'GMPL',
    });

    const failingAction = vi.fn().mockRejectedValue(new Error('Outage'));
    await expect(cb.execute(failingAction)).rejects.toThrow();
    await expect(cb.execute(failingAction)).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    // Wait for cooldown period
    await new Promise((resolve) => setTimeout(resolve, 120));

    // Next check should return HALF_OPEN
    expect(cb.getState()).toBe('HALF_OPEN');

    // Successful probe action
    const successfulAction = vi.fn().mockResolvedValue('probe_success');
    const result = await cb.execute(successfulAction);

    expect(result).toBe('probe_success');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('should return from HALF_OPEN to OPEN if probe fails', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      cooldownPeriodMs: 100,
      providerName: 'GMPL',
    });

    const failingAction = vi.fn().mockRejectedValue(new Error('Outage'));
    await expect(cb.execute(failingAction)).rejects.toThrow();
    await expect(cb.execute(failingAction)).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    // Wait for cooldown
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(cb.getState()).toBe('HALF_OPEN');

    // Probe fails
    await expect(cb.execute(failingAction)).rejects.toThrow('Outage');
    expect(cb.getState()).toBe('OPEN');
  });
});
