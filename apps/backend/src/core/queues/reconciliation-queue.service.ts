import type pg from 'pg';
import type { Queue } from 'bullmq';
import { ReconciliationJobData } from './queue.types.js';
import { QUEUE_NAMES } from '../../infrastructure/queues/queue.config.js';
import { QueueManager } from '../../infrastructure/queues/queue.manager.js';
import { ProviderReconciliationService } from '../providers/provider-reconciliation.service.js';
import { logger } from '../logging/logger.js';

export class ReconciliationQueueService {
  private readonly _db: pg.Pool;
  private readonly reconciliationService: ProviderReconciliationService;
  private readonly queueManager: QueueManager | null;
  private readonly bullQueue: Queue<ReconciliationJobData> | null = null;

  constructor(
    db: pg.Pool,
    reconciliationService: ProviderReconciliationService,
    queueManager: QueueManager | null = null,
  ) {
    this._db = db;
    this.reconciliationService = reconciliationService;
    this.queueManager = queueManager;

    if (this.queueManager && this.queueManager.hasRedis()) {
      this.bullQueue = this.queueManager.getQueue<ReconciliationJobData>(QUEUE_NAMES.RECONCILIATION);
    }
  }

  public getDb(): pg.Pool {
    return this._db;
  }

  /**
   * Schedules or triggers a reconciliation job.
   */
  public async triggerReconciliation(params: {
    trigger: 'SCHEDULED' | 'EVENT_DRIVEN';
    lookbackMinutes?: number;
    correlationId: string;
  }): Promise<{ jobId: string; trigger: string }> {
    const jobId = `recon_${Date.now()}_${params.trigger.toLowerCase()}`;
    const jobData: ReconciliationJobData = {
      trigger: params.trigger,
      lookbackMinutes: params.lookbackMinutes || 60,
      correlationId: params.correlationId,
    };

    if (this.bullQueue) {
      await this.bullQueue.add('reconcile_orders', jobData, {
        jobId,
        removeOnComplete: true,
      });
    }

    logger.info(
      { jobId, trigger: params.trigger, correlationId: params.correlationId },
      '[ReconciliationQueue] Reconciliation job enqueued',
    );

    return { jobId, trigger: params.trigger };
  }

  /**
   * Executes the reconciliation process directly.
   */
  public async executeReconciliation(jobData: ReconciliationJobData) {
    logger.info(
      { trigger: jobData.trigger, correlationId: jobData.correlationId },
      '[ReconciliationQueue] Executing DataHouse reconciliation cycle...',
    );

    const report = await this.reconciliationService.reconcilePendingOrders({
      batchSize: 100,
      olderThanMinutes: 2,
    });

    logger.info(
      {
        totalReconciled: report.totalReconciled,
        completed: report.completedCount,
        failed: report.failedCount,
        unmatched: report.unmatchedCount,
      },
      '[ReconciliationQueue] DataHouse reconciliation cycle completed',
    );

    return report;
  }

  /**
   * Attaches BullMQ worker processor to reconciliation queue.
   */
  public attachBullWorker(queueManager: QueueManager) {
    return queueManager.registerWorker(
      QUEUE_NAMES.RECONCILIATION,
      async (job) => {
        return this.executeReconciliation(job.data);
      },
      { concurrency: 1 },
    );
  }
}
