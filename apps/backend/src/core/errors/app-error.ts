import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../logging/logger.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Array<{ field?: string; code: string; message: string }>;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    details?: Array<{ field?: string; code: string; message: string }>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Invalid request input', details?: Array<{ field?: string; code: string; message: string }>) {
    super(message, 400, 'INVALID_INPUT', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required or token invalid') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden: Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Requested resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict or duplicate entry') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitExceededError extends AppError {
  constructor(message = 'Rate limit exceeded. Please retry later.') {
    super(message, 429, 'RATE_LIMITED');
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Unprocessable entity', details?: Array<{ field?: string; code: string; message: string }>) {
    super(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(message = 'Insufficient agent wallet balance') {
    super(message, 400, 'INSUFFICIENT_BALANCE');
  }
}

export class BundleInactiveError extends AppError {
  constructor(message = 'Requested bundle is currently inactive') {
    super(message, 400, 'BUNDLE_INACTIVE');
  }
}

export class BulkNotOnSandboxError extends AppError {
  constructor(message = 'Bulk orders cannot be executed with sandbox test keys (ak_test_...). Please use a live API key.') {
    super(message, 400, 'BULK_NOT_ON_SANDBOX');
  }
}

export class AgentInactiveError extends AppError {
  constructor(message = 'Agent account is inactive or missing required scope') {
    super(message, 403, 'AGENT_INACTIVE');
  }
}

export class BundleNotFoundError extends AppError {
  constructor(message = 'Requested bundle ID was not found in catalog') {
    super(message, 404, 'BUNDLE_NOT_FOUND');
  }
}

export class InvalidPhoneError extends AppError {
  constructor(message = 'Phone not a Ghanaian MSISDN') {
    super(message, 422, 'INVALID_PHONE');
  }
}

export class BeneficiaryNotValidatedError extends AppError {
  constructor(message = 'First-time MTN number not yet validated — recorded for MTN approval; precheck first.') {
    super(message, 422, 'BENEFICIARY_NOT_VALIDATED');
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const requestId = (request.id as string) || 'unknown-request-id';
  const isProd = process.env.NODE_ENV === 'production';

  logger.error(
    {
      err: error,
      requestId,
      url: request.url,
      method: request.method,
    },
    `Error handling request [${request.method} ${request.url}]`,
  );

  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = isProd
    ? 'An unexpected error occurred. Please contact ByteBeacon support.'
    : error.message;
  let details: Array<{ field?: string; code: string; message: string }> | undefined = undefined;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = error.details;
  } else if ('statusCode' in error && typeof error.statusCode === 'number') {
    statusCode = error.statusCode;
    errorCode = error.code || 'HTTP_ERROR';
    message = error.message;
  }

  reply.status(statusCode).send({
    success: false,
    error: {
      code: errorCode,
      message,
      ...(details ? { details } : {}),
      requestId,
    },
    meta: {
      correlationId: requestId,
    },
  });
}
