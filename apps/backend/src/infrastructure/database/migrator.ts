import pg from 'pg';
import { logger } from '../../core/logging/logger.js';

export interface MigrationFile {
  version: string;
  name: string;
  upSql: string;
  downSql?: string;
}

export interface MigrationStatus {
  version: string;
  name: string;
  applied: boolean;
  appliedAt?: Date;
}

export class DatabaseMigrator {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  public async reconcileLegacySchema(): Promise<void> {
    const reconciliationSql = `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      DO $$
      DECLARE
          r RECORD;
      BEGIN
          -- 1. Automatically rename legacy 'uuid' column to 'id' across all existing public tables where 'id' does not exist
          FOR r IN (
              SELECT table_name 
              FROM information_schema.columns 
              WHERE table_schema = 'public' AND column_name = 'uuid'
          ) LOOP
              IF NOT EXISTS (
                  SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' AND table_name = r.table_name AND column_name = 'id'
              ) THEN
                  EXECUTE format('ALTER TABLE %I RENAME COLUMN uuid TO id', r.table_name);
              END IF;
          END LOOP;

          -- 2. Specific legacy column normalization if present
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
              IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'user_id')
                 AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id') THEN
                  ALTER TABLE users RENAME COLUMN user_id TO id;
              END IF;
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
              IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'order_id')
                 AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'id') THEN
                  ALTER TABLE orders RENAME COLUMN order_id TO id;
              END IF;
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agents') THEN
              IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'agent_id')
                 AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'id') THEN
                  ALTER TABLE agents RENAME COLUMN agent_id TO id;
              END IF;
          END IF;
      END $$;
    `;
    try {
      await this.pool.query(reconciliationSql);
      logger.info('[MIGRATOR] Pre-migration legacy schema reconciliation completed.');
    } catch (err) {
      logger.warn({ err }, '[MIGRATOR] Legacy schema reconciliation notice (proceeding to migration)');
    }
  }

  public async ensureMigrationsTable(): Promise<void> {
    await this.reconcileLegacySchema();
    const query = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await this.pool.query(query);
  }

  public async getAppliedMigrations(): Promise<Map<string, Date>> {
    await this.ensureMigrationsTable();
    const result = await this.pool.query<{ version: string; applied_at: Date }>(
      'SELECT version, applied_at FROM schema_migrations ORDER BY version ASC',
    );
    const map = new Map<string, Date>();
    for (const row of result.rows) {
      map.set(row.version, row.applied_at);
    }
    return map;
  }

  public async applyMigration(migration: MigrationFile): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      logger.info(`Applying migration [${migration.version}]: ${migration.name}`);
      await client.query(migration.upSql);
      await client.query(
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
        [migration.version, migration.name],
      );
      await client.query('COMMIT');
      logger.info(`Successfully applied migration [${migration.version}]`);
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ err, version: migration.version }, `Failed to apply migration [${migration.version}]`);
      throw err;
    } finally {
      client.release();
    }
  }

  public async runPendingMigrations(availableMigrations: MigrationFile[]): Promise<string[]> {
    const applied = await this.getAppliedMigrations();
    const appliedVersions: string[] = [];

    for (const migration of availableMigrations) {
      if (!applied.has(migration.version)) {
        await this.applyMigration(migration);
        appliedVersions.push(migration.version);
      }
    }

    return appliedVersions;
  }

  public async rollbackMigration(migration: MigrationFile): Promise<void> {
    if (!migration.downSql) {
      throw new Error(`Migration [${migration.version}] does not provide a rollback script.`);
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      logger.info(`Rolling back migration [${migration.version}]: ${migration.name}`);
      await client.query(migration.downSql);
      await client.query('DELETE FROM schema_migrations WHERE version = $1', [migration.version]);
      await client.query('COMMIT');
      logger.info(`Successfully rolled back migration [${migration.version}]`);
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ err, version: migration.version }, `Failed to rollback migration [${migration.version}]`);
      throw err;
    } finally {
      client.release();
    }
  }

  public async getStatus(availableMigrations: MigrationFile[]): Promise<MigrationStatus[]> {
    const applied = await this.getAppliedMigrations();
    return availableMigrations.map((m) => ({
      version: m.version,
      name: m.name,
      applied: applied.has(m.version),
      appliedAt: applied.get(m.version),
    }));
  }
}
