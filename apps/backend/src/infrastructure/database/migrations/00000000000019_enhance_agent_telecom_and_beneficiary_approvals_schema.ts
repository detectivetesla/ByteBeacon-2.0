import { MigrationFile } from '../migrator.js';

export const migration00000000000019: MigrationFile = {
  version: '00000000000019',
  name: 'enhance_agent_telecom_and_beneficiary_approvals_schema',
  upSql: `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    DO $$
    BEGIN
        -- 1. Enhance users table with phone_number alias column for agent API queries
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
            ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone') THEN
                UPDATE users SET phone_number = phone WHERE phone_number IS NULL AND phone IS NOT NULL;
            END IF;
        END IF;

        -- 2. Enhance agent_webhooks with plaintext signing_secret storage for HMAC-SHA256 signature verification
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_webhooks') THEN
            ALTER TABLE agent_webhooks ADD COLUMN IF NOT EXISTS signing_secret TEXT;
        END IF;

        -- 3. Enhance beneficiary_validation with tracking attributes
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'beneficiary_validation') THEN
            ALTER TABLE beneficiary_validation ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 1;
            ALTER TABLE beneficiary_validation ADD COLUMN IF NOT EXISTS last_bundle_size_gb NUMERIC(10, 2);
            ALTER TABLE beneficiary_validation ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES users(id) ON DELETE SET NULL;
            ALTER TABLE beneficiary_validation ADD COLUMN IF NOT EXISTS first_detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE beneficiary_validation ADD COLUMN IF NOT EXISTS last_detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE beneficiary_validation ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
        END IF;

        -- 4. Enhance orders with channel and is_sandbox flags
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'web';
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT FALSE;
            -- Relax strict foreign key constraint on agent_id to allow both agent UUID and user UUID
            ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_agent_id_fkey;
        END IF;

        -- 5. Enhance financial_ledger: set default transaction_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_ledger' AND column_name = 'transaction_id') THEN
            ALTER TABLE financial_ledger ALTER COLUMN transaction_id SET DEFAULT uuid_generate_v4();
        END IF;

        -- 6. Enhance bulk_submission_items: allow NULL product_id for linear per-GB batches without catalog match
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bulk_submission_items' AND column_name = 'product_id') THEN
            ALTER TABLE bulk_submission_items ALTER COLUMN product_id DROP NOT NULL;
        END IF;
    END $$;

    -- 7. Create pending_beneficiary_approvals table for MTN Up2U first-time approval tracking
    CREATE TABLE IF NOT EXISTS pending_beneficiary_approvals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        phone_number VARCHAR(30) NOT NULL,
        network VARCHAR(30) NOT NULL DEFAULT 'MTN'
            CHECK (network IN ('MTN', 'TELECEL', 'AIRTELTIGO')),
        agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
            CHECK (status IN ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED')),
        attempt_count INT NOT NULL DEFAULT 1,
        last_bundle_size_gb NUMERIC(10, 2),
        first_detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        submitted_at TIMESTAMPTZ,
        resolved_at TIMESTAMPTZ,
        rejection_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_pending_beneficiary_agent_phone_net UNIQUE (agent_id, phone_number, network)
    );

    CREATE INDEX IF NOT EXISTS idx_pending_ben_agent ON pending_beneficiary_approvals(agent_id);
    CREATE INDEX IF NOT EXISTS idx_pending_ben_phone_net ON pending_beneficiary_approvals(phone_number, network);
    CREATE INDEX IF NOT EXISTS idx_pending_ben_status ON pending_beneficiary_approvals(status);
    CREATE INDEX IF NOT EXISTS idx_pending_ben_created ON pending_beneficiary_approvals(created_at DESC);

    -- 8. Create compatibility view beneficiary_approvals
    CREATE OR REPLACE VIEW beneficiary_approvals AS
    SELECT
        id,
        agent_id AS user_id,
        phone_number,
        network,
        status,
        attempt_count,
        last_bundle_size_gb,
        first_detected_at,
        last_detected_at,
        submitted_at,
        resolved_at,
        rejection_reason,
        created_at,
        updated_at
    FROM pending_beneficiary_approvals;

    -- Trigger to support transparent INSERT into beneficiary_approvals view
    CREATE OR REPLACE FUNCTION fn_beneficiary_approvals_insert()
    RETURNS TRIGGER AS $$
    BEGIN
        INSERT INTO pending_beneficiary_approvals (
            id,
            phone_number,
            network,
            agent_id,
            status,
            attempt_count,
            last_bundle_size_gb,
            created_at,
            updated_at
        ) VALUES (
            COALESCE(NEW.id, uuid_generate_v4()),
            NEW.phone_number,
            COALESCE(NEW.network, 'MTN'),
            COALESCE(NEW.user_id, uuid_generate_v4()),
            COALESCE(NEW.status, 'PENDING'),
            COALESCE(NEW.attempt_count, 1),
            NEW.last_bundle_size_gb,
            COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
            COALESCE(NEW.updated_at, CURRENT_TIMESTAMP)
        )
        ON CONFLICT (agent_id, phone_number, network) DO UPDATE
        SET attempt_count = pending_beneficiary_approvals.attempt_count + 1,
            last_bundle_size_gb = COALESCE(EXCLUDED.last_bundle_size_gb, pending_beneficiary_approvals.last_bundle_size_gb),
            updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_beneficiary_approvals_insert ON beneficiary_approvals;
    CREATE TRIGGER trg_beneficiary_approvals_insert
    INSTEAD OF INSERT ON beneficiary_approvals
    FOR EACH ROW EXECUTE FUNCTION fn_beneficiary_approvals_insert();

    -- 9. Create compatibility view financial_ledger_entries
    CREATE OR REPLACE VIEW financial_ledger_entries AS
    SELECT
        id,
        transaction_id,
        entry_type,
        account_type,
        account_id,
        amount_pesewas,
        currency,
        reference_type,
        reference_id,
        description,
        created_at
    FROM financial_ledger;

    -- Trigger to support transparent INSERT into financial_ledger_entries view
    CREATE OR REPLACE FUNCTION fn_financial_ledger_entries_insert()
    RETURNS TRIGGER AS $$
    BEGIN
        INSERT INTO financial_ledger (
            id,
            transaction_id,
            entry_type,
            account_type,
            account_id,
            amount_pesewas,
            currency,
            reference_type,
            reference_id,
            description,
            created_at
        ) VALUES (
            COALESCE(NEW.id, uuid_generate_v4()),
            COALESCE(NEW.transaction_id, uuid_generate_v4()),
            NEW.entry_type,
            NEW.account_type,
            NEW.account_id,
            NEW.amount_pesewas,
            COALESCE(NEW.currency, 'GHS'),
            NEW.reference_type,
            NEW.reference_id,
            NEW.description,
            COALESCE(NEW.created_at, CURRENT_TIMESTAMP)
        );
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_financial_ledger_entries_insert ON financial_ledger_entries;
    CREATE TRIGGER trg_financial_ledger_entries_insert
    INSTEAD OF INSERT ON financial_ledger_entries
    FOR EACH ROW EXECUTE FUNCTION fn_financial_ledger_entries_insert();

    -- 10. Performance Indexes for Orders & Beneficiaries
    CREATE INDEX IF NOT EXISTS idx_orders_agent_id ON orders(agent_id);
    CREATE INDEX IF NOT EXISTS idx_orders_agent_created ON orders(agent_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_beneficiary_validation_agent ON beneficiary_validation(agent_id);
  `,
  downSql: `
    DROP TRIGGER IF EXISTS trg_financial_ledger_entries_insert ON financial_ledger_entries;
    DROP FUNCTION IF EXISTS fn_financial_ledger_entries_insert();
    DROP VIEW IF EXISTS financial_ledger_entries;

    DROP TRIGGER IF EXISTS trg_beneficiary_approvals_insert ON beneficiary_approvals;
    DROP FUNCTION IF EXISTS fn_beneficiary_approvals_insert();
    DROP VIEW IF EXISTS beneficiary_approvals;

    DROP TABLE IF EXISTS pending_beneficiary_approvals CASCADE;

    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_webhooks') THEN
            ALTER TABLE agent_webhooks DROP COLUMN IF EXISTS signing_secret;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'beneficiary_validation') THEN
            ALTER TABLE beneficiary_validation DROP COLUMN IF EXISTS attempt_count;
            ALTER TABLE beneficiary_validation DROP COLUMN IF EXISTS last_bundle_size_gb;
            ALTER TABLE beneficiary_validation DROP COLUMN IF EXISTS agent_id;
            ALTER TABLE beneficiary_validation DROP COLUMN IF EXISTS first_detected_at;
            ALTER TABLE beneficiary_validation DROP COLUMN IF EXISTS last_detected_at;
            ALTER TABLE beneficiary_validation DROP COLUMN IF EXISTS submitted_at;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
            ALTER TABLE orders DROP COLUMN IF EXISTS channel;
            ALTER TABLE orders DROP COLUMN IF EXISTS is_sandbox;
        END IF;
    END $$;
  `,
};
