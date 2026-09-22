import { MigrationFile } from '../migrator.js';

export const migration00000000000037: MigrationFile = {
  version: '00000000000037',
  name: 'add_paused_order_controls_and_status',
  upSql: `
    -- 1. Add paused tracking columns to orders table
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS paused_from_status VARCHAR(30);

    -- 2. Drop existing CHECK constraint on orders.order_status and replace with one that includes PAUSED
    DO $$
    DECLARE
        constraint_name TEXT;
    BEGIN
        SELECT con.conname INTO constraint_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid
            AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'orders'
          AND att.attname = 'order_status'
          AND con.contype = 'c';

        IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', constraint_name);
        END IF;

        ALTER TABLE orders
            ADD CONSTRAINT orders_order_status_check
            CHECK (order_status IN ('CREATED', 'VALIDATING', 'READY_FOR_FULFILLMENT', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED'));
    END $$;

    -- 3. Create index for high-performance paused order queries
    CREATE INDEX IF NOT EXISTS idx_orders_is_paused ON orders(is_paused) WHERE is_paused = true;
    CREATE INDEX IF NOT EXISTS idx_orders_paused_status ON orders(order_status) WHERE order_status = 'PAUSED';

    -- 4. Seed PAUSE_ORDER_OPERATIONS into emergency_system_controls if table exists
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'emergency_system_controls') THEN
            INSERT INTO emergency_system_controls (control_key, name, description, is_enabled)
            VALUES (
                'PAUSE_ORDER_OPERATIONS',
                'Pause All Order Processes & Activities',
                'Halts all customer & agent order processes, checkouts, and Excel bulk uploads, and holds processing orders for export.',
                false
            )
            ON CONFLICT (control_key) DO NOTHING;
        END IF;
    END $$;
  `,
  downSql: `
    DO $$
    DECLARE
        constraint_name TEXT;
    BEGIN
        SELECT con.conname INTO constraint_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid
            AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'orders'
          AND att.attname = 'order_status'
          AND con.contype = 'c';

        IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', constraint_name);
        END IF;

        ALTER TABLE orders
            ADD CONSTRAINT orders_order_status_check
            CHECK (order_status IN ('CREATED', 'VALIDATING', 'READY_FOR_FULFILLMENT', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'));
    END $$;

    DROP INDEX IF EXISTS idx_orders_is_paused;
    DROP INDEX IF EXISTS idx_orders_paused_status;
    ALTER TABLE orders DROP COLUMN IF EXISTS is_paused;
    ALTER TABLE orders DROP COLUMN IF EXISTS paused_at;
    ALTER TABLE orders DROP COLUMN IF EXISTS paused_from_status;
  `,
};
