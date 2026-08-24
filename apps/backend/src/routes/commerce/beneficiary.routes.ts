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

  // 1. PUBLIC PRECHECK: POST /orders/beneficiaries/precheck & /beneficiaries/precheck
  const handlePublicPrecheck = async (
    req: FastifyRequest<{
      Body: {
        network: NetworkProvider | string;
        phoneNumbers: string[];
      };
    }>,
    reply: FastifyReply,
  ) => {
    const { network, phoneNumbers } = req.body || {};

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

    const result = await beneficiaryService.precheckPublicBeneficiaries({
      network: network as NetworkProvider,
      phoneNumbers,
    });

    return reply.status(200).send({
      success: true,
      statusCode: 200,
      message: 'Success',
      data: result,
    });
  };

  app.post<{ Body: { network: NetworkProvider | string; phoneNumbers: string[] } }>(
    '/orders/beneficiaries/precheck',
    handlePublicPrecheck,
  );
  app.post<{ Body: { network: NetworkProvider | string; phoneNumbers: string[] } }>(
    '/beneficiaries/precheck',
    handlePublicPrecheck,
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
    { preHandler: [authHooks.authenticate] },
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

