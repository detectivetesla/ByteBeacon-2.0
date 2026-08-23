-- ==============================================================================
-- Migration: 00000000000008_enhance_agents_and_stores_schema.sql
-- Description: Phase 11.7 Agent and Agent Store Management Extensions
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Extend agents table with hierarchy, tiers, status, and API access flags
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'parent_agent_id') THEN
        ALTER TABLE agents ADD COLUMN parent_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_agents_parent ON agents(parent_agent_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'agent_tier') THEN
        ALTER TABLE agents ADD COLUMN agent_tier VARCHAR(50) NOT NULL DEFAULT 'STANDARD';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'status') THEN
        ALTER TABLE agents ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';
        CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'commission_rate') THEN
        ALTER TABLE agents ADD COLUMN commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'api_access_enabled') THEN
        ALTER TABLE agents ADD COLUMN api_access_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- 2. Create agent_pricing table for custom wholesale pricing per agent
CREATE TABLE IF NOT EXISTS agent_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
    custom_price_pesewas BIGINT NOT NULL CHECK (custom_price_pesewas > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_agent_pricing UNIQUE (agent_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_pricing_agent ON agent_pricing(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_pricing_product ON agent_pricing(product_id);

-- 3. Create store_payouts table for merchant withdrawals and financial controls
CREATE TABLE IF NOT EXISTS store_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_store_payouts_store ON store_payouts(store_id);
CREATE INDEX IF NOT EXISTS idx_store_payouts_status ON store_payouts(status);

-- 4. Create agent_customers table for tracking direct customer relationships under tenant isolation
CREATE TABLE IF NOT EXISTS agent_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_agent_customer UNIQUE (agent_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_customers_agent ON agent_customers(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_customers_customer ON agent_customers(customer_id);
