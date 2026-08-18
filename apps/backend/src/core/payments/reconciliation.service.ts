import type pg from 'pg';
import { ReconciliationStatus, ReconciliationSummaryDto } from '@bytebeacon/shared';
import { logger } from '../logging/logger.js';

export interface ProviderStatementTransaction {
  reference: string;
  amountPesewas: number;
  currency: string;
  status: string;
  paidAt: string;
}

export interface DiscrepancyRecord {
  type: 'MISSING_INTERNAL' | 'MISSING_PROVIDER' | 'AMOUNT_MISMATCH' | 'STATUS_MISMATCH';
  reference: string;
  providerAmountPesewas?: number;
  internalAmountPesewas?: number;
  providerStatus?: string;
  internalStatus?: string;
  details: string;
}

export class ReconciliationService {
  private readonly db: pg.Pool;

  constructor(db: pg.Pool) {
    this.db = db;
  }

  /**
   * Reconciles a list of provider statement transactions against internal database records.
   */
  public async reconcileTransactions(
    reconciliationDate: string,
    provider: string,
    providerTransactions: ProviderStatementTransaction[],
  ): Promise<ReconciliationSummaryDto> {
    const discrepancies: DiscrepancyRecord[] = [];
    let totalProviderAmount = 0;
    let totalInternalAmount = 0;

    const references = providerTransactions.map((t) => t.reference);

    // Fetch matching internal payments
    const internalRes = await this.db.query(
      `SELECT id, provider_reference as "providerReference", amount_pesewas as "amountPesewas",
              currency, status, paid_at as "paidAt"
       FROM payments
       WHERE provider = $1 AND provider_reference = ANY($2::text[])`,
      [provider, references],
    );

    const internalMap = new Map<string, { id: string; amountPesewas: number; status: string }>();
    for (const row of internalRes.rows) {
      internalMap.set(row.providerReference, {
        id: row.id,
        amountPesewas: Number(row.amountPesewas),
        status: row.status,
      });
      totalInternalAmount += Number(row.amountPesewas);
    }

    for (const pTx of providerTransactions) {
      totalProviderAmount += pTx.amountPesewas;
      const internal = internalMap.get(pTx.reference);

      if (!internal) {
        discrepancies.push({
          type: 'MISSING_INTERNAL',
          reference: pTx.reference,
          providerAmountPesewas: pTx.amountPesewas,
          providerStatus: pTx.status,
          details: `Transaction ${pTx.reference} exists in provider settlement but missing in internal records`,
        });
      } else {
        if (internal.amountPesewas !== pTx.amountPesewas) {
          discrepancies.push({
            type: 'AMOUNT_MISMATCH',
            reference: pTx.reference,
            providerAmountPesewas: pTx.amountPesewas,
            internalAmountPesewas: internal.amountPesewas,
            details: `Amount mismatch for ${pTx.reference}: Provider (${pTx.amountPesewas}) vs Internal (${internal.amountPesewas})`,
          });
        }

        if (pTx.status.toUpperCase() === 'SUCCESS' && internal.status !== 'PAID') {
          discrepancies.push({
            type: 'STATUS_MISMATCH',
            reference: pTx.reference,
            providerStatus: pTx.status,
            internalStatus: internal.status,
            details: `Status mismatch for ${pTx.reference}: Provider (${pTx.status}) vs Internal (${internal.status})`,
          });
        }
      }
    }

    const discrepancyPesewas = Math.abs(totalProviderAmount - totalInternalAmount);
    const overallStatus: ReconciliationStatus =
      discrepancies.length === 0 ? ReconciliationStatus.MATCHED : ReconciliationStatus.DISCREPANCY;

    // Persist reconciliation report
    const insertRes = await this.db.query(
      `INSERT INTO payment_reconciliations (
          reconciliation_date, provider, total_provider_amount_pesewas,
          total_internal_amount_pesewas, discrepancy_pesewas, status, unmatched_records
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [
        reconciliationDate,
        provider,
        totalProviderAmount,
        totalInternalAmount,
        discrepancyPesewas,
        overallStatus,
        JSON.stringify(discrepancies),
      ],
    );

    const recRow = insertRes.rows[0];

    logger.info(
      {
        reconciliationId: recRow.id,
        status: overallStatus,
        discrepancyCount: discrepancies.length,
        discrepancyPesewas,
      },
      'Completed payment reconciliation run',
    );

    return {
      id: recRow.id,
      reconciliationDate,
      provider,
      totalProviderAmountPesewas: totalProviderAmount,
      totalInternalAmountPesewas: totalInternalAmount,
      discrepancyPesewas,
      status: overallStatus,
      unmatchedCount: discrepancies.length,
      createdAt: new Date(recRow.created_at).toISOString(),
    };
  }
}
