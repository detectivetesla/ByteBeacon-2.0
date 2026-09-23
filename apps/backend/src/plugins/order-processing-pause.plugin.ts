import { FastifyRequest, FastifyReply } from 'fastify';
import { FeatureFlagService } from '../infrastructure/features/feature-flag.service.js';
import { UserRole } from '@bytebeacon/shared';
import { ServiceUnavailableError } from '../core/errors/app-error.js';

/**
 * Creates a preHandler hook that rejects order creation, checkouts, and Excel bulk uploads
 * when platform order processing is in Total Lockdown.
 * When in Operational Freeze, it flags the request so orders can be safely saved as PAUSED.
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

    const isTotalLockdown = await featureFlagService.isTotalOrderLockdownActive();
    if (isTotalLockdown) {
      throw new ServiceUnavailableError(
        'Order Placements Completely Paused: Platform administration has enabled a full lockdown on all order creation, bulk purchases, and spreadsheet uploads. Submissions are temporarily blocked.',
      );
    }

    const isPaused = await featureFlagService.isOrderProcessingPaused();
    (req as any).isOrderOperationsPaused = isPaused;
  };
}
