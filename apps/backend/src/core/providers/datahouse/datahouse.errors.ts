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

export class DataHouseInsufficientBalanceError extends DataHouseError {
  constructor(message = 'Insufficient agent wallet balance') {
    super(message, 400, 'INSUFFICIENT_BALANCE');
  }
}

export class DataHouseBundleInactiveError extends DataHouseError {
  constructor(message = 'Requested bundle is currently inactive') {
    super(message, 400, 'BUNDLE_INACTIVE');
  }
}

export class DataHouseBulkNotOnSandboxError extends DataHouseError {
  constructor(message = 'Bulk orders cannot be executed with sandbox test keys (ak_test_...)') {
    super(message, 400, 'BULK_NOT_ON_SANDBOX');
  }
}

export class DataHouseAgentInactiveError extends DataHouseError {
  constructor(message = 'Agent account is inactive or missing required scope') {
    super(message, 403, 'AGENT_INACTIVE');
  }
}

export class DataHouseBundleNotFoundError extends DataHouseError {
  constructor(message = 'Requested bundle ID was not found in catalog') {
    super(message, 404, 'BUNDLE_NOT_FOUND');
  }
}

export class DataHouseInvalidPhoneError extends DataHouseError {
  constructor(message = 'Invalid Ghanaian phone number format') {
    super(message, 422, 'INVALID_PHONE');
  }
}

export class DataHouseBeneficiaryNotValidatedError extends DataHouseError {
  constructor(message = 'First-time MTN beneficiary has not been validated (recorded for approval)') {
    super(message, 422, 'BENEFICIARY_NOT_VALIDATED');
  }
}

