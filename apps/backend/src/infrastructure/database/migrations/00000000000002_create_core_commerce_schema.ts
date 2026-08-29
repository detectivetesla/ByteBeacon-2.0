import { MigrationFile } from '../migrator.js';

export const migration00000000000002: MigrationFile = {
  version: '00000000000002',
  name: 'create_core_commerce_schema',
  upSql: `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Pre-migration self-healing for legacy commerce tables
    DO $$
    BEGIN
        -- Normalize legacy identifiers
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agents') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'uuid')
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'id') THEN
                ALTER TABLE agents RENAME COLUMN uuid TO id;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'agent_id')
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'id') THEN
                ALTER TABLE agents RENAME COLUMN agent_id TO id;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'id') THEN
                ALTER TABLE agents ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4();
            END IF;

            -- Reconcile required columns on agents if preexisting
            ALTER TABLE agents ADD COLUMN IF NOT EXISTS user_id UUID;
            ALTER TABLE agents ADD COLUMN IF NOT EXISTS business_name VARCHAR(255) DEFAULT '';
            ALTER TABLE agents ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
            ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
            ALTER TABLE agents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

            -- Backfill slug if null
            UPDATE agents SET slug = 'agent-' || substr(id::text, 1, 8) WHERE slug IS NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'catalog_products') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'catalog_products' AND column_name = 'uuid')
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'catalog_products' AND column_name = 'id') THEN
                ALTER TABLE catalog_products RENAME COLUMN uuid TO id;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'catalog_products' AND column_name = 'id') THEN
                ALTER TABLE catalog_products ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4();
            END IF;

            -- Reconcile required columns on catalog_products if preexisting
            ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
            ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS network VARCHAR(30) DEFAULT 'MTN';
            ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT '';
            ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS data_amount_mb INT DEFAULT 1024;
            ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS validity_days INT DEFAULT 30;
            ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS base_price_pesewas BIGINT DEFAULT 100;
            ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS agent_price_pesewas BIGINT;
            ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
            ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'uuid')
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'id') THEN
                ALTER TABLE orders RENAME COLUMN uuid TO id;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'order_id')
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'id') THEN
                ALTER TABLE orders RENAME COLUMN order_id TO id;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'id') THEN
                ALTER TABLE orders ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4();
            END IF;

            -- Reconcile required columns on orders if preexisting
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS public_id VARCHAR(50);
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id UUID;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS agent_id UUID;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_id UUID;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(30) DEFAULT '';
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS network VARCHAR(30) DEFAULT 'MTN';
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS data_amount_mb INT DEFAULT 1024;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_pesewas BIGINT DEFAULT 100;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'GHS';
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB DEFAULT '{}';
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'PENDING';
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status VARCHAR(30) DEFAULT 'CREATED';
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_status VARCHAR(30) DEFAULT 'UNKNOWN';
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_status VARCHAR(30) DEFAULT 'NONE';
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            UPDATE orders SET public_id = 'ORD-' || UPPER(substr(md5(random()::text || id::text), 1, 10)) WHERE public_id IS NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'provider_orders') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'provider_orders' AND column_name = 'uuid')
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'provider_orders' AND column_name = 'id') THEN
                ALTER TABLE provider_orders RENAME COLUMN uuid TO id;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'provider_orders' AND column_name = 'id') THEN
                ALTER TABLE provider_orders ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4();
            END IF;

            ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS order_id UUID;
            ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS provider_name VARCHAR(50) DEFAULT 'GMPL';
            ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(255);
            ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(255);
            ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS provider_status VARCHAR(30) DEFAULT 'UNKNOWN';
            ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS raw_payload JSONB;
            ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
            ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS last_provider_event_at TIMESTAMPTZ;
            ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS sync_version INT DEFAULT 0;
            ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS sync_metadata JSONB DEFAULT '{}';
            ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE provider_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'uuid')
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'id') THEN
                ALTER TABLE order_items RENAME COLUMN uuid TO id;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'id') THEN
                ALTER TABLE order_items ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4();
            END IF;

            ALTER TABLE order_items ADD COLUMN IF NOT EXISTS order_id UUID;
            ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_id UUID;
            ALTER TABLE order_items ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1;
            ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price_pesewas BIGINT DEFAULT 100;
            ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_pesewas BIGINT DEFAULT 100;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_events') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_events' AND column_name = 'uuid')
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_events' AND column_name = 'id') THEN
                ALTER TABLE order_events RENAME COLUMN uuid TO id;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_events' AND column_name = 'id') THEN
                ALTER TABLE order_events ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4();
            END IF;

            ALTER TABLE order_events ADD COLUMN IF NOT EXISTS order_id UUID;
            ALTER TABLE order_events ADD COLUMN IF NOT EXISTS event_type VARCHAR(100) DEFAULT 'STATUS_CHANGE';
            ALTER TABLE order_events ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(100) DEFAULT '';
            ALTER TABLE order_events ADD COLUMN IF NOT EXISTS actor_id UUID;
            ALTER TABLE order_events ADD COLUMN IF NOT EXISTS actor_type VARCHAR(50) DEFAULT 'SYSTEM';
            ALTER TABLE order_events ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'SYSTEM';
            ALTER TABLE order_events ADD COLUMN IF NOT EXISTS previous_state JSONB;
            ALTER TABLE order_events ADD COLUMN IF NOT EXISTS new_state JSONB;
            ALTER TABLE order_events ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
            ALTER TABLE order_events ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'uuid')
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'id') THEN
                ALTER TABLE payments RENAME COLUMN uuid TO id;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'id') THEN
                ALTER TABLE payments ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4();
            END IF;

            ALTER TABLE payments ADD COLUMN IF NOT EXISTS public_id VARCHAR(50);
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS order_id UUID;
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id UUID;
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_pesewas BIGINT DEFAULT 100;
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'GHS';
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'PAYSTACK';
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(255);
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'MOMO';
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'PENDING';
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            UPDATE payments SET public_id = 'pay_' || substr(md5(random()::text || id::text), 1, 16) WHERE public_id IS NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'refunds') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'refunds' AND column_name = 'uuid')
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'refunds' AND column_name = 'id') THEN
                ALTER TABLE refunds RENAME COLUMN uuid TO id;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'refunds' AND column_name = 'id') THEN
                ALTER TABLE refunds ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4();
            END IF;

            ALTER TABLE refunds ADD COLUMN IF NOT EXISTS payment_id UUID;
            ALTER TABLE refunds ADD COLUMN IF NOT EXISTS order_id UUID;
            ALTER TABLE refunds ADD COLUMN IF NOT EXISTS amount_pesewas BIGINT DEFAULT 100;
            ALTER TABLE refunds ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT '';
            ALTER TABLE refunds ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'PENDING';
            ALTER TABLE refunds ADD COLUMN IF NOT EXISTS provider_refund_reference VARCHAR(255);
            ALTER TABLE refunds ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE refunds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'provider_sync_records') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'provider_sync_records' AND column_name = 'uuid')
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'provider_sync_records' AND column_name = 'id') THEN
                ALTER TABLE provider_sync_records RENAME COLUMN uuid TO id;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'provider_sync_records' AND column_name = 'id') THEN
                ALTER TABLE provider_sync_records ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4();
            END IF;

            ALTER TABLE provider_sync_records ADD COLUMN IF NOT EXISTS order_id UUID;
            ALTER TABLE provider_sync_records ADD COLUMN IF NOT EXISTS provider_name VARCHAR(50) DEFAULT 'GMPL';
            ALTER TABLE provider_sync_records ADD COLUMN IF NOT EXISTS event_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE provider_sync_records ADD COLUMN IF NOT EXISTS event_version BIGINT DEFAULT 1;
            ALTER TABLE provider_sync_records ADD COLUMN IF NOT EXISTS status_received VARCHAR(50) DEFAULT '';
            ALTER TABLE provider_sync_records ADD COLUMN IF NOT EXISTS is_applied BOOLEAN DEFAULT FALSE;
            ALTER TABLE provider_sync_records ADD COLUMN IF NOT EXISTS reason TEXT;
            ALTER TABLE provider_sync_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bulk_submission_items') THEN
            ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
        END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS catalog_products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        sku VARCHAR(100) UNIQUE NOT NULL,
        network VARCHAR(30) NOT NULL CHECK (network IN ('MTN', 'TELECEL', 'AIRTELTIGO')),
        name VARCHAR(255) NOT NULL,
        data_amount_mb INT NOT NULL CHECK (data_amount_mb > 0),
        validity_days INT NOT NULL DEFAULT 30 CHECK (validity_days > 0),
        base_price_pesewas BIGINT NOT NULL CHECK (base_price_pesewas > 0),
        agent_price_pesewas BIGINT CHECK (agent_price_pesewas IS NULL OR agent_price_pesewas > 0),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_catalog_network_active ON catalog_products(network, is_active);
    CREATE INDEX IF NOT EXISTS idx_catalog_sku ON catalog_products(sku);

    CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        business_name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_agents_slug ON agents(slug);
    CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);

    CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        public_id VARCHAR(50) UNIQUE NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
        product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE RESTRICT,
        recipient_phone VARCHAR(30) NOT NULL,
        network VARCHAR(30) NOT NULL CHECK (network IN ('MTN', 'TELECEL', 'AIRTELTIGO')),
        data_amount_mb INT NOT NULL CHECK (data_amount_mb > 0),
        amount_pesewas BIGINT NOT NULL CHECK (amount_pesewas > 0),
        currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
        pricing_snapshot JSONB NOT NULL,
        payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
            CHECK (payment_status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED')),
        order_status VARCHAR(30) NOT NULL DEFAULT 'CREATED'
            CHECK (order_status IN ('CREATED', 'VALIDATING', 'READY_FOR_FULFILLMENT', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
        provider_status VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN'
            CHECK (provider_status IN ('UNKNOWN', 'RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED')),
        refund_status VARCHAR(30) NOT NULL DEFAULT 'NONE'
            CHECK (refund_status IN ('NONE', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NOT_REQUIRED')),
        idempotency_key VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_public_id ON orders(public_id);
    CREATE INDEX IF NOT EXISTS idx_orders_statuses ON orders(order_status, payment_status, provider_status);
    CREATE INDEX IF NOT EXISTS idx_orders_recipient ON orders(recipient_phone);

    CREATE TABLE IF NOT EXISTS provider_orders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        provider_name VARCHAR(50) NOT NULL DEFAULT 'GMPL',
        provider_order_id VARCHAR(255),
        provider_reference VARCHAR(255) UNIQUE,
        provider_status VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN'
            CHECK (provider_status IN ('UNKNOWN', 'RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED')),
        raw_payload JSONB,
        last_synced_at TIMESTAMPTZ,
        last_provider_event_at TIMESTAMPTZ,
        sync_version INT NOT NULL DEFAULT 0,
        sync_metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_provider_orders_reference ON provider_orders(provider_reference);
    CREATE INDEX IF NOT EXISTS idx_provider_orders_order_id ON provider_orders(order_id);

    CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE RESTRICT,
        quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
        unit_price_pesewas BIGINT NOT NULL CHECK (unit_price_pesewas > 0),
        total_pesewas BIGINT NOT NULL CHECK (total_pesewas > 0)
    );

    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

    CREATE TABLE IF NOT EXISTS order_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        correlation_id VARCHAR(100) NOT NULL,
        actor_id UUID,
        actor_type VARCHAR(50) NOT NULL,
        source VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
        previous_state JSONB,
        new_state JSONB,
        metadata JSONB NOT NULL DEFAULT '{}',
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id, occurred_at ASC);
    CREATE INDEX IF NOT EXISTS idx_order_events_correlation ON order_events(correlation_id);

    CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        public_id VARCHAR(50) UNIQUE,
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        amount_pesewas BIGINT NOT NULL CHECK (amount_pesewas > 0),
        currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
        provider VARCHAR(50) NOT NULL DEFAULT 'PAYSTACK',
        provider_reference VARCHAR(255) UNIQUE,
        payment_method VARCHAR(50) NOT NULL DEFAULT 'MOMO',
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
            CHECK (status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED')),
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(provider_reference);

    CREATE TABLE IF NOT EXISTS refunds (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        payment_id UUID REFERENCES payments(id) ON DELETE RESTRICT,
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
        amount_pesewas BIGINT NOT NULL CHECK (amount_pesewas > 0),
        reason TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
            CHECK (status IN ('NONE', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NOT_REQUIRED')),
        provider_refund_reference VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);

    CREATE TABLE IF NOT EXISTS beneficiary_validation (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        phone_number VARCHAR(30) NOT NULL,
        network VARCHAR(30) NOT NULL CHECK (network IN ('MTN', 'TELECEL', 'AIRTELTIGO')),
        validation_status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
            CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID', 'EXPIRED', 'ERROR')),
        provider_reference VARCHAR(255),
        provider_response_metadata JSONB NOT NULL DEFAULT '{}',
        validated_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_beneficiary_phone_network ON beneficiary_validation(phone_number, network);

    CREATE TABLE IF NOT EXISTS bulk_submissions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        name VARCHAR(255) NOT NULL,
        total_count INT NOT NULL DEFAULT 0,
        processed_count INT NOT NULL DEFAULT 0,
        success_count INT NOT NULL DEFAULT 0,
        failed_count INT NOT NULL DEFAULT 0,
        total_amount_pesewas BIGINT NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
            CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED')),
        idempotency_key VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_bulk_submissions_user ON bulk_submissions(user_id);

    CREATE TABLE IF NOT EXISTS bulk_submission_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        submission_id UUID NOT NULL REFERENCES bulk_submissions(id) ON DELETE CASCADE,
        order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
        recipient_phone VARCHAR(30) NOT NULL,
        product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE RESTRICT,
        amount_pesewas BIGINT NOT NULL CHECK (amount_pesewas > 0),
        status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_bulk_items_submission ON bulk_submission_items(submission_id);

    CREATE TABLE IF NOT EXISTS idempotency_keys (
        key VARCHAR(255) NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint VARCHAR(255) NOT NULL,
        request_hash VARCHAR(64) NOT NULL,
        response_status INT NOT NULL,
        response_body JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (key, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

    CREATE TABLE IF NOT EXISTS provider_sync_records (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        provider_name VARCHAR(50) NOT NULL,
        event_timestamp TIMESTAMPTZ NOT NULL,
        event_version BIGINT NOT NULL DEFAULT 1,
        status_received VARCHAR(50) NOT NULL,
        is_applied BOOLEAN NOT NULL DEFAULT FALSE,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sync_records_order ON provider_sync_records(order_id, event_timestamp DESC);
  `,
};
