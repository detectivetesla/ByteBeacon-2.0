-- ==============================================================================
-- Migration: 00000000000025_performance_and_auth_indexes.sql
-- Description: Targeted Composite Indexes for Fast Authentication & High-Throughput Seeking
-- ==============================================================================

-- 1. Accelerated Login & Role Verification
CREATE INDEX IF NOT EXISTS idx_users_lower_email_role ON users(LOWER(email), role);

-- 2. Accelerated Phone & Numeric Lookups
CREATE INDEX IF NOT EXISTS idx_users_clean_phone ON users((regexp_replace(COALESCE(phone, ''), '\D', '', 'g')));

-- 3. Accelerated Session & Auth Token Validation
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id, is_revoked, expires_at);

-- 4. Storefront Orders & Finance Aggregations (High-Frequency Analytics)
CREATE INDEX IF NOT EXISTS idx_orders_store_composite ON orders(store_id, payment_status, order_status) WHERE store_id IS NOT NULL;

-- 5. Audit Trail Seeking & Compliance
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs(actor_id, created_at DESC);
