-- ==============================================================================
-- Migration: 00000000000014_enhance_telecom_provider_control_plane.sql
-- Description: Enhanced Telecom Provider Control Plane Schema
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- 1. TELECOM NETWORKS
    CREATE TABLE IF NOT EXISTS telecom_networks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(50) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
            CHECK (status IN ('ACTIVE', 'INACTIVE', 'DEGRADED', 'MAINTENANCE')),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        primary_provider_id UUID,
        primary_provider_name VARCHAR(100) DEFAULT 'DataHouse',
        fallback_provider_id UUID,
        fallback_provider_name VARCHAR(100) DEFAULT 'GMPL',
        endpoint_url TEXT,
        webhook_url TEXT,
        daily_volume_limit_mb BIGINT DEFAULT 1000000000,
        daily_order_limit INT DEFAULT 100000,
        min_bundle_mb INT DEFAULT 50,
        max_bundle_mb INT DEFAULT 500000,
        uptime_percentage NUMERIC(5,2) DEFAULT 99.90,
        latency_ms INT DEFAULT 180,
        success_rate_percent NUMERIC(5,2) DEFAULT 99.50,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_telecom_networks_code ON telecom_networks(code);
    CREATE INDEX IF NOT EXISTS idx_telecom_networks_status ON telecom_networks(status);

    -- 2. TELECOM PROVIDERS
    CREATE TABLE IF NOT EXISTS telecom_providers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) UNIQUE NOT NULL,
        slug VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        provider_type VARCHAR(50) NOT NULL DEFAULT 'AGGREGATOR'
            CHECK (provider_type IN ('AGGREGATOR', 'DIRECT_MNO', 'CUSTOM_HTTP', 'MOCK')),
        environment VARCHAR(20) NOT NULL DEFAULT 'PRODUCTION'
            CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
        status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
            CHECK (status IN ('ACTIVE', 'INACTIVE', 'DEGRADED', 'ERROR', 'MAINTENANCE')),
        is_authoritative BOOLEAN NOT NULL DEFAULT FALSE,
        supported_networks TEXT[] NOT NULL DEFAULT '{"MTN", "TELECEL", "AIRTELTIGO"}',
        api_base_url TEXT NOT NULL,
        api_version VARCHAR(20) NOT NULL DEFAULT 'v1',
        auth_method VARCHAR(50) NOT NULL DEFAULT 'API_KEY'
            CHECK (auth_method IN ('API_KEY', 'BEARER', 'BASIC', 'HMAC_SHA256')),
        webhook_support BOOLEAN NOT NULL DEFAULT TRUE,
        webhook_url TEXT,
        sandbox_support BOOLEAN NOT NULL DEFAULT TRUE,
        sandbox_base_url TEXT,
        last_health_check TIMESTAMPTZ,
        last_successful_request TIMESTAMPTZ,
        last_failure TIMESTAMPTZ,
        last_error TEXT,
        avg_latency_ms INT DEFAULT 180,
        p95_latency_ms INT DEFAULT 350,
        success_rate NUMERIC(5,2) DEFAULT 99.80,
        total_requests_count BIGINT DEFAULT 0,
        failed_requests_count BIGINT DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_telecom_providers_auth ON telecom_providers(is_authoritative);
    CREATE INDEX IF NOT EXISTS idx_telecom_providers_status ON telecom_providers(status);
    CREATE INDEX IF NOT EXISTS idx_telecom_providers_slug ON telecom_providers(slug);

    -- 3. PROVIDER CREDENTIALS
    CREATE TABLE IF NOT EXISTS provider_credentials (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        provider_id UUID NOT NULL REFERENCES telecom_providers(id) ON DELETE CASCADE,
        environment VARCHAR(20) NOT NULL DEFAULT 'PRODUCTION'
            CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
        api_key_masked VARCHAR(50) NOT NULL,
        api_key_encrypted TEXT NOT NULL,
        api_secret_encrypted TEXT,
        webhook_secret_encrypted TEXT,
        webhook_secret_masked VARCHAR(50),
        status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
            CHECK (status IN ('ACTIVE', 'ROTATED', 'REVOKED', 'EXPIRED')),
        last_tested_at TIMESTAMPTZ,
        last_test_result VARCHAR(30),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        revoked_at TIMESTAMPTZ,
        revocation_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_provider_creds_prov ON provider_credentials(provider_id, environment);

    -- 4. PROVIDER CAPABILITIES
    CREATE TABLE IF NOT EXISTS provider_capabilities (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        provider_id UUID NOT NULL REFERENCES telecom_providers(id) ON DELETE CASCADE,
        capability VARCHAR(50) NOT NULL,
        is_supported BOOLEAN NOT NULL DEFAULT TRUE,
        notes TEXT,
        last_verified_at TIMESTAMPTZ,
        CONSTRAINT uq_provider_capability UNIQUE (provider_id, capability)
    );

    CREATE INDEX IF NOT EXISTS idx_provider_caps_prov ON provider_capabilities(provider_id);

    -- 5. PROVIDER NETWORKS
    CREATE TABLE IF NOT EXISTS provider_networks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        network_code VARCHAR(50) NOT NULL,
        provider_id UUID NOT NULL REFERENCES telecom_providers(id) ON DELETE CASCADE,
        role VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE'
            CHECK (role IN ('PRIMARY', 'FALLBACK', 'AVAILABLE', 'DISABLED')),
        priority INT NOT NULL DEFAULT 1,
        weight_percent INT NOT NULL DEFAULT 100,
        status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_provider_network UNIQUE (network_code, provider_id)
    );

    CREATE INDEX IF NOT EXISTS idx_provider_nets_code ON provider_networks(network_code);
    CREATE INDEX IF NOT EXISTS idx_provider_nets_prov ON provider_networks(provider_id);

    -- 6. PROVIDER HEALTH CHECKS
    CREATE TABLE IF NOT EXISTS provider_health_checks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        provider_id UUID NOT NULL REFERENCES telecom_providers(id) ON DELETE CASCADE,
        environment VARCHAR(20) NOT NULL DEFAULT 'PRODUCTION',
        status VARCHAR(30) NOT NULL,
        latency_ms INT NOT NULL,
        http_status INT,
        dns_status VARCHAR(30) DEFAULT 'PASSED',
        tls_status VARCHAR(30) DEFAULT 'PASSED',
        auth_status VARCHAR(30) DEFAULT 'PASSED',
        error_message TEXT,
        checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_prov_health_prov ON provider_health_checks(provider_id, checked_at DESC);

    -- 7. PROVIDER TEST RUNS
    CREATE TABLE IF NOT EXISTS provider_test_runs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        provider_id UUID NOT NULL REFERENCES telecom_providers(id) ON DELETE CASCADE,
        test_type VARCHAR(50) NOT NULL,
        environment VARCHAR(20) NOT NULL DEFAULT 'SANDBOX',
        performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        result VARCHAR(30) NOT NULL,
        duration_ms INT NOT NULL,
        steps_json JSONB NOT NULL DEFAULT '[]',
        provider_reference VARCHAR(255),
        error_category VARCHAR(100),
        error_message TEXT,
        details JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_prov_test_runs_prov ON provider_test_runs(provider_id, created_at DESC);

    -- 8. PROVIDER INCIDENTS
    CREATE TABLE IF NOT EXISTS provider_incidents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        provider_id UUID NOT NULL REFERENCES telecom_providers(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        severity VARCHAR(30) NOT NULL DEFAULT 'HIGH'
            CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
        status VARCHAR(30) NOT NULL DEFAULT 'INVESTIGATING'
            CHECK (status IN ('INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED')),
        affected_network VARCHAR(50) DEFAULT 'ALL',
        failure_rate_percent NUMERIC(5,2) DEFAULT 0,
        started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMPTZ,
        summary TEXT NOT NULL,
        mitigation_notes TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_prov_incidents_prov ON provider_incidents(provider_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_prov_incidents_status ON provider_incidents(status);

    -- 9. SEED BASELINE NETWORKS & PROVIDERS
    INSERT INTO telecom_networks (code, name, slug, status, is_active, primary_provider_name, fallback_provider_name, endpoint_url, webhook_url, uptime_percentage, latency_ms, success_rate_percent)
    VALUES
        ('MTN', 'MTN Ghana', 'mtn-ghana', 'ACTIVE', TRUE, 'DataHouse', 'GMPL', 'https://api.datahouse.com.gh/v1/mtn', '/api/v1/fulfillment/datahouse/webhook', 99.85, 183, 99.80),
        ('TELECEL', 'Telecel Ghana', 'telecel-ghana', 'ACTIVE', TRUE, 'DataHouse', 'GMPL', 'https://api.datahouse.com.gh/v1/telecel', '/api/v1/fulfillment/datahouse/webhook', 99.90, 175, 99.70),
        ('AIRTELTIGO', 'AirtelTigo (AT)', 'airteltigo-ghana', 'ACTIVE', TRUE, 'DataHouse', 'GMPL', 'https://api.datahouse.com.gh/v1/at', '/api/v1/fulfillment/datahouse/webhook', 99.80, 192, 99.60)
    ON CONFLICT (code) DO UPDATE SET
        status = EXCLUDED.status,
        is_active = EXCLUDED.is_active,
        primary_provider_name = EXCLUDED.primary_provider_name,
        fallback_provider_name = EXCLUDED.fallback_provider_name;

    INSERT INTO telecom_providers (name, slug, description, provider_type, environment, status, is_authoritative, supported_networks, api_base_url, api_version, auth_method, webhook_support, sandbox_support, avg_latency_ms, p95_latency_ms, success_rate)
    VALUES
        ('DataHouse', 'datahouse', 'Primary authoritative multi-carrier telecom aggregator for Ghanaian MNOs', 'AGGREGATOR', 'PRODUCTION', 'ACTIVE', TRUE, ARRAY['MTN', 'TELECEL', 'AIRTELTIGO'], 'https://api.datahouse.com.gh/v1', 'v1', 'API_KEY', TRUE, TRUE, 183, 412, 99.82),
        ('GMPL', 'gmpl', 'Secondary telecom carrier bridge and enterprise fallback fulfiller', 'AGGREGATOR', 'PRODUCTION', 'ACTIVE', FALSE, ARRAY['MTN', 'TELECEL', 'AIRTELTIGO'], 'https://api.gmpl.com.gh/v2', 'v2', 'BEARER', TRUE, TRUE, 210, 480, 98.60),
        ('MTN_DIRECT', 'mtn-direct', 'Direct carrier enterprise interconnection for MTN Ghana', 'DIRECT_MNO', 'SANDBOX', 'ACTIVE', FALSE, ARRAY['MTN'], 'https://enterprise.mtn.com.gh/v1', 'v1', 'API_KEY', TRUE, TRUE, 145, 320, 99.95)
    ON CONFLICT (name) DO UPDATE SET
        is_authoritative = EXCLUDED.is_authoritative,
        supported_networks = EXCLUDED.supported_networks;

    -- Seed capabilities
    INSERT INTO provider_capabilities (provider_id, capability, is_supported, notes)
    SELECT id, 'NETWORKS', TRUE, 'Supports MTN, Telecel, and AirtelTigo' FROM telecom_providers WHERE name = 'DataHouse'
    ON CONFLICT (provider_id, capability) DO NOTHING;

    INSERT INTO provider_capabilities (provider_id, capability, is_supported, notes)
    SELECT id, 'CATALOG', TRUE, 'Real-time bundle catalog discovery' FROM telecom_providers WHERE name = 'DataHouse'
    ON CONFLICT (provider_id, capability) DO NOTHING;

    INSERT INTO provider_capabilities (provider_id, capability, is_supported, notes)
    SELECT id, 'BENEFICIARY_VALIDATION', TRUE, 'MSISDN pre-check and name verification' FROM telecom_providers WHERE name = 'DataHouse'
    ON CONFLICT (provider_id, capability) DO NOTHING;

    INSERT INTO provider_capabilities (provider_id, capability, is_supported, notes)
    SELECT id, 'SINGLE_ORDERS', TRUE, 'Instant data bundle top-up' FROM telecom_providers WHERE name = 'DataHouse'
    ON CONFLICT (provider_id, capability) DO NOTHING;

    INSERT INTO provider_capabilities (provider_id, capability, is_supported, notes)
    SELECT id, 'BULK_ORDERS', TRUE, 'Batch multi-recipient fulfillment' FROM telecom_providers WHERE name = 'DataHouse'
    ON CONFLICT (provider_id, capability) DO NOTHING;

    INSERT INTO provider_capabilities (provider_id, capability, is_supported, notes)
    SELECT id, 'ORDER_STATUS', TRUE, 'Polling and status synchronization' FROM telecom_providers WHERE name = 'DataHouse'
    ON CONFLICT (provider_id, capability) DO NOTHING;

    INSERT INTO provider_capabilities (provider_id, capability, is_supported, notes)
    SELECT id, 'WEBHOOKS', TRUE, 'HMAC-SHA256 signed event callbacks' FROM telecom_providers WHERE name = 'DataHouse'
    ON CONFLICT (provider_id, capability) DO NOTHING;

    INSERT INTO provider_capabilities (provider_id, capability, is_supported, notes)
    SELECT id, 'RECONCILIATION', TRUE, 'Automated end-of-day ledger reconciliation' FROM telecom_providers WHERE name = 'DataHouse'
    ON CONFLICT (provider_id, capability) DO NOTHING;

    INSERT INTO provider_capabilities (provider_id, capability, is_supported, notes)
    SELECT id, 'SANDBOX', TRUE, 'Full mock environment with simulated fulfillment' FROM telecom_providers WHERE name = 'DataHouse'
    ON CONFLICT (provider_id, capability) DO NOTHING;

    -- Seed carrier mappings
    INSERT INTO provider_networks (network_code, provider_id, role, priority, weight_percent, status)
    SELECT 'MTN', id, 'PRIMARY', 1, 100, 'ACTIVE' FROM telecom_providers WHERE name = 'DataHouse'
    ON CONFLICT (network_code, provider_id) DO NOTHING;

    INSERT INTO provider_networks (network_code, provider_id, role, priority, weight_percent, status)
    SELECT 'TELECEL', id, 'PRIMARY', 1, 100, 'ACTIVE' FROM telecom_providers WHERE name = 'DataHouse'
    ON CONFLICT (network_code, provider_id) DO NOTHING;

    INSERT INTO provider_networks (network_code, provider_id, role, priority, weight_percent, status)
    SELECT 'AIRTELTIGO', id, 'PRIMARY', 1, 100, 'ACTIVE' FROM telecom_providers WHERE name = 'DataHouse'
    ON CONFLICT (network_code, provider_id) DO NOTHING;

    INSERT INTO provider_networks (network_code, provider_id, role, priority, weight_percent, status)
    SELECT 'MTN', id, 'FALLBACK', 2, 0, 'ACTIVE' FROM telecom_providers WHERE name = 'GMPL'
    ON CONFLICT (network_code, provider_id) DO NOTHING;

    INSERT INTO provider_networks (network_code, provider_id, role, priority, weight_percent, status)
    SELECT 'AIRTELTIGO', id, 'FALLBACK', 2, 0, 'ACTIVE' FROM telecom_providers WHERE name = 'GMPL'
    ON CONFLICT (network_code, provider_id) DO NOTHING;
