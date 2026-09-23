import type pg from 'pg';
import { createDatabasePool, closeDatabasePool } from './pool.js';
import { getConfig } from '../../config/env.js';
import { logger } from '../../core/logging/logger.js';

/**
 * Storage Purge & Reclamation Script for ByteBeacon 2.0 (Option A)
 * Purges orders, transactions, deposits, pending MTN approvals,
 * revenues, total withdrawals, and high-volume telemetry logs.
 * STRICTLY PRESERVES all customer and agent wallet balances.
 */
async function runStoragePurge() {
  const config = getConfig();
  const pool = createDatabasePool({ connectionString: config.DATABASE_URL });
  const client: pg.PoolClient = await pool.connect();

  try {
    logger.info('[STORAGE_PURGE] Initializing storage purge routine...');

    // 1. Pre-purge audit statistics
    logger.info('[STORAGE_PURGE] Inspecting current table row counts before purge...');
    const tablesToCheck = [
      'orders',
      'order_items',
      'order_events',
      'payments',
      'refunds',
      'financial_ledger',
      'pending_beneficiary_approvals',
      'beneficiary_validation',
      'store_payouts',
      'bulk_submissions',
      'audit_logs',
      'api_usage_metrics',
      'notifications',
    ];

    for (const tbl of tablesToCheck) {
      try {
        const res = await client.query(`SELECT COUNT(*) as count FROM public.${tbl}`);
        logger.info(`[PRE-CHECK] ${tbl}: ${res.rows[0]?.count || 0} rows`);
      } catch {
        // Table might not exist in some configurations
      }
    }

    const walletStats = await client.query(`
      SELECT 
        COUNT(CASE WHEN wallet_balance_pesewas > 0 THEN 1 END) as "fundedWalletsCount",
        COALESCE(SUM(wallet_balance_pesewas), 0) as "totalWalletPesewas"
      FROM users
    `);
    const fundedCount = walletStats.rows[0]?.fundedWalletsCount || 0;
    const totalGhs = (Number(walletStats.rows[0]?.totalWalletPesewas || 0) / 100).toFixed(2);
    logger.info(`[PRE-CHECK] Users with positive balance: ${fundedCount} users holding total GH₵ ${totalGhs} (Will be 100% PRESERVED)`);

    // 2. Begin atomic transaction
    await client.query('BEGIN');

    const targetTables = [
      // Orders & Fulfillment
      'provider_sync_records',
      'provider_dlq',
      'provider_submission_attempts',
      'provider_events',
      'provider_orders',
      'bulk_submission_items',
      'bulk_submissions',
      'order_items',
      'order_events',
      'idempotency_keys',
      'orders',

      // Payments & Financials
      'payment_events',
      'payment_attempts',
      'refund_events',
      'refunds',
      'financial_adjustments',
      'payment_reconciliations',
      'reconciliation_cases',
      'payments',
      'financial_ledger',

      // MTN Approvals & Pre-Checks
      'pending_beneficiary_approvals',
      'beneficiary_validation',

      // Withdrawals
      'store_payouts',

      // High-Volume Operational Logs
      'daily_store_visits',
      'provider_incidents',
      'provider_test_runs',
      'provider_health_checks',
      'provider_switch_logs',
      'alert_events',
      'system_alerts',
      'notifications',
      'communication_delivery_logs',
      'webhook_delivery_logs',
      'api_security_events',
      'api_usage_metrics',
      'security_incidents',
      'audit_logs',
      'phone_verifications',
      'password_resets',
      'sessions',
    ];

    for (const tbl of targetTables) {
      const existsRes = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [tbl],
      );
      if (existsRes.rows.length > 0) {
        await client.query(`TRUNCATE TABLE public.${tbl} RESTART IDENTITY CASCADE`);
        logger.info(`[TRUNCATED] public.${tbl}`);
      }
    }

    // 3. Re-establish balanced double-entry opening records for non-zero wallets
    const usersWithBalance = await client.query(`
      SELECT id, role, COALESCE(wallet_balance_pesewas, ROUND(COALESCE(wallet_balance, 0) * 100)) as "balancePesewas"
      FROM users
      WHERE COALESCE(wallet_balance_pesewas, ROUND(COALESCE(wallet_balance, 0) * 100)) > 0
    `);

    for (const user of usersWithBalance.rows) {
      const isAgent = ['agent', 'superagent', 'reseller'].includes(String(user.role).toLowerCase());
      const accountType = isAgent ? 'AGENT_WALLET' : 'CUSTOMER_WALLET';
      const txnId = crypto.randomUUID();

      // Wallet credit
      await client.query(
        `INSERT INTO financial_ledger (
           transaction_id, entry_type, account_type, account_id,
           amount_pesewas, currency, reference_type, reference_id, description
         ) VALUES ($1, 'CREDIT', $2, $3, $4, 'GHS', 'OPENING_BALANCE', $5, 'Retained wallet balance opening credit')`,
        [txnId, accountType, user.id, user.balancePesewas, `INIT-${String(user.id).slice(0, 8)}`],
      );

      // Escrow debit
      await client.query(
        `INSERT INTO financial_ledger (
           transaction_id, entry_type, account_type, account_id,
           amount_pesewas, currency, reference_type, reference_id, description
         ) VALUES ($1, 'DEBIT', 'PLATFORM_ESCROW', $2, $3, 'GHS', 'OPENING_BALANCE', $4, 'Retained wallet balance opening reserve')`,
        [txnId, user.id, user.balancePesewas, `INIT-${String(user.id).slice(0, 8)}`],
      );
    }

    await client.query('COMMIT');
    logger.info(`[STORAGE_PURGE] Transaction committed successfully. Maintained wallets for ${usersWithBalance.rows.length} users.`);

    // 4. Release connection and run VACUUM ANALYZE to reclaim disk space
    client.release();
    logger.info('[STORAGE_PURGE] Running VACUUM (ANALYZE) to reclaim disk space in PostgreSQL...');
    await pool.query('VACUUM (ANALYZE)');
    logger.info('[STORAGE_PURGE] Database storage reclamation 100% COMPLETE.');
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    logger.error({ err: error?.message || error }, '[STORAGE_PURGE] Failed to execute database storage purge');
    process.exit(1);
  } finally {
    await closeDatabasePool();
  }
}

runStoragePurge();
