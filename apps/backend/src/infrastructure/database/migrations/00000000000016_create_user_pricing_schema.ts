import { MigrationFile } from '../migrator.js';

export const migration00000000000016: MigrationFile = {
  version: '00000000000016',
  name: 'create_user_pricing_schema',
  upSql: `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Self-heal user_pricing if preexisting
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_pricing') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_pricing' AND column_name = 'uuid')
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_pricing' AND column_name = 'id') THEN
                ALTER TABLE user_pricing RENAME COLUMN uuid TO id;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_pricing' AND column_name = 'id') THEN
                ALTER TABLE user_pricing ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4();
            END IF;
            ALTER TABLE user_pricing ADD COLUMN IF NOT EXISTS user_id UUID;
            ALTER TABLE user_pricing ADD COLUMN IF NOT EXISTS product_id UUID;
            ALTER TABLE user_pricing ADD COLUMN IF NOT EXISTS custom_price_pesewas BIGINT DEFAULT 100;
            ALTER TABLE user_pricing ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
            ALTER TABLE user_pricing ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE user_pricing ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
        END IF;
    END $$;

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
  `,
  downSql: `
    DROP TABLE IF EXISTS user_pricing CASCADE;
  `,
};
