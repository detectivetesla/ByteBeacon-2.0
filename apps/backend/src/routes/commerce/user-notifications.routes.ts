import { FastifyInstance, FastifyReply } from 'fastify';
import type pg from 'pg';
import {
  NotificationType,
  NotificationSeverity,
  CommunicationChannel,
  UserNotificationItemDto,
  UserNotificationCountsDto,
} from '@bytebeacon/shared';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { NotFoundError } from '../../core/errors/app-error.js';

interface UserNotificationsRouteOptions {
  db: pg.Pool;
  apiKeyService: ApiKeyService;
  tokenService: TokenService;
  rbacService: RbacService;
}

export async function userNotificationsRoutes(
  app: FastifyInstance,
  opts: UserNotificationsRouteOptions,
): Promise<void> {
  const { db, apiKeyService, tokenService, rbacService } = opts;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // 1. GET /notifications — List authenticated user's own notifications
  app.get<{
    Querystring: { page?: string; limit?: string; unreadOnly?: string };
  }>(
    '/notifications',
    { preHandler: [authHooks.authenticate] },
    async (req, reply: FastifyReply) => {
      const userId = req.user!.sub;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const unreadOnly = req.query.unreadOnly === 'true';

      const conditions = ['user_id = $1'];
      const params: any[] = [userId];

      if (unreadOnly) {
        conditions.push('is_read = false');
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const [itemsRes, countRes] = await Promise.all([
        db.query<any>(
          `SELECT id, type, severity, title, body, action_url, is_read, channel, created_at
           FROM notifications
           ${whereClause}
           ORDER BY created_at DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset],
        ),
        db.query<any>(
          `SELECT COUNT(*) as total FROM notifications ${whereClause}`,
          params,
        ),
      ]);

      const items: UserNotificationItemDto[] = itemsRes.rows.map((row: any) => ({
        id: row.id,
        type: (row.type ?? NotificationType.EMERGENCY_BROADCAST) as NotificationType,
        severity: (row.severity ?? NotificationSeverity.INFO) as NotificationSeverity,
        title: row.title,
        body: row.body,
        actionUrl: row.action_url ?? undefined,
        isRead: Boolean(row.is_read),
        channel: (row.channel ?? CommunicationChannel.IN_APP) as CommunicationChannel,
        createdAt: row.created_at?.toISOString?.() ?? row.created_at,
      }));

      const total = Number(countRes.rows[0]?.total ?? 0);

      return reply.send({
        success: true,
        data: {
          items,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    },
  );

  // 2. GET /notifications/counts — User unread/total notification counts
  app.get(
    '/notifications/counts',
    { preHandler: [authHooks.authenticate] },
    async (req, reply: FastifyReply) => {
      const userId = req.user!.sub;

      const countsRes = await db.query<any>(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE is_read = false) as unread
         FROM notifications
         WHERE user_id = $1`,
        [userId],
      );

      const counts: UserNotificationCountsDto = {
        total: Number(countsRes.rows[0]?.total ?? 0),
        unread: Number(countsRes.rows[0]?.unread ?? 0),
      };

      return reply.send({ success: true, data: counts });
    },
  );

  // 3. POST /notifications/:id/read — Mark single notification as read (anti-IDOR guarded)
  app.post<{ Params: { id: string } }>(
    '/notifications/:id/read',
    { preHandler: [authHooks.authenticate] },
    async (req, reply: FastifyReply) => {
      const userId = req.user!.sub;
      const { id } = req.params;

      const result = await db.query(
        `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );

      if (result.rowCount === 0) {
        throw new NotFoundError(`Notification '${id}' not found or unauthorized.`);
      }

      return reply.send({ success: true, data: { id, isRead: true } });
    },
  );

  // 4. POST /notifications/read-all — Mark all notifications as read for current user
  app.post(
    '/notifications/read-all',
    { preHandler: [authHooks.authenticate] },
    async (req, reply: FastifyReply) => {
      const userId = req.user!.sub;

      const result = await db.query(
        `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
        [userId],
      );

      return reply.send({
        success: true,
        data: { markedCount: result.rowCount ?? 0 },
      });
    },
  );
}
