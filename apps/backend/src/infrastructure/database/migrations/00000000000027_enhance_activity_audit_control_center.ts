import { MigrationFile } from '../migrator.js';

export const migration00000000000027: MigrationFile = {
  version: '00000000000027',
  name: 'enhance_activity_audit_control_center',
  upSql: `
    DO $$
    BEGIN
        -- 1. Enhance audit_logs table with control center telemetry & actor role fields
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR(50);
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'WEB';
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS service VARCHAR(50) NOT NULL DEFAULT 'core-api';
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS endpoint VARCHAR(255);
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS http_method VARCHAR(10);
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS http_status INT;
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS latency_ms INT;
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS description TEXT;

        -- 2. Performance indexes
        CREATE INDEX IF NOT EXISTS idx_audit_request_id ON audit_logs(request_id);
        CREATE INDEX IF NOT EXISTS idx_audit_source_created ON audit_logs(source, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_actor_role_created ON audit_logs(actor_role, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
        CREATE INDEX IF NOT EXISTS idx_audit_created_desc ON audit_logs(created_at DESC);

        -- 3. Backfill actor_role for existing rows where null
        UPDATE audit_logs l
        SET actor_role = LOWER(u.role)
        FROM users u
        WHERE l.actor_role IS NULL AND l.actor_id = u.id;

        UPDATE audit_logs
        SET actor_role = LOWER(actor_type)
        WHERE actor_role IS NULL;
    END $$;
  `,
  downSql: `
    SELECT 1;
  `,
};
