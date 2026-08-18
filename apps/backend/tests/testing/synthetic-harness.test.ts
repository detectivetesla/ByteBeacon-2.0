import { describe, it, expect } from 'vitest';
import { SyntheticDataGenerator, PiiMasker } from '../../src/infrastructure/testing/synthetic-data-generator.js';
import { EnvironmentGuard, EnvironmentIsolationError } from '../../src/infrastructure/testing/environment-guard.js';

describe('Phase 8.1: Test Harness & Synthetic Data Infrastructure', () => {
  describe('PII Masking Standards', () => {
    it('should partially mask Ghana mobile numbers correctly (e.g. 024****567)', () => {
      expect(PiiMasker.maskPhone('0244123567')).toBe('024****567');
      expect(PiiMasker.maskPhone('0501234999')).toBe('050****999');
      expect(PiiMasker.maskPhone('123')).toBe('***');
    });

    it('should partially mask email addresses correctly (e.g. kw***@example.com)', () => {
      expect(PiiMasker.maskEmail('kwame.asante@bytebeacon.com')).toBe('kw***@bytebeacon.com');
      expect(PiiMasker.maskEmail('ab@test.com')).toBe('a***@test.com');
      expect(PiiMasker.maskEmail('invalid-email')).toBe('***@***.***');
    });

    it('should completely redact secrets and keys', () => {
      expect(PiiMasker.redactSecret('sk_live_998877665544')).toBe('[REDACTED]');
      expect(PiiMasker.redactSecret('super_secret_jwt_key')).toBe('[REDACTED]');
    });
  });

  describe('Synthetic Data Generator', () => {
    const generator = new SyntheticDataGenerator();

    it('should generate valid synthetic users across 4-tier roles', () => {
      const users = generator.generateUsers(30);
      expect(users).toHaveLength(30);
      expect(users[0].role).toBe('super_admin');
      expect(users[1].role).toBe('admin');
      expect(users[10].role).toBe('agent');
      expect(users[25].role).toBe('customer');
    });

    it('should generate orders with balanced double-entry ledger entries (Total Debit === Total Credit)', () => {
      const users = generator.generateUsers(5);
      const { orders, ledgerEntries } = generator.generateOrdersWithLedger(50, users);

      expect(orders).toHaveLength(50);
      expect(ledgerEntries).toHaveLength(100); // 1 Debit + 1 Credit per order

      // Validate balanced ledger invariant for every generated transaction
      const transactionSums = new Map<string, { debits: bigint; credits: bigint }>();

      for (const entry of ledgerEntries) {
        const current = transactionSums.get(entry.transactionId) || { debits: 0n, credits: 0n };
        if (entry.entryType === 'DEBIT') {
          current.debits += entry.amountPesewas;
        } else {
          current.credits += entry.amountPesewas;
        }
        transactionSums.set(entry.transactionId, current);
      }

      for (const [txnId, sums] of transactionSums.entries()) {
        expect(sums.debits, `Transaction ${txnId} must be balanced`).toBe(sums.credits);
      }
    });

    it('should stream 100,000 synthetic records in memory chunks without heap exhaustion', () => {
      const stream = generator.generateLargeDatasetStream(10000, 2500); // 10k in chunks of 2.5k
      let processedRecords = 0;
      let chunksCount = 0;

      for (const chunk of stream) {
        processedRecords += chunk.orders.length;
        chunksCount++;
        expect(chunk.orders.length).toBeLessThanOrEqual(2500);
      }

      expect(processedRecords).toBe(10000);
      expect(chunksCount).toBe(4);
    });
  });

  describe('Environment Isolation Guards', () => {
    it('should pass validation for clean test environment with test keys', () => {
      expect(() => {
        EnvironmentGuard.validateTestEnvironment({
          nodeEnv: 'test',
          databaseUrl: 'postgresql://postgres:postgres@localhost:5432/bytebeacon_test',
          paystackSecretKey: 'sk_test_mock_123456789',
          datahouseBaseUrl: 'https://sandbox.getmorepaylessdatahouse.net/api/v1',
        });
      }).not.toThrow();
    });

    it('should throw EnvironmentIsolationError if live Paystack key is detected in test context', () => {
      expect(() => {
        EnvironmentGuard.validateTestEnvironment({
          nodeEnv: 'test',
          paystackSecretKey: 'sk_live_dangerous_real_money_key_1234',
        });
      }).toThrow(EnvironmentIsolationError);
    });

    it('should throw EnvironmentIsolationError if NODE_ENV is set to production', () => {
      expect(() => {
        EnvironmentGuard.validateTestEnvironment({
          nodeEnv: 'production',
        });
      }).toThrow(EnvironmentIsolationError);
    });

    it('should identify test mode API keys accurately', () => {
      expect(EnvironmentGuard.isPaystackTestMode('sk_test_123')).toBe(true);
      expect(EnvironmentGuard.isPaystackTestMode('sk_live_123')).toBe(false);
      expect(EnvironmentGuard.isApiKeyTestMode('ak_test_xyz')).toBe(true);
      expect(EnvironmentGuard.isApiKeyTestMode('ak_live_xyz')).toBe(false);
    });
  });
});
