import { MigrationFile } from '../migrator.js';

export const migration00000000000012: MigrationFile = {
  version: '00000000000012',
  name: 'enhance_audit_and_security_operations_schema',
  upSql: `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- 1. Enhance audit_logs with cryptographic chaining, classification & state snapshots
    ALTER TABLE audit_logs 
      ADD COLUMN IF NOT EXISTS severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
      ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'ADMIN_ACTION',
      ADD COLUMN IF NOT EXISTS result VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
      ADD COLUMN IF NOT EXISTS before_state JSONB,
      ADD COLUMN IF NOT EXISTS after_state JSONB,
      ADD COLUMN IF NOT EXISTS reason TEXT,
      ADD COLUMN IF NOT EXISTS event_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS previous_event_hash VARCHAR(64);

    CREATE INDEX IF NOT EXISTS idx_audit_severity_created ON audit_logs(severity, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_category_created ON audit_logs(category, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_result_created ON audit_logs(result, created_at DESC);

    -- 2. Create security_incidents table for incident lifecycle management
    CREATE TABLE IF NOT EXISTS security_incidents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        incident_number VARCHAR(50) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'HIGH'
            CHECK (severity IN ('INFO', 'WARNING', 'HIGH', 'CRITICAL')),
        status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
            CHECK (status IN ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'FALSE_POSITIVE')),
        triggering_event_id UUID REFERENCES audit_logs(id) ON DELETE SET NULL,
        assigned_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
        affected_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        timeline JSONB NOT NULL DEFAULT '[]',
        investigation_notes TEXT NOT NULL DEFAULT '',
        resolution TEXT,
        resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sec_incidents_status ON security_incidents(status);
    CREATE INDEX IF NOT EXISTS idx_sec_incidents_severity ON security_incidents(severity);
    CREATE INDEX IF NOT EXISTS idx_sec_incidents_created ON security_incidents(created_at DESC);

    -- 3. Create emergency_system_controls table for Super Admin kill switches
    CREATE TABLE IF NOT EXISTS emergency_system_controls (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        control_key VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_enabled BOOLEAN NOT NULL DEFAULT false,
        last_toggled_by UUID REFERENCES users(id) ON DELETE SET NULL,
        last_toggled_at TIMESTAMPTZ,
        last_justification TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Seed default emergency controls
    INSERT INTO emergency_system_controls (control_key, name, description, is_enabled)
    VALUES 
    (
        'MAINTENANCE_MODE',
        'Platform Maintenance Mode',
        'Restricts all public customer and agent storefront interactions with a maintenance banner.',
        false
    ),
    (
        'DISABLE_AGENT_STORES',
        'Kill Switch: Agent Storefronts',
        'Instantly pauses all external customer checkouts on agent custom storefront domains.',
        false
    ),
    (
        'KILL_SWITCH_PAYSTACK',
        'Kill Switch: Paystack Live Processing',
        'Halts incoming mobile money and card deposits; falls back to manual bank verification.',
        false
    ),
    (
        'KILL_SWITCH_TELECOM_DISPATCH',
        'Kill Switch: Automated Telecom Dispatch',
        'Holds all newly placed orders in pending queue rather than submitting to telecom carriers.',
        false
    ),
    (
        'EMERGENCY_READ_ONLY',
        'Emergency Platform Read-Only Mode',
        'Locks all database write transactions across financial and commerce domains.',
        false
    )
    ON CONFLICT (control_key) DO NOTHING;
  `,
  downSql: `
    DROP TABLE IF EXISTS emergency_system_controls CASCADE;
    DROP TABLE IF EXISTS security_incidents CASCADE;
    ALTER TABLE audit_logs 
      DROP COLUMN IF EXISTS previous_event_hash,
      DROP COLUMN IF EXISTS event_hash,
      DROP COLUMN IF EXISTS reason,
      DROP COLUMN IF EXISTS after_state,
      DROP COLUMN IF EXISTS before_state,
      DROP COLUMN IF EXISTS result,
      DROP COLUMN IF EXISTS category,
      DROP COLUMN IF EXISTS severity;
  `,
};
