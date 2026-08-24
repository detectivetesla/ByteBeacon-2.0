import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { BeneficiaryService } from '../../core/commerce/beneficiary.service.js';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { BadRequestError } from '../../core/errors/app-error.js';
import {
  ValidateBeneficiaryRequest,
  BeneficiaryValidationDto,
  ApiResponse,
  NetworkProvider,
} from '@bytebeacon/shared';

export interface BeneficiaryRouteDependencies {
  db: pg.Pool;
  beneficiaryService: BeneficiaryService;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
}

export async function beneficiaryRoutes(
  app: FastifyInstance,
  deps: BeneficiaryRouteDependencies,
) {
  const { db, beneficiaryService, tokenService, apiKeyService, rbacService } = deps;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

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

  // 3. PRECHECK BENEFICIARIES (Bulk MTN Up2U & Carrier Verification)
  app.post<{
    Body: {
      phoneNumbers: string[];
      network: NetworkProvider;
      record?: boolean;
    };
  }>(
    '/beneficiaries/precheck',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const { phoneNumbers, network, record = false } = req.body || {};
      if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        throw new BadRequestError('phoneNumbers array is required');
      }
      if (!network) {
        throw new BadRequestError('network is required');
      }

      const result = await beneficiaryService.precheckBeneficiaries({
        phoneNumbers,
        network,
        record,
        userId: req.user!.sub,
      });

      return reply.send({
        success: true,
        data: result,
      });
    },
  );

  // 4. CUSTOMER/AGENT: LIST BENEFICIARY APPROVALS
  app.get<{
    Querystring: {
      network?: string;
      status?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/beneficiaries/approvals',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const { network, status, page, limit } = req.query;
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 20;

      const result = await beneficiaryService.listBeneficiaryApprovals({
        network: network as NetworkProvider,
        status,
        page: pageNum,
        limit: limitNum,
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

