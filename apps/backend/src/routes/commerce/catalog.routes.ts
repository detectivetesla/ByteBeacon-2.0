import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CatalogService } from '../../core/commerce/catalog.service.js';
import { NetworkProvider, ApiResponse, CatalogProductDto } from '@bytebeacon/shared';

export interface CatalogRouteDependencies {
  catalogService: CatalogService;
}

export async function catalogRoutes(
  app: FastifyInstance,
  deps: CatalogRouteDependencies,
) {
  const { catalogService } = deps;

  const handleListProducts = async (
    req: FastifyRequest<{ Querystring: { network?: string; channel?: string } }>,
    reply: FastifyReply,
  ) => {
    const network = req.query.network as NetworkProvider | undefined;
    const channel = req.query.channel as 'CUSTOMER' | 'AGENT' | 'STORE' | 'API' | undefined;
    const products = await catalogService.listActiveProducts({
      network: network && network !== ('ALL' as any) ? network : undefined,
      channel: channel || 'CUSTOMER',
    });

    const response: ApiResponse<CatalogProductDto[]> = {
      success: true,
      data: products,
    };

    return reply.send(response);
  };

  const handleGetProductById = async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const product = await catalogService.getProductById(req.params.id);

    const response: ApiResponse<CatalogProductDto> = {
      success: true,
      data: product,
    };

    return reply.send(response);
  };

  // 1. LIST CATALOG PRODUCTS & BUNDLES (Supports both aliases)
  app.get<{ Querystring: { network?: string; channel?: string } }>(
    '/catalog/products',
    handleListProducts,
  );

  app.get<{ Querystring: { network?: string; channel?: string } }>(
    '/catalog/bundles',
    handleListProducts,
  );

  // 2. GET PRODUCT / BUNDLE BY ID
  app.get<{ Params: { id: string } }>(
    '/catalog/products/:id',
    handleGetProductById,
  );

  app.get<{ Params: { id: string } }>(
    '/catalog/bundles/:id',
    handleGetProductById,
  );
}
