import { GmplError } from './gmpl/gmpl.errors.js';

export interface RetryPolicyConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export class RetryPolicy {
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(config: RetryPolicyConfig = { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 30000 }) {
    this.maxAttempts = config.maxAttempts;
    this.baseDelayMs = config.baseDelayMs;
    this.maxDelayMs = config.maxDelayMs;
  }

  public getMaxAttempts(): number {
    return this.maxAttempts;
  }

  public isRetryable(error: unknown): boolean {
    if (error instanceof GmplError) {
      return error.retryable;
    }

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes('timeout') ||
        msg.includes('econnreset') ||
        msg.includes('econnrefused') ||
        msg.includes('network') ||
        msg.includes('429') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('504')
      ) {
        return true;
      }
    }

    return false;
  }

  public computeBackoffDelay(attempt: number): number {
    const exponential = this.baseDelayMs * Math.pow(2, attempt - 1);
    const capped = Math.min(exponential, this.maxDelayMs);
    // Add 10-25% random jitter to prevent thundering herd
    const jitter = capped * (0.1 + Math.random() * 0.15);
    return Math.floor(capped + jitter);
  }
}
