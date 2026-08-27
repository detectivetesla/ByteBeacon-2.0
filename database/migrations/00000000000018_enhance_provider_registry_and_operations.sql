-- ==============================================================================
-- Migration: 00000000000018_enhance_provider_registry_and_operations.sql
-- Description: Enhanced Telecom Provider Control Plane, Soft Delete & Telemetry
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
    -- 1. Enhance telecom_providers with soft delete, display name, priority, operations & telemetry
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'telecom_providers') THEN
        ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);
        ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 100;
        ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS supported_operations TEXT[] NOT NULL DEFAULT '{"HEALTH_CHECK","AUTHENTICATION","GET_AGENT","GET_BALANCE","GET_NETWORKS","GET_BUNDLES","VALIDATE_BENEFICIARY","SUBMIT_ORDER","GET_ORDER_STATUS"}';
        ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS health_status VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN';
        ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS failure_count INT NOT NULL DEFAULT 0;
        ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS success_count INT NOT NULL DEFAULT 0;
        ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS last_failed_request TIMESTAMPTZ;
        ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

        -- Sync display_name and is_primary where missing
        UPDATE telecom_providers SET display_name = name WHERE display_name IS NULL;
        UPDATE telecom_providers SET is_primary = is_authoritative WHERE is_authoritative = TRUE;
    END IF;

    -- 2. Enhance provider_orders with explicit provider tracking references & timestamps
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'provider_orders') THEN
        ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS provider_id UUID;
        ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS provider_response JSONB;
        ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS provider_submitted_at TIMESTAMPTZ;
        ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS provider_completed_at TIMESTAMPTZ;
        ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS last_provider_sync_at TIMESTAMPTZ;
    END IF;

    -- 3. Enhance telecom_networks with priority and indices
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'telecom_networks') THEN
        ALTER TABLE telecom_networks ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 1;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_telecom_providers_active ON telecom_providers(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_telecom_providers_health ON telecom_providers(health_status);
CREATE INDEX IF NOT EXISTS idx_provider_orders_prov_id ON provider_orders(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_orders_ref ON provider_orders(provider_reference);
