-- ==============================================================================
-- SCRIPT: purge_orders_and_financial_data.sql
-- DESCRIPTION: High-Performance Database Storage Reclamation for Supabase (Option A)
-- TARGET: Purges all orders, transactions, deposits, pending MTN approvals,
--         revenues, total withdrawals, and high-volume telemetry logs.
-- PRESERVATION RULE: STRICTLY MAINTAINS ALL USER & AGENT WALLETS & PROFILES.
-- INSTRUCTIONS: Run this complete script in the Supabase SQL Editor.
-- NOTE: In PostgreSQL, TRUNCATE physically frees disk pages upon execution.
-- ==============================================================================

-- 1. Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. DYNAMIC TABLE TRUNCATION (Idempotent: safely ignores non-existent tables)
DO $$
DECLARE
    tbl text;
    target_tables text[] := ARRAY[
        -- Domain: Orders & Telecom Fulfillment
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

        -- Domain: Payments, Deposits, Transactions & Refunds
        'payment_events',
        'payment_attempts',
        'refund_events',
        'refunds',
        'financial_adjustments',
        'payment_reconciliations',
        'reconciliation_cases',
        'payments',
        'financial_ledger',

        -- Domain: MTN Pending Approvals & Telecom Pre-Checks
        'pending_beneficiary_approvals',
        'beneficiary_validation',

        -- Domain: Withdrawals & Payouts (Resets Total Withdrawals to 0)
        'store_payouts',

        -- Domain: Option A High-Volume Operational Logs & Telemetry
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
        'sessions'
    ];
BEGIN
    FOREACH tbl IN ARRAY target_tables
    LOOP
        IF EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name = tbl
        ) THEN
            RAISE NOTICE 'Truncating table: %', tbl;
            EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE;', tbl);
        ELSE
            RAISE NOTICE 'Table % does not exist in schema, skipping.', tbl;
        END IF;
    END LOOP;
END $$;

-- 3. RE-ESTABLISH BALANCED OPENING LEDGER JOURNALS FOR MAINTAINED WALLETS
-- Ensures the Double-Entry Ledger remains 100% balanced (Total Debits == Total Credits)
-- without storing millions of historical transaction rows.
DO $$
DECLARE
    r RECORD;
    v_txn_id UUID;
    v_acct_type VARCHAR(50);
    v_count INT := 0;
    v_total_pesewas BIGINT := 0;
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'financial_ledger'
    ) THEN
        FOR r IN 
            SELECT id, role, COALESCE(wallet_balance_pesewas, ROUND(COALESCE(wallet_balance, 0) * 100)) as balance_pesewas
            FROM users 
            WHERE COALESCE(wallet_balance_pesewas, ROUND(COALESCE(wallet_balance, 0) * 100)) > 0
        LOOP
            v_txn_id := uuid_generate_v4();
            v_acct_type := CASE 
                WHEN LOWER(COALESCE(r.role::text, 'customer')) IN ('agent', 'superagent', 'reseller') THEN 'AGENT_WALLET' 
                ELSE 'CUSTOMER_WALLET' 
            END;

            -- 3a. Credit the user's wallet with their retained balance
            INSERT INTO financial_ledger (
                transaction_id, entry_type, account_type, account_id,
                amount_pesewas, currency, reference_type, reference_id, description, created_at
            ) VALUES (
                v_txn_id, 'CREDIT', v_acct_type, r.id,
                r.balance_pesewas, 'GHS', 'OPENING_BALANCE', 'INIT-' || SUBSTR(r.id::text, 1, 8),
                'Retained wallet balance opening credit after database storage reclamation', CURRENT_TIMESTAMP
            );

            -- 3b. Matching balanced debit to platform escrow reserve
            INSERT INTO financial_ledger (
                transaction_id, entry_type, account_type, account_id,
                amount_pesewas, currency, reference_type, reference_id, description, created_at
            ) VALUES (
                v_txn_id, 'DEBIT', 'PLATFORM_ESCROW', r.id,
                r.balance_pesewas, 'GHS', 'OPENING_BALANCE', 'INIT-' || SUBSTR(r.id::text, 1, 8),
                'Retained wallet balance opening reserve after database storage reclamation', CURRENT_TIMESTAMP
            );

            v_count := v_count + 1;
            v_total_pesewas := v_total_pesewas + r.balance_pesewas;
        END LOOP;

        RAISE NOTICE 'Preserved % active user wallets with total float: GH₵ %', v_count, (v_total_pesewas / 100.0);
    END IF;
END $$;

-- 4. UPDATE QUERY PLANNER STATISTICS (Safe inside Supabase SQL editor)
ANALYZE;
