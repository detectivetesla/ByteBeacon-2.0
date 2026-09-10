import { MigrationFile } from '../migrator.js';

export const migration00000000000023: MigrationFile = {
  version: '00000000000023',
  name: 'add_public_id_to_refunds_and_orders_failure_reason',
  upSql: `
    DO $$
    BEGIN
        -- 1. Ensure public_id on refunds table
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'refunds') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'refunds' AND column_name = 'public_id') THEN
                ALTER TABLE refunds ADD COLUMN public_id VARCHAR(64);
                CREATE UNIQUE INDEX IF NOT EXISTS uq_refunds_public_id ON refunds(public_id);
                UPDATE refunds SET public_id = 'ref_' || substr(md5(random()::text || id::text), 1, 16) WHERE public_id IS NULL;
            END IF;
        END IF;

        -- 2. Ensure failure_reason on orders table
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'failure_reason') THEN
                ALTER TABLE orders ADD COLUMN failure_reason TEXT;
            END IF;
        END IF;
    END $$;
  `,
  downSql: `
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'refunds') THEN
            DROP INDEX IF EXISTS uq_refunds_public_id;
            ALTER TABLE refunds DROP COLUMN IF EXISTS public_id;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
            ALTER TABLE orders DROP COLUMN IF EXISTS failure_reason;
        END IF;
    END $$;
  `,
};
