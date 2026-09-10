import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import type pg from 'pg';
import { BeneficiaryService } from '../../core/commerce/beneficiary.service.js';
import { BeneficiaryVerificationJobService } from '../../core/commerce/beneficiary-verification-job.service.js';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { BadRequestError, NotFoundError } from '../../core/errors/app-error.js';
import { RateLimiterService } from '../../core/security/rate-limiter.service.js';
import { createRateLimitHook } from '../../plugins/rate-limit.plugin.js';
import {
  ValidateBeneficiaryRequest,
  BeneficiaryValidationDto,
  ApiResponse,
  NetworkProvider,
  Permission,
} from '@bytebeacon/shared';

export interface BeneficiaryRouteDependencies {
  db: pg.Pool;
  beneficiaryService: BeneficiaryService;
  verificationJobService?: BeneficiaryVerificationJobService;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  rateLimiter?: RateLimiterService;
}

export async function beneficiaryRoutes(
  app: FastifyInstance,
  deps: BeneficiaryRouteDependencies,
) {
  const { db, beneficiaryService, tokenService, apiKeyService, rbacService, rateLimiter } = deps;
  const verificationJobService =
    deps.verificationJobService || new BeneficiaryVerificationJobService(beneficiaryService);
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);
  const publicPrecheckRateLimit = rateLimiter
    ? createRateLimitHook(rateLimiter, { limit: 30, windowSeconds: 60 })
    : undefined;

  // 1. VALIDATE BENEFICIARY
  app.post<{ Body: ValidateBeneficiaryRequest }>(
    '/beneficiaries/validate',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest<{ Body: ValidateBeneficiaryRequest }>, reply: FastifyReply) => {
      const { phoneNumber, network } = req.body || {};

      if (!phoneNumber || !network) {
        throw new BadRequestError('Phone number and network are required');
      }

      const result = await beneficiaryService.validatePhoneNumber(phoneNumber, network);

      const response: ApiResponse<BeneficiaryValidationDto> = {
        success: true,
        data: result,
      };

      return reply.send(response);
    },
  );

  // 2. GET BENEFICIARY STATUS
  app.get<{ Params: { phone: string }; Querystring: { network?: string } }>(
    '/beneficiaries/:phone',
    { preHandler: [authHooks.authenticateCustomer] },
    async (
      req: FastifyRequest<{ Params: { phone: string }; Querystring: { network?: string } }>,
      reply: FastifyReply,
    ) => {
      const network = req.query.network as NetworkProvider | undefined;
      const status = await beneficiaryService.getBeneficiaryStatus(req.params.phone, network);

      const response: ApiResponse<BeneficiaryValidationDto | null> = {
        success: true,
        data: status,
      };

      return reply.send(response);
    },
  );

  // 1. PUBLIC PRECHECK: POST /orders/beneficiaries/precheck
  const handlePublicPrecheck = async (
    req: FastifyRequest<{
      Body: {
        network: NetworkProvider | string;
        phoneNumbers: string[];
        record?: boolean;
      };
    }>,
    reply: FastifyReply,
  ) => {
    const { network, phoneNumbers, record = true } = req.body || {};

    if (!network) {
      throw new BadRequestError('network is required (e.g. MTN, TELECEL)');
    }
    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      throw new BadRequestError('phoneNumbers array is required and cannot be empty');
    }
    if (phoneNumbers.length > 10) {
      throw new BadRequestError('Up to 10 phone numbers allowed per public precheck call');
    }
    for (const phone of phoneNumbers) {
      if (typeof phone !== 'string' || phone.length > 20) {
        throw new BadRequestError('Each phone number must be a string of at most 20 characters');
      }
    }

    let authenticatedUserId: string | undefined = (req.user as any)?.sub;
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'];

    if (!authenticatedUserId) {
      if (authHeader?.startsWith('Bearer ') && !authHeader.startsWith('Bearer ak_')) {
        try {
          const payload = tokenService.verifyAccessToken(authHeader.substring(7).trim());
          authenticatedUserId = payload.sub;
        } catch {
          // fallback
        }
      } else if (apiKeyHeader || authHeader?.startsWith('Bearer ak_')) {
        try {
          const rawKey = (apiKeyHeader as string) || authHeader!.substring(7).trim();
          const key = await apiKeyService.validateApiKey(rawKey);
          authenticatedUserId = key.agentId;
        } catch {
          // fallback
        }
      }
    }

    const result = await beneficiaryService.precheckPublicBeneficiaries({
      network: network as NetworkProvider,
      phoneNumbers,
      record: record !== false,
      userId: authenticatedUserId,
    });

    const isEnforced = result.enforced !== false;

    return reply.status(200).send({
      success: true,
      statusCode: 200,
      message: 'Success',
      data: {
        network: result.network,
        enforced: isEnforced,
        portedCandidates: result.portedCandidates || [],
        summary: result.summary,
        results: result.results.map((r) => ({
          phone: r.phone,
          normalized: r.normalized,
          valid: r.valid,
          known: r.known,
        })),
      },
    });
  };

  app.post<{ Body: { network: NetworkProvider | string; phoneNumbers: string[]; record?: boolean } }>(
    '/orders/beneficiaries/precheck',
    { preHandler: publicPrecheckRateLimit ? [publicPrecheckRateLimit] : [] },
    handlePublicPrecheck,
  );

  // 1b. BENEFICIARIES PRECHECK (Supports both Customer/Agent sessions, bulk up to 1000, and opt-in recording)
  app.post<{
    Body: {
      network: NetworkProvider | string;
      phoneNumbers: string[];
      record?: boolean;
    };
  }>(
    '/beneficiaries/precheck',
    async (req, reply) => {
      const { network, phoneNumbers, record = false } = req.body || {};

      if (!network) {
        throw new BadRequestError('network is required (e.g. MTN, TELECEL)');
      }
      if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        throw new BadRequestError('phoneNumbers array is required and cannot be empty');
      }

      // Check optional authentication for higher rate/batch limits
      let authenticatedUserId: string | undefined;
      const authHeader = req.headers.authorization;
      const apiKeyHeader = req.headers['x-api-key'];

      if (authHeader?.startsWith('Bearer ') && !authHeader.startsWith('Bearer ak_')) {
        try {
          const payload = tokenService.verifyAccessToken(authHeader.substring(7).trim());
          authenticatedUserId = payload.sub;
        } catch {
          // unauthenticated fallback
        }
      } else if (apiKeyHeader || authHeader?.startsWith('Bearer ak_')) {
        try {
          const rawKey = (apiKeyHeader as string) || authHeader!.substring(7).trim();
          const key = await apiKeyService.validateApiKey(rawKey);
          authenticatedUserId = key.agentId;
        } catch {
          // unauthenticated fallback
        }
      }

      const maxLimit = 1000;
      if (phoneNumbers.length > maxLimit) {
        throw new BadRequestError(`Up to ${maxLimit} phone numbers allowed per precheck call`);
      }
      for (const phone of phoneNumbers) {
        if (typeof phone !== 'string' || phone.length > 25) {
          throw new BadRequestError('Each phone number must be a string of at most 25 characters');
        }
      }

      const result = await beneficiaryService.precheckPublicBeneficiaries({
        network: network as NetworkProvider,
        phoneNumbers,
        record: Boolean(record),
        userId: authenticatedUserId,
      });

      return reply.status(200).send({
        success: true,
        statusCode: 200,
        message: 'Success',
        data: result,
      });
    },
  );

  // 1b-2. ASYNCHRONOUS VERIFICATION JOBS (HTTP 202 Accepted for bulk Excel verification)
  app.post<{
    Body: {
      network: NetworkProvider | string;
      phoneNumbers: string[];
      record?: boolean;
      idempotencyKey?: string;
    };
  }>(
    '/beneficiaries/verification-jobs',
    async (req, reply) => {
      const { network, phoneNumbers, record = false, idempotencyKey } = req.body || {};

      if (!network) {
        throw new BadRequestError('network is required (e.g. MTN, TELECEL)');
      }
      if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        throw new BadRequestError('phoneNumbers array is required and cannot be empty');
      }

      const maxLimit = 10000;
      if (phoneNumbers.length > maxLimit) {
        throw new BadRequestError(`Up to ${maxLimit} phone numbers allowed per verification job`);
      }

      // Input validation: sanitize and validate each phone string
      const sanitizedPhones: string[] = [];
      for (let i = 0; i < phoneNumbers.length; i++) {
        const phone = phoneNumbers[i];
        if (typeof phone !== 'string') {
          throw new BadRequestError(`Item at index ${i} is not a valid phone string`);
        }
        const trimmed = phone.trim();
        if (trimmed.length === 0 || trimmed.length > 25) {
          throw new BadRequestError(`Phone number at index ${i} must be 1-25 characters`);
        }
        sanitizedPhones.push(trimmed);
      }

      // Deduplicate before background dispatch
      const uniquePhones = Array.from(new Set(sanitizedPhones));

      let authenticatedUserId: string | undefined;
      const authHeader = req.headers.authorization;
      const apiKeyHeader = req.headers['x-api-key'];

      if (authHeader?.startsWith('Bearer ') && !authHeader.startsWith('Bearer ak_')) {
        try {
          const payload = tokenService.verifyAccessToken(authHeader.substring(7).trim());
          authenticatedUserId = payload.sub;
        } catch {
          // fallback
        }
      } else if (apiKeyHeader || authHeader?.startsWith('Bearer ak_')) {
        try {
          const rawKey = (apiKeyHeader as string) || authHeader!.substring(7).trim();
          const key = await apiKeyService.validateApiKey(rawKey);
          authenticatedUserId = key.agentId;
        } catch {
          // fallback
        }
      }

      // Calculate deterministic idempotency key if not provided by client
      const headerIdemp = req.headers['idempotency-key'] as string | undefined;
      const effectiveIdempKey =
        idempotencyKey ||
        headerIdemp ||
        createHash('sha256')
          .update(`${network}:${Boolean(record)}:${[...uniquePhones].sort().join(',')}`)
          .digest('hex');

      const jobState = await verificationJobService.startJob({
        network: network as NetworkProvider,
        phoneNumbers: uniquePhones,
        record: Boolean(record),
        userId: authenticatedUserId,
        idempotencyKey: effectiveIdempKey,
      });

      const statusCode = jobState.processedRows > 0 || jobState.status === 'COMPLETED' ? 200 : 202;

      return reply.status(statusCode).send({
        success: true,
        statusCode,
        message: statusCode === 200 ? 'Existing verification job returned' : 'Verification job initiated',
        data: jobState,
      });
    },
  );

  // 1b-3. GET VERIFICATION JOB STATUS & LIVE PROGRESS
  app.get<{ Params: { jobId: string } }>(
    '/beneficiaries/verification-jobs/:jobId',
    async (req, reply) => {
      const { jobId } = req.params;
      const jobState = await verificationJobService.getJob(jobId);

      if (!jobState) {
        throw new NotFoundError(`Verification job [${jobId}] not found`);
      }

      return reply.status(200).send({
        success: true,
        statusCode: 200,
        data: jobState,
      });
    },
  );

  // 1b-4. CANCEL VERIFICATION JOB
  app.post<{ Params: { jobId: string } }>(
    '/beneficiaries/verification-jobs/:jobId/cancel',
    async (req, reply) => {
      const { jobId } = req.params;
      const cancelled = await verificationJobService.cancelJob(jobId);

      return reply.status(200).send({
        success: true,
        statusCode: 200,
        data: {
          jobId,
          status: cancelled ? 'CANCELLED' : 'NOT_MODIFIED',
          cancelled,
        },
      });
    },
  );

  // 1c. RECORD UNAPPROVED BENEFICIARIES (Saves scanned Excel unapproved items to Pending MTN Approvals)
  app.post<{
    Body: {
      items: Array<{
        phoneNumber: string;
        network?: NetworkProvider | string;
        dataSize?: string;
        dataAmountMb?: number;
        pricePesewas?: number;
        detectedFrom?: string;
      }>;
      userId?: string;
    };
  }>(
    '/beneficiaries/record-unapproved',
    async (req, reply) => {
      const { items, userId } = req.body || {};
      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new BadRequestError('items array is required and cannot be empty');
      }

      // Check optional authentication for agent / customer attribution
      let authenticatedUserId: string | undefined;
      const authHeader = req.headers.authorization;
      const apiKeyHeader = req.headers['x-api-key'];

      if (authHeader?.startsWith('Bearer ') && !authHeader.startsWith('Bearer ak_')) {
        try {
          const payload = tokenService.verifyAccessToken(authHeader.substring(7).trim());
          authenticatedUserId = payload.sub;
        } catch {
          // unauthenticated fallback
        }
      } else if (apiKeyHeader || authHeader?.startsWith('Bearer ak_')) {
        try {
          const rawKey = (apiKeyHeader as string) || authHeader!.substring(7).trim();
          const key = await apiKeyService.validateApiKey(rawKey);
          authenticatedUserId = key.agentId;
        } catch {
          // unauthenticated fallback
        }
      }

      const effectiveUserId = authenticatedUserId || userId;

      const result = await beneficiaryService.recordUnapprovedBeneficiaries({
        items,
        userId: effectiveUserId,
      });

      return reply.status(200).send({
        success: true,
        statusCode: 200,
        message: 'Success',
        data: { recorded: result.count },
      });
    },
  );

  // 2. AGENT PRECHECK (Bulk-sized, opt-in recording): POST /agent/beneficiaries/precheck
  app.post<{
    Body: {
      network: NetworkProvider | string;
      phoneNumbers: string[];
      record?: boolean;
    };
  }>(
    '/agent/beneficiaries/precheck',
    { preHandler: [authHooks.authenticate(Permission.PENDING_MTN_MANAGE)] },
    async (req, reply) => {
      const { network, phoneNumbers, record = false } = req.body || {};

      if (!network) {
        throw new BadRequestError('network is required (e.g. MTN, TELECEL)');
      }
      if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        throw new BadRequestError('phoneNumbers array is required and cannot be empty');
      }
      if (phoneNumbers.length > 1000) {
        throw new BadRequestError('Up to 1000 phone numbers allowed per agent precheck call');
      }

      const apiKeyHeader = (req.headers['x-api-key'] as string) || '';
      const isSandbox =
        Boolean((req as any).apiKey?.isSandbox) ||
        apiKeyHeader.startsWith('ak_test_') ||
        (req as any).apiKey?.keyPrefix?.startsWith('ak_test');

      const result = await beneficiaryService.precheckAgentBeneficiaries({
        network: network as NetworkProvider,
        phoneNumbers,
        record,
        isSandbox,
        userId: req.user?.sub,
      });

      return reply.status(200).send({
        success: true,
        statusCode: 200,
        message: 'Success',
        data: result,
      });
    },
  );

  // 3. REAL-TIME PENDING APPROVALS / ORDERS COUNT
  app.get(
    '/beneficiaries/pending-count',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = req.user?.sub;
        const role = (req.user?.role || '').toUpperCase();
        let countRes;
        if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
          countRes = await db.query(`
            SELECT COUNT(*) as "pendingCount"
            FROM beneficiary_validation
            WHERE validation_status IN ('PENDING', 'VALIDATING', 'PENDING_APPROVAL')
          `);
        } else {
          countRes = await db.query(`
            SELECT COUNT(*) as "pendingCount"
            FROM pending_beneficiary_approvals
            WHERE agent_id = $1 AND status IN ('PENDING', 'VALIDATING', 'PENDING_APPROVAL')
          `, [userId]);
        }
        const pendingCount = parseInt(countRes.rows[0]?.pendingCount || '0', 10);
        return reply.send({
          success: true,
          data: {
            pendingCount,
          },
        });
      } catch {
        return reply.send({
          success: true,
          data: {
            pendingCount: 0,
          },
        });
      }
    },
  );

  // 4. CUSTOMER/AGENT: LIST BENEFICIARY APPROVALS
  app.get<{
    Querystring: {
      network?: string;
      status?: string;
      page?: string;
      limit?: string;
      userId?: string;
    };
  }>(
    '/beneficiaries/approvals',
    async (req, reply) => {
      // Optional customer/agent authentication check
      let authenticatedUserId: string | undefined;
      let authenticatedRole: string | undefined;

      const authHeader = req.headers.authorization;
      const apiKeyHeader = req.headers['x-api-key'];

      if (authHeader?.startsWith('Bearer ') && !authHeader.startsWith('Bearer ak_')) {
        try {
          const payload = tokenService.verifyAccessToken(authHeader.substring(7).trim());
          req.user = payload as any;
          authenticatedUserId = payload.sub;
          authenticatedRole = payload.role;
        } catch {
          // unauthenticated fallback
        }
      } else if (apiKeyHeader || authHeader?.startsWith('Bearer ak_')) {
        try {
          const rawKey = (apiKeyHeader as string) || authHeader!.substring(7).trim();
          const key = await apiKeyService.validateApiKey(rawKey);
          authenticatedUserId = key.agentId;
          authenticatedRole = 'agent';
        } catch {
          // unauthenticated fallback
        }
      }

      const { network, status, page, limit, userId } = req.query as any;
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 20;

      const effectiveRole = authenticatedRole?.toUpperCase();
      const isAdmin = effectiveRole === 'ADMIN' || effectiveRole === 'SUPER_ADMIN';

      // Strict user isolation: admins can inspect any userId or all; customers/agents are restricted to their own userId
      const effectiveUserId = isAdmin
        ? (userId || authenticatedUserId)
        : (authenticatedUserId || (process.env.NODE_ENV !== 'production' ? userId : undefined));

      const result = await beneficiaryService.listBeneficiaryApprovals({
        network: network as NetworkProvider,
        status,
        page: pageNum,
        limit: limitNum,
        userId: effectiveUserId,
        role: authenticatedRole,
      });

      return reply.send({
        success: true,
        data: result,
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/beneficiaries/approvals/:id/approve',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const updated = await beneficiaryService.approveBeneficiary(req.params.id);
      return reply.send({
        success: true,
        data: updated,
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/beneficiaries/approvals/:id/reject',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const updated = await beneficiaryService.rejectBeneficiary(req.params.id);
      return reply.send({
        success: true,
        data: updated,
      });
    },
  );

  // 4b. CUSTOMER/AGENT: SYNC BENEFICIARY APPROVALS FROM PROVIDER
  app.post<{ Body: { network?: string; status?: string; search?: string } }>(
    '/beneficiaries/approvals/sync',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const { network, status, search } = req.body || {};
      const result = await beneficiaryService.syncBeneficiariesFromProvider({
        network,
        status,
        search,
      });
      return reply.send({
        success: true,
        data: result,
      });
    },
  );

  // 5. ADMIN: LIST MTN BENEFICIARY APPROVALS
  app.get<{
    Querystring: {
      network?: string;
      status?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/admin/mtn-approvals',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { network, status, page, limit } = req.query;
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 20;

      const result = await beneficiaryService.listBeneficiaryApprovals({
        network: network as NetworkProvider,
        status,
        page: pageNum,
        limit: limitNum,
        role: (req.user as any)?.role || 'ADMIN',
      });

      return reply.send({
        success: true,
        data: result,
      });
    },
  );

  // 6. ADMIN: APPROVE MTN BENEFICIARY
  app.post<{ Params: { id: string } }>(
    '/admin/mtn-approvals/:id/approve',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const updated = await beneficiaryService.approveBeneficiary(req.params.id);
      return reply.send({
        success: true,
        data: updated,
      });
    },
  );

  // 7. ADMIN: REJECT MTN BENEFICIARY
  app.post<{ Params: { id: string } }>(
    '/admin/mtn-approvals/:id/reject',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const updated = await beneficiaryService.rejectBeneficiary(req.params.id);
      return reply.send({
        success: true,
        data: updated,
      });
    },
  );
}

