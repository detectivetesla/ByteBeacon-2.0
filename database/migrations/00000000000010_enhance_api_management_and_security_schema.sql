-- Migration 10: Enhance API Management and Security Schema
-- Phase 11.10: API Management, Developer Platform & API Security

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create api_consumers table to represent client apps/integrations
CREATE TABLE IF NOT EXISTS api_consumers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    environment VARCHAR(20) NOT NULL DEFAULT 'LIVE',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_consumers_owner ON api_consumers(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_api_consumers_status ON api_consumers(status);

-- 2. Extend api_keys table with developer management columns
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS consumer_id UUID REFERENCES api_consumers(id) ON DELETE SET NULL;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS ip_restrictions TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rate_limit_per_minute INT NOT NULL DEFAULT 300;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_request_ip VARCHAR(45);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_request_endpoint VARCHAR(255);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revocation_reason TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rotation_of_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_consumer ON api_keys(consumer_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_owner ON api_keys(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_env ON api_keys(environment);

-- 2. Create api_usage_metrics table for traffic & latency analytics
CREATE TABLE IF NOT EXISTS api_usage_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    environment VARCHAR(20) NOT NULL DEFAULT 'LIVE',
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INT NOT NULL,
    response_time_ms NUMERIC NOT NULL DEFAULT 0,
    ip_address VARCHAR(45),
    error_code VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_usage_metrics(key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage_metrics(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage_metrics(user_id);

-- 3. Create api_security_events table for tracking anomalous & unauthorized attempts
CREATE TABLE IF NOT EXISTS api_security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    key_prefix VARCHAR(50),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    ip_address VARCHAR(45),
    endpoint VARCHAR(255),
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_sec_events_type ON api_security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_api_sec_events_severity ON api_security_events(severity);
CREATE INDEX IF NOT EXISTS idx_api_sec_events_created ON api_security_events(created_at DESC);

-- 4. Create agent_webhooks table for developer webhook dispatching
CREATE TABLE IF NOT EXISTS agent_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret_hash VARCHAR(255) NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'PAUSED', 'DISABLED', 'FAILED')),
    rate_limit_per_minute INT NOT NULL DEFAULT 60,
    failure_count INT NOT NULL DEFAULT 0,
    last_delivery_at TIMESTAMPTZ,
    last_delivery_status VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_webhooks_agent ON agent_webhooks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_webhooks_status ON agent_webhooks(status);

-- 5. Create webhook_delivery_logs table for audit delivery history
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES agent_webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status_code INT,
    response_body TEXT,
    latency_ms INT NOT NULL DEFAULT 0,
    attempt INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'DELIVERED',
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wh_delivery_webhook ON webhook_delivery_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_wh_delivery_delivered ON webhook_delivery_logs(delivered_at DESC);

-- 6. Create telecom_provider_configs table for managing carrier connections
CREATE TABLE IF NOT EXISTS telecom_provider_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_name VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(50) NOT NULL,
    is_authoritative BOOLEAN NOT NULL DEFAULT FALSE,
    environment VARCHAR(20) NOT NULL DEFAULT 'LIVE',
    status VARCHAR(30) NOT NULL DEFAULT 'HEALTHY'
        CHECK (status IN ('HEALTHY', 'DEGRADED', 'DOWN', 'MAINTENANCE')),
    priority INT NOT NULL DEFAULT 1,
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    api_base_url TEXT NOT NULL,
    auth_type VARCHAR(50) NOT NULL DEFAULT 'BEARER'
        CHECK (auth_type IN ('BEARER', 'API_KEY', 'BASIC', 'HMAC_SHA256')),
    last_health_check TIMESTAMPTZ,
    last_successful_request TIMESTAMPTZ,
    last_failed_request TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telecom_configs_auth ON telecom_provider_configs(is_authoritative);

-- 7. Create provider_switch_logs table for high-risk telecom authority migrations
CREATE TABLE IF NOT EXISTS provider_switch_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    previous_provider VARCHAR(50) NOT NULL,
    new_provider VARCHAR(50) NOT NULL,
    switched_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    switch_reason TEXT NOT NULL,
    health_check_passed BOOLEAN NOT NULL DEFAULT TRUE,
    verification_details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_provider_switch_created ON provider_switch_logs(created_at DESC);

-- 8. Create api_policy_controls table for emergency kill switches and global limits
CREATE TABLE IF NOT EXISTS api_policy_controls (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'GLOBAL',
    customer_rate_limit_per_min INT NOT NULL DEFAULT 120,
    agent_rate_limit_per_min INT NOT NULL DEFAULT 300,
    admin_rate_limit_per_min INT NOT NULL DEFAULT 600,
    max_custom_rate_limit_per_min INT NOT NULL DEFAULT 1200,
    api_key_default_expiry_days INT NOT NULL DEFAULT 90,
    enforce_ip_restrictions BOOLEAN NOT NULL DEFAULT FALSE,
    agent_api_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    sandbox_api_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    new_orders_api_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    bulk_orders_api_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    webhooks_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    provider_integration_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed Baseline Telecom Provider Configurations
INSERT INTO telecom_provider_configs (provider_name, slug, is_authoritative, environment, status, priority, capabilities, api_base_url, auth_type)
VALUES
    ('DataHouse', 'datahouse', TRUE, 'LIVE', 'HEALTHY', 1, ARRAY['MTN', 'TELECEL', 'AIRTELTIGO', 'DATA_TOPUP', 'BALANCE_CHECK'], 'https://api.datahouse.com.gh/v1', 'BEARER'),
    ('GMPL', 'gmpl', FALSE, 'LIVE', 'HEALTHY', 2, ARRAY['MTN', 'TELECEL', 'AIRTELTIGO', 'DATA_TOPUP'], 'https://api.gmpl.com.gh/v2', 'BEARER'),
    ('MTN_DIRECT', 'mtn-direct', FALSE, 'LIVE', 'HEALTHY', 3, ARRAY['MTN', 'UP2U', 'DATA_TOPUP'], 'https://enterprise.mtn.com.gh/v1', 'API_KEY'),
    ('PAYSTACK', 'paystack', TRUE, 'LIVE', 'HEALTHY', 1, ARRAY['MOMO_COLLECTIONS', 'CARD_PAYMENTS', 'BANK_TRANSFERS'], 'https://api.paystack.co', 'BEARER')
ON CONFLICT (provider_name) DO UPDATE SET
    is_authoritative = EXCLUDED.is_authoritative,
    capabilities = EXCLUDED.capabilities;

-- Seed Global API Policies Row
INSERT INTO api_policy_controls (id)
VALUES ('GLOBAL')
ON CONFLICT (id) DO NOTHING;
