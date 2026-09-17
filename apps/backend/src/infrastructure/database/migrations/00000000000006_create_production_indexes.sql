-- Migration: 00000000000006 - create_production_indexes
-- ByteBeacon Database Migration

BEGIN;

-- Production Index Optimization for High-Throughput Seeking & Keyset Pagination

    -- 1. Orders: Compound index for keyset pagination and agent lookups
    CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders (user_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (order_status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders (recipient_phone);

    -- 2. Financial Ledger: High-performance account seeks and keyset pagination
    CREATE INDEX IF NOT EXISTS idx_ledger_account_created ON financial_ledger (account_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_ledger_transaction ON financial_ledger (transaction_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_reference ON financial_ledger (reference_type, reference_id);

    -- 3. Provider Orders: Deduplication and provider reference seek
    CREATE INDEX IF NOT EXISTS idx_provider_orders_ref ON provider_orders (provider_reference);
    CREATE INDEX IF NOT EXISTS idx_provider_orders_status ON provider_orders (provider_status, created_at DESC);

    -- 4. Payments: Provider reference and event deduplication
    CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments (provider_reference);
    CREATE INDEX IF NOT EXISTS idx_payment_events_provider_event ON payment_events (provider, provider_event_id);

-- Record migration in tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version, name)
VALUES ('00000000000006', 'create_production_indexes')
ON CONFLICT (version) DO NOTHING;

COMMIT;
