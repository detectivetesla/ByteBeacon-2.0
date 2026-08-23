import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { FeatureFlagService } from '../../src/infrastructure/features/feature-flag.service.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { UserRole, SecurityDomain, Permission } from '@bytebeacon/shared';

describe('ByteBeacon 2.0 — Emergency Maintenance Mode Integration Suite', () => {
  const jwtSecret = 'test_jwt_secret_key_32_characters_long_min!';
  let tokenService: TokenService;
  let flagService: FeatureFlagService;

  beforeEach(() => {
    delete process.env.FF_MAINTENANCE_MODE;
    tokenService = new TokenService(jwtSecret);
    flagService = new FeatureFlagService(null);
  });

  afterEach(() => {
    delete process.env.FF_MAINTENANCE_MODE;
    flagService.clearAllOverrides();
  });

  it('GET /platform/status should return OPERATIONAL by default', async () => {
    const app = createApp({
      featureFlagService: flagService,
      tokenService,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/platform/status',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.isMaintenanceMode).toBe(false);
    expect(body.data.platformStatus).toBe('OPERATIONAL');
  });

  it('GET /api/v1/platform/status should return MAINTENANCE when maintenance flag is enabled', async () => {
    flagService.setOverride('MAINTENANCE_MODE', true);

    const app = createApp({
      featureFlagService: flagService,
      tokenService,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/platform/status',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.isMaintenanceMode).toBe(true);
    expect(body.data.platformStatus).toBe('MAINTENANCE');
    expect(body.data.message).toContain('Scheduled Maintenance in Progress');
  });

  it('POST /orders should return 503 MAINTENANCE_MODE_ACTIVE for customers during maintenance', async () => {
    flagService.setOverride('MAINTENANCE_MODE', true);

    const customerToken = tokenService.signAccessToken({
      sub: '00000000-0000-0000-0000-000000000001',
      email: 'customer@example.com',
      role: UserRole.CUSTOMER,
      domain: SecurityDomain.CUSTOMER,
    });

    const mockDb: any = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM users WHERE uuid = $1')) {
          return {
            rows: [{
              id: '00000000-0000-0000-0000-000000000001',
              uuid: '00000000-0000-0000-0000-000000000001',
              email: 'customer@example.com',
              role: 'customer',
              status: 'ACTIVE',
              is_active: true,
            }],
          };
        }
        return { rows: [] };
      }),
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      }),
    };

    const mockRbac: any = {
      hasPermission: vi.fn().mockResolvedValue(true),
    };

    const app = createApp({
      dbPool: mockDb,
      featureFlagService: flagService,
      tokenService,
      rbacService: mockRbac,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        authorization: `Bearer ${customerToken}`,
      },
      payload: {
        productId: 'prod_123',
        recipientPhone: '0244123456',
      },
    });

    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('MAINTENANCE_MODE_ACTIVE');
    expect(body.error.message).toContain('scheduled maintenance');
  });

  it('POST /orders should allow SUPER_ADMIN to bypass maintenance mode', async () => {
    flagService.setOverride('MAINTENANCE_MODE', true);

    const adminToken = tokenService.signAccessToken({
      sub: '00000000-0000-0000-0000-000000000002',
      email: 'admin@bytebeacon.com',
      role: UserRole.SUPER_ADMIN,
      domain: SecurityDomain.ADMIN,
    });

    const mockDb: any = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM users WHERE uuid = $1')) {
          return {
            rows: [{
              id: '00000000-0000-0000-0000-000000000002',
              uuid: '00000000-0000-0000-0000-000000000002',
              email: 'admin@bytebeacon.com',
              role: 'super_admin',
              status: 'ACTIVE',
              is_active: true,
            }],
          };
        }
        return { rows: [] };
      }),
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      }),
    };

    const mockRbac: any = {
      hasPermission: vi.fn().mockResolvedValue(true),
    };

    const mockOrderService: any = {
      createOrder: vi.fn().mockResolvedValue({
        order: {
          id: 'ord_test_admin',
          publicId: 'ord_test_admin',
          status: 'PENDING',
        },
        isIdempotentReplay: false,
      }),
    };

    const app = createApp({
      dbPool: mockDb,
      featureFlagService: flagService,
      tokenService,
      rbacService: mockRbac,
      orderService: mockOrderService,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        productId: 'prod_123',
        recipientPhone: '0244123456',
      },
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(mockOrderService.createOrder).toHaveBeenCalled();
  });
});
