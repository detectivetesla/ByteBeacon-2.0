export interface EnvironmentCheckConfig {
  nodeEnv?: string;
  databaseUrl?: string;
  paystackSecretKey?: string;
  datahouseBaseUrl?: string;
}

export class EnvironmentIsolationError extends Error {
  constructor(message: string) {
    super(`[ENVIRONMENT_ISOLATION_VIOLATION] ${message}`);
    this.name = 'EnvironmentIsolationError';
  }
}

/**
 * Environment Isolation Guard ensuring automated test runs cannot accidentally execute against production infrastructure.
 */
export class EnvironmentGuard {
  /**
   * Enforces that test executions run strictly against non-production resources.
   */
  public static validateTestEnvironment(config: EnvironmentCheckConfig): void {
    const env = config.nodeEnv || process.env.NODE_ENV || 'test';

    if (env === 'production') {
      throw new EnvironmentIsolationError(
        'Automated test suite cannot execute with NODE_ENV="production". Testing must run in development or test mode.',
      );
    }

    if (config.paystackSecretKey && config.paystackSecretKey.startsWith('sk_live_')) {
      throw new EnvironmentIsolationError(
        'Production Paystack secret key (sk_live_...) detected in test environment. Phase 8 requires Paystack Test Mode keys (sk_test_...).',
      );
    }

    if (config.datahouseBaseUrl && config.datahouseBaseUrl.includes('production') && !config.datahouseBaseUrl.includes('sandbox')) {
      throw new EnvironmentIsolationError(
        'Production DataHouse telecom endpoint detected in test environment. Phase 8 requires DataHouse Sandbox endpoint.',
      );
    }

    if (config.databaseUrl && (config.databaseUrl.includes('prod-db') || config.databaseUrl.includes('production-db'))) {
      throw new EnvironmentIsolationError(
        'Production database connection detected in test execution context. Test database must be isolated.',
      );
    }
  }

  /**
   * Confirms whether given Paystack key is a verified sandbox/test credential.
   */
  public static isPaystackTestMode(key?: string): boolean {
    return !!key && key.startsWith('sk_test_');
  }

  /**
   * Confirms whether given API key is a sandbox/test key.
   */
  public static isApiKeyTestMode(key?: string): boolean {
    return !!key && (key.startsWith('ak_test_') || key.startsWith('bb_test_'));
  }
}
