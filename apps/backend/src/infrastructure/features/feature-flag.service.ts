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

    // 1. Check environment variable override (e.g. FF_NEW_ORDER_ENGINE=false)
    const envOverride = process.env[`FF_${normalizedName}`];
    if (envOverride !== undefined) {
      return envOverride.toLowerCase() === 'true' || envOverride === '1';
    }

    // 2. Check local memory override / kill-switch
    if (this.memoryOverrides.has(normalizedName)) {
      return this.memoryOverrides.get(normalizedName)!;
    }

    // 3. Check database overrides if available
    if (this.db) {
      try {
        const res = await this.db.query<{ is_enabled: boolean; allowed_roles: string[] | null }>(
          'SELECT is_enabled, allowed_roles FROM feature_flags WHERE name = $1 LIMIT 1',
          [normalizedName],
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          if (!row.is_enabled) return false;

          // Check role restrictions if specified
          if (row.allowed_roles && row.allowed_roles.length > 0 && context?.role) {
            return row.allowed_roles.includes(context.role);
          }
          return row.is_enabled;
        }
      } catch (err) {
        logger.warn({ flagName, err }, '[FEATURE_FLAGS] Database lookup failed; falling back to defaults');
      }
    }

    // 4. Fallback to hardcoded safe default
    return FeatureFlagService.DEFAULT_FLAGS[normalizedName] ?? false;
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
