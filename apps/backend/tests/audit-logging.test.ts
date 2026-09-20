import { describe, it, expect, vi } from 'vitest';
import { AuditService } from '../src/core/security/audit.service.js';
import type pg from 'pg';

describe('Tamper-Resistant Audit Logging System', () => {
  it('should persist structured audit log events with correlation IDs', async () => {
    let insertedEvent: unknown[] = [];

    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (typeof q === 'string' && q.includes('INSERT INTO audit_logs')) {
          insertedEvent = params;
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const auditService = new AuditService(mockDb);

    await auditService.logEvent({
      correlationId: 'req_01J123456789',
      actorId: 'adm_1',
      actorType: 'ADMIN',
      action: 'ADMIN_SUSPEND_AGENT',
      resourceType: 'users',
      resourceId: 'agt_99',
      metadata: { reason: 'Policy violation', priorStatus: 'ACTIVE' },
      ipAddress: '10.0.0.1',
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      expect.any(Array),
    );
    expect(insertedEvent[0]).toBe('req_01J123456789'); // correlation_id
    expect(insertedEvent[1]).toBe('adm_1'); // actor_id
    expect(insertedEvent[2]).toBe('ADMIN'); // actor_type
    expect(insertedEvent[3]).toBe('admin'); // actor_role
    expect(insertedEvent[6]).toBe('ADMIN_SUSPEND_AGENT'); // action
    expect(insertedEvent[7]).toBe('users'); // resource_type
    expect(insertedEvent[8]).toBe('agt_99'); // resource_id
  });
});
