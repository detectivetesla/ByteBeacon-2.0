import { MigrationFile } from '../migrator.js';

export const migration00000000000024: MigrationFile = {
  version: '00000000000024',
  name: 'align_default_telecom_routing',
  upSql: `
    DO $$
    DECLARE
        dh_id UUID;
        gmpl_id UUID;
    BEGIN
        -- 1. Check if DataHouse exists in telecom_providers
        SELECT id INTO dh_id FROM telecom_providers WHERE LOWER(slug) = 'datahouse' OR LOWER(name) = 'datahouse' LIMIT 1;
        SELECT id INTO gmpl_id FROM telecom_providers WHERE LOWER(slug) = 'gmpl' OR LOWER(name) = 'gmpl' LIMIT 1;

        IF dh_id IS NOT NULL THEN
            -- Promote DataHouse as authoritative
            UPDATE telecom_providers SET is_authoritative = FALSE WHERE is_authoritative = TRUE;
            UPDATE telecom_providers SET is_authoritative = TRUE, status = 'ACTIVE', is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = dh_id;
        END IF;

        -- 2. Update carrier routing in telecom_networks
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'telecom_networks') THEN
            UPDATE telecom_networks
            SET primary_provider_name = 'DataHouse',
                fallback_provider_name = 'GMPL',
                updated_at = CURRENT_TIMESTAMP
            WHERE code IN ('MTN', 'TELECEL', 'AIRTELTIGO');
        END IF;

        -- 3. Update provider_networks if present
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'provider_networks') AND dh_id IS NOT NULL THEN
            UPDATE provider_networks SET role = 'PRIMARY', priority = 1 WHERE provider_id = dh_id;
            IF gmpl_id IS NOT NULL THEN
                UPDATE provider_networks SET role = 'FALLBACK', priority = 2 WHERE provider_id = gmpl_id;
            END IF;
        END IF;
    END $$;
  `,
  downSql: `
    -- Reversible no-op
    SELECT 1;
  `,
};
