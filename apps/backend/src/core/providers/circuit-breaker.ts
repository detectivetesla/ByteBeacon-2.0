import { CircuitState } from '@bytebeacon/shared';
import { logger } from '../logging/logger.js';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownPeriodMs: number;
  providerName: string;
}

export class CircuitBreakerOpenError extends Error {
  constructor(providerName: string) {
    super(`Circuit breaker is OPEN for provider [${providerName}]. Requests temporarily blocked.`);
    this.name = 'CircuitBreakerOpenError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly cooldownPeriodMs: number;
  private readonly providerName: string;

  constructor(config: CircuitBreakerConfig) {
    this.failureThreshold = config.failureThreshold;
    this.cooldownPeriodMs = config.cooldownPeriodMs;
    this.providerName = config.providerName;
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed > this.cooldownPeriodMs) {
        this.state = 'HALF_OPEN';
        logger.info(
          { provider: this.providerName, state: this.state },
          'Circuit breaker transitioned from OPEN to HALF_OPEN (probing provider health)',
        );
      }
    }
    return this.state;
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new CircuitBreakerOpenError(this.providerName);
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  public onSuccess(): void {
    if (this.state === 'HALF_OPEN' || this.failureCount > 0) {
      logger.info(
        { provider: this.providerName, previousFailures: this.failureCount },
        'Circuit breaker recovered; state reset to CLOSED',
      );
    }
    this.state = 'CLOSED';
    this.failureCount = 0;
  }

  public onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      logger.warn(
        { provider: this.providerName, state: this.state },
        'Probe failed in HALF_OPEN; circuit breaker returned to OPEN',
      );
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.error(
        {
          provider: this.providerName,
          failures: this.failureCount,
          threshold: this.failureThreshold,
          cooldownMs: this.cooldownPeriodMs,
        },
        'Failure threshold breached; circuit breaker tripped to OPEN',
      );
    }
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
