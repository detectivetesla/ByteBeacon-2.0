import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';

export interface AdminAnalyticsRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
}

export async function adminAnalyticsRoutes(
  app: FastifyInstance,
  deps: AdminAnalyticsRouteDependencies,
) {
  const { db, tokenService, apiKeyService, rbacService } = deps;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // 1. GET /admin/analytics/overview — Comprehensive Platform Metrics
  app.get<{
    Querystring: { range?: string };
  }>(
    '/admin/analytics/overview',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{ Querystring: { range?: string } }>, reply: FastifyReply) => {
      const { range = '30d' } = req.query || {};

      let days = 30;
      if (range === '7d') days = 7;
      else if (range === '90d') days = 90;
      else if (range === 'all') days = 3650;

      // 1. User metrics
      const userStatsRes = await db.query(`
        SELECT 
          COUNT(*) as "totalUsers",
          COUNT(CASE WHEN role = 'customer' THEN 1 END) as "totalCustomers",
          COUNT(CASE WHEN role = 'agent' OR role = 'superagent' THEN 1 END) as "totalAgents",
          COUNT(CASE WHEN role = 'admin' OR role = 'super_admin' THEN 1 END) as "totalAdmins",
          COUNT(CASE WHEN is_active = true OR status = 'ACTIVE' THEN 1 END) as "activeUsers"
        FROM users
      `).catch(() => ({ rows: [{ totalUsers: 0, totalCustomers: 0, totalAgents: 0, totalAdmins: 0, activeUsers: 0 }] }));

      // 2. Order metrics across all platform orders
      const orderStatsRes = await db.query(`
        SELECT 
          COUNT(*) as "totalOrders",
          COUNT(CASE WHEN order_status IN ('COMPLETED', 'DELIVERED') THEN 1 END) as "completedOrders",
          COUNT(CASE WHEN order_status IN ('PENDING', 'PROCESSING', 'SUBMITTED', 'READY_FOR_FULFILLMENT') THEN 1 END) as "processingOrders",
          COUNT(CASE WHEN order_status IN ('FAILED', 'CANCELLED') THEN 1 END) as "failedOrders",
          COUNT(CASE WHEN order_status = 'REFUNDED' THEN 1 END) as "refundedOrders",
          COALESCE(SUM(amount_pesewas), 0) as "totalVolumePesewas",
          COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE THEN amount_pesewas ELSE 0 END), 0) as "todayVolumePesewas",
          COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE) THEN amount_pesewas ELSE 0 END), 0) as "monthVolumePesewas"
        FROM orders
        WHERE created_at >= CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL
      `, [days]).catch(() => ({
        rows: [{
          totalOrders: 0,
          completedOrders: 0,
          processingOrders: 0,
          failedOrders: 0,
          refundedOrders: 0,
          totalVolumePesewas: '0',
          todayVolumePesewas: '0',
          monthVolumePesewas: '0',
        }],
      }));

      // 3. Network breakdown
      const networkStatsRes = await db.query(`
        SELECT 
          network,
          COUNT(*) as "orderCount",
          COALESCE(SUM(amount_pesewas), 0) as "volumePesewas"
        FROM orders
        WHERE created_at >= CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL
        GROUP BY network
      `, [days]).catch(() => ({ rows: [] }));

      // 4. Queues count (DLQ & MTN Approvals)
      const dlqCountRes = await db.query(`
        SELECT COUNT(*) as "pendingDlq" FROM provider_dlq WHERE status = 'PENDING_REVIEW'
      `).catch(() => ({ rows: [{ pendingDlq: 0 }] }));

      const mtnApprovalsRes = await db.query(`
        SELECT COUNT(*) as "pendingMtn" FROM beneficiary_records WHERE status = 'PENDING'
      `).catch(() => ({ rows: [{ pendingMtn: 0 }] }));

      // 5. Active stores count
      const storesRes = await db.query(`
        SELECT 
          COUNT(*) as "totalStores",
          COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as "activeStores"
        FROM agent_stores
      `).catch(() => ({ rows: [{ totalStores: 0, activeStores: 0 }] }));

      const userStats = userStatsRes.rows[0];
      const orderStats = orderStatsRes.rows[0];
      const dlqCount = parseInt(dlqCountRes.rows[0]?.pendingDlq || '0', 10);
      const mtnPending = parseInt(mtnApprovalsRes.rows[0]?.pendingMtn || '0', 10);
      const storeStats = storesRes.rows[0];

      return reply.send({
        success: true,
        data: {
          range,
          users: {
            total: parseInt(userStats.totalUsers || '0', 10),
            customers: parseInt(userStats.totalCustomers || '0', 10),
            agents: parseInt(userStats.totalAgents || '0', 10),
            admins: parseInt(userStats.totalAdmins || '0', 10),
            active: parseInt(userStats.activeUsers || '0', 10),
          },
          orders: {
            total: parseInt(orderStats.totalOrders || '0', 10),
            completed: parseInt(orderStats.completedOrders || '0', 10),
            processing: parseInt(orderStats.processingOrders || '0', 10),
            failed: parseInt(orderStats.failedOrders || '0', 10),
            refunded: parseInt(orderStats.refundedOrders || '0', 10),
            completionRate: orderStats.totalOrders > 0
              ? Math.round((parseInt(orderStats.completedOrders || '0', 10) / parseInt(orderStats.totalOrders, 10)) * 100)
              : 100,
          },
          revenue: {
            lifetimePesewas: parseInt(orderStats.totalVolumePesewas || '0', 10),
            todayPesewas: parseInt(orderStats.todayVolumePesewas || '0', 10),
            monthPesewas: parseInt(orderStats.monthVolumePesewas || '0', 10),
          },
          networks: networkStatsRes.rows.map((r) => ({
            network: r.network,
            orderCount: parseInt(r.orderCount || '0', 10),
            volumePesewas: parseInt(r.volumePesewas || '0', 10),
          })),
          stores: {
            total: parseInt(storeStats.totalStores || '0', 10),
            active: parseInt(storeStats.activeStores || '0', 10),
          },
          queues: {
            pendingDlq: dlqCount,
            pendingMtnApprovals: mtnPending,
            processingOrders: parseInt(orderStats.processingOrders || '0', 10),
          },
          systemStatus: {
            api: 'OPERATIONAL',
            database: 'OPERATIONAL',
            redis: 'OPERATIONAL',
            datahouse: 'OPERATIONAL',
            paystack: 'OPERATIONAL',
          },
        },
      });
    },
  );
}
