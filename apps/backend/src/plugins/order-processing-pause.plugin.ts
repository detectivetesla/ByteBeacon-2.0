import { FastifyRequest, FastifyReply } from 'fastify';
import { FeatureFlagService } from '../infrastructure/features/feature-flag.service.js';
import { UserRole } from '@bytebeacon/shared';
import { AppError } from '../core/errors/app-error.js';

/**
 * Creates a preHandler hook that rejects order creation, checkouts, and Excel bulk uploads
 * when platform order processing is paused by an administrator.
 * Administrative users (ADMIN, SUPER_ADMIN) are exempt to allow test verification.
 */
export function createOrderProcessingPauseHook(featureFlagService: FeatureFlagService) {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (
      req.user &&
      (req.user.role === UserRole.ADMIN || req.user.role === UserRole.SUPER_ADMIN)
    ) {
      return;
    }

    const isPaused = await featureFlagService.isOrderProcessingPaused();
    if (isPaused) {
      throw new AppError(
        'Order processing, checkout, and bulk Excel uploads are temporarily paused by platform administration. Please check back shortly.',
        503,
        'ORDER_PROCESSING_PAUSED',
      );
    }
  };
}
