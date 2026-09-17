-- Migration: 00000000000000 - init_system_metadata
-- ByteBeacon Database Migration

BEGIN;

CREATE TABLE IF NOT EXISTS system_metadata (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO system_metadata (key, value)
    VALUES ('schema_version', '2.0.0-phase1')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;

-- Record migration in tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version, name)
VALUES ('00000000000000', 'init_system_metadata')
ON CONFLICT (version) DO NOTHING;

COMMIT;
