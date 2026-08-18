import { describe, it, expect } from 'vitest';
import { ProductionReleaseGateService, ReleaseGateInputs } from '../../src/infrastructure/release/production-release-gate.service.js';

describe('Phase 10.3: Automated Production Release Gate Engine', () => {
  const perfectReleaseInputs: ReleaseGateInputs = {
    p0DefectsCount: 0,
    p1SecurityDefectsCount: 0,
    totalTests: 233,
    failedTestsCount: 0,
    typecheckPassed: true,
    financialLedgerBalanced: true,
    authBypassesDetected: 0,
    datahouseInvariantViolations: 0,
    unhandledCriticalErrors: 0,
    migrationSafetyVerified: true,
    smokeTestsPassed: true,
  };

  it('should approve release when all 10 release gate criteria are 100% satisfied', () => {
    const decision = ProductionReleaseGateService.evaluateGate(perfectReleaseInputs);

    expect(decision.isApproved).toBe(true);
    expect(decision.reasons).toHaveLength(0);
  });

  it('should block release when a P0 defect is present', () => {
    const decision = ProductionReleaseGateService.evaluateGate({
      ...perfectReleaseInputs,
      p0DefectsCount: 1,
    });

    expect(decision.isApproved).toBe(false);
    expect(decision.reasons.some((r) => r.includes('P0 defects must be 0'))).toBe(true);
  });

  it('should block release when financial ledger fails double-entry balance check', () => {
    const decision = ProductionReleaseGateService.evaluateGate({
      ...perfectReleaseInputs,
      financialLedgerBalanced: false,
    });

    expect(decision.isApproved).toBe(false);
    expect(decision.reasons.some((r) => r.includes('financial ledger fails'))).toBe(true);
  });

  it('should block release when automated tests fail', () => {
    const decision = ProductionReleaseGateService.evaluateGate({
      ...perfectReleaseInputs,
      failedTestsCount: 2,
    });

    expect(decision.isApproved).toBe(false);
    expect(decision.reasons.some((r) => r.includes('All automated tests must pass'))).toBe(true);
  });

  it('should block release when migration safety is unverified', () => {
    const decision = ProductionReleaseGateService.evaluateGate({
      ...perfectReleaseInputs,
      migrationSafetyVerified: false,
    });

    expect(decision.isApproved).toBe(false);
    expect(decision.reasons.some((r) => r.includes('Database migration is not verified'))).toBe(true);
  });
});
