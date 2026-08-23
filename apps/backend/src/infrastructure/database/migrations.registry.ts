import { MigrationFile } from './migrator.js';
import { migration00000000000000 } from './migrations/00000000000000_init_system_metadata.js';
import { migration00000000000001 } from './migrations/00000000000001_create_security_auth_schema.js';
import { migration00000000000002 } from './migrations/00000000000002_create_core_commerce_schema.js';
import { migration00000000000003 } from './migrations/00000000000003_create_financial_engine_schema.js';
import { migration00000000000004 } from './migrations/00000000000004_create_provider_fulfillment_schema.js';
import { migration00000000000005 } from './migrations/00000000000005_create_agent_stores_schema.js';
import { migration00000000000006 } from './migrations/00000000000006_create_production_indexes.js';
import { migration00000000000007 } from './migrations/00000000000007_enhance_catalog_management_schema.js';
import { migration00000000000008 } from './migrations/00000000000008_enhance_agents_and_stores_schema.js';
import { migration00000000000009 } from './migrations/00000000000009_enhance_finance_and_reconciliation_schema.js';
import { migration00000000000010 } from './migrations/00000000000010_enhance_api_management_and_security_schema.js';
import { migration00000000000011 } from './migrations/00000000000011_enhance_communication_and_messaging_schema.js';
import { migration00000000000012 } from './migrations/00000000000012_enhance_audit_and_security_operations_schema.js';
import { migration00000000000013 } from './migrations/00000000000013_enhance_system_configuration_and_governance_schema.js';
import { migration00000000000014 } from './migrations/00000000000014_enhance_telecom_provider_control_plane.js';
import { migration00000000000015 } from './migrations/00000000000015_enhance_alerts_notifications_and_views.js';

export const allMigrations: MigrationFile[] = [
  migration00000000000000,
  migration00000000000001,
  migration00000000000002,
  migration00000000000003,
  migration00000000000004,
  migration00000000000005,
  migration00000000000006,
  migration00000000000007,
  migration00000000000008,
  migration00000000000009,
  migration00000000000010,
  migration00000000000011,
  migration00000000000012,
  migration00000000000013,
  migration00000000000014,
  migration00000000000015,
];
