import { CircuitBreaker, CircuitBreakerOpenError } from './circuit-breaker.js';
import { logger } from '../logging/logger.js';

export interface TelecomCircuitBreakerOptions {
  failureThreshold?: number;
  cooldownPeriodMs?: number;
  providerName?: string;
}

export class TelecomCircuitBreaker {
  private readonly breaker: CircuitBreaker;
  public readonly providerName: string;

  constructor(options: TelecomCircuitBreakerOptions = {}) {
    this.providerName = options.providerName || 'TelecomProvider';
    this.breaker = new CircuitBreaker({
      failureThreshold: options.failureThreshold || 5,
      cooldownPeriodMs: options.cooldownPeriodMs || 30000,
      providerName: this.providerName,
    });
  }

  public getState(): string {
    return this.breaker.getState();
  }

  public isAvailable(): boolean {
    return this.breaker.getState() !== 'OPEN';
  }

  /**
   * Executes an upstream telecom verification call within circuit breaker bounds.
   * If the circuit is OPEN or fails, returns { success: false, unavailable: true } instead of throwing,
   * guaranteeing that upstream outages NEVER misclassify valid recipients as REJECTED.
   */
  public async executeVerification<T>(
    action: () => Promise<T>,
  ): Promise<{ data: T | null; isAvailable: boolean; error?: string }> {
    try {
      const data = await this.breaker.execute(action);
      return { data, isAvailable: true };
    } catch (err: any) {
      const isOpen = err instanceof CircuitBreakerOpenError || this.breaker.getState() === 'OPEN';
      logger.warn(
        { provider: this.providerName, err: err?.message, isOpen },
        `[TelecomCircuitBreaker] Upstream telecom call interrupted: ${err?.message}`,
      );
      return {
        data: null,
        isAvailable: false,
        error: err?.message || 'Telecom provider unavailable',
      };
    }
  }

  public reset(): void {
    this.breaker.reset();
  }
}
