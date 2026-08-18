import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GmplWebhookService } from '../../core/providers/gmpl-webhook.service.js';

export async function gmplWebhookRoutes(
  app: FastifyInstance,
  deps: {
    webhookService: GmplWebhookService;
  },
) {
  app.post('/webhooks/gmpl', async (req: FastifyRequest, reply: FastifyReply) => {
    const signature =
      (req.headers['x-gmpl-signature'] as string) ||
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
  });
}
