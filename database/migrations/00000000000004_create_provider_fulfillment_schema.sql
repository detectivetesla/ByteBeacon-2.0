-- ==============================================================================
-- Migration: 00000000000004_create_provider_fulfillment_schema.sql
-- Description: GMPL / Telecom Provider Events, Submissions, DLQ & Reconciliation
-- Invariant: GMPL Authoritative, Out-of-Order Stale Event Protection, Idempotent Submissions
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROVIDER EVENTS (Durable Webhook & Event Log with UNIQUE(provider, provider_event_id))
CREATE TABLE IF NOT EXISTS provider_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL DEFAULT 'GMPL',
    provider_event_id VARCHAR(255),
    provider_order_id VARCHAR(255),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL,
    event_version INT NOT NULL DEFAULT 1,
    correlation_id VARCHAR(100) NOT NULL,
    provider_status VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    is_applied BOOLEAN NOT NULL DEFAULT true,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_provider_event UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_events_order ON provider_events(order_id, event_timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_provider_events_provider_order ON provider_events(provider, provider_order_id);
CREATE INDEX IF NOT EXISTS idx_provider_events_correlation ON provider_events(correlation_id);

-- 2. PROVIDER SUBMISSION ATTEMPTS
CREATE TABLE IF NOT EXISTS provider_submission_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'GMPL',
    idempotency_key VARCHAR(255) NOT NULL,
    attempt_number INT NOT NULL DEFAULT 1,
    request_payload JSONB NOT NULL DEFAULT '{}',
    response_payload JSONB,
    status VARCHAR(50) NOT NULL, -- ACCEPTED, REJECTED, TIMEOUT, ERROR
    error_code VARCHAR(100),
    error_message TEXT,
    latency_ms INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_provider_submission_order ON provider_submission_attempts(order_id, attempt_number ASC);
CREATE INDEX IF NOT EXISTS idx_provider_submission_idempotency ON provider_submission_attempts(provider, idempotency_key);

-- 3. PROVIDER DEAD-LETTER QUEUE (DLQ)
CREATE TABLE IF NOT EXISTS provider_dlq (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'GMPL',
    job_id VARCHAR(255) NOT NULL,
    attempt_count INT NOT NULL DEFAULT 1,
    error_code VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    request_reference VARCHAR(255) NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    first_failed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_failed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    failure_class VARCHAR(50) NOT NULL, -- RETRYABLE_EXHAUSTED, PERMANENT_REJECTION, MALFORMED_REQUEST
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_REVIEW', -- PENDING_REVIEW, REPLAYED, DISCARDED
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_provider_dlq_status ON provider_dlq(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_dlq_order ON provider_dlq(order_id);

-- 4. PROVIDER RECONCILIATION RECORDS
CREATE TABLE IF NOT EXISTS provider_reconciliation_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_date DATE NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'GMPL',
    total_orders_checked INT NOT NULL DEFAULT 0,
    matched_count INT NOT NULL DEFAULT 0,
    discrepancy_count INT NOT NULL DEFAULT 0,
    discrepancies JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_provider_rec_date ON provider_reconciliation_records(reconciliation_date, provider);
