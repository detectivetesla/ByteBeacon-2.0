import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { openApiPaths, openApiSchemas } from './openapi-spec.js';

export async function registerSwagger(app: FastifyInstance) {
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'ByteBeacon 2.0 API',
        description:
          'Authoritative Telecom Aggregation, Double-Entry Reseller Ledger, High-Speed Up2U Beneficiary Precheck, and Automated Carrier Fulfillment API.',
        version: '2.0.0',
        contact: {
          name: 'ByteBeacon Developer Support',
          email: 'support@bytebeacon.online',
        },
      },
      servers: [
        {
          url: 'https://bytebeacon-2-0.onrender.com',
          description: 'Production Live Server (Render)',
        },
        {
          url: 'https://api.bytebeacon.online',
          description: 'Production Live Gateway',
        },
        {
          url: 'http://localhost:3000',
          description: 'Local Development Server',
        },
      ],
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
            description:
              'Developer API key (format: `ak_live_...` for live transactions e.g. `ak_live_G8xX0g9D98nu_oq7c9lkag7IKrZ3YDq4`, `ak_test_...` for sandbox simulation). Also accepted via `Authorization: Bearer <key>`, `Authorization: ApiKey <key>`, or `?api_key=<key>`.',
          },
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT or API Key',
            description: 'JWT session access token or API Key passed via standard Authorization Bearer header.',
          },
        },
        schemas: openApiSchemas,
      },
      paths: openApiPaths,
      tags: [
        { name: 'Beneficiaries & Up2U', description: 'High-speed precheck, Up2U verification engine, and async batch jobs' },
        { name: 'Pending Approvals', description: 'MTN pending approvals management, manual clearance, and bulk purge' },
        { name: 'Orders', description: 'Single and high-throughput bulk telecom data dispatch' },
        { name: 'Catalog', description: 'Active bundle packages, validity, and wholesale agent pricing' },
        { name: 'Wallet & Telemetry', description: 'Float balances, statement reporting, and API usage telemetry' },
        { name: 'Webhooks', description: 'Real-time HTTP callbacks and HMAC-SHA256 signature verification' },
        { name: 'Auth', description: 'Customer and agent session authentication' },
      ],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Expose standard /api/v1/openapi.json and /openapi.json
  const sendSpec = async (_req: any, reply: any) => {
    const generated = app.swagger() as any;
    // Ensure all pre-defined paths and schemas are preserved in exported spec
    const mergedPaths = { ...openApiPaths, ...(generated.paths || {}) };
    const mergedSchemas = { ...openApiSchemas, ...(generated.components?.schemas || {}) };
    const finalSpec = {
      ...generated,
      paths: mergedPaths,
      components: {
        ...generated.components,
        schemas: mergedSchemas,
      },
    };
    return reply.status(200).send(finalSpec);
  };

  app.get('/api/v1/openapi.json', sendSpec);
  app.get('/openapi.json', sendSpec);
}

