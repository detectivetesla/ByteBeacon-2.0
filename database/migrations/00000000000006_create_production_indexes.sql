-- ==============================================================================
-- Migration: 00000000000006_create_production_indexes.sql
-- Description: Production Index Optimization for High-Throughput Seeking & Keyset Pagination
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders (user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (order_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders (recipient_phone);

CREATE INDEX IF NOT EXISTS idx_ledger_account_created ON financial_ledger (account_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction ON financial_ledger (transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON financial_ledger (reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_provider_orders_ref ON provider_orders (provider_reference);
CREATE INDEX IF NOT EXISTS idx_provider_orders_status ON provider_orders (provider_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments (provider_reference);
CREATE INDEX IF NOT EXISTS idx_payment_events_provider_event ON payment_events (provider, provider_event_id);
