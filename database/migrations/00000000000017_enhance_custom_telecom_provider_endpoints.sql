-- Migration: 00000000000017_enhance_custom_telecom_provider_endpoints.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Self-heal and enhance core tables for resilient order placement & custom providers
DO $$
BEGIN
    -- 1. Ensure users has wallet balance columns
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance_pesewas BIGINT NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00;
    END IF;

    -- 2. Ensure payments has public_id column
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
        ALTER TABLE payments ADD COLUMN IF NOT EXISTS public_id VARCHAR(50);
        UPDATE payments SET public_id = 'pay_' || substr(md5(random()::text || id::text), 1, 16) WHERE public_id IS NULL;
    END IF;

    -- 3. Ensure orders has public_id and idempotency_key
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS public_id VARCHAR(50);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
        UPDATE orders SET public_id = 'ORD-' || UPPER(substr(md5(random()::text || id::text), 1, 10)) WHERE public_id IS NULL;
    END IF;

    -- 4. Ensure telecom_providers has dynamic endpoint paths, field mappings, and custom headers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'telecom_providers') THEN
        ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS endpoint_paths JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS field_mappings JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS custom_headers JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    -- 5. Ensure telecom_provider_configs has dynamic configurations
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'telecom_provider_configs') THEN
        ALTER TABLE telecom_provider_configs ADD COLUMN IF NOT EXISTS endpoint_paths JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE telecom_provider_configs ADD COLUMN IF NOT EXISTS field_mappings JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE telecom_provider_configs ADD COLUMN IF NOT EXISTS custom_headers JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    -- 6. Ensure financial_ledger exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_ledger') THEN
        CREATE TABLE IF NOT EXISTS financial_ledger (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            transaction_id UUID NOT NULL,
            entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
            account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('CUSTOMER_WALLET', 'AGENT_WALLET', 'PLATFORM_ESCROW', 'PROVIDER_PAYABLE')),
            account_id UUID NOT NULL,
            amount_pesewas BIGINT NOT NULL CHECK (amount_pesewas > 0),
            currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
            reference_type VARCHAR(50) NOT NULL,
            reference_id VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_ledger_transaction ON financial_ledger(transaction_id);
        CREATE INDEX IF NOT EXISTS idx_ledger_account ON financial_ledger(account_type, account_id, created_at DESC);
    END IF;

    -- 7. Ensure user_pricing table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_pricing') THEN
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
    END IF;
END $$;
