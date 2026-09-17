import { MigrationFile } from '../migrator.js';

export const migration00000000000031: MigrationFile = {
  version: '00000000000031',
  name: 'ensure_store_branding_text_columns',
  upSql: `
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stores') THEN
            -- Ensure logo_url, banner_url, tagline, description are TEXT without character limits
            ALTER TABLE stores ALTER COLUMN logo_url TYPE TEXT;
            ALTER TABLE stores ALTER COLUMN banner_url TYPE TEXT;
            ALTER TABLE stores ALTER COLUMN tagline TYPE TEXT;
            ALTER TABLE stores ALTER COLUMN description TYPE TEXT;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents') THEN
            ALTER TABLE agents ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';
        END IF;
    END $$;
  `,
  downSql: `
    SELECT 1;
  `,
};
