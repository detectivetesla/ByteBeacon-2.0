import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { BeneficiaryVerificationJobService } from '../../src/core/commerce/beneficiary-verification-job.service.js';
import { BeneficiaryService } from '../../src/core/commerce/beneficiary.service.js';
import { beneficiaryRoutes } from '../../src/routes/commerce/beneficiary.routes.js';
import { NetworkProvider, UserRole, SecurityDomain } from '@bytebeacon/shared';
import type pg from 'pg';

describe('BeneficiaryVerificationJobService & HTTP Endpoints', () => {
  let mockBeneficiaryService: any;
  let jobService: BeneficiaryVerificationJobService;
  let app: FastifyInstance;

  beforeEach(async () => {
    mockBeneficiaryService = {
      precheckAgentBeneficiaries: vi.fn().mockImplementation(async ({ phoneNumbers }) => {
        return {
          network: NetworkProvider.MTN,
          enforced: true,
          portedCandidates: [],
          results: phoneNumbers.map((phone: string) => {
            const isApproved = phone.endsWith('1') || phone.endsWith('2');
            const isRejected = phone.startsWith('020'); // wrong network
            const isUnapproved = !isApproved && !isRejected;

            return {
              phone,
              phoneNumber: phone,
              normalized: phone,
              valid: !isRejected,
              isValid: !isRejected,
              known: isApproved,
              isKnown: isApproved,
              orderable: isApproved,
              status: isApproved ? 'APPROVED' : isRejected ? 'REJECTED' : 'UNAPPROVED',
              message: isApproved ? 'Approved' : isRejected ? 'Wrong network' : 'New beneficiary',
            };
          }),
        };
      }),
    };

    jobService = new BeneficiaryVerificationJobService(mockBeneficiaryService as BeneficiaryService);

    // Setup Fastify instance with routes
    const mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as pg.Pool;

    const mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'usr_test_1',
        email: 'user@bytebeacon.com',
        role: UserRole.AGENT,
        domain: SecurityDomain.AGENT,
        status: 'ACTIVE',
      }),
    } as any;

    const mockApiKeyService = {
      validateApiKey: vi.fn(),
      verifyApiKey: vi.fn(),
    } as any;

    const mockRbacService = {
      hasPermission: vi.fn().mockReturnValue(true),
    } as any;

    app = Fastify();
    await app.register(beneficiaryRoutes, {
      db: mockDb,
      beneficiaryService: mockBeneficiaryService as BeneficiaryService,
      verificationJobService: jobService,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
    });
  });

  describe('Service Core Lifecycle', () => {
    it('creates and returns initial job state immediately', async () => {
      const numbers = ['0241000001', '0241000002', '0241000003'];
      const job = await jobService.startJob({
        network: 'MTN',
        phoneNumbers: numbers,
        userId: 'usr_1',
      });

      expect(job.jobId).toBeDefined();
      expect(job.status).toBe('PROCESSING');
      expect(job.totalRows).toBe(3);
      expect(job.processedRows).toBe(0);
      expect(job.approvedCount).toBe(0);
      expect(job.unapprovedCount).toBe(0);
      expect(job.rejectedCount).toBe(0);
      expect(job.progressPercent).toBe(0);
    });

    it('processes chunks and aggregates authoritative counts', async () => {
      // 10 numbers: 2 approved (ends in 1, 2), 1 rejected (020), 7 unapproved
      const numbers = [
        '0240000001', // Approved
        '0240000002', // Approved
        '0200000003', // Rejected
        '0240000004',
        '0240000005',
        '0240000006',
        '0240000007',
        '0240000008',
        '0240000009',
        '0240000010',
      ];

      const initial = await jobService.startJob({
        network: 'MTN',
        phoneNumbers: numbers,
      });

      const finalState = await jobService.processJob(initial.jobId, {
        network: 'MTN',
        phoneNumbers: numbers,
      });

      expect(finalState.status).toBe('COMPLETED');
      expect(finalState.totalRows).toBe(10);
      expect(finalState.processedRows).toBe(10);
      expect(finalState.approvedCount).toBe(2);
      expect(finalState.rejectedCount).toBe(1);
      expect(finalState.unapprovedCount).toBe(7);
      expect(finalState.progressPercent).toBe(100);
      expect(finalState.completedAt).toBeDefined();
      expect(finalState.results.length).toBe(10);
    });

    it('supports job cancellation mid-execution', async () => {
      const numbers = Array.from({ length: 300 }, (_, i) => `024${String(i).padStart(7, '0')}`);
      const job = await jobService.startJob({
        network: 'MTN',
        phoneNumbers: numbers,
      });

      // Cancel the job
      const cancelled = await jobService.cancelJob(job.jobId);
      expect(cancelled).toBe(true);

      const state = await jobService.getJob(job.jobId);
      expect(state?.status).toBe('CANCELLED');
      expect(state?.isCancelled).toBe(true);

      // Attempting to run processJob respects cancellation
      const afterProcess = await jobService.processJob(job.jobId, {
        network: 'MTN',
        phoneNumbers: numbers,
      });
      expect(afterProcess.status).toBe('CANCELLED');
    });

    it('handles unexpected batch processing errors gracefully', async () => {
      mockBeneficiaryService.precheckAgentBeneficiaries.mockRejectedValueOnce(
        new Error('Database lock timeout'),
      );

      const job = await jobService.startJob({
        network: 'MTN',
        phoneNumbers: ['0241112233'],
      });

      const failedState = await jobService.processJob(job.jobId, {
        network: 'MTN',
        phoneNumbers: ['0241112233'],
      });

      expect(failedState.status).toBe('FAILED');
      expect(failedState.error).toContain('Database lock timeout');
    });
  });

  describe('HTTP Endpoints', () => {
    it('POST /beneficiaries/verification-jobs returns HTTP 202 with job reference', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/beneficiaries/verification-jobs',
        headers: {
          authorization: 'Bearer valid_agent_token',
        },
        payload: {
          network: 'MTN',
          phoneNumbers: ['0241112233', '0249998877'],
        },
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.jobId).toMatch(/^vjob_/);
      expect(body.data.status).toBe('PROCESSING');
      expect(body.data.totalRows).toBe(2);
    });

    it('GET /beneficiaries/verification-jobs/:jobId returns current job progress', async () => {
      const job = await jobService.startJob({
        network: 'MTN',
        phoneNumbers: ['0241112233'],
      });

      const response = await app.inject({
        method: 'GET',
        url: `/beneficiaries/verification-jobs/${job.jobId}`,
        headers: {
          authorization: 'Bearer valid_agent_token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.jobId).toBe(job.jobId);
      expect(body.data.status).toBeDefined();
    });

    it('GET /beneficiaries/verification-jobs/nonexistent returns 404', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/beneficiaries/verification-jobs/vjob_nonexistent_123',
        headers: {
          authorization: 'Bearer valid_agent_token',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('POST /beneficiaries/verification-jobs/:jobId/cancel cancels the job', async () => {
      const job = await jobService.startJob({
        network: 'MTN',
        phoneNumbers: ['0241112233'],
      });

      const response = await app.inject({
        method: 'POST',
        url: `/beneficiaries/verification-jobs/${job.jobId}/cancel`,
        headers: {
          authorization: 'Bearer valid_agent_token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.cancelled).toBe(true);

      const state = await jobService.getJob(job.jobId);
      expect(state?.status).toBe('CANCELLED');
    });
  });
});
