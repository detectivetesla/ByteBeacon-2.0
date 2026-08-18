import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PaymentWebhookService } from '../../core/payments/payment-webhook.service.js';
import { logger } from '../../core/logging/logger.js';

export async function webhookRoutes(
  app: FastifyInstance,
  deps: {
    webhookService: PaymentWebhookService;
  },
) {
  app.post(
    '/webhooks/paystack',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const signature = (req.headers['x-paystack-signature'] as string) || '';
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      try {
        const result = await deps.webhookService.handlePaystackWebhook(
          rawBody,
          signature,
          req.id,
        );

        reply.status(200).send({
          success: true,
          status: result.status,
          message: result.message,
        });
      } catch (err: any) {
        logger.error({ err, reqId: req.id }, 'Webhook rejection');
        reply.status(err.statusCode || 400).send({
          success: false,
          error: {
            code: err.code || 'WEBHOOK_ERROR',
            message: err.message,
          },
        });
      }
    },
  );
}
