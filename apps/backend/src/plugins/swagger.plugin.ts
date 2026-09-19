import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { openApiPaths, openApiSchemas } from './openapi-spec.js';

export async function registerSwagger(app: FastifyInstance) {
  const isProd = process.env.NODE_ENV === 'production';
  const servers = [
    {
      url: 'https://api.bytebeacon.online',
      description: 'Production API Gateway',
    },
    {
      url: 'https://bytebeacon-2-0.onrender.com',
      description: 'Production Application Server (Render)',
    },
    ...(isProd
      ? []
      : [
          {
            url: 'http://localhost:3000',
            description: 'Local Development Server',
          },
        ]),
  ];

  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'ByteBeacon 2.0 Developer API',
        description:
          'Official ByteBeacon 2.0 Developer API for Telecom Data Orders, Recipient Precheck, Wallet Balance, and Webhooks.',
        version: '2.0.0',
        contact: {
          name: 'ByteBeacon Developer Support',
          email: 'support@bytebeacon.online',
        },
      },
      servers,
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
            description:
              'Developer API key (format: `ak_live_...` for live transactions e.g. `ak_live_REDACTED_EXAMPLE`, `ak_test_...` for sandbox simulation e.g. `ak_test_XXXXXXXXXXXXXXXX`). Also accepted via `Authorization: Bearer <key>` or `Authorization: ApiKey <key>`. Do not pass API keys in URL query parameters.',
          },
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT or API Key',
            description: 'JWT session token or API Key passed via standard Authorization: Bearer header.',
          },
        },
        schemas: openApiSchemas,
      },
      paths: openApiPaths,
      tags: [
        { name: 'Beneficiaries & Up2U', description: 'Recipient eligibility precheck and asynchronous validation batch jobs' },
        { name: 'Orders', description: 'Single and bulk data bundle dispatch and tracking' },
        { name: 'Catalog', description: 'Available data bundle packages and wholesale pricing' },
        { name: 'Wallet & Telemetry', description: 'Prepaid balance queries and API usage telemetry' },
        { name: 'Webhooks', description: 'Real-time event subscriptions and HMAC signature delivery' },
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

