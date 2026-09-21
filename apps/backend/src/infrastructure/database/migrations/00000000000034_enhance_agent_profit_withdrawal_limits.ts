import { MigrationFile } from '../migrator.js';

export const migration00000000000034: MigrationFile = {
  version: '00000000000034',
  name: 'enhance_agent_profit_withdrawal_limits',
  upSql: `
    -- 1. Extend financial_safety_settings with min and max single withdrawal limits
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_safety_settings' AND column_name = 'min_withdrawal_pesewas') THEN
        ALTER TABLE financial_safety_settings ADD COLUMN min_withdrawal_pesewas BIGINT NOT NULL DEFAULT 1000;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_safety_settings' AND column_name = 'max_single_withdrawal_pesewas') THEN
        ALTER TABLE financial_safety_settings ADD COLUMN max_single_withdrawal_pesewas BIGINT NOT NULL DEFAULT 500000;
    END IF;

    -- 2. Add custom withdrawal limit override to agents table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'custom_withdrawal_limit_pesewas') THEN
        ALTER TABLE agents ADD COLUMN custom_withdrawal_limit_pesewas BIGINT DEFAULT NULL;
    END IF;

    -- 3. Seed / ensure system configurations for agent withdrawal limits
    INSERT INTO system_configurations (
        scope, config_key, category, value, data_type, is_secret, risk_level, requires_step_up, description, version
    )
    VALUES
      ('AGENTS', 'agent_min_withdrawal_pesewas', 'AGENTS', '1000'::jsonb, 'NUMBER', false, 'MEDIUM', false, 'Minimum profit withdrawal amount per request in pesewas (1000 = GH₵10.00)', 1),
      ('AGENTS', 'agent_max_withdrawal_pesewas', 'AGENTS', '500000'::jsonb, 'NUMBER', false, 'HIGH', true, 'Maximum single profit withdrawal limit in pesewas (500000 = GH₵5,000.00)', 1),
      ('PAYMENTS', 'daily_withdrawal_limit_pesewas', 'PAYMENTS', '2000000'::jsonb, 'NUMBER', false, 'HIGH', true, 'Daily aggregated profit withdrawal limit per agent in pesewas (2000000 = GH₵20,000.00)', 1),
      ('PAYMENTS', 'allow_agent_withdrawals', 'PAYMENTS', 'true'::jsonb, 'BOOLEAN', false, 'HIGH', true, 'Global switch to permit or pause agent profit withdrawals platform-wide', 1)
    ON CONFLICT (config_key) DO NOTHING;
  `,
  downSql: `
    ALTER TABLE financial_safety_settings DROP COLUMN IF EXISTS min_withdrawal_pesewas;
    ALTER TABLE financial_safety_settings DROP COLUMN IF EXISTS max_single_withdrawal_pesewas;
    ALTER TABLE agents DROP COLUMN IF EXISTS custom_withdrawal_limit_pesewas;
    DELETE FROM system_configurations WHERE config_key IN ('agent_min_withdrawal_pesewas', 'agent_max_withdrawal_pesewas');
  `,
};
