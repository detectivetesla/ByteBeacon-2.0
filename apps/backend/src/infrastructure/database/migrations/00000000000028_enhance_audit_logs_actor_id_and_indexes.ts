import { MigrationFile } from '../migrator.js';

export const migration00000000000028: MigrationFile = {
  version: '00000000000028',
  name: 'enhance_audit_logs_actor_id_and_indexes',
  upSql: `
    DO $$
    BEGIN
        -- Drop view dependent on actor_id before altering column type
        DROP VIEW IF EXISTS audit_events CASCADE;

        -- 1. Ensure actor_id allows text IDs (UUIDs, custom string IDs) without type cast errors
        ALTER TABLE audit_logs ALTER COLUMN actor_id TYPE VARCHAR(100) USING actor_id::text;

        -- 2. Add actor_email and actor_name for immutable, self-contained audit records
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_email VARCHAR(255);
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_name VARCHAR(255);

        -- 3. Populate actor_email and actor_name from users where available
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
            UPDATE audit_logs l
            SET actor_email = u.email,
                actor_name = COALESCE(u.full_name, u.email)
            FROM users u
            WHERE l.actor_email IS NULL AND l.actor_id::text = u.id::text;
        END IF;

        -- 4. Create performance indexes
        CREATE INDEX IF NOT EXISTS idx_audit_actor_email ON audit_logs(actor_email);
        CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs(category);
        CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity);
        CREATE INDEX IF NOT EXISTS idx_audit_result ON audit_logs(result);

        -- 5. Recreate compatibility view audit_events
        CREATE OR REPLACE VIEW audit_events AS
        SELECT 
            id,
            correlation_id,
            actor_id,
            actor_type,
            action,
            resource_type,
            resource_id,
            severity,
            category,
            result,
            before_state,
            after_state,
            metadata,
            reason,
            ip_address,
            user_agent,
            event_hash,
            previous_event_hash,
            created_at
        FROM audit_logs;
    END $$;
  `,
  downSql: `
    SELECT 1;
  `,
};
