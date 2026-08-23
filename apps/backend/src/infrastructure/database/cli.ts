import { getDatabasePool, closeDatabasePool } from './pool.js';
import { DatabaseMigrator } from './migrator.js';
import { allMigrations } from './migrations.registry.js';
import { logger } from '../../core/logging/logger.js';

export { allMigrations };

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
