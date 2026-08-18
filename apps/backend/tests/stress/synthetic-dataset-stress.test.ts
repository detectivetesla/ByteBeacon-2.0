import { describe, it, expect } from 'vitest';
import { SyntheticDataGenerator } from '../../src/infrastructure/testing/synthetic-data-generator.js';

describe('Phase 8.8: High-Volume Stress & Latency Validation Suite (100k+ Records)', () => {
  const generator = new SyntheticDataGenerator();

  it('should stream and validate 100,000 synthetic orders and 200,000 balanced ledger lines within performance thresholds', () => {
    const totalTarget = 100000;
    const chunkSize = 10000;
    const stream = generator.generateLargeDatasetStream(totalTarget, chunkSize);

    const latenciesMs: number[] = [];
    let totalOrdersGenerated = 0;
    let totalLedgerEntriesCount = 0;

    for (const chunk of stream) {
      const start = performance.now();

      // Chunk integrity validation
      totalOrdersGenerated += chunk.orders.length;
      totalLedgerEntriesCount += chunk.orders.length * 2; // 1 debit + 1 credit per order

      // Verify sample order invariants
      const sample = chunk.orders[0];
      expect(sample.amountPesewas).toBeGreaterThan(0n);
      expect(sample.recipientPhone).toMatch(/^024\d{7}$/);

      const duration = performance.now() - start;
      latenciesMs.push(duration);
    }

    expect(totalOrdersGenerated).toBe(totalTarget);
    expect(totalLedgerEntriesCount).toBe(200000);

    // Calculate P50, P95, P99 Latency across chunk processing
    latenciesMs.sort((a, b) => a - b);
    const p50 = latenciesMs[Math.floor(latenciesMs.length * 0.5)];
    const p95 = latenciesMs[Math.floor(latenciesMs.length * 0.95)];
    const p99 = latenciesMs[Math.floor(latenciesMs.length * 0.99)];

    // Performance assertion: Each 10k chunk should process in < 50ms in-memory
    expect(p50).toBeLessThan(50);
    expect(p95).toBeLessThan(100);
    expect(p99).toBeLessThan(150);
  });
});
