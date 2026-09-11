-- ==============================================================================
-- Migration: 00000000000023_add_public_id_to_refunds_and_orders_failure_reason.sql
-- ==============================================================================
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
