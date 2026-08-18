export class GmplError extends Error {
  public readonly retryable: boolean;
  public readonly statusCode?: number;
  public readonly errorCode?: string;

  constructor(message: string, retryable = false, statusCode?: number, errorCode?: string) {
    super(message);
    this.name = 'GmplError';
    this.retryable = retryable;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class GmplNetworkError extends GmplError {
  constructor(message = 'Network connectivity error connecting to GMPL/DataHouse') {
    super(message, true, 503, 'NETWORK_ERROR');
  }
}

export class GmplTimeoutError extends GmplError {
  constructor(message = 'Request to GMPL/DataHouse timed out') {
    super(message, true, 504, 'TIMEOUT');
  }
}

export class GmplRateLimitError extends GmplError {
  constructor(message = 'GMPL rate limit exceeded (HTTP 429)') {
    super(message, true, 429, 'RATE_LIMITED');
  }
}

export class GmplAuthError extends GmplError {
  constructor(message = 'Authentication failure communicating with GMPL') {
    super(message, false, 401, 'AUTH_ERROR');
  }
}

export class GmplRejectionError extends GmplError {
  constructor(message: string, errorCode = 'PROVIDER_REJECTED') {
    super(message, false, 422, errorCode);
  }
}
