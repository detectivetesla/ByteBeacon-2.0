import { MigrationFile } from '../migrator.js';

export const migration00000000000032: MigrationFile = {
  version: '00000000000032',
  name: 'daily_store_visits',
  upSql: `
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stores') THEN
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS daily_visits BIGINT NOT NULL DEFAULT 0;
            ALTER TABLE stores ADD COLUMN IF NOT EXISTS last_visit_date DATE DEFAULT CURRENT_DATE;
        END IF;

        CREATE TABLE IF NOT EXISTS store_visits (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
            visited_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            visit_date DATE NOT NULL DEFAULT CURRENT_DATE
        );

        CREATE INDEX IF NOT EXISTS idx_store_visits_store_date ON store_visits(store_id, visit_date);
        CREATE INDEX IF NOT EXISTS idx_store_visits_visited_at ON store_visits(visited_at DESC);
    END $$;
  `,
  downSql: `
    DROP TABLE IF EXISTS store_visits CASCADE;
  `,
};
