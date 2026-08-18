import { AppError } from '../../errors/app-error.js';

export class DataHouseError extends AppError {
  constructor(message: string, statusCode = 502, code = 'DATAHOUSE_ERROR', details?: unknown[]) {
    super(message, statusCode, code, details as any);
  }
}

export class DataHouseNetworkError extends DataHouseError {
  constructor(message: string, originalError?: Error) {
    super(`DataHouse Network Failure: ${message}`, 503, 'DATAHOUSE_NETWORK_ERROR', [
      { field: 'network', message: originalError?.message || message },
    ]);
  }
}

export class DataHouseTimeoutError extends DataHouseError {
  constructor(timeoutMs: number) {
    super(`DataHouse Request Timed Out after ${timeoutMs}ms`, 504, 'DATAHOUSE_TIMEOUT', [
      { field: 'timeoutMs', message: `Exceeded ${timeoutMs}ms limit` },
    ]);
  }
}

export class DataHouseRateLimitError extends DataHouseError {
  constructor(retryAfterSeconds?: number) {
    super('DataHouse Rate Limit Exceeded (HTTP 429)', 429, 'DATAHOUSE_RATE_LIMIT', [
      { field: 'retryAfter', message: `Retry after ${retryAfterSeconds || 2}s` },
    ]);
  }
}

export class DataHouseAuthError extends DataHouseError {
  constructor(message = 'Invalid DataHouse API Key or Authentication Failure') {
    super(message, 502, 'DATAHOUSE_AUTH_ERROR');
  }
}

export class DataHouseRejectionError extends DataHouseError {
  public readonly providerCode?: string;

  constructor(message: string, providerCode?: string, details?: unknown[]) {
    super(`DataHouse Fulfillment Rejected: ${message}`, 422, 'DATAHOUSE_REJECTION', details);
    this.providerCode = providerCode;
  }
}

export class DataHouseBeneficiaryError extends DataHouseError {
  constructor(message: string, details?: unknown[]) {
    super(`DataHouse Beneficiary Precheck Error: ${message}`, 422, 'DATAHOUSE_BENEFICIARY_ERROR', details);
  }
}
