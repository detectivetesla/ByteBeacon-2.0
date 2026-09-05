import { describe, it, expect, vi } from 'vitest';
import { ProductionSchemaVerifier } from '../../src/infrastructure/database/schema-verifier.service.js';
import { allMigrations } from '../../src/infrastructure/database/migrations.registry.js';
import type pg from 'pg';

describe('Production Schema Verifier & Migration Registry', () => {
  it('should include all 20 consecutive migrations in registry from 00 to 19', () => {
    for (let i = 0; i <= 19; i++) {
      const versionStr = String(i).padStart(14, '0');
      expect(allMigrations[i].version).toBe(versionStr);
      expect(allMigrations[i].name).toBeDefined();
      expect(allMigrations[i].upSql).toBeDefined();
      expect(typeof allMigrations[i].upSql).toBe('string');
    }
  });

  it('should verify all required relations when all tables and views exist', async () => {
    const mockRows = ProductionSchemaVerifier.REQUIRED_RELATIONS.map((rel) => ({
      table_name: rel,
      table_type: rel.endsWith('_events') || rel.endsWith('_stores') || rel === 'feature_flags' ? 'VIEW' : 'BASE TABLE',
    }));

    const mockPool = {
      query: vi.fn().mockResolvedValue({
        rows: mockRows,
      }),
    } as unknown as pg.Pool;

    const report = await ProductionSchemaVerifier.verifyRequiredSchema(mockPool);

    expect(report.isComplete).toBe(true);
    expect(report.missingRelations.length).toBe(0);
    expect(report.existingCount).toBe(ProductionSchemaVerifier.REQUIRED_RELATIONS.length);
  });

  it('should identify missing tables when production schema is behind', async () => {
    const incompleteRows = [
      { table_name: 'system_metadata', table_type: 'BASE TABLE' },
      { table_name: 'users', table_type: 'BASE TABLE' },
    ];

    const mockPool = {
      query: vi.fn().mockResolvedValue({
        rows: incompleteRows,
      }),
    } as unknown as pg.Pool;

    const report = await ProductionSchemaVerifier.verifyRequiredSchema(mockPool);

    expect(report.isComplete).toBe(false);
    expect(report.missingRelations.length).toBeGreaterThan(0);
    expect(report.missingRelations).toContain('system_configurations');
    expect(report.missingRelations).toContain('platform_feature_flags');
    expect(report.missingRelations).toContain('system_alerts');
    expect(report.missingRelations).toContain('notifications');
  });

  it('should handle database connection errors gracefully without crashing or leaking secrets', async () => {
    const mockPool = {
      query: vi.fn().mockRejectedValue(new Error('Connection lost to postgres://supersecret@db:5432')),
    } as unknown as pg.Pool;

    const report = await ProductionSchemaVerifier.verifyRequiredSchema(mockPool);

    expect(report.isComplete).toBe(false);
    expect(report.missingRelations.length).toBe(ProductionSchemaVerifier.REQUIRED_RELATIONS.length);
  });
});
