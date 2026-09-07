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
import { NotFoundError, UnauthorizedError } from '../../core/errors/app-error.js';
import { logger } from '../../core/logging/logger.js';

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

  // Self-heal notifications table in PostgreSQL if missing
  const ensureNotificationsTable = async () => {
    try {
      await db.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
            severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
            title VARCHAR(255) NOT NULL,
            body TEXT NOT NULL DEFAULT '',
            message TEXT,
            action_url VARCHAR(255),
            channel VARCHAR(30) NOT NULL DEFAULT 'IN_APP',
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
        CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
      `);
    } catch (err: any) {
      logger.warn({ err: err?.message }, '[NOTIFICATIONS_SCHEMA] Schema self-heal notice (non-fatal)');
    }
  };
  ensureNotificationsTable().catch(() => {});

  // 1. GET /notifications — List authenticated user's own notifications
  app.get<{
    Querystring: { page?: string; limit?: string; unreadOnly?: string };
  }>(
    '/notifications',
    { preHandler: [authHooks.authenticate()] },
    async (req, reply: FastifyReply) => {
      const userId = req.user?.sub;
      if (!userId) {
        throw new UnauthorizedError('Customer authorization token missing');
      }

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

      let items: UserNotificationItemDto[] = [];
      let total = 0;

      try {
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

        items = itemsRes.rows.map((row: any) => ({
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

        total = Number(countRes.rows[0]?.total ?? 0);
      } catch (err: any) {
        logger.warn({ err: err?.message, userId }, '[NOTIFICATIONS] Non-fatal notification lookup warning');
        // Gracefully return empty notification list on schema/table recovery
      }

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
    { preHandler: [authHooks.authenticate()] },
    async (req, reply: FastifyReply) => {
      const userId = req.user?.sub;
      if (!userId) {
        throw new UnauthorizedError('Customer authorization token missing');
      }

      let total = 0;
      let unread = 0;

      try {
        const countsRes = await db.query<any>(
          `SELECT
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE is_read = false) as unread
           FROM notifications
           WHERE user_id = $1`,
          [userId],
        );

        total = Number(countsRes.rows[0]?.total ?? 0);
        unread = Number(countsRes.rows[0]?.unread ?? 0);
      } catch (err: any) {
        logger.warn({ err: err?.message, userId }, '[NOTIFICATIONS_COUNTS] Non-fatal counts query warning');
      }

      const counts: UserNotificationCountsDto = { total, unread };
      return reply.send({ success: true, data: counts });
    },
  );

  // 3. POST /notifications/:id/read — Mark single notification as read (anti-IDOR guarded)
  app.post<{ Params: { id: string } }>(
    '/notifications/:id/read',
    { preHandler: [authHooks.authenticate()] },
    async (req, reply: FastifyReply) => {
      const userId = req.user?.sub;
      if (!userId) {
        throw new UnauthorizedError('Customer authorization token missing');
      }
      const { id } = req.params;

      try {
        const result = await db.query(
          `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
          [id, userId],
        );

        if (result.rowCount === 0) {
          throw new NotFoundError(`Notification '${id}' not found or unauthorized.`);
        }
      } catch (err: any) {
        if (err instanceof NotFoundError) throw err;
        logger.warn({ err: err?.message, id, userId }, '[NOTIFICATIONS_READ] Non-fatal update warning');
      }

      return reply.send({ success: true, data: { id, isRead: true } });
    },
  );

  // 4. POST /notifications/read-all — Mark all notifications as read for current user
  app.post(
    '/notifications/read-all',
    { preHandler: [authHooks.authenticate()] },
    async (req, reply: FastifyReply) => {
      const userId = req.user?.sub;
      if (!userId) {
        throw new UnauthorizedError('Customer authorization token missing');
      }

      let markedCount = 0;
      try {
        const result = await db.query(
          `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
          [userId],
        );
        markedCount = result.rowCount ?? 0;
      } catch (err: any) {
        logger.warn({ err: err?.message, userId }, '[NOTIFICATIONS_READ_ALL] Non-fatal update warning');
      }

      return reply.send({
        success: true,
        data: { markedCount },
      });
    },
  );

  // 5. DELETE /notifications — Clear notifications for current user
  app.delete<{
    Querystring: { readOnly?: string };
  }>(
    '/notifications',
    { preHandler: [authHooks.authenticate()] },
    async (req, reply: FastifyReply) => {
      const userId = req.user?.sub;
      if (!userId) {
        throw new UnauthorizedError('Customer authorization token missing');
      }
      const readOnly = req.query.readOnly === 'true';

      let clearedCount = 0;
      try {
        let query = `DELETE FROM notifications WHERE user_id = $1`;
        if (readOnly) {
          query += ` AND is_read = true`;
        }
        const result = await db.query(query, [userId]);
        clearedCount = result.rowCount ?? 0;
      } catch (err: any) {
        logger.warn({ err: err?.message, userId }, '[NOTIFICATIONS_DELETE] Non-fatal delete warning');
      }

      return reply.send({
        success: true,
        data: { clearedCount },
      });
    },
  );

  // 6. POST /notifications/clear — Clear notifications alias
  app.post<{
    Body?: { readOnly?: boolean };
  }>(
    '/notifications/clear',
    { preHandler: [authHooks.authenticate()] },
    async (req, reply: FastifyReply) => {
      const userId = req.user?.sub;
      if (!userId) {
        throw new UnauthorizedError('Customer authorization token missing');
      }
      const readOnly = req.body?.readOnly === true;

      let clearedCount = 0;
      try {
        let query = `DELETE FROM notifications WHERE user_id = $1`;
        if (readOnly) {
          query += ` AND is_read = true`;
        }
        const result = await db.query(query, [userId]);
        clearedCount = result.rowCount ?? 0;
      } catch (err: any) {
        logger.warn({ err: err?.message, userId }, '[NOTIFICATIONS_CLEAR] Non-fatal clear warning');
      }

      return reply.send({
        success: true,
        data: { clearedCount },
      });
    },
  );

  // 7. DELETE /notifications/:id — Dismiss/delete single notification (anti-IDOR guarded)
  app.delete<{ Params: { id: string } }>(
    '/notifications/:id',
    { preHandler: [authHooks.authenticate()] },
    async (req, reply: FastifyReply) => {
      const userId = req.user?.sub;
      if (!userId) {
        throw new UnauthorizedError('Customer authorization token missing');
      }
      const { id } = req.params;

      try {
        const result = await db.query(
          `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
          [id, userId],
        );

        if (result.rowCount === 0) {
          throw new NotFoundError(`Notification '${id}' not found or unauthorized.`);
        }
      } catch (err: any) {
        if (err instanceof NotFoundError) throw err;
        logger.warn({ err: err?.message, id, userId }, '[NOTIFICATIONS_DELETE_ITEM] Non-fatal delete warning');
      }

      return reply.send({
        success: true,
        data: { id, deleted: true },
      });
    },
  );
}
