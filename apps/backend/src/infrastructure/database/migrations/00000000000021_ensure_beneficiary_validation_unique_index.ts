import { MigrationFile } from '../migrator.js';

export const migration00000000000021: MigrationFile = {
  version: '00000000000021',
  name: 'ensure_beneficiary_validation_unique_index',
  upSql: `
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'beneficiary_validation') THEN
            -- 1. Deduplicate any existing duplicate (phone_number, network) pairs
            DELETE FROM beneficiary_validation a USING beneficiary_validation b
            WHERE a.id < b.id 
              AND a.phone_number = b.phone_number 
              AND a.network = b.network;

            -- 2. Create unique index required for ON CONFLICT (phone_number, network)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE tablename = 'beneficiary_validation' 
                  AND indexname = 'uq_beneficiary_validation_phone_network'
            ) THEN
                CREATE UNIQUE INDEX uq_beneficiary_validation_phone_network 
                ON beneficiary_validation (phone_number, network);
            END IF;
        END IF;
    END $$;
  `,
  downSql: `
    DROP INDEX IF EXISTS uq_beneficiary_validation_phone_network;
  `,
};
