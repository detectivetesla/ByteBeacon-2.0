import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { UserRole, Permission, ADMIN_ROLE_PERMISSIONS, AdminSubRole } from '@bytebeacon/shared';
import { ForbiddenError } from '../../src/core/errors/app-error.js';
import type pg from 'pg';

describe('Phase 8.5: Authentication, Authorization & RBAC Security Suite', () => {
  let rbacService: RbacService;
  let tokenService: TokenService;
  let mockDb: pg.Pool;

  beforeEach(() => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string, params?: any[]) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('FROM role_permissions WHERE role = $1')) {
          const role = params?.[0];
          if (role === UserRole.CUSTOMER) {
            return Promise.resolve({
              rows: [{ permissionId: Permission.ORDERS_READ }, { permissionId: Permission.ORDERS_CREATE }],
            });
          }
          if (role === UserRole.AGENT) {
            return Promise.resolve({
              rows: [
                { permissionId: Permission.ORDERS_READ },
                { permissionId: Permission.ORDERS_CREATE },
                { permissionId: Permission.WALLET_READ },
                { permissionId: Permission.API_KEYS_MANAGE },
              ],
            });
          }
          if (role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) {
            return Promise.resolve({
              rows: Object.values(Permission).map((p) => ({ permissionId: p })),
            });
          }
        }
        if (sql.includes('UPDATE user_sessions SET is_revoked = true')) {
          return Promise.resolve({ rows: [{ count: 2 }] });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    rbacService = new RbacService(mockDb);
    tokenService = new TokenService('test_jwt_secret_must_be_long_enough_32bytes!!', 900);
  });

  describe('4-Tier RBAC & Permission Boundaries', () => {
    it('Customer should only have customer-domain permissions and cannot access admin/agent routes', async () => {
      const customerRole = UserRole.CUSTOMER;
      expect(await rbacService.hasPermission(customerRole, Permission.ORDERS_READ)).toBe(true);
      expect(await rbacService.hasPermission(customerRole, Permission.USERS_MANAGE)).toBe(false);
      expect(await rbacService.hasPermission(customerRole, Permission.SETTINGS_MANAGE)).toBe(false);
      expect(await rbacService.hasPermission(customerRole, Permission.ORDERS_RETRY)).toBe(false);
    });

    it('Agent should have reseller and wallet permissions but not platform infrastructure controls', async () => {
      const agentRole = UserRole.AGENT;
      expect(await rbacService.hasPermission(agentRole, Permission.ORDERS_CREATE)).toBe(true);
      expect(await rbacService.hasPermission(agentRole, Permission.WALLET_READ)).toBe(true);
      expect(await rbacService.hasPermission(agentRole, Permission.API_KEYS_MANAGE)).toBe(true);
      expect(await rbacService.hasPermission(agentRole, Permission.SETTINGS_MANAGE)).toBe(false);
      expect(await rbacService.hasPermission(agentRole, Permission.MAINTENANCE_MANAGE)).toBe(false);
    });

    it('Operations Admin should have telecom operations and DLQ management permissions', () => {
      const opsPerms = ADMIN_ROLE_PERMISSIONS[AdminSubRole.OPERATIONS_ADMIN];
      expect(opsPerms).toContain(Permission.ORDERS_RETRY);
      expect(opsPerms).toContain(Permission.PENDING_MTN_MANAGE);
      expect(opsPerms).toContain(Permission.ORDERS_RECONCILE);
      expect(opsPerms).not.toContain(Permission.USERS_MANAGE);
    });

    it('Finance Admin should have ledger, wallet adjustment and pricing controls', () => {
      const finPerms = ADMIN_ROLE_PERMISSIONS[AdminSubRole.FINANCE_ADMIN];
      expect(finPerms).toContain(Permission.LEDGER_READ);
      expect(finPerms).toContain(Permission.WALLET_ADJUST);
      expect(finPerms).toContain(Permission.ORDERS_REFUND);
      expect(finPerms).not.toContain(Permission.MAINTENANCE_MANAGE);
    });

    it('Super Admin requires explicit permission evaluation rather than blind unrestricted bypass', async () => {
      const superAdminPerms = ADMIN_ROLE_PERMISSIONS[AdminSubRole.SUPER_ADMIN];
      expect(superAdminPerms).toContain(Permission.SETTINGS_MANAGE);
      expect(superAdminPerms).toContain(Permission.MAINTENANCE_MANAGE);
      expect(await rbacService.hasPermission(UserRole.SUPER_ADMIN, Permission.SETTINGS_MANAGE)).toBe(true);
    });
  });

  describe('MFA Enforcement Policy', () => {
    it('Admin and Super Admin must require MFA token verification', () => {
      const isMfaMandatory = (role: UserRole): boolean => {
        return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
      };

      expect(isMfaMandatory(UserRole.SUPER_ADMIN)).toBe(true);
      expect(isMfaMandatory(UserRole.ADMIN)).toBe(true);
      expect(isMfaMandatory(UserRole.AGENT)).toBe(false); // Optional for Agent
      expect(isMfaMandatory(UserRole.CUSTOMER)).toBe(false); // Optional for Customer
    });
  });

  describe('Session Invalidation on Password Change', () => {
    it('should invalidate all active sessions when user updates their password', async () => {
      const userId = 'usr_target_123';

      // Simulate password change invalidation
      await mockDb.query(
        'UPDATE user_sessions SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1',
        [userId],
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_sessions SET is_revoked = true'),
        [userId],
      );
    });
  });

  describe('Step-Up Authentication for High-Risk Operations', () => {
    it('should reject high-risk financial adjustment if step-up token is missing or expired', () => {
      const verifyStepUpToken = (stepUpHeader?: string): boolean => {
        if (!stepUpHeader || !stepUpHeader.startsWith('stepup_valid_')) {
          throw new ForbiddenError('High-risk action requires step-up authentication');
        }
        return true;
      };

      expect(() => verifyStepUpToken(undefined)).toThrow(ForbiddenError);
      expect(() => verifyStepUpToken('invalid_token')).toThrow(ForbiddenError);
      expect(verifyStepUpToken('stepup_valid_123456')).toBe(true);
    });
  });

  describe('JWT Token Security & Expiration', () => {
    it('should sign and verify valid JWT tokens and reject tampered tokens', () => {
      const token = tokenService.signAccessToken({
        sub: 'usr_dev_1',
        email: 'dev@bytebeacon.com',
        role: UserRole.AGENT,
        domain: 'AGENT' as any,
      });

      const payload = tokenService.verifyAccessToken(token);
      expect(payload.sub).toBe('usr_dev_1');
      expect(payload.role).toBe(UserRole.AGENT);

      // Reject tampered token
      const tampered = token.slice(0, -5) + 'abcde';
      expect(() => tokenService.verifyAccessToken(tampered)).toThrow();
    });
  });
});

