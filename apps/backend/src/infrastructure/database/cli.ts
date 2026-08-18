import { getDatabasePool, closeDatabasePool } from './pool.js';
import { DatabaseMigrator } from './migrator.js';
import { migration00000000000000 } from './migrations/00000000000000_init_system_metadata.js';
import { migration00000000000001 } from './migrations/00000000000001_create_security_auth_schema.js';
import { migration00000000000002 } from './migrations/00000000000002_create_core_commerce_schema.js';
import { migration00000000000003 } from './migrations/00000000000003_create_financial_engine_schema.js';
import { migration00000000000004 } from './migrations/00000000000004_create_provider_fulfillment_schema.js';
import { migration00000000000005 } from './migrations/00000000000005_create_agent_stores_schema.js';
import { migration00000000000006 } from './migrations/00000000000006_create_production_indexes.js';
import { logger } from '../../core/logging/logger.js';

const allMigrations = [
  migration00000000000000,
  migration00000000000001,
  migration00000000000002,
  migration00000000000003,
  migration00000000000004,
  migration00000000000005,
  migration00000000000006,
];

async function main() {
  const pool = getDatabasePool();
  const migrator = new DatabaseMigrator(pool);

  try {
    const command = process.argv[2] || 'up';

    if (command === 'status') {
      const statuses = await migrator.getStatus(allMigrations);
      logger.info({ statuses }, 'Migration status:');
    } else if (command === 'up') {
      const applied = await migrator.runPendingMigrations(allMigrations);
      logger.info({ count: applied.length, applied }, 'Applied migrations successfully.');
    } else {
      logger.error(`Unknown migration command: ${command}`);
      process.exit(1);
    }
  } catch (error) {
    logger.error({ error }, 'Migration CLI failed');
    process.exit(1);
  } finally {
    await closeDatabasePool();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
