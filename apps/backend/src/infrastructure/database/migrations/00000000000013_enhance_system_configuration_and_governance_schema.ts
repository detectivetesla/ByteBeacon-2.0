import { MigrationFile } from '../migrator.js';

export const migration00000000000013: MigrationFile = {
  version: '00000000000013',
  name: 'enhance_system_configuration_and_governance_schema',
  upSql: `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- 1. Create system_configurations table for platform-wide settings
    CREATE TABLE IF NOT EXISTS system_configurations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        scope VARCHAR(50) NOT NULL DEFAULT 'GLOBAL',
        config_key VARCHAR(100) NOT NULL UNIQUE,
        category VARCHAR(50) NOT NULL,
        value JSONB NOT NULL,
        data_type VARCHAR(20) NOT NULL DEFAULT 'STRING'
            CHECK (data_type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON')),
        is_secret BOOLEAN NOT NULL DEFAULT false,
        risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW'
            CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
        requires_step_up BOOLEAN NOT NULL DEFAULT false,
        description TEXT,
        version INT NOT NULL DEFAULT 1,
        last_modified_by UUID REFERENCES users(uuid) ON DELETE SET NULL,
        last_modified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sys_config_scope ON system_configurations(scope);
    CREATE INDEX IF NOT EXISTS idx_sys_config_category ON system_configurations(category);
    CREATE INDEX IF NOT EXISTS idx_sys_config_risk ON system_configurations(risk_level);

    -- 2. Create configuration_versions table for immutable change history & 1-click rollbacks
    CREATE TABLE IF NOT EXISTS configuration_versions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        config_key VARCHAR(100) NOT NULL,
        version INT NOT NULL,
        previous_value JSONB,
        new_value JSONB NOT NULL,
        change_reason TEXT NOT NULL,
        changed_by UUID REFERENCES users(uuid) ON DELETE SET NULL,
        changed_by_name VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_config_ver_key ON configuration_versions(config_key, version DESC);
    CREATE INDEX IF NOT EXISTS idx_config_ver_created ON configuration_versions(created_at DESC);

    -- 3. Create platform_feature_flags table for runtime feature toggling & targeting
    CREATE TABLE IF NOT EXISTS platform_feature_flags (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        flag_key VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_enabled BOOLEAN NOT NULL DEFAULT false,
        target_role VARCHAR(50) NOT NULL DEFAULT 'ALL'
            CHECK (target_role IN ('ALL', 'SUPER_ADMIN', 'ADMIN', 'AGENT', 'CUSTOMER')),
        environment VARCHAR(50) NOT NULL DEFAULT 'ALL'
            CHECK (environment IN ('ALL', 'PRODUCTION', 'STAGING', 'DEVELOPMENT', 'SANDBOX')),
        last_toggled_by UUID REFERENCES users(uuid) ON DELETE SET NULL,
        last_toggled_at TIMESTAMPTZ,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_feat_flags_key ON platform_feature_flags(flag_key);

    -- 4. Seed Default System Configurations
    INSERT INTO system_configurations (scope, config_key, category, value, data_type, is_secret, risk_level, requires_step_up, description, version)
    VALUES
      ('GLOBAL', 'platform_name', 'GENERAL', '"ByteBeacon 2.0"'::jsonb, 'STRING', false, 'LOW', false, 'Official platform brand name', 1),
      ('GLOBAL', 'platform_currency', 'GENERAL', '"GHS"'::jsonb, 'STRING', false, 'HIGH', true, 'Base operating currency (Ghana Cedi)', 1),
      ('GLOBAL', 'platform_country', 'GENERAL', '"Ghana"'::jsonb, 'STRING', false, 'LOW', false, 'Primary operating country jurisdiction', 1),
      ('GLOBAL', 'platform_timezone', 'GENERAL', '"Africa/Accra"'::jsonb, 'STRING', false, 'LOW', false, 'Default platform operational timezone', 1),
      ('GLOBAL', 'support_email', 'GENERAL', '"support@bytebeacon.com"'::jsonb, 'STRING', false, 'LOW', false, 'Customer and agent helpdesk email address', 1),
      ('GLOBAL', 'support_phone', 'GENERAL', '"+233240000000"'::jsonb, 'STRING', false, 'LOW', false, 'Official WhatsApp and customer support helpline', 1),
      ('GLOBAL', 'maintenance_mode', 'GENERAL', 'false'::jsonb, 'BOOLEAN', false, 'CRITICAL', true, 'Global emergency switch pausing purchases across all storefronts', 1),
      ('GLOBAL', 'allow_new_registrations', 'GENERAL', 'true'::jsonb, 'BOOLEAN', false, 'MEDIUM', false, 'Permit new customer and agent self-registrations', 1),
      ('GLOBAL', 'allow_customer_purchases', 'GENERAL', 'true'::jsonb, 'BOOLEAN', false, 'HIGH', true, 'Allow retail customers to submit bundle checkout orders', 1),
      ('GLOBAL', 'allow_agent_purchases', 'GENERAL', 'true'::jsonb, 'BOOLEAN', false, 'HIGH', true, 'Allow verified agents to submit wholesale and bulk orders', 1),
      ('GLOBAL', 'allow_agent_stores', 'GENERAL', 'true'::jsonb, 'BOOLEAN', false, 'MEDIUM', false, 'Enable agent custom storefront activations and public routing', 1),
      ('GLOBAL', 'allow_agent_withdrawals', 'PAYMENTS', 'true'::jsonb, 'BOOLEAN', false, 'HIGH', true, 'Permit agent wallet commission withdrawals', 1),
      ('GLOBAL', 'allow_sandbox', 'GENERAL', 'true'::jsonb, 'BOOLEAN', false, 'LOW', false, 'Enable Developer sandbox simulator environment', 1),
      
      ('SECURITY', 'auth_max_login_attempts', 'SECURITY', '5'::jsonb, 'NUMBER', false, 'MEDIUM', false, 'Max consecutive failed password attempts before account lockout', 1),
      ('SECURITY', 'auth_lockout_duration_mins', 'SECURITY', '15'::jsonb, 'NUMBER', false, 'MEDIUM', false, 'Temporary lockout cooling duration in minutes', 1),
      ('SECURITY', 'password_min_length', 'SECURITY', '8'::jsonb, 'NUMBER', false, 'HIGH', false, 'Minimum character length for customer and agent passwords', 1),
      ('SECURITY', 'password_require_complexity', 'SECURITY', 'true'::jsonb, 'BOOLEAN', false, 'HIGH', false, 'Require uppercase, lowercase, numbers, and special symbols', 1),
      ('SECURITY', 'session_lifetime_mins', 'SECURITY', '120'::jsonb, 'NUMBER', false, 'MEDIUM', false, 'Access token active session window in minutes', 1),
      ('SECURITY', 'refresh_token_lifetime_days', 'SECURITY', '30'::jsonb, 'NUMBER', false, 'MEDIUM', false, 'Refresh token renewal lifespan in days', 1),
      ('SECURITY', 'max_concurrent_sessions', 'SECURITY', '3'::jsonb, 'NUMBER', false, 'LOW', false, 'Maximum active logged-in device sessions per user account', 1),
      ('SECURITY', 'mfa_admin_required', 'SECURITY', 'true'::jsonb, 'BOOLEAN', false, 'CRITICAL', true, 'Mandatory 2FA/TOTP requirement for Admin domain accounts', 1),
      ('SECURITY', 'mfa_super_admin_required', 'SECURITY', 'true'::jsonb, 'BOOLEAN', false, 'CRITICAL', true, 'Mandatory 2FA/TOTP requirement for Super Admin accounts', 1),
      
      ('RATE_LIMITS', 'ratelimit_public_rpm', 'SECURITY', '60'::jsonb, 'NUMBER', false, 'LOW', false, 'Sliding-window request limit per minute for unauthenticated clients', 1),
      ('RATE_LIMITS', 'ratelimit_customer_rpm', 'SECURITY', '120'::jsonb, 'NUMBER', false, 'LOW', false, 'Sliding-window request limit per minute for Customer tokens', 1),
      ('RATE_LIMITS', 'ratelimit_agent_rpm', 'SECURITY', '300'::jsonb, 'NUMBER', false, 'LOW', false, 'Sliding-window request limit per minute for Agent tokens', 1),
      ('RATE_LIMITS', 'ratelimit_admin_rpm', 'SECURITY', '600'::jsonb, 'NUMBER', false, 'LOW', false, 'Sliding-window request limit per minute for Admin tokens', 1),
      ('RATE_LIMITS', 'ratelimit_api_rpm', 'APIS', '1000'::jsonb, 'NUMBER', false, 'MEDIUM', false, 'Sliding-window request limit per minute for Developer API keys', 1),
      
      ('PAYMENTS', 'paystack_environment', 'PAYMENTS', '"LIVE"'::jsonb, 'STRING', false, 'CRITICAL', true, 'Target Paystack environment mode (TEST or LIVE)', 1),
      ('PAYMENTS', 'paystack_secret_configured', 'PAYMENTS', 'true'::jsonb, 'BOOLEAN', true, 'CRITICAL', true, 'Indicator whether live Paystack secret key is securely loaded in environment', 1),
      ('PAYMENTS', 'wallet_min_deposit_pesewas', 'PAYMENTS', '100'::jsonb, 'NUMBER', false, 'MEDIUM', false, 'Minimum wallet top-up in pesewas (100 = GH₵1.00)', 1),
      ('PAYMENTS', 'wallet_max_deposit_pesewas', 'PAYMENTS', '500000'::jsonb, 'NUMBER', false, 'HIGH', true, 'Maximum single wallet top-up in pesewas (500000 = GH₵5,000.00)', 1),
      ('PAYMENTS', 'daily_deposit_limit_pesewas', 'PAYMENTS', '1000000'::jsonb, 'NUMBER', false, 'HIGH', true, 'Daily aggregated deposit cap per user account in pesewas', 1),
      ('PAYMENTS', 'daily_withdrawal_limit_pesewas', 'PAYMENTS', '500000'::jsonb, 'NUMBER', false, 'HIGH', true, 'Daily aggregated commission withdrawal cap in pesewas', 1),
      
      ('TELECOM', 'authoritative_telecom_provider', 'TELECOM', '"DataHouse"'::jsonb, 'STRING', false, 'CRITICAL', true, 'Designated authoritative fulfillment provider adapter for carrier dispatch', 1),
      ('TELECOM', 'telecom_auto_failover', 'TELECOM', 'false'::jsonb, 'BOOLEAN', false, 'CRITICAL', true, 'Enable automatic dispatch rerouting on secondary carrier timeouts', 1),
      ('TELECOM', 'telecom_circuit_breaker_threshold', 'TELECOM', '5'::jsonb, 'NUMBER', false, 'MEDIUM', false, 'Consecutive 5xx/timeout errors before tripping circuit breaker open', 1),
      
      ('ORDERS', 'max_bulk_recipients', 'ORDERS', '1000'::jsonb, 'NUMBER', false, 'MEDIUM', false, 'Maximum recipient phone numbers allowed in a single bulk batch', 1),
      ('ORDERS', 'max_spreadsheet_size_mb', 'ORDERS', '5'::jsonb, 'NUMBER', false, 'LOW', false, 'Maximum spreadsheet CSV/Excel file size upload in megabytes', 1),
      ('ORDERS', 'max_spreadsheet_rows', 'ORDERS', '1000'::jsonb, 'NUMBER', false, 'LOW', false, 'Maximum row lines processed in bulk order spreadsheet uploads', 1),
      ('ORDERS', 'order_retry_limit', 'ORDERS', '3'::jsonb, 'NUMBER', false, 'MEDIUM', false, 'Maximum automated retries for retryable network dispatch failures', 1),
      ('ORDERS', 'mtn_precheck_enabled', 'ORDERS', 'true'::jsonb, 'BOOLEAN', false, 'HIGH', false, 'Enforce beneficiary validation precheck before dispatching MTN bundles', 1),
      ('ORDERS', 'mtn_auto_fulfillment_on_approval', 'ORDERS', 'true'::jsonb, 'BOOLEAN', false, 'MEDIUM', false, 'Automatically fulfill orders immediately upon receiving MTN approval', 1),
      
      ('CATALOG', 'allow_custom_agent_pricing', 'CATALOG', 'true'::jsonb, 'BOOLEAN', false, 'MEDIUM', false, 'Allow agents to customize selling prices on their storefronts', 1),
      ('CATALOG', 'agent_max_markup_percentage', 'CATALOG', '50'::jsonb, 'NUMBER', false, 'HIGH', false, 'Ceiling markup percentage above base wholesale cost', 1),
      ('CATALOG', 'price_auto_sync_enabled', 'CATALOG', 'true'::jsonb, 'BOOLEAN', false, 'MEDIUM', false, 'Sync base prices automatically from authoritative DataHouse catalog syncs', 1),
      
      ('AGENTS', 'agent_store_activation_fee_pesewas', 'AGENTS', '5000'::jsonb, 'NUMBER', false, 'HIGH', true, 'One-time store activation fee in pesewas (5000 = GH₵50.00)', 1),
      ('AGENTS', 'agent_store_approval_required', 'AGENTS', 'true'::jsonb, 'BOOLEAN', false, 'MEDIUM', false, 'Require Admin approval before activating a new agent storefront', 1),
      ('AGENTS', 'agent_store_custom_domains_enabled', 'AGENTS', 'true'::jsonb, 'BOOLEAN', false, 'MEDIUM', false, 'Allow verified agents to connect branded CNAME custom domains', 1)
    ON CONFLICT (config_key) DO NOTHING;

    -- 5. Seed Default Platform Feature Flags
    INSERT INTO platform_feature_flags (flag_key, name, description, is_enabled, target_role, environment, reason)
    VALUES
      ('NEW_ORDER_ENGINE', 'Next-Gen High-Concurrency Order Engine', 'High-throughput async fulfillment pipeline backed by BullMQ workers', true, 'ALL', 'ALL', 'Core 2.0 order pipeline default'),
      ('AGENT_STORES', 'Agent Custom Storefront Engine', 'Branded multi-tenant storefronts with custom pricing and domains', true, 'ALL', 'ALL', 'Agent commerce empowerment default'),
      ('MTN_PRECHECK', 'MTN Beneficiary Blacklist Precheck', 'Pre-submission validation verifying phone eligibility on MTN network', true, 'ALL', 'ALL', 'Fraud and loss prevention default'),
      ('PAYSTACK_LIVE', 'Paystack Live Payment Gateway', 'Live mobile money and card collection via production Paystack credentials', true, 'ALL', 'PRODUCTION', 'Production payment gateway'),
      ('MAINTENANCE_MODE', 'Emergency Maintenance Mode', 'Platform-wide checkout blackout with administrative access preservation', false, 'ALL', 'ALL', 'Standard operating state (inactive)')
    ON CONFLICT (flag_key) DO NOTHING;
  `,
  downSql: `
    DROP TABLE IF EXISTS platform_feature_flags CASCADE;
    DROP TABLE IF EXISTS configuration_versions CASCADE;
    DROP TABLE IF EXISTS system_configurations CASCADE;
  `,
};
