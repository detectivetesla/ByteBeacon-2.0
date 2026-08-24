import { MigrationFile } from '../migrator.js';

export const migration00000000000005: MigrationFile = {
  version: '00000000000005',
  name: 'create_agent_stores_schema',
  upSql: `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Pre-migration self-healing for legacy stores
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stores') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'uuid')
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'id') THEN
                ALTER TABLE stores RENAME COLUMN uuid TO id;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'id') THEN
                ALTER TABLE stores ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4();
            END IF;

            -- Reconcile required columns on stores if preexisting
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS agent_id UUID;
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS user_id UUID;
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_name VARCHAR(255) DEFAULT '';
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS tagline TEXT;
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS description TEXT;
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS logo_url TEXT;
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS banner_url TEXT;
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS primary_color VARCHAR(30) NOT NULL DEFAULT '#0066FF';
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS accent_color VARCHAR(30) NOT NULL DEFAULT '#00E599';
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS contact_whatsapp VARCHAR(50);
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED';
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) NOT NULL DEFAULT 'NOT_SUBMITTED';
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED';
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS activation_fee_pesewas BIGINT NOT NULL DEFAULT 50000;
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS paystack_reference VARCHAR(255);
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS admin_notes TEXT;
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS approved_by UUID;
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

            -- Backfill slug if null
            UPDATE stores SET slug = 'store-' || substr(id::text, 1, 8) WHERE slug IS NULL;
        END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS stores (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        store_name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        tagline TEXT,
        description TEXT,
        logo_url TEXT,
        banner_url TEXT,
        primary_color VARCHAR(30) NOT NULL DEFAULT '#0066FF',
        accent_color VARCHAR(30) NOT NULL DEFAULT '#00E599',
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        contact_whatsapp VARCHAR(50),
        payment_status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED'
            CHECK (payment_status IN ('NOT_STARTED', 'PAYMENT_REQUIRED', 'PAYMENT_PENDING', 'PAID', 'PAYMENT_FAILED')),
        approval_status VARCHAR(30) NOT NULL DEFAULT 'NOT_SUBMITTED'
            CHECK (approval_status IN ('NOT_SUBMITTED', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED')),
        store_status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED'
            CHECK (store_status IN ('NOT_STARTED', 'INACTIVE', 'ACTIVE', 'SUSPENDED')),
        activation_fee_pesewas BIGINT NOT NULL DEFAULT 50000,
        paystack_reference VARCHAR(255),
        admin_notes TEXT,
        approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        approved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);
    CREATE INDEX IF NOT EXISTS idx_stores_agent_id ON stores(agent_id);
    CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
    CREATE INDEX IF NOT EXISTS idx_stores_statuses ON stores(store_status, approval_status, payment_status);

    CREATE TABLE IF NOT EXISTS store_products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        catalog_product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
        markup_pesewas BIGINT NOT NULL DEFAULT 0 CHECK (markup_pesewas >= 0),
        custom_price_pesewas BIGINT,
        is_available BOOLEAN NOT NULL DEFAULT TRUE,
        is_visible BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_store_product UNIQUE (store_id, catalog_product_id)
    );

    CREATE INDEX IF NOT EXISTS idx_store_products_store ON store_products(store_id);

    -- Add store_id to orders if not exists
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'orders' AND column_name = 'store_id'
        ) THEN
            ALTER TABLE orders ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
            CREATE INDEX idx_orders_store_id ON orders(store_id);
        END IF;
    END $$;
  `,
  downSql: `
    DROP TABLE IF EXISTS store_products CASCADE;
    DROP TABLE IF EXISTS stores CASCADE;
    ALTER TABLE orders DROP COLUMN IF EXISTS store_id;
  `,
};
