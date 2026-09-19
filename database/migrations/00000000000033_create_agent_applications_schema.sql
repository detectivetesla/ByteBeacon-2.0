-- ==============================================================================
-- Migration: 00000000000033_create_agent_applications_schema.sql
-- Description: Agent Applications, Verification Workflow, and Dynamic Pricing
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS agent_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    location_region VARCHAR(100),
    experience_description TEXT,
    fee_pesewas BIGINT NOT NULL DEFAULT 10000,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PAYMENT_PENDING'
        CHECK (payment_status IN ('NOT_STARTED', 'PAYMENT_PENDING', 'PAID', 'PAYMENT_FAILED')),
    paystack_reference VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL'
        CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    admin_notes TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_applications_user_id ON agent_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_applications_status ON agent_applications(status);
CREATE INDEX IF NOT EXISTS idx_agent_applications_payment ON agent_applications(payment_status);
CREATE INDEX IF NOT EXISTS idx_agent_applications_created ON agent_applications(created_at DESC);

-- Seed default agent application fee (100 Cedis = 10000 pesewas) in system_configurations
INSERT INTO system_configurations (
    scope, config_key, category, value, data_type, is_secret, risk_level, requires_step_up, description, version
)
VALUES (
    'AGENTS', 'agent_application_fee_pesewas', 'AGENTS', '10000'::jsonb, 'NUMBER', false, 'HIGH', true, 'One-time agent application and onboarding fee in pesewas (10000 = GH₵100.00)', 1
)
ON CONFLICT (config_key) DO NOTHING;
