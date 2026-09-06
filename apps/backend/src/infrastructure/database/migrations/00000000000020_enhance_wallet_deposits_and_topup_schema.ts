import { MigrationFile } from '../migrator.js';

export const migration00000000000020: MigrationFile = {
  version: '00000000000020',
  name: 'enhance_wallet_deposits_and_topup_schema',
  upSql: `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    DO $$
    BEGIN
        -- 1. Relax order_id in payments to allow NULL for wallet top-ups (which do not correspond to product catalog orders)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'order_id') THEN
            ALTER TABLE payments ALTER COLUMN order_id DROP NOT NULL;
        END IF;

        -- 2. Ensure payments has metadata JSONB column for top-up context and user linkage
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'metadata') THEN
            ALTER TABLE payments ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';
        END IF;

        -- 3. Ensure payments has index on provider_reference for fast webhook lookups
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
            CREATE INDEX IF NOT EXISTS idx_payments_provider_reference ON payments (provider_reference);
        END IF;

        -- 4. Authoritative wallet consistency between wallet_balance (GHS numeric) and wallet_balance_pesewas (BIGINT)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
            UPDATE users
            SET wallet_balance = ROUND(COALESCE(wallet_balance_pesewas, 0) / 100.0, 2)
            WHERE wallet_balance IS NULL OR wallet_balance != ROUND(COALESCE(wallet_balance_pesewas, 0) / 100.0, 2);
        END IF;
    END $$;
  `,
  downSql: `
    DO $$
    BEGIN
        -- Rollback operations if needed
        DROP INDEX IF EXISTS idx_payments_provider_reference;
    END $$;
  `,
};
