-- ==============================================================================
-- Migration: 00000000000003_create_financial_engine_schema.sql
-- Description: Financial Engine, Double-Entry Ledger, Payment Attempts & Events
-- Invariant: Double-Entry Balancing (Debits = Credits), Immutable Ledger, Integer Pesewas
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PAYMENT ATTEMPTS
CREATE TABLE IF NOT EXISTS payment_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    attempt_number INT NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
    provider_channel VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    error_code VARCHAR(100),
    error_message TEXT,
    raw_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_payment ON payment_attempts(payment_id);

-- 2. PAYMENT EVENTS (Durable Webhook Idempotency Guarantee: UNIQUE(provider, provider_event_id))
CREATE TABLE IF NOT EXISTS payment_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'PAYSTACK',
    provider_event_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'WEBHOOK',
    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_payment_provider_event UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_events_payment ON payment_events(payment_id, occurred_at ASC);
CREATE INDEX IF NOT EXISTS idx_payment_events_correlation ON payment_events(correlation_id);

-- 3. REFUND EVENTS
CREATE TABLE IF NOT EXISTS refund_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    refund_id UUID NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refund_events_refund ON refund_events(refund_id, occurred_at ASC);

-- 4. FINANCIAL LEDGER (Double-Entry Authoritative Source of Truth)
CREATE TABLE IF NOT EXISTS financial_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL,
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('CUSTOMER_WALLET', 'AGENT_WALLET', 'PLATFORM_ESCROW', 'PROVIDER_PAYABLE')),
    account_id UUID NOT NULL,
    amount_pesewas BIGINT NOT NULL CHECK (amount_pesewas > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
    reference_type VARCHAR(50) NOT NULL, -- PAYMENT, REFUND, SETTLEMENT, ADJUSTMENT
    reference_id VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_transaction ON financial_ledger(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON financial_ledger(account_type, account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON financial_ledger(reference_type, reference_id);

-- 5. PAYMENT RECONCILIATIONS
CREATE TABLE IF NOT EXISTS payment_reconciliations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_date DATE NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'PAYSTACK',
    total_provider_amount_pesewas BIGINT NOT NULL DEFAULT 0,
    total_internal_amount_pesewas BIGINT NOT NULL DEFAULT 0,
    discrepancy_pesewas BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'MATCHED'
        CHECK (status IN ('MATCHED', 'DISCREPANCY', 'PENDING_INVESTIGATION')),
    unmatched_records JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reconciliations_date_provider ON payment_reconciliations(reconciliation_date, provider);
