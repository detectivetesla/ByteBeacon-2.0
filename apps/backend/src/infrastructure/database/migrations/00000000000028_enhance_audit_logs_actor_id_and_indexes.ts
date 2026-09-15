import { MigrationFile } from '../migrator.js';

export const migration00000000000028: MigrationFile = {
  version: '00000000000028',
  name: 'enhance_audit_logs_actor_id_and_indexes',
  upSql: `
    DO $$
    BEGIN
        -- 1. Ensure actor_id allows text IDs (UUIDs, custom string IDs) without type cast errors
        ALTER TABLE audit_logs ALTER COLUMN actor_id TYPE VARCHAR(100) USING actor_id::text;

        -- 2. Add actor_email and actor_name for immutable, self-contained audit records
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_email VARCHAR(255);
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_name VARCHAR(255);

        -- 3. Populate actor_email and actor_name from users where available
        UPDATE audit_logs l
        SET actor_email = u.email,
            actor_name = COALESCE(u.full_name, u.email)
        FROM users u
        WHERE l.actor_email IS NULL AND l.actor_id = u.id::text;

        -- 4. Create performance indexes
        CREATE INDEX IF NOT EXISTS idx_audit_actor_email ON audit_logs(actor_email);
        CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs(category);
        CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity);
        CREATE INDEX IF NOT EXISTS idx_audit_result ON audit_logs(result);
    END $$;
  `,
  downSql: `
    SELECT 1;
  `,
};
