import { MigrationFile } from '../migrator.js';

export const migration00000000000022: MigrationFile = {
  version: '00000000000022',
  name: 'add_metadata_to_pending_beneficiary_approvals',
  upSql: `
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pending_beneficiary_approvals') THEN
            ALTER TABLE pending_beneficiary_approvals ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
            ALTER TABLE pending_beneficiary_approvals ADD COLUMN IF NOT EXISTS detected_from VARCHAR(50);
            ALTER TABLE pending_beneficiary_approvals ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(255);
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'beneficiary_validation') THEN
            ALTER TABLE beneficiary_validation ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
        END IF;
    END $$;
  `,
  downSql: `
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pending_beneficiary_approvals') THEN
            ALTER TABLE pending_beneficiary_approvals DROP COLUMN IF EXISTS metadata;
            ALTER TABLE pending_beneficiary_approvals DROP COLUMN IF EXISTS detected_from;
            ALTER TABLE pending_beneficiary_approvals DROP COLUMN IF EXISTS provider_reference;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'beneficiary_validation') THEN
            ALTER TABLE beneficiary_validation DROP COLUMN IF EXISTS user_id;
        END IF;
    END $$;
  `,
};
