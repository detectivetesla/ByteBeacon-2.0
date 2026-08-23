import { FastifyRequest, FastifyReply } from 'fastify';
import { FeatureFlagService } from '../infrastructure/features/feature-flag.service.js';
import { UserRole } from '@bytebeacon/shared';
import { AppError } from '../core/errors/app-error.js';

/**
 * Creates a preHandler hook that rejects requests when Maintenance Mode is active.
 * Administrative users (ADMIN, SUPER_ADMIN) are exempt to preserve control plane access.
 */
export function createMaintenanceHook(featureFlagService: FeatureFlagService) {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // Admins and Super Admins bypass maintenance blackout
    if (
      req.user &&
      (req.user.role === UserRole.ADMIN || req.user.role === UserRole.SUPER_ADMIN)
    ) {
      return;
    }

    const isMaintenance = await featureFlagService.isMaintenanceModeActive();
    if (isMaintenance) {
      throw new AppError(
        'Platform is currently undergoing scheduled maintenance. Order fulfillment and checkout operations are temporarily paused. You can still browse bundles, track past orders, and access your account.',
        503,
        'MAINTENANCE_MODE_ACTIVE',
      );
    }
  };
}
