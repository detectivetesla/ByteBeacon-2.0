-- Migration: 00000000000022 - add_metadata_to_pending_beneficiary_approvals
-- ByteBeacon Database Migration

BEGIN;

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

-- Record migration in tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version, name)
VALUES ('00000000000022', 'add_metadata_to_pending_beneficiary_approvals')
ON CONFLICT (version) DO NOTHING;

COMMIT;
