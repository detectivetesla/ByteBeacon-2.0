-- Migration: 00000000000031 - ensure_store_branding_text_columns
-- ByteBeacon Database Migration

BEGIN;

DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stores') THEN
            -- 1. Drop dependent view so column types can be altered cleanly
            DROP VIEW IF EXISTS agent_stores CASCADE;

            -- 2. Alter column types to TEXT without character limits
            ALTER TABLE stores ALTER COLUMN logo_url TYPE TEXT;
            ALTER TABLE stores ALTER COLUMN banner_url TYPE TEXT;
            ALTER TABLE stores ALTER COLUMN tagline TYPE TEXT;
            ALTER TABLE stores ALTER COLUMN description TYPE TEXT;

            -- 3. Re-create view matching stores schema
            CREATE OR REPLACE VIEW agent_stores AS
            SELECT 
                id,
                agent_id,
                user_id,
                store_name,
                slug,
                tagline,
                description,
                logo_url,
                banner_url,
                primary_color,
                accent_color,
                contact_email,
                contact_phone,
                contact_whatsapp,
                payment_status,
                approval_status,
                store_status as status,
                activation_fee_pesewas,
                paystack_reference,
                admin_notes,
                approved_by,
                approved_at,
                created_at,
                updated_at
            FROM stores;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents') THEN
            ALTER TABLE agents ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';
        END IF;
    END $$;

-- Record migration in tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version, name)
VALUES ('00000000000031', 'ensure_store_branding_text_columns')
ON CONFLICT (version) DO NOTHING;

COMMIT;
