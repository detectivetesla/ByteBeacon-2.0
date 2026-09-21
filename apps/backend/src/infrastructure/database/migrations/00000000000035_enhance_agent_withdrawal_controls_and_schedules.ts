import { MigrationFile } from '../migrator.js';

export const migration00000000000035: MigrationFile = {
  version: '00000000000035',
  name: 'enhance_agent_withdrawal_controls_and_schedules',
  upSql: `
    -- 1. Extend agents table with custom min withdrawal, daily limit, and withdrawal permissions
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS custom_min_withdrawal_pesewas BIGINT DEFAULT NULL;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS custom_daily_limit_pesewas BIGINT DEFAULT NULL;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS withdrawals_enabled BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS allow_anytime_withdrawals BOOLEAN NOT NULL DEFAULT FALSE;

    -- 2. Seed / ensure system configurations for agent withdrawal schedules and limits
    INSERT INTO system_configurations (
        scope, config_key, category, value, data_type, is_secret, risk_level, requires_step_up, description, version
    )
    VALUES
      ('AGENTS', 'agent_min_withdrawal_pesewas', 'AGENTS', '1000'::jsonb, 'NUMBER', false, 'MEDIUM', false, 'Minimum profit withdrawal amount per request in pesewas (1000 = GH₵10.00)', 1),
      ('AGENTS', 'agent_max_withdrawal_pesewas', 'AGENTS', '500000'::jsonb, 'NUMBER', false, 'HIGH', true, 'Maximum single profit withdrawal limit in pesewas (500000 = GH₵5,000.00)', 1),
      ('PAYMENTS', 'daily_withdrawal_limit_pesewas', 'PAYMENTS', '500000'::jsonb, 'NUMBER', false, 'HIGH', true, 'Daily aggregated profit withdrawal limit per agent in pesewas (500000 = GH₵5,000.00)', 1),
      ('AGENTS', 'agent_withdrawal_schedule_enabled', 'AGENTS', 'true'::jsonb, 'BOOLEAN', false, 'MEDIUM', false, 'Enforce time window and operating day restrictions on agent withdrawals', 1),
      ('AGENTS', 'agent_withdrawal_allowed_days', 'AGENTS', '["MON","TUE","WED","THU","FRI","SAT","SUN"]'::jsonb, 'JSON', false, 'MEDIUM', false, 'Days of week when agent profit payouts are permitted (SUN-SAT)', 1),
      ('AGENTS', 'agent_withdrawal_start_time', 'AGENTS', '"00:00"'::jsonb, 'STRING', false, 'MEDIUM', false, 'Daily withdrawal opening time in GMT (HH:MM)', 1),
      ('AGENTS', 'agent_withdrawal_end_time', 'AGENTS', '"23:59"'::jsonb, 'STRING', false, 'MEDIUM', false, 'Daily withdrawal closing time in GMT (HH:MM)', 1),
      ('PAYMENTS', 'allow_agent_withdrawals', 'PAYMENTS', 'true'::jsonb, 'BOOLEAN', false, 'HIGH', true, 'Global switch to permit or pause agent profit withdrawals platform-wide', 1)
    ON CONFLICT (config_key) DO NOTHING;
  `,
  downSql: `
    ALTER TABLE agents DROP COLUMN IF EXISTS custom_min_withdrawal_pesewas;
    ALTER TABLE agents DROP COLUMN IF EXISTS custom_daily_limit_pesewas;
    ALTER TABLE agents DROP COLUMN IF EXISTS withdrawals_enabled;
    ALTER TABLE agents DROP COLUMN IF EXISTS allow_anytime_withdrawals;
    DELETE FROM system_configurations WHERE config_key IN (
      'agent_withdrawal_schedule_enabled',
      'agent_withdrawal_allowed_days',
      'agent_withdrawal_start_time',
      'agent_withdrawal_end_time'
    );
  `,
};
