import { MigrationFile } from '../migrator.js';

export const migration00000000000017: MigrationFile = {
  version: '00000000000017',
  name: 'enhance_custom_telecom_provider_endpoints',
  upSql: `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Enhance telecom_providers with dynamic endpoint paths, field mappings, and custom headers
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'telecom_providers') THEN
            ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS endpoint_paths JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS field_mappings JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS custom_headers JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE telecom_providers ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'telecom_provider_configs') THEN
            ALTER TABLE telecom_provider_configs ADD COLUMN IF NOT EXISTS endpoint_paths JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE telecom_provider_configs ADD COLUMN IF NOT EXISTS field_mappings JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE telecom_provider_configs ADD COLUMN IF NOT EXISTS custom_headers JSONB NOT NULL DEFAULT '{}'::jsonb;
        END IF;
    END $$;
  `,
  downSql: `
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'telecom_providers') THEN
            ALTER TABLE telecom_providers DROP COLUMN IF EXISTS endpoint_paths;
            ALTER TABLE telecom_providers DROP COLUMN IF EXISTS field_mappings;
            ALTER TABLE telecom_providers DROP COLUMN IF EXISTS custom_headers;
            ALTER TABLE telecom_providers DROP COLUMN IF EXISTS metadata;
        END IF;
    END $$;
  `,
};
