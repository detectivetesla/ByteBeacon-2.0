import type { JobsOptions, QueueOptions, WorkerOptions } from 'bullmq';

export const QUEUE_NAMES = {
  FULFILLMENT: 'bb:fulfillment',
  RECONCILIATION: 'bb:reconciliation',
  WEBHOOKS: 'bb:webhooks',
  BULK_PROCESSING: 'bb:bulk-processing',
  NOTIFICATIONS: 'bb:notifications',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

export const DEFAULT_RETRY_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 3000, // 3s, 6s, 12s, 24s, 48s
  },
  removeOnComplete: {
    count: 2000,
    age: 86400, // Retain 24 hours
  },
  removeOnFail: {
    count: 10000,
    age: 604800, // Retain 7 days for audit/DLQ
  },
};

export const DEFAULT_QUEUE_OPTIONS: Omit<QueueOptions, 'connection'> = {
  defaultJobOptions: DEFAULT_RETRY_OPTIONS,
};

export const DEFAULT_WORKER_OPTIONS: Omit<WorkerOptions, 'connection'> = {
  concurrency: 10,
  lockDuration: 60000, // 60s
  maxStalledCount: 2,
};
