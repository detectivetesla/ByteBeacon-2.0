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

  // 3. GET ALL ACTIVE OFFERS (Custom API & Integrations)
  app.get('/offers', async (_req: FastifyRequest, reply: FastifyReply) => {
    const products = await catalogService.listActiveProducts({});

    const ispMap = new Map<string, { name: string; isp: string; type: string; offerSlug: string; volumes: number[] }>();

    ispMap.set('MTN', {
      name: 'MTN Data Bundle',
      isp: 'MTN',
      type: 'Data',
      offerSlug: 'mtn_data_bundle',
      volumes: [],
    });
    ispMap.set('TELECEL', {
      name: 'Telecel Data Bundle',
      isp: 'Telecel',
      type: 'Data',
      offerSlug: 'telecel_data_bundle',
      volumes: [],
    });
    ispMap.set('AIRTELTIGO', {
      name: 'AirtelTigo Data Bundle',
      isp: 'AirtelTigo',
      type: 'Data',
      offerSlug: 'airteltigo_data_bundle',
      volumes: [],
    });

    for (const p of products) {
      const net = String(p.network || 'MTN').toUpperCase();
      const ispEntry = ispMap.get(net);
      const volGb = Math.max(1, Math.round(p.dataAmountMb / 1024));
      if (ispEntry) {
        if (!ispEntry.volumes.includes(volGb)) {
          ispEntry.volumes.push(volGb);
        }
      }
    }

    for (const entry of Array.from(ispMap.values())) {
      if (entry.volumes.length === 0) {
        entry.volumes.push(1, 2, 5, 10, 20, 50, 100);
      } else {
        entry.volumes.sort((a, b) => a - b);
      }
    }

    const offers = [
      ispMap.get('MTN')!,
      ispMap.get('TELECEL')!,
      {
        name: 'AirtelTigo Voice Minutes',
        isp: 'AirtelTigo',
        type: 'Voice Minutes',
        offerSlug: 'airteltigo_voice_minutes',
        volumes: [10, 50, 100, 500, 1000],
      },
      ispMap.get('AIRTELTIGO')!,
    ].filter(Boolean);

    return reply.send({
      success: true,
      offers,
    });
  });

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
