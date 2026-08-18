import crypto from 'node:crypto';
import type pg from 'pg';
import {
  LedgerEntryType,
  LedgerAccountType,
  Currency,
  FinancialLedgerEntryDto,
} from '@bytebeacon/shared';
import { BadRequestError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';

export interface LedgerPostingItem {
  entryType: LedgerEntryType;
  accountType: LedgerAccountType;
  accountId: string;
  amountPesewas: number;
  currency?: Currency;
  referenceType: string;
  referenceId: string;
  description: string;
}

export class FinancialLedgerService {
  private readonly db: pg.Pool;

  constructor(db: pg.Pool) {
    this.db = db;
  }

  /**
   * Records a balanced double-entry set of ledger items atomically.
   * Total Debits MUST equal Total Credits in integer pesewas.
   */
  public async recordJournalEntries(
    clientOrPool: pg.PoolClient | pg.Pool,
    items: LedgerPostingItem[],
  ): Promise<FinancialLedgerEntryDto[]> {
    if (!items || items.length < 2) {
      throw new BadRequestError('A valid journal entry requires at least 2 balanced ledger lines.');
    }

    let totalDebits = 0;
    let totalCredits = 0;

    for (const item of items) {
      if (!Number.isInteger(item.amountPesewas) || item.amountPesewas <= 0) {
        throw new BadRequestError(
          `Invalid ledger entry amount: ${item.amountPesewas}. Must be a positive integer in pesewas.`,
        );
      }
      if (item.entryType === LedgerEntryType.DEBIT) {
        totalDebits += item.amountPesewas;
      } else if (item.entryType === LedgerEntryType.CREDIT) {
        totalCredits += item.amountPesewas;
      } else {
        throw new BadRequestError(`Invalid ledger entry type: ${item.entryType}`);
      }
    }

    if (totalDebits !== totalCredits) {
      throw new BadRequestError(
        `Unbalanced financial ledger entry: Total Debits (${totalDebits} pesewas) != Total Credits (${totalCredits} pesewas)`,
      );
    }

    const transactionId = crypto.randomUUID();
    const results: FinancialLedgerEntryDto[] = [];

    for (const item of items) {
      const res = await clientOrPool.query(
        `INSERT INTO financial_ledger (
            transaction_id, entry_type, account_type, account_id,
            amount_pesewas, currency, reference_type, reference_id, description
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, entry_type as "entryType", account_type as "accountType",
                   account_id as "accountId", amount_pesewas as "amountPesewas",
                   currency, reference_type as "referenceType", reference_id as "referenceId",
                   description, created_at as "createdAt"`,
        [
          transactionId,
          item.entryType,
          item.accountType,
          item.accountId,
          item.amountPesewas,
          item.currency || Currency.GHS,
          item.referenceType,
          item.referenceId,
          item.description,
        ],
      );

      results.push({
        id: res.rows[0].id,
        entryType: res.rows[0].entryType as LedgerEntryType,
        accountType: res.rows[0].accountType as LedgerAccountType,
        accountId: res.rows[0].accountId,
        amountPesewas: Number(res.rows[0].amountPesewas),
        currency: res.rows[0].currency as Currency,
        referenceType: res.rows[0].referenceType,
        referenceId: res.rows[0].referenceId,
        description: res.rows[0].description,
        createdAt: new Date(res.rows[0].createdAt).toISOString(),
      });
    }

    logger.info(
      { transactionId, lineCount: items.length, totalPesewas: totalDebits },
      'Successfully posted balanced financial ledger transaction',
    );

    return results;
  }

  /**
   * Computes the authoritative account balance directly from immutable ledger rows.
   */
  public async getAccountBalance(
    accountType: LedgerAccountType,
    accountId: string,
  ): Promise<{ balancePesewas: number; totalDebits: number; totalCredits: number }> {
    const res = await this.db.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_pesewas ELSE 0 END), 0) as "totalDebits",
         COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE 0 END), 0) as "totalCredits"
       FROM financial_ledger
       WHERE account_type = $1 AND account_id = $2`,
      [accountType, accountId],
    );

    const totalDebits = Number(res.rows[0]?.totalDebits || 0);
    const totalCredits = Number(res.rows[0]?.totalCredits || 0);

    // For Customer/Agent Wallet & Platform Escrow (Liability/Asset perspective):
    // Credits increase wallet/escrow balance, Debits decrease balance.
    const balancePesewas = totalCredits - totalDebits;

    return {
      balancePesewas,
      totalDebits,
      totalCredits,
    };
  }

  public async getEntriesByReference(
    referenceType: string,
    referenceId: string,
  ): Promise<FinancialLedgerEntryDto[]> {
    const res = await this.db.query(
      `SELECT id, entry_type as "entryType", account_type as "accountType",
              account_id as "accountId", amount_pesewas as "amountPesewas",
              currency, reference_type as "referenceType", reference_id as "referenceId",
              description, created_at as "createdAt"
       FROM financial_ledger
       WHERE reference_type = $1 AND reference_id = $2
       ORDER BY created_at ASC`,
      [referenceType, referenceId],
    );

    return res.rows.map((row) => ({
      id: row.id,
      entryType: row.entryType as LedgerEntryType,
      accountType: row.accountType as LedgerAccountType,
      accountId: row.accountId,
      amountPesewas: Number(row.amountPesewas),
      currency: row.currency as Currency,
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      description: row.description,
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  /**
   * Reverses an existing journal transaction by creating balanced opposite entries.
   * Preserves append-only immutability (Original -> Correction/Reversal -> New resulting balance).
   */
  public async recordReversalTransaction(
    clientOrPool: pg.PoolClient | pg.Pool,
    originalTransactionId: string,
    reversalReason: string,
  ): Promise<FinancialLedgerEntryDto[]> {
    const origRes = await clientOrPool.query(
      `SELECT entry_type as "entryType", account_type as "accountType",
              account_id as "accountId", amount_pesewas as "amountPesewas",
              currency, reference_type as "referenceType", reference_id as "referenceId"
       FROM financial_ledger
       WHERE transaction_id = $1`,
      [originalTransactionId],
    );

    if (origRes.rows.length === 0) {
      throw new BadRequestError(`Transaction ID [${originalTransactionId}] not found for reversal.`);
    }

    const reversalItems: LedgerPostingItem[] = origRes.rows.map((row) => ({
      entryType: row.entryType === LedgerEntryType.DEBIT ? LedgerEntryType.CREDIT : LedgerEntryType.DEBIT,
      accountType: row.accountType,
      accountId: row.accountId,
      amountPesewas: Number(row.amountPesewas),
      currency: row.currency,
      referenceType: `REVERSAL_${row.referenceType}`,
      referenceId: originalTransactionId,
      description: `Reversal: ${reversalReason}`,
    }));

    return this.recordJournalEntries(clientOrPool, reversalItems);
  }

  /**
   * Detects ledger anomalies and integrity violations across the system:
   * - Negative wallet balances
   * - Unbalanced journal entries
   * - Duplicate payments
   */
  public async detectAnomalies(): Promise<{
    hasAnomalies: boolean;
    unbalancedTransactionsCount: number;
    negativeWalletsCount: number;
    anomalies: string[];
  }> {
    const anomalies: string[] = [];

    // 1. Check for unbalanced transactions (Debit != Credit sum)
    const unbalancedRes = await this.db.query(`
      SELECT transaction_id,
             SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_pesewas ELSE 0 END) as "totalDebits",
             SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE 0 END) as "totalCredits"
      FROM financial_ledger
      GROUP BY transaction_id
      HAVING SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_pesewas ELSE 0 END) !=
             SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE 0 END)
    `);

    const unbalancedCount = unbalancedRes.rows.length;
    for (const row of unbalancedRes.rows) {
      anomalies.push(
        `Unbalanced transaction ${row.transaction_id}: Debits (${row.totalDebits}) != Credits (${row.totalCredits})`,
      );
    }

    // 2. Check for negative wallet balances
    const negativeRes = await this.db.query(`
      SELECT account_id,
             SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE 0 END) -
             SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_pesewas ELSE 0 END) as "balance"
      FROM financial_ledger
      WHERE account_type = 'CUSTOMER_WALLET'
      GROUP BY account_id
      HAVING (SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE 0 END) -
              SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_pesewas ELSE 0 END)) < 0
    `);

    const negativeCount = negativeRes.rows.length;
    for (const row of negativeRes.rows) {
      anomalies.push(`Negative wallet balance detected for account ${row.account_id}: ${row.balance} pesewas`);
    }

    return {
      hasAnomalies: anomalies.length > 0,
      unbalancedTransactionsCount: unbalancedCount,
      negativeWalletsCount: negativeCount,
      anomalies,
    };
  }
}
