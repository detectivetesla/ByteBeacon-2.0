-- Migration: 00000000000031 - ensure_store_branding_text_columns
-- ByteBeacon Database Migration
-- Safe, idempotent script to expand stores branding columns to TEXT and align agent status

BEGIN;

-- 1. Drop dependent view so column types can be altered cleanly without ERROR 0A000
DROP VIEW IF EXISTS agent_stores CASCADE;

-- 2. Alter column types to TEXT without character limits
ALTER TABLE IF EXISTS stores ALTER COLUMN logo_url TYPE TEXT;
ALTER TABLE IF EXISTS stores ALTER COLUMN banner_url TYPE TEXT;
ALTER TABLE IF EXISTS stores ALTER COLUMN tagline TYPE TEXT;
ALTER TABLE IF EXISTS stores ALTER COLUMN description TYPE TEXT;

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

-- 4. Ensure agents table has status column if not already present
ALTER TABLE IF EXISTS agents ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';

-- 5. Record migration in tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version, name)
VALUES ('00000000000031', 'ensure_store_branding_text_columns')
ON CONFLICT (version) DO NOTHING;

COMMIT;
