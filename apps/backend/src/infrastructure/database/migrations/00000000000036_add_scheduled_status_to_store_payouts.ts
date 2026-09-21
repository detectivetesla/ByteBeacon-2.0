import { MigrationFile } from '../migrator.js';

export const migration00000000000036: MigrationFile = {
  version: '00000000000036',
  name: 'add_scheduled_status_to_store_payouts',
  upSql: `
    -- Drop existing CHECK constraint on store_payouts.status and replace with one that includes SCHEDULED
    DO $$
    DECLARE
        constraint_name TEXT;
    BEGIN
        -- Find and drop any CHECK constraint on the status column of store_payouts
        SELECT con.conname INTO constraint_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid
            AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'store_payouts'
          AND att.attname = 'status'
          AND con.contype = 'c';

        IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE store_payouts DROP CONSTRAINT %I', constraint_name);
        END IF;

        -- Add updated CHECK constraint with SCHEDULED status
        ALTER TABLE store_payouts
            ADD CONSTRAINT store_payouts_status_check
            CHECK (status IN ('PENDING', 'PROCESSING', 'PAID', 'HELD', 'REJECTED', 'FAILED', 'SCHEDULED'));
    END $$;
  `,
  downSql: `
    DO $$
    DECLARE
        constraint_name TEXT;
    BEGIN
        SELECT con.conname INTO constraint_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid
            AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'store_payouts'
          AND att.attname = 'status'
          AND con.contype = 'c';

        IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE store_payouts DROP CONSTRAINT %I', constraint_name);
        END IF;

        ALTER TABLE store_payouts
            ADD CONSTRAINT store_payouts_status_check
            CHECK (status IN ('PENDING', 'PROCESSING', 'PAID', 'HELD', 'REJECTED', 'FAILED'));
    END $$;
  `,
};
