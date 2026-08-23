import type pg from 'pg';
import { logger } from '../../core/logging/logger.js';

export interface SchemaVerificationReport {
  isComplete: boolean;
  totalRequired: number;
  existingCount: number;
  missingRelations: string[];
  tablesCount: number;
  viewsCount: number;
  checkedAt: string;
}

/**
 * Production Schema Verifier for ByteBeacon 2.0.
 * Inspects PostgreSQL catalog for all authoritative tables and views.
 * Ensures zero credential leaks in diagnostic outputs.
 */
export class ProductionSchemaVerifier {
  public static readonly REQUIRED_RELATIONS: readonly string[] = [
    // Core Auth & Identity (Domain 1)
    'system_metadata',
    'users',
    'sessions',
    'api_keys',
    'permissions',
    'role_permissions',
    'audit_logs',
    'password_resets',
    'phone_verifications',

    // Core Commerce & Orders (Domain 2)
    'catalog_products',
    'agents',
    'orders',
    'provider_orders',
    'order_items',
    'order_events',
    'payments',
    'refunds',
    'beneficiary_validation',
    'bulk_submissions',
    'bulk_submission_items',
    'idempotency_keys',
    'provider_sync_records',

    // Financial Engine (Domain 3)
    'payment_attempts',
    'payment_events',
    'refund_events',
    'financial_ledger',
    'payment_reconciliations',

    // Telecom & Fulfillment (Domain 4)
    'provider_events',
    'provider_submission_attempts',
    'provider_dlq',
    'provider_reconciliation_records',

    // Agent Storefronts (Domain 5)
    'stores',
    'store_products',

    // Extended Catalog Management
    'catalog_price_history',
    'provider_catalog_sync_batches',
    'provider_catalog_sync_items',

    // Extended Agents & Stores
    'agent_pricing',
    'store_payouts',
    'agent_customers',

    // Finance & Reconciliation Control Plane
    'reconciliation_cases',
    'financial_adjustments',
    'financial_safety_settings',

    // API Management & Security
    'api_consumers',
    'api_usage_metrics',
    'api_security_events',
    'agent_webhooks',
    'webhook_delivery_logs',
    'telecom_provider_configs',
    'provider_switch_logs',
    'api_policy_controls',

    // Communication & Messaging
    'communication_campaigns',
    'notification_templates',
    'communication_delivery_logs',
    'user_notification_preferences',

    // Audit & Security Operations
    'security_incidents',
    'emergency_system_controls',

    // System Configurations & Feature Flags (Phase 11.13)
    'system_configurations',
    'configuration_versions',
    'platform_feature_flags',

    // Telecom Provider Control Plane
    'telecom_networks',
    'telecom_providers',
    'provider_credentials',
    'provider_capabilities',
    'provider_networks',
    'provider_health_checks',
    'provider_test_runs',
    'provider_incidents',

    // Alerts & Notifications (Phase 11.15)
    'system_alerts',
    'alert_events',
    'notifications',
    'notification_rules',

    // Compatibility Views
    'audit_events',
    'agent_stores',
    'payment_transactions',
    'ledger_entries',
    'feature_flags',
    'beneficiary_records',
  ];

  /**
   * Verifies that all required relations (tables & views) exist in PostgreSQL.
   */
  public static async verifyRequiredSchema(pool: pg.Pool): Promise<SchemaVerificationReport> {
    const checkedAt = new Date().toISOString();
    try {
      const res = await pool.query<{ table_name: string; table_type: string }>(
        `SELECT table_name, table_type 
         FROM information_schema.tables 
         WHERE table_schema = 'public'`,
      );

      const existingRelations = new Set(res.rows.map((r) => r.table_name.toLowerCase()));
      const missingRelations: string[] = [];

      let tablesCount = 0;
      let viewsCount = 0;

      for (const row of res.rows) {
        if (row.table_type === 'VIEW') {
          viewsCount++;
        } else {
          tablesCount++;
        }
      }

      for (const required of this.REQUIRED_RELATIONS) {
        if (!existingRelations.has(required.toLowerCase())) {
          missingRelations.push(required);
        }
      }

      const isComplete = missingRelations.length === 0;

      if (isComplete) {
        logger.info(
          {
            existingRelationsCount: existingRelations.size,
            tablesCount,
            viewsCount,
            checkedAt,
          },
          '[SCHEMA_VERIFIER] Production database schema verification: 100% PASS',
        );
      } else {
        logger.error(
          {
            missingRelationsCount: missingRelations.length,
            missingRelations,
            checkedAt,
          },
          '[SCHEMA_VERIFIER] Production database schema verification: FAILED (missing relations)',
        );
      }

      return {
        isComplete,
        totalRequired: this.REQUIRED_RELATIONS.length,
        existingCount: this.REQUIRED_RELATIONS.length - missingRelations.length,
        missingRelations,
        tablesCount,
        viewsCount,
        checkedAt,
      };
    } catch (err: any) {
      logger.error(
        { error: err?.message || 'Database query error', checkedAt },
        '[SCHEMA_VERIFIER] Error querying information_schema.tables',
      );
      return {
        isComplete: false,
        totalRequired: this.REQUIRED_RELATIONS.length,
        existingCount: 0,
        missingRelations: [...this.REQUIRED_RELATIONS],
        tablesCount: 0,
        viewsCount: 0,
        checkedAt,
      };
    }
  }
}
