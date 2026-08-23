-- ==============================================================================
-- Migration: 00000000000015_enhance_alerts_notifications_and_views.sql
-- Description: Alerts, Notifications, Compatibility Schema and Views
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- 1. Ensure user compatibility columns and financial/beneficiary columns exist
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'uuid') THEN
            ALTER TABLE users ADD COLUMN uuid UUID;
            UPDATE users SET uuid = id WHERE uuid IS NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'admin_sub_role') THEN
            ALTER TABLE users ADD COLUMN admin_sub_role VARCHAR(50);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'name') THEN
            ALTER TABLE users ADD COLUMN name VARCHAR(255);
            UPDATE users SET name = full_name WHERE name IS NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
            ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_verified') THEN
            ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_ledger' AND column_name = 'metadata') THEN
            ALTER TABLE financial_ledger ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'beneficiary_validation' AND column_name = 'account_name') THEN
            ALTER TABLE beneficiary_validation ADD COLUMN account_name VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'beneficiary_validation' AND column_name = 'is_valid') THEN
            ALTER TABLE beneficiary_validation ADD COLUMN is_valid BOOLEAN NOT NULL DEFAULT TRUE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'beneficiary_validation' AND column_name = 'raw_response') THEN
            ALTER TABLE beneficiary_validation ADD COLUMN raw_response JSONB NOT NULL DEFAULT '{}';
        END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_users_uuid ON users(uuid);

    -- 2. Create system_alerts table
    CREATE TABLE IF NOT EXISTS system_alerts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'WARNING', 'SECURITY')),
        source VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
        condition TEXT NOT NULL,
        current_value TEXT,
        threshold TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'REOPENED', 'DETECTED')),
        deduplication_key VARCHAR(255) UNIQUE,
        first_detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
        acknowledged_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        acknowledged_at TIMESTAMPTZ,
        resolved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TIMESTAMPTZ,
        resolution TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_system_alerts_status ON system_alerts(status);
    CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
    CREATE INDEX IF NOT EXISTS idx_system_alerts_created ON system_alerts(created_at DESC);

    -- 3. Create alert_events table
    CREATE TABLE IF NOT EXISTS alert_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        alert_id UUID NOT NULL REFERENCES system_alerts(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        actor_name VARCHAR(255),
        note TEXT,
        previous_status VARCHAR(30),
        new_status VARCHAR(30),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_alert_events_alert ON alert_events(alert_id);
    CREATE INDEX IF NOT EXISTS idx_alert_events_created ON alert_events(created_at DESC);

    -- 4. Create notifications table
    CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
        severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        message TEXT,
        action_url VARCHAR(255),
        channel VARCHAR(30) NOT NULL DEFAULT 'IN_APP',
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

    -- 5. Create notification_rules table
    CREATE TABLE IF NOT EXISTS notification_rules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        event_condition VARCHAR(100) NOT NULL,
        condition_value VARCHAR(255),
        notify_roles JSONB NOT NULL DEFAULT '[]',
        notify_user_ids JSONB NOT NULL DEFAULT '[]',
        channels JSONB NOT NULL DEFAULT '["IN_APP"]',
        severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
        template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        version INT NOT NULL DEFAULT 1,
        status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_notification_rules_status ON notification_rules(status);

    -- 6. Create Compatibility Views
    CREATE OR REPLACE VIEW audit_events AS
    SELECT 
        id,
        correlation_id,
        actor_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        severity,
        category,
        result,
        before_state,
        after_state,
        metadata,
        reason,
        ip_address,
        user_agent,
        event_hash,
        previous_event_hash,
        created_at
    FROM audit_logs;

    CREATE OR REPLACE VIEW agent_stores AS
    SELECT 
        id,
        agent_id,
        user_id,
        store_name,
        slug,
        tagline,
        description,
        logo_url,
        banner_url,
        primary_color,
        accent_color,
        contact_email,
        contact_phone,
        contact_whatsapp,
        payment_status,
        approval_status,
        store_status as status,
        activation_fee_pesewas,
        paystack_reference,
        admin_notes,
        approved_by,
        approved_at,
        created_at,
        updated_at
    FROM stores;

    CREATE OR REPLACE VIEW payment_transactions AS
    SELECT 
        id,
        order_id,
        user_id,
        amount_pesewas,
        currency,
        provider,
        provider_reference,
        payment_method,
        status,
        paid_at,
        created_at,
        updated_at
    FROM payments;

    CREATE OR REPLACE VIEW ledger_entries AS
    SELECT 
        id,
        transaction_id,
        entry_type,
        account_type,
        account_id,
        amount_pesewas,
        currency,
        reference_type,
        reference_id,
        description,
        metadata,
        created_at
    FROM financial_ledger;

    CREATE OR REPLACE VIEW feature_flags AS
    SELECT 
        id,
        flag_key as name,
        name as display_name,
        description,
        is_enabled,
        CASE WHEN target_role = 'ALL' THEN NULL ELSE ARRAY[target_role] END as allowed_roles,
        environment,
        created_at,
        updated_at
    FROM platform_feature_flags;

    CREATE OR REPLACE VIEW beneficiary_records AS
    SELECT 
        id,
        phone_number,
        network,
        account_name,
        validation_status as status,
        is_valid,
        raw_response,
        created_at,
        updated_at
    FROM beneficiary_validation;

    CREATE OR REPLACE VIEW financial_safety_controls AS
    SELECT 
        id,
        emergency_payments_disabled,
        emergency_withdrawals_disabled,
        emergency_refunds_disabled,
        wallet_operations_frozen,
        agent_purchases_frozen,
        global_maintenance_mode,
        provider_disabled,
        max_single_transaction_pesewas,
        max_daily_withdrawal_pesewas,
        max_daily_deposit_pesewas,
        suspicious_velocity_threshold,
        updated_by,
        updated_at
    FROM financial_safety_settings;
