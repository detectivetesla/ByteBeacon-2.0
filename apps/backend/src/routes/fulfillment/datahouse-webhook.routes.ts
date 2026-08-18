import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DataHouseWebhookService } from '../../core/providers/datahouse-webhook.service.js';

export async function datahouseWebhookRoutes(
  app: FastifyInstance,
  deps: {
    webhookService: DataHouseWebhookService;
  },
) {
  const webhookHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const signature =
      (req.headers['x-telecom-signature'] as string) ||
      (req.headers['x-datahouse-signature'] as string) ||
      (req.headers['x-webhook-signature'] as string) ||
      '';

    const correlationId = (req.headers['x-correlation-id'] as string) || req.id;
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body);

    const result = await deps.webhookService.handleWebhook(
      rawBody,
      signature,
      correlationId,
    );

    reply.status(200).send({
      success: true,
      data: result,
    });
  };

  app.post('/webhooks/datahouse', webhookHandler);
  app.post('/webhooks/telecom', webhookHandler);
  app.post('/fulfillment/datahouse/webhook', webhookHandler);
}
