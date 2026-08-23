-- ==============================================================================
-- Migration: 00000000000005_create_agent_stores_schema.sql
-- Description: Agent Storefronts, Catalog Mappings, and Store Payout Controls
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
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
    approved_by UUID REFERENCES users(uuid) ON DELETE SET NULL,
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
        CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
    END IF;
END $$;
