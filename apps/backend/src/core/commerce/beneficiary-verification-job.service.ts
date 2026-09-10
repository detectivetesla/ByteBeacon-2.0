import type { Redis } from 'ioredis';
import type { Queue } from 'bullmq';
import { NetworkProvider } from '@bytebeacon/shared';
import { QUEUE_NAMES } from '../../infrastructure/queues/queue.config.js';
import { QueueManager } from '../../infrastructure/queues/queue.manager.js';
import { BeneficiaryService } from './beneficiary.service.js';
import { logger } from '../logging/logger.js';
import { randomBytes } from 'crypto';

export type VerificationJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface VerificationJobItemResult {
  phone: string;
  phoneNumber: string;
  normalized: string;
  valid: boolean;
  isValid: boolean;
  known: boolean;
  isKnown: boolean;
  orderable: boolean;
  status: 'APPROVED' | 'UNAPPROVED' | 'REJECTED' | 'PENDING_VERIFICATION' | 'PROVIDER_ERROR';
  message: string;
  accountName?: string;
}

export interface VerificationJobState {
  jobId: string;
  network: NetworkProvider | string;
  status: VerificationJobStatus;
  totalRows: number;
  processedRows: number;
  approvedCount: number;
  unapprovedCount: number;
  rejectedCount: number;
  pendingCount: number;
  progressPercent: number;
  portedCandidates: string[];
  results: VerificationJobItemResult[];
  error?: string;
  isCancelled?: boolean;
  userId?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface StartVerificationJobParams {
  network: NetworkProvider | string;
  phoneNumbers: string[];
  record?: boolean;
  userId?: string;
  idempotencyKey?: string;
}

export class BeneficiaryVerificationJobService {
  private readonly beneficiaryService: BeneficiaryService;
  private readonly redis: Redis | null;
  private readonly queueManager: QueueManager | null;
  private readonly bullQueue: Queue | null = null;
  private readonly inMemoryJobs = new Map<string, VerificationJobState>();
  private readonly inMemoryIdempotency = new Map<string, { jobId: string; expiresAt: number }>();

  public static readonly CHUNK_SIZE = 500;
  public static readonly STATE_TTL_SECONDS = 3600; // 1 hour retention
  private static readonly REDIS_PREFIX = 'bb:beneficiary:job:';
  private static readonly IDEMP_PREFIX = 'bb:beneficiary:idemp:';

  constructor(
    beneficiaryService: BeneficiaryService,
    redis: Redis | null = null,
    queueManager: QueueManager | null = null,
  ) {
    this.beneficiaryService = beneficiaryService;
    this.redis = redis;
    this.queueManager = queueManager;

    if (this.queueManager && this.queueManager.hasRedis()) {
      this.bullQueue = this.queueManager.getQueue(QUEUE_NAMES.BENEFICIARY_VERIFICATION);
    }
  }

  private getRedisKey(jobId: string): string {
    return `${BeneficiaryVerificationJobService.REDIS_PREFIX}${jobId}`;
  }

  /**
   * Persists job state to Redis (if ready) and in-memory map.
   */
  private async saveJobState(state: VerificationJobState): Promise<void> {
    state.updatedAt = new Date().toISOString();
    this.inMemoryJobs.set(state.jobId, state);

    if (this.redis && this.redis.status === 'ready') {
      try {
        const key = this.getRedisKey(state.jobId);
        await this.redis.setex(
          key,
          BeneficiaryVerificationJobService.STATE_TTL_SECONDS,
          JSON.stringify(state),
        );
      } catch (err: any) {
        logger.warn({ jobId: state.jobId, err: err?.message }, '[BeneficiaryJob] Redis save state failed, memory retained');
      }
    }
  }

  /**
   * Retrieves job state by jobId from in-memory map or Redis.
   */
  public async getJob(jobId: string): Promise<VerificationJobState | null> {
    if (this.inMemoryJobs.has(jobId)) {
      return this.inMemoryJobs.get(jobId)!;
    }

    if (this.redis && this.redis.status === 'ready') {
      try {
        const raw = await this.redis.get(this.getRedisKey(jobId));
        if (raw) {
          const parsed = JSON.parse(raw) as VerificationJobState;
          this.inMemoryJobs.set(jobId, parsed);
          return parsed;
        }
      } catch (err: any) {
        logger.warn({ jobId, err: err?.message }, '[BeneficiaryJob] Redis get state failed');
      }
    }

    return null;
  }

  /**
   * Starts an asynchronous beneficiary verification job.
   * Immediately returns HTTP 202-ready job status while processing chunks in the background.
   * Supports idempotency: identical idempotencyKey within 10 minutes returns the existing active/completed job.
   */
  public async startJob(params: StartVerificationJobParams): Promise<VerificationJobState> {
    const { network, phoneNumbers, record = false, userId, idempotencyKey } = params;

    // Idempotency check: if identical verification payload was submitted recently, return existing job
    if (idempotencyKey) {
      const now = Date.now();
      let existingJobId: string | null = null;

      if (this.redis && this.redis.status === 'ready') {
        try {
          existingJobId = await this.redis.get(`${BeneficiaryVerificationJobService.IDEMP_PREFIX}${idempotencyKey}`);
        } catch {
          // ignore redis error
        }
      }

      if (!existingJobId) {
        const mem = this.inMemoryIdempotency.get(idempotencyKey);
        if (mem && mem.expiresAt > now) {
          existingJobId = mem.jobId;
        }
      }

      if (existingJobId) {
        const existingState = await this.getJob(existingJobId);
        if (existingState && existingState.status !== 'FAILED') {
          logger.info({ jobId: existingJobId, idempotencyKey }, '[BeneficiaryJob] Returning existing idempotent verification job');
          return existingState;
        }
      }
    }

    const jobId = `vjob_${Date.now()}_${randomBytes(4).toString('hex')}`;
    const nowStr = new Date().toISOString();

    const initialState: VerificationJobState = {
      jobId,
      network,
      status: 'PROCESSING',
      totalRows: phoneNumbers.length,
      processedRows: 0,
      approvedCount: 0,
      unapprovedCount: 0,
      rejectedCount: 0,
      pendingCount: 0,
      progressPercent: 0,
      portedCandidates: [],
      results: [],
      userId,
      idempotencyKey,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    await this.saveJobState(initialState);

    // Record idempotency mapping (10 minutes retention)
    if (idempotencyKey) {
      this.inMemoryIdempotency.set(idempotencyKey, {
        jobId,
        expiresAt: Date.now() + 600 * 1000,
      });

      if (this.redis && this.redis.status === 'ready') {
        try {
          await this.redis.setex(
            `${BeneficiaryVerificationJobService.IDEMP_PREFIX}${idempotencyKey}`,
            600,
            jobId,
          );
        } catch {
          // ignore
        }
      }
    }

    // If BullMQ is configured, push to BullMQ queue
    if (this.bullQueue) {
      try {
        await this.bullQueue.add(
          'verify_batch',
          { jobId, network, phoneNumbers, record, userId, idempotencyKey },
          { jobId },
        );
        logger.info({ jobId, totalRows: phoneNumbers.length }, '[BeneficiaryJob] Enqueued job in BullMQ');
        return initialState;
      } catch (err: any) {
        logger.warn({ jobId, err: err?.message }, '[BeneficiaryJob] BullMQ enqueue failed; falling back to in-process runner');
      }
    }

    // In-process async background runner fallback
    setImmediate(async () => {
      await this.processJob(jobId, { network, phoneNumbers, record, userId, idempotencyKey });
    });

    return initialState;
  }

  /**
   * Cancels an ongoing verification job.
   */
  public async cancelJob(jobId: string): Promise<boolean> {
    const state = await this.getJob(jobId);
    if (!state) return false;

    if (state.status === 'COMPLETED' || state.status === 'FAILED') {
      return false;
    }

    state.isCancelled = true;
    state.status = 'CANCELLED';
    await this.saveJobState(state);
    logger.info({ jobId }, '[BeneficiaryJob] Verification job marked as CANCELLED');
    return true;
  }

  /**
   * Executes verification chunks with progress persistence, pending state tracking, and resumability.
   */
  public async processJob(
    jobId: string,
    params: {
      network: NetworkProvider | string;
      phoneNumbers: string[];
      record?: boolean;
      userId?: string;
      idempotencyKey?: string;
    },
  ): Promise<VerificationJobState> {
    const state = (await this.getJob(jobId)) || {
      jobId,
      network: params.network,
      status: 'PROCESSING' as VerificationJobStatus,
      totalRows: params.phoneNumbers.length,
      processedRows: 0,
      approvedCount: 0,
      unapprovedCount: 0,
      rejectedCount: 0,
      pendingCount: 0,
      progressPercent: 0,
      portedCandidates: [],
      results: [],
      userId: params.userId,
      idempotencyKey: params.idempotencyKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const chunkSize = BeneficiaryVerificationJobService.CHUNK_SIZE;
    const phoneNumbers = params.phoneNumbers;
    const total = phoneNumbers.length;

    // Resumability: if the job already processed some rows before interruption, resume from next chunk
    const startIdx = state.processedRows > 0 && state.processedRows < total ? state.processedRows : 0;

    try {
      for (let i = startIdx; i < total; i += chunkSize) {
        // Check for cancellation before processing each chunk
        const currentState = await this.getJob(jobId);
        if (currentState?.isCancelled || currentState?.status === 'CANCELLED') {
          logger.info({ jobId, chunkStart: i }, '[BeneficiaryJob] Job was cancelled; stopping chunk execution');
          state.status = 'CANCELLED';
          await this.saveJobState(state);
          return state;
        }

        const chunk = phoneNumbers.slice(i, i + chunkSize);

        // Run precheck on chunk
        const precheckRes = await this.beneficiaryService.precheckAgentBeneficiaries({
          network: params.network,
          phoneNumbers: chunk,
          record: Boolean(params.record),
          userId: params.userId,
          bypassCache: true,
        });

        if (precheckRes.portedCandidates && Array.isArray(precheckRes.portedCandidates)) {
          const merged = new Set([...state.portedCandidates, ...precheckRes.portedCandidates]);
          state.portedCandidates = Array.from(merged);
        }

        if (Array.isArray(precheckRes.results)) {
          for (const item of precheckRes.results) {
            const isApproved = item.status === 'APPROVED';
            const isUnapproved = item.status === 'UNAPPROVED';
            const isRejected = item.status === 'REJECTED';
            const isPending = item.status === 'PENDING_VERIFICATION' || item.status === 'PROVIDER_ERROR';

            if (isApproved) state.approvedCount++;
            else if (isUnapproved) state.unapprovedCount++;
            else if (isRejected) state.rejectedCount++;
            else if (isPending) state.pendingCount = (state.pendingCount || 0) + 1;
            else state.pendingCount = (state.pendingCount || 0) + 1; // Unknown status → pending, not unapproved

            state.results.push({
              phone: item.phone,
              phoneNumber: item.phoneNumber,
              normalized: item.normalized,
              valid: item.valid,
              isValid: item.isValid,
              known: item.known,
              isKnown: item.isKnown,
              orderable: item.orderable,
              status: item.status as any,
              message: item.message,
              accountName: (item as any).accountName,
            });
          }
        }

        state.processedRows += chunk.length;
        state.progressPercent = total > 0 ? Math.min(100, Math.round((state.processedRows / total) * 100)) : 100;

        await this.saveJobState(state);
      }

      state.status = 'COMPLETED';
      state.completedAt = new Date().toISOString();
      state.progressPercent = 100;
      await this.saveJobState(state);

      logger.info(
        {
          jobId,
          totalRows: state.totalRows,
          approved: state.approvedCount,
          unapproved: state.unapprovedCount,
          rejected: state.rejectedCount,
          pending: state.pendingCount,
        },
        '[BeneficiaryJob] Verification job completed successfully',
      );
    } catch (err: any) {
      state.status = 'FAILED';
      state.error = err?.message || 'Verification job failed';
      state.completedAt = new Date().toISOString();
      await this.saveJobState(state);
      logger.error({ jobId, err: err?.message }, '[BeneficiaryJob] Verification job failed');
    }

    return state;
  }

  /**
   * Attaches a BullMQ worker processor to process verification jobs from BullMQ.
   */
  public attachBullWorker(queueManager: QueueManager) {
    return queueManager.registerWorker(
      QUEUE_NAMES.BENEFICIARY_VERIFICATION,
      async (job) => {
        const result = await this.processJob(job.data.jobId, job.data);
        if (result.status === 'FAILED') {
          throw new Error(result.error || 'Verification job execution failed');
        }
        return result;
      },
      { concurrency: 5 },
    );
  }
}
