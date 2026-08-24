import type pg from 'pg';
import { logger } from '../../core/logging/logger.js';

export interface FeatureFlagContext {
  userId?: string;
  role?: string;
  agentId?: string;
}

export interface FeatureFlagDefinition {
  name: string;
  isEnabled: boolean;
  percentageRollout?: number; // 0 to 100
  allowedRoles?: string[];
  description?: string;
}

/**
 * High-Performance Runtime Feature Flag & Kill-Switch Service for ByteBeacon 2.0.
 * Allows progressive subsystem activation and instant kill-switch rollbacks without redeployment.
 */
export class FeatureFlagService {
  private readonly db: pg.Pool | null;
  private readonly memoryOverrides = new Map<string, boolean>();

  // Default system baseline flag definitions
  private static readonly DEFAULT_FLAGS: Record<string, boolean> = {
    NEW_ORDER_ENGINE: true,
    AGENT_STORES: true,
    MTN_PRECHECK: true,
    PAYSTACK_LIVE: false,
    MAINTENANCE_MODE: false,
    DEVELOPER_SANDBOX: true,
  };

  constructor(db: pg.Pool | null = null) {
    this.db = db;
  }

  /**
   * Evaluates if a feature flag is enabled for the current evaluation context.
   */
  public async isEnabled(flagName: string, context?: FeatureFlagContext): Promise<boolean> {
    const normalizedName = flagName.toUpperCase();

    // 1. Check local memory override / kill-switch
    if (this.memoryOverrides.has(normalizedName)) {
      return this.memoryOverrides.get(normalizedName)!;
    }

    // 2. Special handling for platform-wide emergency maintenance mode
    if (normalizedName === 'MAINTENANCE_MODE') {
      // Explicit emergency env override to true
      const envOverride = process.env.FF_MAINTENANCE_MODE;
      if (envOverride === 'true' || envOverride === '1') {
        return true;
      }

      // Check database across all administrative maintenance controls
      if (this.db) {
        try {
          const res = await this.db.query<{ is_active: boolean }>(
            `SELECT (
              EXISTS (
                SELECT 1 FROM platform_feature_flags 
                WHERE flag_key = 'MAINTENANCE_MODE' AND is_enabled = true
              )
              OR EXISTS (
                SELECT 1 FROM emergency_system_controls 
                WHERE control_key = 'MAINTENANCE_MODE' AND is_enabled = true
              )
              OR EXISTS (
                SELECT 1 FROM financial_safety_controls 
                WHERE global_maintenance_mode = true
              )
              OR EXISTS (
                SELECT 1 FROM system_configurations 
                WHERE config_key = 'maintenance_mode' 
                  AND (value = 'true'::jsonb OR value::text = 'true' OR value::text = '"true"')
              )
            ) AS is_active`,
          );
          if (res.rows.length > 0) {
            return Boolean(res.rows[0].is_active);
          }
        } catch (err) {
          logger.warn({ flagName, err }, '[FEATURE_FLAGS] Database lookup failed for maintenance mode; falling back to default');
        }
      }

      if (envOverride !== undefined) {
        return envOverride.toLowerCase() === 'true' || envOverride === '1';
      }

      return FeatureFlagService.DEFAULT_FLAGS[normalizedName] ?? false;
    }

    // 3. Check environment variable override for other flags (e.g. FF_NEW_ORDER_ENGINE=false)
    const envOverride = process.env[`FF_${normalizedName}`];
    if (envOverride !== undefined) {
      return envOverride.toLowerCase() === 'true' || envOverride === '1';
    }

    // 4. Check database overrides for regular flags
    if (this.db) {
      try {
        const res = await this.db.query<{ is_enabled: boolean; target_role?: string; allowed_roles?: string[] | null }>(
          `SELECT is_enabled, 
                  COALESCE(target_role, (allowed_roles)[1], 'ALL') as target_role, 
                  allowed_roles 
           FROM (
             SELECT is_enabled, target_role, NULL::text[] as allowed_roles FROM platform_feature_flags WHERE flag_key = $1
             UNION ALL
             SELECT is_enabled, NULL as target_role, allowed_roles FROM feature_flags WHERE name = $1
           ) flags LIMIT 1`,
          [normalizedName],
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          if (!row.is_enabled) return false;

          // Check role restrictions if specified
          if (row.allowed_roles && row.allowed_roles.length > 0 && context?.role) {
            return row.allowed_roles.includes(context.role);
          }
          if (row.target_role && row.target_role !== 'ALL' && context?.role) {
            return row.target_role.toLowerCase() === context.role.toLowerCase();
          }
          return row.is_enabled;
        }
      } catch (err) {
        logger.warn({ flagName, err }, '[FEATURE_FLAGS] Database lookup failed; falling back to defaults');
      }
    }

    // 5. Fallback to hardcoded safe default
    return FeatureFlagService.DEFAULT_FLAGS[normalizedName] ?? false;
  }

  /**
   * Helper to check if emergency maintenance mode is active.
   */
  public async isMaintenanceModeActive(): Promise<boolean> {
    return this.isEnabled('MAINTENANCE_MODE');
  }

  /**
   * Sets an in-memory runtime override / emergency kill-switch.
   */
  public setOverride(flagName: string, isEnabled: boolean): void {
    const normalizedName = flagName.toUpperCase();
    this.memoryOverrides.set(normalizedName, isEnabled);
    logger.info({ flag: normalizedName, isEnabled }, '[FEATURE_FLAGS] Applied runtime feature flag override');
  }

  /**
   * Clears a runtime override.
   */
  public clearOverride(flagName: string): void {
    const normalizedName = flagName.toUpperCase();
    this.memoryOverrides.delete(normalizedName);
  }

  /**
   * Clears all in-memory overrides.
   */
  public clearAllOverrides(): void {
    this.memoryOverrides.clear();
  }
}
