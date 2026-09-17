-- Migration: 00000000000020 - enhance_wallet_deposits_and_topup_schema
-- ByteBeacon Database Migration

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    DO $$
    BEGIN
        -- 1. Relax order_id in payments to allow NULL for wallet top-ups (which do not correspond to product catalog orders)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'order_id') THEN
            ALTER TABLE payments ALTER COLUMN order_id DROP NOT NULL;
        END IF;

        -- 2. Ensure payments has metadata JSONB column for top-up context and user linkage
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'metadata') THEN
            ALTER TABLE payments ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';
        END IF;

        -- 3. Ensure payments has index on provider_reference for fast webhook lookups
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
            CREATE INDEX IF NOT EXISTS idx_payments_provider_reference ON payments (provider_reference);
        END IF;

        -- 4. Authoritative wallet consistency between wallet_balance (GHS numeric) and wallet_balance_pesewas (BIGINT)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
            UPDATE users
            SET wallet_balance = ROUND(COALESCE(wallet_balance_pesewas, 0) / 100.0, 2)
            WHERE wallet_balance IS NULL OR wallet_balance != ROUND(COALESCE(wallet_balance_pesewas, 0) / 100.0, 2);
        END IF;
    END $$;

-- Record migration in tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version, name)
VALUES ('00000000000020', 'enhance_wallet_deposits_and_topup_schema')
ON CONFLICT (version) DO NOTHING;

COMMIT;
