-- Migration: 00000000000038 - reconcile_bulk_submissions_schema
-- Ensures bulk_submissions and bulk_submission_items have all required columns

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create bulk_submissions if it does not exist
CREATE TABLE IF NOT EXISTS bulk_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL DEFAULT 'Bulk Order',
    total_count INT NOT NULL DEFAULT 0,
    processed_count INT NOT NULL DEFAULT 0,
    success_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    total_amount_pesewas BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    idempotency_key VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Rename legacy columns if present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bulk_submissions' AND column_name = 'title')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bulk_submissions' AND column_name = 'name') THEN
        ALTER TABLE bulk_submissions RENAME COLUMN title TO name;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bulk_submissions' AND column_name = 'batch_name')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bulk_submissions' AND column_name = 'name') THEN
        ALTER TABLE bulk_submissions RENAME COLUMN batch_name TO name;
    END IF;
END $$;

-- 3. Add all required columns to bulk_submissions
ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT 'Bulk Order';
ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS total_count INT NOT NULL DEFAULT 0;
ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS processed_count INT NOT NULL DEFAULT 0;
ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS success_count INT NOT NULL DEFAULT 0;
ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS failed_count INT NOT NULL DEFAULT 0;
ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS total_amount_pesewas BIGINT NOT NULL DEFAULT 0;
ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'PENDING';
ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE bulk_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 4. Create bulk_submission_items if it does not exist
CREATE TABLE IF NOT EXISTS bulk_submission_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES bulk_submissions(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    recipient_phone VARCHAR(30) NOT NULL DEFAULT '',
    product_id UUID REFERENCES catalog_products(id) ON DELETE SET NULL,
    amount_pesewas BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Add all required columns to bulk_submission_items
ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS submission_id UUID;
ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(30) NOT NULL DEFAULT '';
ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES catalog_products(id) ON DELETE SET NULL;
ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS amount_pesewas BIGINT NOT NULL DEFAULT 0;
ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'CREATED';
ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE bulk_submission_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 6. Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_bulk_submissions_user ON bulk_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_bulk_items_submission ON bulk_submission_items(submission_id);

COMMIT;
