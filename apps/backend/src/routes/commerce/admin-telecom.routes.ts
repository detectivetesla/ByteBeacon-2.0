import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { TokenService } from '../../core/security/token.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { TelecomProviderManagementService } from '../../core/providers/telecom-provider-management.service.js';
import { AppError, BadRequestError } from '../../core/errors/app-error.js';
import {
  CreateTelecomProviderRequest,
  UpdateTelecomProviderRequest,
  CreateProviderCredentialRequest,
  RotateProviderCredentialRequest,
  UpdateTelecomNetworkRequest,
  UpdateNetworkRoutingRequest,
  SwitchAuthoritativeProviderRequest,
  CreateProviderIncidentRequest,
  UpdateProviderIncidentRequest,
  SandboxTransactionTestInput,
  ProviderTestOperationRequest,
} from '@bytebeacon/shared';

export interface AdminTelecomRouteDependencies {
  db: pg.Pool;
  telecomService: TelecomProviderManagementService;
  apiKeyService: ApiKeyService;
  tokenService: TokenService;
  rbacService: RbacService;
  auditService: AuditService;
}

export async function adminTelecomRoutes(
  app: FastifyInstance,
  deps: AdminTelecomRouteDependencies,
) {
  const { db, telecomService, apiKeyService, tokenService, rbacService } = deps;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // =========================================================================
  // 1. Overview & Telemetry
  // =========================================================================

  app.get(
    '/admin/telecom/overview',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const overview = await telecomService.getOverview();
      return reply.send({ success: true, data: overview });
    },
  );

  // =========================================================================
  // 2. Networks Management (MTN, Telecel, AirtelTigo)
  // =========================================================================

  app.get(
    '/admin/telecom/networks',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const networks = await telecomService.getNetworks();
      return reply.send({ success: true, data: networks });
    },
  );

  app.patch<{
    Params: { code: string };
    Body: UpdateTelecomNetworkRequest;
  }>(
    '/admin/telecom/networks/:code',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const { code } = request.params;
      const user = (request as any).user;
      const updated = await telecomService.updateNetwork(code, request.body, user?.sub, (request as any).correlationId);
      return reply.send({ success: true, data: updated });
    },
  );

  app.post<{
    Params: { code: string };
  }>(
    '/admin/telecom/networks/:code/toggle',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const { code } = request.params;
      const user = (request as any).user;
      const result = await telecomService.toggleNetwork(code, user?.sub, (request as any).correlationId);
      return reply.send({ success: true, data: result });
    },
  );

  // =========================================================================
  // 3. Telecom Providers Registry (CRUD)
  // =========================================================================

  app.get(
    '/admin/telecom/providers',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const providers = await telecomService.getProviders();
      return reply.send({ success: true, data: providers });
    },
  );

  app.get<{
    Params: { id: string };
  }>(
    '/admin/telecom/providers/:id',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const provider = await telecomService.getProvider(request.params.id);
      return reply.send({ success: true, data: provider });
    },
  );

  app.post<{
    Body: CreateTelecomProviderRequest;
  }>(
    '/admin/telecom/providers',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const created = await telecomService.createProvider(request.body, user?.sub, (request as any).correlationId);
        return reply.status(201).send({ success: true, data: created });
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new BadRequestError(err.message || 'Failed to register telecom provider');
      }
    },
  );

  app.patch<{
    Params: { id: string };
    Body: UpdateTelecomProviderRequest;
  }>(
    '/admin/telecom/providers/:id',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const updated = await telecomService.updateProvider(request.params.id, request.body, user?.sub, (request as any).correlationId);
        return reply.send({ success: true, data: updated });
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new BadRequestError(err.message || 'Failed to update telecom provider');
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: { status: string; reason?: string };
  }>(
    '/admin/telecom/providers/:id/status',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const result = await telecomService.updateProviderStatus(
        request.params.id,
        request.body.status,
        request.body.reason,
        user?.sub,
        (request as any).correlationId,
      );
      return reply.send({ success: true, data: result });
    },
  );

  app.delete<{
    Params: { id: string };
  }>(
    '/admin/telecom/providers/:id',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const result = await telecomService.deleteProvider(
        request.params.id,
        user?.sub,
        (request as any).correlationId,
      );
      return reply.send({ success: true, data: result });
    },
  );

  // =========================================================================
  // 4. Credentials Management (Server Vault)
  // =========================================================================

  app.get<{
    Params: { id: string };
  }>(
    '/admin/telecom/providers/:id/credentials',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const creds = await telecomService.getCredentials(request.params.id);
      return reply.send({ success: true, data: creds });
    },
  );

  app.post<{
    Params: { id: string };
    Body: CreateProviderCredentialRequest;
  }>(
    '/admin/telecom/providers/:id/credentials',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const created = await telecomService.setCredentials(
        request.params.id,
        request.body,
        user?.sub,
        (request as any).correlationId,
      );
      return reply.status(201).send({ success: true, data: created });
    },
  );

  app.post<{
    Params: { id: string };
    Body: RotateProviderCredentialRequest;
  }>(
    '/admin/telecom/providers/:id/credentials/rotate',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const rotated = await telecomService.rotateCredentials(
        request.params.id,
        request.body,
        user?.sub,
        (request as any).correlationId,
      );
      return reply.send({ success: true, data: rotated });
    },
  );

  app.post<{
    Params: { id: string; credId: string };
    Body: { reason: string };
  }>(
    '/admin/telecom/providers/:id/credentials/:credId/revoke',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const res = await telecomService.revokeCredential(
        request.params.id,
        request.params.credId,
        request.body.reason,
        user?.sub,
        (request as any).correlationId,
      );
      return reply.send({ success: true, data: res });
    },
  );

  // =========================================================================
  // 5. Diagnostics & Sandbox Testing
  // =========================================================================

  app.post<{
    Params: { id: string };
    Body?: { environment?: string };
  }>(
    '/admin/telecom/providers/:id/test-connection',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const env = request.body?.environment || 'SANDBOX';
      const result = await telecomService.testConnection(
        request.params.id,
        env,
        user?.sub,
        (request as any).correlationId,
      );
      return reply.send({ success: true, data: result });
    },
  );

  app.post<{
    Params: { id: string };
  }>(
    '/admin/telecom/providers/:id/test-capabilities',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const caps = await telecomService.testCapabilities(
        request.params.id,
        user?.sub,
        (request as any).correlationId,
      );
      return reply.send({ success: true, data: caps });
    },
  );

  app.post<{
    Params: { id: string };
    Body: SandboxTransactionTestInput;
  }>(
    '/admin/telecom/providers/:id/test-sandbox',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const result = await telecomService.testSandboxTransaction(
        request.params.id,
        request.body,
        user?.sub,
        (request as any).correlationId,
      );
      return reply.send({ success: true, data: result });
    },
  );

  app.post<{
    Params: { id: string };
    Body: ProviderTestOperationRequest;
  }>(
    '/admin/telecom/providers/:id/test-operation',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const result = await telecomService.testProviderOperation(
        request.params.id,
        request.body,
        user?.sub,
        (request as any).correlationId,
      );
      return reply.send({ success: true, data: result });
    },
  );

  // =========================================================================
  // 6. Network Carrier Routing Configuration
  // =========================================================================

  app.get(
    '/admin/telecom/routing',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const routing = await telecomService.getRoutingMatrix();
      return reply.send({ success: true, data: routing });
    },
  );

  app.post<{
    Body: UpdateNetworkRoutingRequest;
  }>(
    '/admin/telecom/routing',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const updated = await telecomService.updateRouting(
        request.body,
        user?.sub,
        (request as any).correlationId,
      );
      return reply.send({ success: true, data: updated });
    },
  );

  // =========================================================================
  // 7. Authoritative Provider Selection & Switching
  // =========================================================================

  app.get<{
    Querystring: { targetProvider: string };
  }>(
    '/admin/telecom/authoritative-switch/validate',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const { targetProvider } = request.query;
      const validation = await telecomService.validateAuthoritativeSwitch(targetProvider);
      return reply.send({ success: true, data: validation });
    },
  );

  app.post<{
    Body: SwitchAuthoritativeProviderRequest;
  }>(
    '/admin/telecom/authoritative-switch',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const result = await telecomService.switchAuthoritativeProvider(
        request.body,
        user?.sub,
        (request as any).correlationId,
      );
      return reply.send({ success: true, data: result });
    },
  );

  // =========================================================================
  // 8. Provider Incidents Management
  // =========================================================================

  app.get<{
    Querystring: { status?: string; severity?: string };
  }>(
    '/admin/telecom/incidents',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const incidents = await telecomService.getIncidents(request.query);
      return reply.send({ success: true, data: incidents });
    },
  );

  app.post<{
    Body: CreateProviderIncidentRequest;
  }>(
    '/admin/telecom/incidents',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const created = await telecomService.createIncident(
        request.body,
        user?.sub,
        (request as any).correlationId,
      );
      return reply.status(201).send({ success: true, data: created });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: UpdateProviderIncidentRequest;
  }>(
    '/admin/telecom/incidents/:id',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const user = (request as any).user;
      const updated = await telecomService.updateIncident(
        request.params.id,
        request.body,
        user?.sub,
        (request as any).correlationId,
      );
      return reply.send({ success: true, data: updated });
    },
  );

  // =========================================================================
  // 9. Provider Health & Telemetry Metrics
  // =========================================================================

  app.get<{
    Params: { id: string };
  }>(
    '/admin/telecom/providers/:id/health',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (request, reply) => {
      const health = await telecomService.getHealthMetrics(request.params.id);
      return reply.send({ success: true, data: health });
    },
  );
}
