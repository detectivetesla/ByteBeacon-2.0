-- ==============================================================================
-- Migration: 00000000000025_enhance_store_payouts_and_agent_withdrawals.sql
-- Description: Ensure store_payouts table, indexes, and destination account tracking
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
    -- 1. Ensure store_payouts table exists
    CREATE TABLE IF NOT EXISTS store_payouts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
        amount_pesewas BIGINT NOT NULL CHECK (amount_pesewas > 0),
        destination_account VARCHAR(255) NOT NULL,
        destination_provider VARCHAR(50) NOT NULL DEFAULT 'MOMO',
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
            CHECK (status IN ('PENDING', 'PROCESSING', 'PAID', 'HELD', 'REJECTED', 'FAILED')),
        admin_notes TEXT,
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMPTZ,
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Make store_id nullable if preexisting table had NOT NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_payouts' AND column_name = 'store_id' AND is_nullable = 'NO') THEN
        ALTER TABLE store_payouts ALTER COLUMN store_id DROP NOT NULL;
    END IF;

    -- 3. Add enhanced destination tracking columns
    ALTER TABLE store_payouts ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);
    ALTER TABLE store_payouts ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);
    ALTER TABLE store_payouts ADD COLUMN IF NOT EXISTS reference VARCHAR(100);

    -- 4. Create performance indexes
    CREATE INDEX IF NOT EXISTS idx_store_payouts_agent ON store_payouts(agent_id);
    CREATE INDEX IF NOT EXISTS idx_store_payouts_store ON store_payouts(store_id);
    CREATE INDEX IF NOT EXISTS idx_store_payouts_status ON store_payouts(status);
    CREATE INDEX IF NOT EXISTS idx_store_payouts_created ON store_payouts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_store_payouts_reference ON store_payouts(reference);
END $$;

INSERT INTO schema_migrations (version, name)
VALUES ('00000000000025', 'enhance_store_payouts_and_agent_withdrawals')
ON CONFLICT (version) DO NOTHING;
