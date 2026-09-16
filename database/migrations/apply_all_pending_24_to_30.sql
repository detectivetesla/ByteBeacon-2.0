-- ==============================================================================
-- Combined Script: apply_all_pending_24_to_30.sql
-- Description: Run this entire script in Supabase SQL Editor to apply all pending
--              migrations from 00000000000024 through 00000000000030 in one run.
-- Idempotent: Safe to run multiple times without duplicating data or errors.
-- ==============================================================================

-- Ensure uuid-ossp is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- MIGRATION 24: align_default_telecom_routing
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    dh_id UUID;
    gmpl_id UUID;
BEGIN
    SELECT id INTO dh_id FROM telecom_providers WHERE LOWER(slug) = 'datahouse' OR LOWER(name) = 'datahouse' LIMIT 1;
    SELECT id INTO gmpl_id FROM telecom_providers WHERE LOWER(slug) = 'gmpl' OR LOWER(name) = 'gmpl' LIMIT 1;

    IF dh_id IS NOT NULL THEN
        UPDATE telecom_providers SET is_authoritative = FALSE WHERE is_authoritative = TRUE;
        UPDATE telecom_providers SET is_authoritative = TRUE, status = 'ACTIVE', is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = dh_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'telecom_networks') THEN
        UPDATE telecom_networks
        SET primary_provider_name = 'DataHouse',
            fallback_provider_name = 'GMPL',
            updated_at = CURRENT_TIMESTAMP
        WHERE code IN ('MTN', 'TELECEL', 'AIRTELTIGO');
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'provider_networks') AND dh_id IS NOT NULL THEN
        UPDATE provider_networks SET role = 'PRIMARY', priority = 1 WHERE provider_id = dh_id;
        IF gmpl_id IS NOT NULL THEN
            UPDATE provider_networks SET role = 'FALLBACK', priority = 2 WHERE provider_id = gmpl_id;
        END IF;
    END IF;
END $$;

INSERT INTO schema_migrations (version, name)
VALUES ('00000000000024', 'align_default_telecom_routing')
ON CONFLICT (version) DO NOTHING;

-- ------------------------------------------------------------------------------
-- MIGRATION 25: enhance_store_payouts_and_agent_withdrawals
-- ------------------------------------------------------------------------------
DO $$
BEGIN
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

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_payouts' AND column_name = 'store_id' AND is_nullable = 'NO') THEN
        ALTER TABLE store_payouts ALTER COLUMN store_id DROP NOT NULL;
    END IF;

    ALTER TABLE store_payouts ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);
    ALTER TABLE store_payouts ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);
    ALTER TABLE store_payouts ADD COLUMN IF NOT EXISTS reference VARCHAR(100);

    CREATE INDEX IF NOT EXISTS idx_store_payouts_agent ON store_payouts(agent_id);
    CREATE INDEX IF NOT EXISTS idx_store_payouts_store ON store_payouts(store_id);
    CREATE INDEX IF NOT EXISTS idx_store_payouts_status ON store_payouts(status);
    CREATE INDEX IF NOT EXISTS idx_store_payouts_created ON store_payouts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_store_payouts_reference ON store_payouts(reference);
END $$;

INSERT INTO schema_migrations (version, name)
VALUES ('00000000000025', 'enhance_store_payouts_and_agent_withdrawals')
ON CONFLICT (version) DO NOTHING;

-- ------------------------------------------------------------------------------
-- MIGRATION 26: enhance_api_usage_metrics_request_response_tracking
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_usage_metrics') THEN
        ALTER TABLE api_usage_metrics ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
        ALTER TABLE api_usage_metrics ADD COLUMN IF NOT EXISTS key_name VARCHAR(255);
        ALTER TABLE api_usage_metrics ADD COLUMN IF NOT EXISTS key_prefix VARCHAR(32);
        ALTER TABLE api_usage_metrics ADD COLUMN IF NOT EXISTS user_agent TEXT;
        ALTER TABLE api_usage_metrics ADD COLUMN IF NOT EXISTS request_headers JSONB;
        ALTER TABLE api_usage_metrics ADD COLUMN IF NOT EXISTS request_payload TEXT;
        ALTER TABLE api_usage_metrics ADD COLUMN IF NOT EXISTS response_headers JSONB;
        ALTER TABLE api_usage_metrics ADD COLUMN IF NOT EXISTS response_payload TEXT;

        CREATE INDEX IF NOT EXISTS idx_api_usage_agent ON api_usage_metrics(agent_id);
        CREATE INDEX IF NOT EXISTS idx_api_usage_key_prefix ON api_usage_metrics(key_prefix);
        CREATE INDEX IF NOT EXISTS idx_api_usage_agent_created ON api_usage_metrics(agent_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_api_usage_key_created ON api_usage_metrics(key_id, created_at DESC);

        UPDATE api_usage_metrics m
        SET agent_id = a.id
        FROM agents a
        WHERE m.agent_id IS NULL AND (m.user_id = a.user_id OR m.user_id = a.id);

        UPDATE api_usage_metrics m
        SET agent_id = a.id
        FROM api_keys k
        JOIN agents a ON a.user_id = k.agent_id OR a.id = k.agent_id
        WHERE m.agent_id IS NULL AND m.key_id = k.id;

        UPDATE api_usage_metrics m
        SET key_prefix = k.key_prefix,
            key_name = k.name
        FROM api_keys k
        WHERE m.key_id = k.id AND (m.key_prefix IS NULL OR m.key_name IS NULL);
    END IF;
END $$;

INSERT INTO schema_migrations (version, name)
VALUES ('00000000000026', 'enhance_api_usage_metrics_request_response_tracking')
ON CONFLICT (version) DO NOTHING;

-- ------------------------------------------------------------------------------
-- MIGRATION 27: enhance_activity_audit_control_center
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR(50);
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'WEB';
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS service VARCHAR(50) NOT NULL DEFAULT 'core-api';
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS endpoint VARCHAR(255);
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS http_method VARCHAR(10);
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS http_status INT;
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS latency_ms INT;
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS description TEXT;

    CREATE INDEX IF NOT EXISTS idx_audit_request_id ON audit_logs(request_id);
    CREATE INDEX IF NOT EXISTS idx_audit_source_created ON audit_logs(source, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_actor_role_created ON audit_logs(actor_role, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created_desc ON audit_logs(created_at DESC);

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        UPDATE audit_logs l
        SET actor_role = LOWER(u.role::text)
        FROM users u
        WHERE l.actor_role IS NULL AND l.actor_id::text = u.id::text;
    END IF;

    UPDATE audit_logs
    SET actor_role = LOWER(actor_type::text)
    WHERE actor_role IS NULL AND actor_type IS NOT NULL;
END $$;

INSERT INTO schema_migrations (version, name)
VALUES ('00000000000027', 'enhance_activity_audit_control_center')
ON CONFLICT (version) DO NOTHING;

-- ------------------------------------------------------------------------------
-- MIGRATION 28: enhance_audit_logs_actor_id_and_indexes
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    ALTER TABLE audit_logs ALTER COLUMN actor_id TYPE VARCHAR(100) USING actor_id::text;

    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_email VARCHAR(255);
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_name VARCHAR(255);

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        UPDATE audit_logs l
        SET actor_email = u.email,
            actor_name = COALESCE(u.full_name, u.email)
        FROM users u
        WHERE l.actor_email IS NULL AND l.actor_id::text = u.id::text;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_audit_actor_email ON audit_logs(actor_email);
    CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs(category);
    CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity);
    CREATE INDEX IF NOT EXISTS idx_audit_result ON audit_logs(result);
END $$;

INSERT INTO schema_migrations (version, name)
VALUES ('00000000000028', 'enhance_audit_logs_actor_id_and_indexes')
ON CONFLICT (version) DO NOTHING;

-- ------------------------------------------------------------------------------
-- MIGRATION 29: enhance_store_settings_and_visits
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stores') THEN
        ALTER TABLE stores ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';
        ALTER TABLE stores ADD COLUMN IF NOT EXISTS visit_count BIGINT NOT NULL DEFAULT 0;
        ALTER TABLE stores ADD COLUMN IF NOT EXISTS last_visited_at TIMESTAMPTZ;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        CREATE INDEX IF NOT EXISTS idx_orders_store_recipient ON orders(store_id, recipient_phone) WHERE store_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_orders_store_created_date ON orders(store_id, created_at DESC) WHERE store_id IS NOT NULL;
    END IF;
END $$;

INSERT INTO schema_migrations (version, name)
VALUES ('00000000000029', 'enhance_store_settings_and_visits')
ON CONFLICT (version) DO NOTHING;

-- ------------------------------------------------------------------------------
-- MIGRATION 30: performance_and_auth_indexes
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        CREATE INDEX IF NOT EXISTS idx_users_lower_email_role ON users(LOWER(email), role);
        CREATE INDEX IF NOT EXISTS idx_users_clean_phone ON users((regexp_replace(COALESCE(phone, ''), '\D', '', 'g')));
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions') THEN
        CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id, is_revoked, expires_at);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        CREATE INDEX IF NOT EXISTS idx_orders_store_composite ON orders(store_id, payment_status, order_status) WHERE store_id IS NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs(actor_id, created_at DESC);
    END IF;
END $$;

INSERT INTO schema_migrations (version, name)
VALUES ('00000000000030', 'performance_and_auth_indexes')
ON CONFLICT (version) DO NOTHING;
