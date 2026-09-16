-- ==============================================================================
-- Migration: 00000000000030_performance_and_auth_indexes.sql
-- Description: Targeted Composite Indexes for Fast Authentication & High-Throughput Seeking
-- ==============================================================================

DO $$
BEGIN
    -- 1. Accelerated Login & Role Verification
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        CREATE INDEX IF NOT EXISTS idx_users_lower_email_role ON users(LOWER(email), role);
        CREATE INDEX IF NOT EXISTS idx_users_clean_phone ON users((regexp_replace(COALESCE(phone, ''), '\D', '', 'g')));
    END IF;

    -- 2. Accelerated Session & Auth Token Validation
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions') THEN
        CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id, is_revoked, expires_at);
    END IF;

    -- 3. Storefront Orders & Finance Aggregations
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        CREATE INDEX IF NOT EXISTS idx_orders_store_composite ON orders(store_id, payment_status, order_status) WHERE store_id IS NOT NULL;
    END IF;

    -- 4. Audit Trail Seeking & Compliance
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs(actor_id, created_at DESC);
    END IF;
END $$;

INSERT INTO schema_migrations (version, name)
VALUES ('00000000000030', 'performance_and_auth_indexes')
ON CONFLICT (version) DO NOTHING;
