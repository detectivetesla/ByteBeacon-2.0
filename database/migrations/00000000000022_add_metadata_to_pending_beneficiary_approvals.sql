-- ==============================================================================
-- Migration: 00000000000022_add_metadata_to_pending_beneficiary_approvals.sql
-- ==============================================================================
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
