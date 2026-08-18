import { MigrationFile } from '../migrator.js';

export const migration00000000000006: MigrationFile = {
  version: '00000000000006',
  name: 'create_production_indexes',
  upSql: `
    -- Production Index Optimization for High-Throughput Seeking & Keyset Pagination

    -- 1. Orders: Compound index for keyset pagination and agent lookups
    CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders (user_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (order_status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders (recipient_phone);

    -- 2. Financial Ledger: High-performance account seeks and keyset pagination
    CREATE INDEX IF NOT EXISTS idx_ledger_account_created ON financial_ledger (account_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_ledger_transaction ON financial_ledger (transaction_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_reference ON financial_ledger (reference_type, reference_id);

    -- 3. Provider Orders: Deduplication and provider reference seek
    CREATE INDEX IF NOT EXISTS idx_provider_orders_ref ON provider_orders (provider_reference);
    CREATE INDEX IF NOT EXISTS idx_provider_orders_status ON provider_orders (provider_status, created_at DESC);

    -- 4. Payments: Provider reference and event deduplication
    CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments (provider_reference);
    CREATE INDEX IF NOT EXISTS idx_payment_events_provider_event ON payment_events (provider, provider_event_id);
  `,
  downSql: `
    DROP INDEX IF EXISTS idx_orders_user_created;
    DROP INDEX IF EXISTS idx_orders_status_created;
    DROP INDEX IF EXISTS idx_orders_phone;
    DROP INDEX IF EXISTS idx_ledger_account_created;
    DROP INDEX IF EXISTS idx_ledger_transaction;
    DROP INDEX IF EXISTS idx_ledger_reference;
    DROP INDEX IF EXISTS idx_provider_orders_ref;
    DROP INDEX IF EXISTS idx_provider_orders_status;
    DROP INDEX IF EXISTS idx_payments_reference;
    DROP INDEX IF EXISTS idx_payment_events_provider_event;
  `,
};
