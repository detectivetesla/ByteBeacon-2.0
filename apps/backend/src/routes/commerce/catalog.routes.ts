import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CatalogService } from '../../core/commerce/catalog.service.js';
import { TokenService } from '../../core/security/token.service.js';
import { NetworkProvider, ApiResponse, CatalogProductDto } from '@bytebeacon/shared';

export interface CatalogRouteDependencies {
  catalogService: CatalogService;
  tokenService?: TokenService;
}

export async function catalogRoutes(
  app: FastifyInstance,
  deps: CatalogRouteDependencies,
) {
  const { catalogService, tokenService } = deps;

  const extractAuthContext = (req: FastifyRequest) => {
    let userId: string | undefined;
    let role: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ') && tokenService) {
      const token = authHeader.substring(7).trim();
      try {
        const payload = tokenService.verifyAccessToken(token);
        userId = payload.sub;
        role = payload.role;
      } catch {
        // Continue as anonymous user
      }
    }

    return { userId, role };
  };

  const handleListProducts = async (
    req: FastifyRequest<{ Querystring: { network?: string; channel?: string; userId?: string } }>,
    reply: FastifyReply,
  ) => {
    const auth = extractAuthContext(req);
    const effectiveUserId = auth.userId || req.query.userId;
    const network = req.query.network as NetworkProvider | undefined;
    const channel = req.query.channel as 'CUSTOMER' | 'AGENT' | 'STORE' | 'API' | undefined;

    const products = await catalogService.listActiveProducts({
      network: network && network !== ('ALL' as any) ? network : undefined,
      channel: channel || (auth.role === 'agent' ? 'AGENT' : 'CUSTOMER'),
      userId: effectiveUserId,
      role: auth.role,
    });

    const response: ApiResponse<CatalogProductDto[]> = {
      success: true,
      data: products,
    };

    return reply.send(response);
  };

  const handleGetProductById = async (
    req: FastifyRequest<{ Params: { id: string }; Querystring: { userId?: string } }>,
    reply: FastifyReply,
  ) => {
    const auth = extractAuthContext(req);
    const effectiveUserId = auth.userId || req.query.userId;
    const product = await catalogService.getProductById(req.params.id, {
      userId: effectiveUserId,
      role: auth.role,
    });

    const response: ApiResponse<CatalogProductDto> = {
      success: true,
      data: product,
    };

    return reply.send(response);
  };

  // 1. LIST CATALOG PRODUCTS & BUNDLES (Supports both aliases)
  app.get<{ Querystring: { network?: string; channel?: string; userId?: string } }>(
    '/catalog/products',
    handleListProducts,
  );

  app.get<{ Querystring: { network?: string; channel?: string; userId?: string } }>(
    '/catalog/bundles',
    handleListProducts,
  );

  // 2. GET PRODUCT / BUNDLE BY ID
  app.get<{ Params: { id: string }; Querystring: { userId?: string } }>(
    '/catalog/products/:id',
    handleGetProductById,
  );

  app.get<{ Params: { id: string }; Querystring: { userId?: string } }>(
    '/catalog/bundles/:id',
    handleGetProductById,
  );
}
