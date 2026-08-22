import { MigrationFile } from '../migrator.js';

export const migration00000000000007: MigrationFile = {
  version: '00000000000007',
  name: 'enhance_catalog_management_schema',
  upSql: `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- 1. Extend catalog_products with multi-tier pricing, provider mappings, and visibility flags
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'provider_name') THEN
            ALTER TABLE catalog_products ADD COLUMN provider_name VARCHAR(50) NOT NULL DEFAULT 'DataHouse';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'provider_plan_id') THEN
            ALTER TABLE catalog_products ADD COLUMN provider_plan_id VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'provider_plan_code') THEN
            ALTER TABLE catalog_products ADD COLUMN provider_plan_code VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'provider_product_code') THEN
            ALTER TABLE catalog_products ADD COLUMN provider_product_code VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'provider_price_pesewas') THEN
            ALTER TABLE catalog_products ADD COLUMN provider_price_pesewas BIGINT NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'agent_min_price_pesewas') THEN
            ALTER TABLE catalog_products ADD COLUMN agent_min_price_pesewas BIGINT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'agent_max_price_pesewas') THEN
            ALTER TABLE catalog_products ADD COLUMN agent_max_price_pesewas BIGINT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'store_price_pesewas') THEN
            ALTER TABLE catalog_products ADD COLUMN store_price_pesewas BIGINT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'pricing_mode') THEN
            ALTER TABLE catalog_products ADD COLUMN pricing_mode VARCHAR(30) NOT NULL DEFAULT 'FIXED';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'markup_value') THEN
            ALTER TABLE catalog_products ADD COLUMN markup_value NUMERIC(10, 2) DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'validity_desc') THEN
            ALTER TABLE catalog_products ADD COLUMN validity_desc VARCHAR(100) NOT NULL DEFAULT 'Non-Expiry';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'description') THEN
            ALTER TABLE catalog_products ADD COLUMN description TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'category') THEN
            ALTER TABLE catalog_products ADD COLUMN category VARCHAR(50) DEFAULT 'DATA_BUNDLE';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'status') THEN
            ALTER TABLE catalog_products ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'provider_status') THEN
            ALTER TABLE catalog_products ADD COLUMN provider_status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'available_for_customer') THEN
            ALTER TABLE catalog_products ADD COLUMN available_for_customer BOOLEAN NOT NULL DEFAULT TRUE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'available_for_agent') THEN
            ALTER TABLE catalog_products ADD COLUMN available_for_agent BOOLEAN NOT NULL DEFAULT TRUE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'available_for_store') THEN
            ALTER TABLE catalog_products ADD COLUMN available_for_store BOOLEAN NOT NULL DEFAULT TRUE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'available_for_api') THEN
            ALTER TABLE catalog_products ADD COLUMN available_for_api BOOLEAN NOT NULL DEFAULT TRUE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'version') THEN
            ALTER TABLE catalog_products ADD COLUMN version INT NOT NULL DEFAULT 1;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'last_synced_at') THEN
            ALTER TABLE catalog_products ADD COLUMN last_synced_at TIMESTAMPTZ;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'sync_error') THEN
            ALTER TABLE catalog_products ADD COLUMN sync_error TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_products' AND column_name = 'popular') THEN
            ALTER TABLE catalog_products ADD COLUMN popular BOOLEAN NOT NULL DEFAULT FALSE;
        END IF;
    END $$;

    -- 2. Create catalog_price_history table
    CREATE TABLE IF NOT EXISTS catalog_price_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
        changed_by UUID,
        change_type VARCHAR(50) NOT NULL,
        previous_provider_price_pesewas BIGINT,
        new_provider_price_pesewas BIGINT,
        previous_base_price_pesewas BIGINT,
        new_base_price_pesewas BIGINT,
        previous_agent_price_pesewas BIGINT,
        new_agent_price_pesewas BIGINT,
        previous_store_price_pesewas BIGINT,
        new_store_price_pesewas BIGINT,
        reason TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_catalog_price_history_product ON catalog_price_history(product_id, created_at DESC);

    -- 3. Create provider_catalog_sync_batches and provider_catalog_sync_items
    CREATE TABLE IF NOT EXISTS provider_catalog_sync_batches (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        provider_name VARCHAR(50) NOT NULL DEFAULT 'DataHouse',
        initiated_by UUID,
        total_provider_plans INT NOT NULL DEFAULT 0,
        matched_plans INT NOT NULL DEFAULT 0,
        new_plans_count INT NOT NULL DEFAULT 0,
        changed_plans_count INT NOT NULL DEFAULT 0,
        removed_plans_count INT NOT NULL DEFAULT 0,
        discrepancy_count INT NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
        applied_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_catalog_sync_batches_provider ON provider_catalog_sync_batches(provider_name, created_at DESC);

    CREATE TABLE IF NOT EXISTS provider_catalog_sync_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        batch_id UUID NOT NULL REFERENCES provider_catalog_sync_batches(id) ON DELETE CASCADE,
        catalog_product_id UUID REFERENCES catalog_products(id) ON DELETE SET NULL,
        provider_plan_id VARCHAR(255) NOT NULL,
        change_type VARCHAR(50) NOT NULL,
        network VARCHAR(30) NOT NULL,
        plan_name VARCHAR(255) NOT NULL,
        data_amount_mb INT NOT NULL,
        current_provider_price_pesewas BIGINT,
        new_provider_price_pesewas BIGINT NOT NULL,
        current_customer_price_pesewas BIGINT,
        proposed_customer_price_pesewas BIGINT,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        reviewed_by UUID,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_catalog_sync_items_batch ON provider_catalog_sync_items(batch_id);

    -- 4. Initial Seed of Standard DataHouse Telecom Bundles
    INSERT INTO catalog_products (
        sku, network, name, data_amount_mb, validity_days, validity_desc,
        provider_price_pesewas, base_price_pesewas, agent_price_pesewas, store_price_pesewas,
        agent_min_price_pesewas, agent_max_price_pesewas,
        provider_name, provider_plan_id, is_active, status, provider_status,
        available_for_customer, available_for_agent, available_for_store, available_for_api, popular
    ) VALUES
        ('MTN-1GB-NE', 'MTN', '1GB Non-Expiry', 1024, 30, 'Non-Expiry', 350, 600, 380, 450, 360, 590, 'DataHouse', 'dh_mtn_1gb', TRUE, 'ACTIVE', 'AVAILABLE', TRUE, TRUE, TRUE, TRUE, FALSE),
        ('MTN-2GB-NE', 'MTN', '2GB Non-Expiry', 2048, 30, 'Non-Expiry', 700, 1200, 760, 900, 720, 1180, 'DataHouse', 'dh_mtn_2gb', TRUE, 'ACTIVE', 'AVAILABLE', TRUE, TRUE, TRUE, TRUE, FALSE),
        ('MTN-3GB-NE', 'MTN', '3GB Non-Expiry', 3072, 30, 'Non-Expiry', 1050, 1800, 1140, 1350, 1080, 1750, 'DataHouse', 'dh_mtn_3gb', TRUE, 'ACTIVE', 'AVAILABLE', TRUE, TRUE, TRUE, TRUE, FALSE),
        ('MTN-5GB-NE', 'MTN', '5GB Non-Expiry', 5120, 30, 'Non-Expiry', 1750, 2800, 1900, 2200, 1800, 2750, 'DataHouse', 'dh_mtn_5gb', TRUE, 'ACTIVE', 'AVAILABLE', TRUE, TRUE, TRUE, TRUE, TRUE),
        ('MTN-10GB-NE', 'MTN', '10GB Non-Expiry', 10240, 30, 'Non-Expiry', 3500, 5500, 3800, 4400, 3600, 5400, 'DataHouse', 'dh_mtn_10gb', TRUE, 'ACTIVE', 'AVAILABLE', TRUE, TRUE, TRUE, TRUE, TRUE),
        ('MTN-20GB-NE', 'MTN', '20GB Non-Expiry', 20480, 30, 'Non-Expiry', 6800, 10000, 7200, 8500, 7000, 9800, 'DataHouse', 'dh_mtn_20gb', TRUE, 'ACTIVE', 'AVAILABLE', TRUE, TRUE, TRUE, TRUE, FALSE),
        ('MTN-50GB-NE', 'MTN', '50GB Non-Expiry', 51200, 30, 'Non-Expiry', 16500, 24000, 17500, 20500, 17000, 23500, 'DataHouse', 'dh_mtn_50gb', TRUE, 'ACTIVE', 'AVAILABLE', TRUE, TRUE, TRUE, TRUE, FALSE),

        ('TEL-2GB-NE', 'TELECEL', '2GB Non-Expiry', 2048, 30, 'Non-Expiry', 600, 1000, 680, 800, 640, 980, 'DataHouse', 'dh_tel_2gb', TRUE, 'ACTIVE', 'AVAILABLE', TRUE, TRUE, TRUE, TRUE, FALSE),
        ('TEL-5GB-NE', 'TELECEL', '5GB Non-Expiry', 5120, 30, 'Non-Expiry', 1500, 2400, 1650, 1950, 1550, 2350, 'DataHouse', 'dh_tel_5gb', TRUE, 'ACTIVE', 'AVAILABLE', TRUE, TRUE, TRUE, TRUE, TRUE),
        ('TEL-10GB-NE', 'TELECEL', '10GB Non-Expiry', 10240, 30, 'Non-Expiry', 2900, 4500, 3200, 3700, 3000, 4400, 'DataHouse', 'dh_tel_10gb', TRUE, 'ACTIVE', 'AVAILABLE', TRUE, TRUE, TRUE, TRUE, FALSE),
        ('TEL-25GB-NE', 'TELECEL', '25GB Non-Expiry', 25600, 30, 'Non-Expiry', 7200, 11000, 7800, 9200, 7500, 10800, 'DataHouse', 'dh_tel_25gb', TRUE, 'ACTIVE', 'AVAILABLE', TRUE, TRUE, TRUE, TRUE, FALSE),

        ('AT-2GB-NE', 'AIRTELTIGO', '2GB Non-Expiry', 2048, 30, 'Non-Expiry', 480, 800, 550, 650, 500, 780, 'DataHouse', 'dh_at_2gb', TRUE, 'ACTIVE', 'AVAILABLE', TRUE, TRUE, TRUE, TRUE, FALSE),
        ('AT-5GB-NE', 'AIRTELTIGO', '5GB Non-Expiry', 5120, 30, 'Non-Expiry', 1200, 2000, 1400, 1650, 1300, 1950, 'DataHouse', 'dh_at_5gb', TRUE, 'ACTIVE', 'AVAILABLE', TRUE, TRUE, TRUE, TRUE, TRUE),
        ('AT-10GB-NE', 'AIRTELTIGO', '10GB Non-Expiry', 10240, 30, 'Non-Expiry', 2400, 3800, 2700, 3100, 2500, 3700, 'DataHouse', 'dh_at_10gb', TRUE, 'ACTIVE', 'AVAILABLE', TRUE, TRUE, TRUE, TRUE, FALSE),
        ('AT-20GB-NE', 'AIRTELTIGO', '20GB Non-Expiry', 20480, 30, 'Non-Expiry', 4600, 7500, 5200, 6000, 4800, 7200, 'DataHouse', 'dh_at_20gb', TRUE, 'ACTIVE', 'AVAILABLE', TRUE, TRUE, TRUE, TRUE, FALSE)
    ON CONFLICT (sku) DO UPDATE SET
        provider_price_pesewas = EXCLUDED.provider_price_pesewas,
        base_price_pesewas = EXCLUDED.base_price_pesewas,
        agent_price_pesewas = EXCLUDED.agent_price_pesewas,
        store_price_pesewas = EXCLUDED.store_price_pesewas,
        provider_plan_id = EXCLUDED.provider_plan_id,
        validity_desc = EXCLUDED.validity_desc,
        status = 'ACTIVE',
        provider_status = 'AVAILABLE',
        is_active = TRUE;
  `,
  downSql: `
    DROP TABLE IF EXISTS provider_catalog_sync_items CASCADE;
    DROP TABLE IF EXISTS provider_catalog_sync_batches CASCADE;
    DROP TABLE IF EXISTS catalog_price_history CASCADE;
  `,
};
