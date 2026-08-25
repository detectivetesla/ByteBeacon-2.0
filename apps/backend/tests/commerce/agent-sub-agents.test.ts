import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { agentRoutes } from '../../src/routes/commerce/agent.routes.js';
import { OrderService } from '../../src/core/commerce/order.service.js';
import { CatalogService } from '../../src/core/commerce/catalog.service.js';
import { IdempotencyService } from '../../src/core/commerce/idempotency.service.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { errorHandler } from '../../src/core/errors/app-error.js';
import { UserRole, SecurityDomain } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Agent Sub-Agents Management Suite (GET, POST, PATCH /agents/sub-agents)', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let orderService: OrderService;
  let catalogService: CatalogService;
  let idempotencyService: IdempotencyService;

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string, params?: any[]) => {
        const sql = query.replace(/\s+/g, ' ');

        // User lookup
        if (sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'usr_agent_parent', status: 'ACTIVE', role: 'agent' }],
          });
        }

        // Parent agent lookup
        if (sql.includes('SELECT id FROM agents WHERE user_id = $1 OR id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'agt_parent_123' }],
          });
        }

        // Sub-agents query strictly for parent_agent_id = $1
        if (sql.includes('WHERE a.parent_agent_id = $1')) {
          if (params && params[0] === 'agt_parent_123') {
            return Promise.resolve({
              rows: [
                {
                  id: 'usr_sub_1',
                  agentTableId: 'agt_sub_1',
                  name: 'Kwame Mensah',
                  email: 'kwame@subagent.com',
                  phone: '0241112233',
                  storeName: 'Kwame Express Data',
                  storeSlug: 'kwame-express-data',
                  storeStatus: 'ONLINE',
                  status: 'ACTIVE',
                  balancePesewas: 15000,
                  commissionRate: 8,
                  ordersCount: 42,
                  successfulOrdersCount: 40,
                  failedOrdersCount: 2,
                  totalSalesPesewas: 52000,
                  createdAt: new Date().toISOString(),
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }

        // Duplicate user check on enrollment
        if (sql.includes('SELECT id FROM users WHERE email = $1 OR phone = $2')) {
          return Promise.resolve({ rows: [] });
        }

        // Insert new user
        if (sql.includes('INSERT INTO users')) {
          return Promise.resolve({
            rows: [{ id: 'usr_sub_new', created_at: new Date().toISOString() }],
          });
        }

        // Insert new agent
        if (sql.includes('INSERT INTO agents')) {
          return Promise.resolve({
            rows: [{ id: 'agt_sub_new' }],
          });
        }

        // Insert store
        if (sql.includes('INSERT INTO stores')) {
          return Promise.resolve({
            rows: [{ id: 'store_sub_new' }],
          });
        }

        // Update sub agent status
        if (sql.includes('UPDATE agents SET status = $1')) {
          if (params && params[2] === 'agt_parent_123') {
            return Promise.resolve({
              rows: [{ id: params[1], status: params[0] }],
            });
          }
          return Promise.resolve({ rows: [] });
        }

        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    mockTokenService = {
      verifyAccessToken: vi.fn().mockResolvedValue({
        sub: 'usr_agent_parent',
        role: UserRole.AGENT,
        domain: SecurityDomain.CUSTOMER,
        email: 'parent@bytebeacon.com',
      }),
    } as unknown as TokenService;

    mockApiKeyService = {
      authenticate: vi.fn(),
    } as unknown as ApiKeyService;

    mockRbacService = {
      hasPermission: vi.fn().mockResolvedValue(true),
    } as unknown as RbacService;

    orderService = {} as unknown as OrderService;
    catalogService = {} as unknown as CatalogService;
    idempotencyService = {} as unknown as IdempotencyService;

    app = Fastify();
    app.setErrorHandler(errorHandler);
    await app.register(agentRoutes, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      orderService,
      catalogService,
      idempotencyService,
    });
    await app.ready();
  });

  it('GET /agents/sub-agents should only return sub-agents linked via parent_agent_id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/agents/sub-agents',
      headers: {
        authorization: 'Bearer valid_parent_token',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.subAgents).toHaveLength(1);
    expect(json.data.subAgents[0].name).toBe('Kwame Mensah');
    expect(json.data.subAgents[0].storeName).toBe('Kwame Express Data');
    expect(json.data.subAgents[0].totalSalesPesewas).toBe(52000);
    expect(json.data.subAgents[0].totalCommissionPesewas).toBe(4160); // 8% of 52000
  });

  it('POST /agents/sub-agents should enroll a new sub-agent under parent_agent_id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/agents/sub-agents',
      headers: {
        authorization: 'Bearer valid_parent_token',
      },
      payload: {
        name: 'Ama Serwaa',
        email: 'ama@subagent.com',
        phone: '0245556677',
        storeName: 'Ama Rapid Bundles',
      },
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.name).toBe('Ama Serwaa');
    expect(json.data.email).toBe('ama@subagent.com');
    expect(json.data.storeName).toBe('Ama Rapid Bundles');
  });

  it('PATCH /agents/sub-agents/:id/status should update sub-agent operational status', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/agents/sub-agents/usr_sub_1/status',
      headers: {
        authorization: 'Bearer valid_parent_token',
      },
      payload: {
        status: 'SUSPENDED',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('SUSPENDED');
  });
});
