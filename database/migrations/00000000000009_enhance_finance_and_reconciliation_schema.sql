-- Migration 09: Enhance Finance, Transactions and Reconciliation Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create reconciliation_cases table for tracking all discrepancies
CREATE TABLE IF NOT EXISTS reconciliation_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number VARCHAR(50) UNIQUE NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    source VARCHAR(50) NOT NULL CHECK (source IN ('PAYSTACK', 'DATAHOUSE', 'LEDGER', 'WALLET', 'ORDERS')),
    account_id VARCHAR(255) NOT NULL,
    account_name VARCHAR(255) NOT NULL DEFAULT '',
    amount_pesewas BIGINT NOT NULL DEFAULT 0,
    expected_state TEXT NOT NULL,
    actual_state TEXT NOT NULL,
    discrepancy_details JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'ESCALATED')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_name VARCHAR(255),
    resolution_notes TEXT,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    escalated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recon_cases_status ON reconciliation_cases(status);
CREATE INDEX IF NOT EXISTS idx_recon_cases_severity ON reconciliation_cases(severity);
CREATE INDEX IF NOT EXISTS idx_recon_cases_source ON reconciliation_cases(source);
CREATE INDEX IF NOT EXISTS idx_recon_cases_account ON reconciliation_cases(account_id);
CREATE INDEX IF NOT EXISTS idx_recon_cases_created ON reconciliation_cases(created_at DESC);

-- 2. Create financial_adjustments table for two-person request/approval workflow
CREATE TABLE IF NOT EXISTS financial_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adjustment_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_pesewas BIGINT NOT NULL CHECK (amount_pesewas > 0),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
    reason TEXT NOT NULL,
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED')),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    ledger_journal_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fin_adjustments_user ON financial_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_fin_adjustments_status ON financial_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_fin_adjustments_created ON financial_adjustments(created_at DESC);

-- 3. Create financial_safety_settings table for platform kill-switches and limits
CREATE TABLE IF NOT EXISTS financial_safety_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    emergency_payments_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    emergency_withdrawals_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    emergency_refunds_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    wallet_operations_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    agent_purchases_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    global_maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
    provider_disabled JSONB NOT NULL DEFAULT '{"datahouse": false, "paystack": false, "gmpl": false}',
    max_single_transaction_pesewas BIGINT NOT NULL DEFAULT 500000,
    max_daily_withdrawal_pesewas BIGINT NOT NULL DEFAULT 2000000,
    max_daily_deposit_pesewas BIGINT NOT NULL DEFAULT 5000000,
    suspicious_velocity_threshold INT NOT NULL DEFAULT 10,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default row if empty
INSERT INTO financial_safety_settings (
    emergency_payments_disabled, emergency_withdrawals_disabled, emergency_refunds_disabled,
    wallet_operations_frozen, agent_purchases_frozen, global_maintenance_mode,
    provider_disabled, max_single_transaction_pesewas, max_daily_withdrawal_pesewas,
    max_daily_deposit_pesewas, suspicious_velocity_threshold
)
SELECT FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
       '{"datahouse": false, "paystack": false, "gmpl": false}'::JSONB,
       500000, 2000000, 5000000, 10
WHERE NOT EXISTS (SELECT 1 FROM financial_safety_settings);

-- 4. Extend refunds table with audit, approval, and risk columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'requested_by') THEN
        ALTER TABLE refunds ADD COLUMN requested_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'approved_by') THEN
        ALTER TABLE refunds ADD COLUMN approved_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'admin_notes') THEN
        ALTER TABLE refunds ADD COLUMN admin_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'ledger_journal_id') THEN
        ALTER TABLE refunds ADD COLUMN ledger_journal_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'risk_level') THEN
        ALTER TABLE refunds ADD COLUMN risk_level VARCHAR(20) NOT NULL DEFAULT 'STANDARD';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'reversal_type') THEN
        ALTER TABLE refunds ADD COLUMN reversal_type VARCHAR(20) NOT NULL DEFAULT 'FULL';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_created ON refunds(created_at DESC);
