import crypto from 'node:crypto';
import type pg from 'pg';
import { logger } from '../../core/logging/logger.js';

export interface LedgerSnapshotChecksum {
  totalEntries: number;
  totalDebitsPesewas: bigint;
  totalCreditsPesewas: bigint;
  isBalanced: boolean;
  sha256Checksum: string;
  calculatedAt: string;
}

export interface DisasterRecoveryVerificationResult {
  isVerified: boolean;
  sourceSnapshot: LedgerSnapshotChecksum;
  restoredSnapshot: LedgerSnapshotChecksum;
  discrepancies: string[];
}

/**
 * Disaster Recovery & PITR Backup Verification Service for ByteBeacon 2.0.
 * Proves that restored backups match financial ledger states to the exact pesewa without data loss.
 */
export class DisasterRecoveryService {
  private readonly db: pg.Pool;

  constructor(db: pg.Pool) {
    this.db = db;
  }

  /**
   * Computes an immutable SHA-256 cryptographic checksum across all financial ledger entries.
   */
  public async computeLedgerChecksum(): Promise<LedgerSnapshotChecksum> {
    const res = await this.db.query(`
      SELECT 
        id, transaction_id, entry_type, account_id, amount_pesewas, created_at
      FROM financial_ledger
      ORDER BY id ASC
    `);

    let totalDebits = 0n;
    let totalCredits = 0n;

    const hash = crypto.createHash('sha256');

    for (const row of res.rows) {
      const amount = BigInt(row.amount_pesewas);
      if (row.entry_type === 'DEBIT') {
        totalDebits += amount;
      } else {
        totalCredits += amount;
      }
      hash.update(`${row.id}:${row.transaction_id}:${row.entry_type}:${row.account_id}:${row.amount_pesewas}`);
    }

    const sha256Checksum = hash.digest('hex');
    const isBalanced = totalDebits === totalCredits;

    return {
      totalEntries: res.rows.length,
      totalDebitsPesewas: totalDebits,
      totalCreditsPesewas: totalCredits,
      isBalanced,
      sha256Checksum,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Compares a source backup snapshot against a restored database instance to verify zero financial loss.
   */
  public async verifyRestoredBackup(
    sourceSnapshot: LedgerSnapshotChecksum,
  ): Promise<DisasterRecoveryVerificationResult> {
    const restoredSnapshot = await this.computeLedgerChecksum();
    const discrepancies: string[] = [];

    if (sourceSnapshot.totalEntries !== restoredSnapshot.totalEntries) {
      discrepancies.push(
        `Entry count mismatch: source=${sourceSnapshot.totalEntries}, restored=${restoredSnapshot.totalEntries}`,
      );
    }

    if (sourceSnapshot.totalDebitsPesewas !== restoredSnapshot.totalDebitsPesewas) {
      discrepancies.push(
        `Debits mismatch: source=${sourceSnapshot.totalDebitsPesewas}, restored=${restoredSnapshot.totalDebitsPesewas}`,
      );
    }

    if (sourceSnapshot.totalCreditsPesewas !== restoredSnapshot.totalCreditsPesewas) {
      discrepancies.push(
        `Credits mismatch: source=${sourceSnapshot.totalCreditsPesewas}, restored=${restoredSnapshot.totalCreditsPesewas}`,
      );
    }

    if (sourceSnapshot.sha256Checksum !== restoredSnapshot.sha256Checksum) {
      discrepancies.push(
        `Cryptographic SHA-256 mismatch: source=${sourceSnapshot.sha256Checksum}, restored=${restoredSnapshot.sha256Checksum}`,
      );
    }

    if (!restoredSnapshot.isBalanced) {
      discrepancies.push('Restored financial ledger fails double-entry balance invariant (Debits != Credits)');
    }

    const isVerified = discrepancies.length === 0;

    logger.info(
      { isVerified, discrepanciesCount: discrepancies.length },
      '[DISASTER_RECOVERY] Completed backup restoration audit',
    );

    return {
      isVerified,
      sourceSnapshot,
      restoredSnapshot,
      discrepancies,
    };
  }
}
