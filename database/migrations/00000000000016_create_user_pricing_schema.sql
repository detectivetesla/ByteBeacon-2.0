-- ==============================================================================
-- Migration: 00000000000016_create_user_pricing_schema.sql
-- Description: Individual User Data Bundle Custom Pricing Overrides Schema
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create user_pricing table for custom data bundle pricing per individual user
CREATE TABLE IF NOT EXISTS user_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
    custom_price_pesewas BIGINT NOT NULL CHECK (custom_price_pesewas > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_pricing UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_user_pricing_user_product ON user_pricing(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_user_pricing_product ON user_pricing(product_id);
