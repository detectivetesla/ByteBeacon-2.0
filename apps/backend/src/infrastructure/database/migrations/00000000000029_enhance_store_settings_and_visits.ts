import { MigrationFile } from '../migrator.js';

export const migration00000000000029: MigrationFile = {
  version: '00000000000029',
  name: 'enhance_store_settings_and_visits',
  upSql: `
    DO $$
    BEGIN
        -- 1. Store operational settings (auto-fulfillment, notification preferences)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stores') THEN
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS visit_count BIGINT NOT NULL DEFAULT 0;
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS last_visited_at TIMESTAMPTZ;
        END IF;

        -- 2. Index for efficient store-scoped notification queries
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
            CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
        END IF;

        -- 3. Index for efficient store-scoped customer aggregation from orders
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
            CREATE INDEX IF NOT EXISTS idx_orders_store_recipient ON orders(store_id, recipient_phone) WHERE store_id IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_orders_store_created_date ON orders(store_id, created_at DESC) WHERE store_id IS NOT NULL;
        END IF;
    END $$;
  `,
  downSql: `
    SELECT 1;
  `,
};
