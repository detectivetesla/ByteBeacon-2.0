-- Migration: Enhanced Store Settings, Visit Tracking, and Notification Indexes
-- Part of Agent Commerce Platform conversion

-- 1. Store operational settings (auto-fulfillment, notification preferences)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';

-- 2. Store visit counter (simple increment for storefront page loads)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS visit_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS last_visited_at TIMESTAMPTZ;

-- 3. Index for efficient store-scoped notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- 4. Index for efficient store-scoped customer aggregation from orders
CREATE INDEX IF NOT EXISTS idx_orders_store_recipient ON orders(store_id, recipient_phone) WHERE store_id IS NOT NULL;

-- 5. Index for efficient daily revenue aggregation
CREATE INDEX IF NOT EXISTS idx_orders_store_created_date ON orders(store_id, created_at DESC) WHERE store_id IS NOT NULL;
