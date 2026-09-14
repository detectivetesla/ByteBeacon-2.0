import { MigrationFile } from '../migrator.js';

export const migration00000000000026: MigrationFile = {
  version: '00000000000026',
  name: 'enhance_api_usage_metrics_request_response_tracking',
  upSql: `
    DO $$
    BEGIN
        -- 1. Ensure api_usage_metrics table has enhanced tracking columns
        ALTER TABLE api_usage_metrics ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
        ALTER TABLE api_usage_metrics ADD COLUMN IF NOT EXISTS key_name VARCHAR(255);
        ALTER TABLE api_usage_metrics ADD COLUMN IF NOT EXISTS key_prefix VARCHAR(32);
        ALTER TABLE api_usage_metrics ADD COLUMN IF NOT EXISTS user_agent TEXT;
        ALTER TABLE api_usage_metrics ADD COLUMN IF NOT EXISTS request_headers JSONB;
        ALTER TABLE api_usage_metrics ADD COLUMN IF NOT EXISTS request_payload TEXT;
        ALTER TABLE api_usage_metrics ADD COLUMN IF NOT EXISTS response_headers JSONB;
        ALTER TABLE api_usage_metrics ADD COLUMN IF NOT EXISTS response_payload TEXT;

        -- 2. Performance indexes
        CREATE INDEX IF NOT EXISTS idx_api_usage_agent ON api_usage_metrics(agent_id);
        CREATE INDEX IF NOT EXISTS idx_api_usage_key_prefix ON api_usage_metrics(key_prefix);
        CREATE INDEX IF NOT EXISTS idx_api_usage_agent_created ON api_usage_metrics(agent_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_api_usage_key_created ON api_usage_metrics(key_id, created_at DESC);

        -- 3. Backfill agent_id where user_id or key_id matches agents
        UPDATE api_usage_metrics m
        SET agent_id = a.id
        FROM agents a
        WHERE m.agent_id IS NULL AND (m.user_id = a.user_id OR m.user_id = a.id);

        UPDATE api_usage_metrics m
        SET agent_id = a.id
        FROM api_keys k
        JOIN agents a ON a.user_id = k.agent_id OR a.id = k.agent_id
        WHERE m.agent_id IS NULL AND m.key_id = k.id;

        -- 4. Backfill key_prefix and key_name from api_keys
        UPDATE api_usage_metrics m
        SET key_prefix = k.key_prefix,
            key_name = k.name
        FROM api_keys k
        WHERE m.key_id = k.id AND (m.key_prefix IS NULL OR m.key_name IS NULL);
    END $$;
  `,
  downSql: `
    SELECT 1;
  `,
};
