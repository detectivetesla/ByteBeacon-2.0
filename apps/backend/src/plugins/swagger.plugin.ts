import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

export async function registerSwagger(app: FastifyInstance) {
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'ByteBeacon 2.0 API',
        description:
          'Authoritative Telecom Aggregation, Double-Entry Reseller Ledger, and Automated Carrier Fulfillment API.',
        version: '2.0.0',
        contact: {
          name: 'ByteBeacon Developer Support',
          email: 'support@bytebeacon.online',
        },
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local Development Server',
        },
        {
          url: 'https://sandbox.bytebeacon.online',
          description: 'Staging Developer Sandbox',
        },
        {
          url: 'https://api.bytebeacon.online',
          description: 'Production Live Gateway',
        },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT session access token for authenticated Customer, Agent, or Admin users.',
          },
          ApiKeyAuth: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
            description:
              'Developer API key (format: `bb_live_...` for live transactions, `bb_test_...` for sandbox simulation).',
          },
        },
      },
      tags: [
        { name: 'Auth', description: 'Authentication and session security' },
        { name: 'Commerce', description: 'Catalog bundles, ordering, and beneficiary validation' },
        { name: 'Agents', description: 'Reseller wallets, top-ups, and ledger reporting' },
        { name: 'Stores', description: 'Standalone Agent Reseller storefront management' },
        { name: 'Developer Sandbox', description: 'API Key management and mock carrier testing gateway' },
        { name: 'Admin', description: 'Dead-Letter Queue, carrier reconciliation, and system audit' },
        { name: 'Health', description: 'Liveness, readiness, and upstream dependency health checks' },
      ],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Also expose standard /openapi.json endpoint
  app.get('/api/v1/openapi.json', async (_req, reply) => {
    return reply.send(app.swagger());
  });
}
