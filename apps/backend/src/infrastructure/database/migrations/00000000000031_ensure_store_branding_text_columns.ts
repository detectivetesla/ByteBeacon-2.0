import { MigrationFile } from '../migrator.js';

export const migration00000000000031: MigrationFile = {
  version: '00000000000031',
  name: 'ensure_store_branding_text_columns',
  upSql: `
    DROP VIEW IF EXISTS agent_stores CASCADE;

    ALTER TABLE IF EXISTS stores ALTER COLUMN logo_url TYPE TEXT;
    ALTER TABLE IF EXISTS stores ALTER COLUMN banner_url TYPE TEXT;
    ALTER TABLE IF EXISTS stores ALTER COLUMN tagline TYPE TEXT;
    ALTER TABLE IF EXISTS stores ALTER COLUMN description TYPE TEXT;

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

    ALTER TABLE IF EXISTS agents ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';
  `,
  downSql: `
    SELECT 1;
  `,
};
