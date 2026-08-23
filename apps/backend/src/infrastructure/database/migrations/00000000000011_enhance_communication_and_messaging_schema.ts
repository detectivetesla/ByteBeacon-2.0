import { MigrationFile } from '../migrator.js';

export const migration00000000000011: MigrationFile = {
  version: '00000000000011',
  name: 'enhance_communication_and_messaging_schema',
  upSql: `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- 1. Create communication_campaigns table for mass and scheduled communications
    CREATE TABLE IF NOT EXISTS communication_campaigns (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        channels VARCHAR(50)[] NOT NULL DEFAULT '{"IN_APP"}',
        target_type VARCHAR(50) NOT NULL DEFAULT 'ROLE',
        segment VARCHAR(100),
        audience_count INT NOT NULL DEFAULT 0,
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        action_url VARCHAR(255),
        action_label VARCHAR(100),
        priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL'
            CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
        status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
            CHECK (status IN ('DRAFT', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED')),
        scheduled_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        delivered_count INT NOT NULL DEFAULT 0,
        failed_count INT NOT NULL DEFAULT 0,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_comm_campaigns_status ON communication_campaigns(status);
    CREATE INDEX IF NOT EXISTS idx_comm_campaigns_scheduled ON communication_campaigns(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_comm_campaigns_created_by ON communication_campaigns(created_by);

    -- 2. Create notification_templates table with versioning
    CREATE TABLE IF NOT EXISTS notification_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        slug VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'SYSTEM'
            CHECK (category IN ('AUTH', 'WALLET', 'ORDERS', 'BENEFICIARY', 'STORE', 'API', 'MARKETING', 'SYSTEM')),
        channels VARCHAR(50)[] NOT NULL DEFAULT '{"IN_APP"}',
        subject_template VARCHAR(255) NOT NULL,
        body_template TEXT NOT NULL,
        action_url_template VARCHAR(255),
        available_variables TEXT[] NOT NULL DEFAULT '{}',
        version INT NOT NULL DEFAULT 1,
        status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
            CHECK (status IN ('ACTIVE', 'DRAFT', 'ARCHIVED')),
        is_system_critical BOOLEAN NOT NULL DEFAULT false,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_notif_templates_slug ON notification_templates(slug);
    CREATE INDEX IF NOT EXISTS idx_notif_templates_category ON notification_templates(category);

    -- 3. Create communication_delivery_logs table for audit & tracking
    CREATE TABLE IF NOT EXISTS communication_delivery_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        message_id VARCHAR(100) NOT NULL,
        campaign_id UUID REFERENCES communication_campaigns(id) ON DELETE SET NULL,
        template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
        recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        recipient_email VARCHAR(255),
        recipient_phone VARCHAR(50),
        channel VARCHAR(30) NOT NULL DEFAULT 'IN_APP'
            CHECK (channel IN ('IN_APP', 'EMAIL', 'SMS', 'PUSH')),
        priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL'
            CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'CREATED'
            CHECK (status IN ('CREATED', 'QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING', 'CANCELLED')),
        attempts INT NOT NULL DEFAULT 0,
        error_message TEXT,
        idempotency_key VARCHAR(255) UNIQUE,
        sent_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_comm_deliv_recipient ON communication_delivery_logs(recipient_user_id);
    CREATE INDEX IF NOT EXISTS idx_comm_deliv_status ON communication_delivery_logs(status);
    CREATE INDEX IF NOT EXISTS idx_comm_deliv_channel ON communication_delivery_logs(channel);
    CREATE INDEX IF NOT EXISTS idx_comm_deliv_created ON communication_delivery_logs(created_at DESC);

    -- 4. Create user_notification_preferences table
    CREATE TABLE IF NOT EXISTS user_notification_preferences (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email_order_updates BOOLEAN NOT NULL DEFAULT true,
        email_account_alerts BOOLEAN NOT NULL DEFAULT true,
        email_marketing BOOLEAN NOT NULL DEFAULT false,
        sms_security BOOLEAN NOT NULL DEFAULT true,
        sms_transactions BOOLEAN NOT NULL DEFAULT false,
        sms_marketing BOOLEAN NOT NULL DEFAULT false,
        in_app_all BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_user_notif_pref UNIQUE (user_id)
    );

    -- 5. Seed default system notification templates
    INSERT INTO notification_templates (slug, name, category, channels, subject_template, body_template, action_url_template, available_variables, version, status, is_system_critical)
    VALUES 
    (
        'ORDER_COMPLETED',
        'Order Fulfillment Completed',
        'ORDERS',
        '{"IN_APP", "EMAIL"}',
        'Order {{order_id}} Completed - Data Dispatched',
        'Hello {{user_name}}, your {{network}} data package {{bundle}} for recipient {{recipient_phone}} has been successfully delivered and confirmed.',
        '/orders/{{order_id}}',
        '{"user_name", "order_id", "network", "bundle", "recipient_phone", "amount"}',
        1,
        'ACTIVE',
        true
    ),
    (
        'ORDER_FAILED',
        'Order Fulfillment Failed & Refunded',
        'ORDERS',
        '{"IN_APP", "EMAIL"}',
        'Order {{order_id}} Notice - Auto-Refund Issued',
        'Hello {{user_name}}, fulfillment for order {{order_id}} could not be completed by {{network}}. The amount of GH₵ {{amount}} has been refunded to your wallet.',
        '/orders/{{order_id}}',
        '{"user_name", "order_id", "network", "amount", "reason"}',
        1,
        'ACTIVE',
        true
    ),
    (
        'PAYMENT_SUCCESSFUL',
        'Payment Verified & Wallet Credited',
        'WALLET',
        '{"IN_APP", "EMAIL"}',
        'Payment Receipt - GH₵ {{amount}} Received',
        'Hello {{user_name}}, your payment of GH₵ {{amount}} via {{channel}} (Ref: {{transaction_reference}}) was verified. Your new balance is GH₵ {{new_balance}}.',
        '/wallet',
        '{"user_name", "amount", "channel", "transaction_reference", "new_balance"}',
        1,
        'ACTIVE',
        true
    ),
    (
        'STORE_APPROVED',
        'Agent Storefront Approved',
        'STORE',
        '{"IN_APP", "EMAIL"}',
        'Congratulations! Your Agent Store is Live',
        'Hello {{user_name}}, your storefront "{{store_name}}" has been approved by administrators. You can now start receiving retail customer orders.',
        '/store/dashboard',
        '{"user_name", "store_name", "slug", "commission_rate"}',
        1,
        'ACTIVE',
        false
    ),
    (
        'SECURITY_ALERT',
        'Security & Account Access Notice',
        'AUTH',
        '{"IN_APP", "EMAIL"}',
        'Security Alert: {{event_type}} on Your Account',
        'Hello {{user_name}}, a security event ({{event_type}}) was recorded from IP {{ip_address}} on {{timestamp}}. If this was not you, please contact support immediately.',
        '/settings/security',
        '{"user_name", "event_type", "ip_address", "timestamp"}',
        1,
        'ACTIVE',
        true
    )
    ON CONFLICT (slug) DO NOTHING;
  `,
  downSql: `
    DROP TABLE IF EXISTS user_notification_preferences CASCADE;
    DROP TABLE IF EXISTS communication_delivery_logs CASCADE;
    DROP TABLE IF EXISTS notification_templates CASCADE;
    DROP TABLE IF EXISTS communication_campaigns CASCADE;
  `,
};
