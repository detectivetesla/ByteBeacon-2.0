import { logger } from '../../core/logging/logger.js';

export interface ReleaseGateInputs {
  p0DefectsCount: number;
  p1SecurityDefectsCount: number;
  totalTests: number;
  failedTestsCount: number;
  typecheckPassed: boolean;
  financialLedgerBalanced: boolean;
  authBypassesDetected: number;
  datahouseInvariantViolations: number;
  unhandledCriticalErrors: number;
  migrationSafetyVerified: boolean;
  smokeTestsPassed: boolean;
}

export interface ReleaseGateDecision {
  isApproved: boolean;
  reasons: string[];
  evaluatedAt: string;
  metrics: ReleaseGateInputs;
}

/**
 * Formal Production Release Gate Service for ByteBeacon 2.0.
 * Evaluates mandatory release safety criteria before any build can be promoted to production.
 */
export class ProductionReleaseGateService {
  /**
   * Evaluates release gate inputs and returns an immutable decision.
   */
  public static evaluateGate(inputs: ReleaseGateInputs): ReleaseGateDecision {
    const reasons: string[] = [];

    if (inputs.p0DefectsCount > 0) {
      reasons.push(`P0 defects must be 0 (found ${inputs.p0DefectsCount})`);
    }

    if (inputs.p1SecurityDefectsCount > 0) {
      reasons.push(`P1 security defects must be 0 (found ${inputs.p1SecurityDefectsCount})`);
    }

    if (inputs.failedTestsCount > 0) {
      reasons.push(`All automated tests must pass (found ${inputs.failedTestsCount} failed tests out of ${inputs.totalTests})`);
    }

    if (!inputs.typecheckPassed) {
      reasons.push('Strict TypeScript typecheck failed');
    }

    if (!inputs.financialLedgerBalanced) {
      reasons.push('Authoritative double-entry financial ledger fails debit/credit balance constraint');
    }

    if (inputs.authBypassesDetected > 0) {
      reasons.push(`Authentication/RBAC bypasses detected (count: ${inputs.authBypassesDetected})`);
    }

    if (inputs.datahouseInvariantViolations > 0) {
      reasons.push(`DataHouse telecom provider authority violations detected (count: ${inputs.datahouseInvariantViolations})`);
    }

    if (inputs.unhandledCriticalErrors > 0) {
      reasons.push(`Unhandled critical Sentry errors detected in release candidate (count: ${inputs.unhandledCriticalErrors})`);
    }

    if (!inputs.migrationSafetyVerified) {
      reasons.push('Database migration is not verified as non-destructive or backward-compatible');
    }

    if (!inputs.smokeTestsPassed) {
      reasons.push('Production pre-flight smoke tests failed');
    }

    const isApproved = reasons.length === 0;

    if (isApproved) {
      logger.info({ evaluatedAt: new Date().toISOString() }, '[RELEASE_GATE] Production Release Gate APPROVED');
    } else {
      logger.warn({ reasons }, '[RELEASE_GATE] Production Release Gate BLOCKED');
    }

    return {
      isApproved,
      reasons,
      evaluatedAt: new Date().toISOString(),
      metrics: inputs,
    };
  }
}
