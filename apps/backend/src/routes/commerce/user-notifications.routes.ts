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
import { NotificationService, devNotificationCache } from '../../core/notifications/notification.service.js';

interface UserNotificationsRouteOptions {
  db: pg.Pool;
  apiKeyService: ApiKeyService;
  tokenService: TokenService;
  rbacService: RbacService;
  notificationService?: NotificationService;
}

export async function userNotificationsRoutes(
  app: FastifyInstance,
  opts: UserNotificationsRouteOptions,
): Promise<void> {
  const { db, apiKeyService, tokenService, rbacService } = opts;
  const notificationService = opts.notificationService ?? new NotificationService(db);
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // Self-heal notifications table in PostgreSQL if missing
  const ensureNotificationsTable = async () => {
    try {
      await db.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(255) PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
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
        ALTER TABLE notifications ALTER COLUMN user_id TYPE VARCHAR(255);
        ALTER TABLE notifications ALTER COLUMN id TYPE VARCHAR(255);
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
      const userEmail = req.user?.email;
      if (!userId) {
        throw new UnauthorizedError('Customer authorization token missing');
      }

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const unreadOnly = req.query.unreadOnly === 'true';

      const conditions = ['(user_id = $1 OR user_id = $2)'];
      const params: any[] = [userId, userEmail?.toLowerCase() || userId];

      if (unreadOnly) {
        conditions.push('is_read = false');
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      let items: UserNotificationItemDto[] = [];
      let total = 0;

      // 1. Query PostgreSQL if online
      try {
        const [itemsRes, countRes] = await Promise.all([
          db.query<any>(
            `SELECT id, type, severity, title, COALESCE(NULLIF(body, ''), message, '') as body, action_url, is_read, channel, created_at
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
          id: String(row.id),
          type: (row.type ?? NotificationType.EMERGENCY_BROADCAST) as NotificationType,
          severity: (row.severity ?? NotificationSeverity.INFO) as NotificationSeverity,
          title: row.title,
          body: row.body || '',
          actionUrl: row.action_url ?? undefined,
          isRead: Boolean(row.is_read),
          channel: (row.channel ?? CommunicationChannel.IN_APP) as CommunicationChannel,
          createdAt: row.created_at?.toISOString?.() ?? row.created_at,
        }));

        total = Number(countRes.rows[0]?.total ?? 0);
      } catch (err: any) {
        logger.warn({ err: err?.message, userId }, '[NOTIFICATIONS] Non-fatal notification lookup warning');
      }

      // 2. Merge with in-memory cache
      const memById = devNotificationCache.get(userId) || [];
      const memByEmail = userEmail ? devNotificationCache.get(userEmail.toLowerCase()) || [] : [];
      const combinedMem = [...memById, ...memByEmail];

      if (combinedMem.length > 0) {
        const seenIds = new Set(items.map((i) => i.id));
        const newFromMem = combinedMem
          .filter((m) => !seenIds.has(m.id))
          .filter((m) => (unreadOnly ? !m.isRead : true))
          .map((m) => ({
            id: m.id,
            type: (m.type ?? NotificationType.EMERGENCY_BROADCAST) as NotificationType,
            severity: (m.severity ?? NotificationSeverity.INFO) as NotificationSeverity,
            title: m.title,
            body: m.body,
            actionUrl: m.actionUrl,
            isRead: m.isRead,
            channel: CommunicationChannel.IN_APP,
            createdAt: m.createdAt,
          }));

        // Deduplicate within newFromMem
        const finalMem: UserNotificationItemDto[] = [];
        for (const nm of newFromMem) {
          if (!seenIds.has(nm.id)) {
            seenIds.add(nm.id);
            finalMem.push(nm);
          }
        }

        items = [...finalMem, ...items];
        total = Math.max(total + finalMem.length, items.length);
      }

      // 3. Self-healing: If user still has 0 notifications, ensure welcome notifications are generated!
      if (total === 0) {
        await notificationService.ensureWelcomeNotifications({
          userId,
          email: userEmail,
          fullName: userEmail ? userEmail.split('@')[0] : 'User',
          role: req.user?.role || 'customer',
        });

        const freshById = devNotificationCache.get(userId) || [];
        const freshByEmail = userEmail ? devNotificationCache.get(userEmail.toLowerCase()) || [] : [];
        const freshCombined = [...freshById, ...freshByEmail];

        const seenIds = new Set<string>();
        for (const m of freshCombined) {
          if (!seenIds.has(m.id)) {
            seenIds.add(m.id);
            items.push({
              id: m.id,
              type: (m.type ?? NotificationType.EMERGENCY_BROADCAST) as NotificationType,
              severity: (m.severity ?? NotificationSeverity.INFO) as NotificationSeverity,
              title: m.title,
              body: m.body,
              actionUrl: m.actionUrl,
              isRead: m.isRead,
              channel: CommunicationChannel.IN_APP,
              createdAt: m.createdAt,
            });
          }
        }
        total = items.length;
      }

      return reply.send({
        success: true,
        data: {
          items,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
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
      const userEmail = req.user?.email;
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

      // Merge with in-memory counts
      const memById = devNotificationCache.get(userId) || [];
      const memByEmail = userEmail ? devNotificationCache.get(userEmail.toLowerCase()) || [] : [];
      const combinedMem = [...memById, ...memByEmail];
      const seenIds = new Set<string>();
      let memTotal = 0;
      let memUnread = 0;

      for (const m of combinedMem) {
        if (!seenIds.has(m.id)) {
          seenIds.add(m.id);
          memTotal++;
          if (!m.isRead) memUnread++;
        }
      }

      total = Math.max(total, memTotal);
      unread = Math.max(unread, memUnread);

      // Self-healing check if user has 0 notifications
      if (total === 0) {
        await notificationService.ensureWelcomeNotifications({
          userId,
          email: userEmail,
          fullName: userEmail ? userEmail.split('@')[0] : 'User',
          role: req.user?.role || 'customer',
        });

        const freshMem = devNotificationCache.get(userId) || [];
        total = freshMem.length;
        unread = freshMem.filter((m) => !m.isRead).length;
      }

      const counts: UserNotificationCountsDto = { total, unread };
      return reply.send({ success: true, data: counts });
    },
  );

  // 3. POST /notifications/:id/read — Mark single notification as read
  app.post<{
    Params: { id: string };
  }>(
    '/notifications/:id/read',
    { preHandler: [authHooks.authenticate()] },
    async (req, reply: FastifyReply) => {
      const { id } = req.params;
      const userId = req.user?.sub;
      if (!userId) {
        throw new UnauthorizedError('Customer authorization token missing');
      }

      try {
        const result = await db.query(
          `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
          [id, userId],
        );

        if (result.rowCount === 0) {
          // Check memory cache before throwing NotFound
          const mem = devNotificationCache.get(userId) || [];
          const found = mem.find((n) => n.id === id);
          if (!found) {
            throw new NotFoundError(`Notification '${id}' not found or unauthorized.`);
          }
        }
      } catch (err: any) {
        if (err instanceof NotFoundError) throw err;
        logger.warn({ err: err?.message, id, userId }, '[NOTIFICATIONS_READ] Non-fatal update warning');
      }

      // Update in-memory cache
      const mem = devNotificationCache.get(userId) || [];
      const item = mem.find((n) => n.id === id);
      if (item) item.isRead = true;

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

      // Update in-memory cache
      const mem = devNotificationCache.get(userId) || [];
      let memMarked = 0;
      for (const n of mem) {
        if (!n.isRead) {
          n.isRead = true;
          memMarked++;
        }
      }

      if (markedCount === 0) {
        markedCount = memMarked;
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
        let query = `DELETE FROM notifications WHERE (user_id = $1 OR user_id = $2)`;
        if (readOnly) {
          query += ` AND is_read = true`;
        }
        const result = await db.query(query, [userId, req.user?.email?.toLowerCase() || userId]);
        clearedCount = result.rowCount ?? 0;
      } catch (err: any) {
        logger.warn({ err: err?.message, userId }, '[NOTIFICATIONS_DELETE] Non-fatal delete warning');
      }

      // Sync in-memory cache
      const mem = devNotificationCache.get(userId) || [];
      if (readOnly) {
        const remaining = mem.filter((n) => !n.isRead);
        clearedCount += mem.length - remaining.length;
        devNotificationCache.set(userId, remaining);
      } else {
        clearedCount += mem.length;
        devNotificationCache.set(userId, []);
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
        let query = `DELETE FROM notifications WHERE (user_id = $1 OR user_id = $2)`;
        if (readOnly) {
          query += ` AND is_read = true`;
        }
        const result = await db.query(query, [userId, req.user?.email?.toLowerCase() || userId]);
        clearedCount = result.rowCount ?? 0;
      } catch (err: any) {
        logger.warn({ err: err?.message, userId }, '[NOTIFICATIONS_CLEAR] Non-fatal clear warning');
      }

      // Sync in-memory cache
      const mem = devNotificationCache.get(userId) || [];
      if (readOnly) {
        const remaining = mem.filter((n) => !n.isRead);
        clearedCount += mem.length - remaining.length;
        devNotificationCache.set(userId, remaining);
      } else {
        clearedCount += mem.length;
        devNotificationCache.set(userId, []);
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
          `DELETE FROM notifications WHERE id = $1 AND (user_id = $2 OR user_id = $3)`,
          [id, userId, req.user?.email?.toLowerCase() || userId],
        );

        if (result.rowCount === 0) {
          const mem = devNotificationCache.get(userId) || [];
          const found = mem.some((n) => n.id === id);
          if (!found) {
            throw new NotFoundError(`Notification '${id}' not found or unauthorized.`);
          }
        }
      } catch (err: any) {
        if (err instanceof NotFoundError) throw err;
        logger.warn({ err: err?.message, id, userId }, '[NOTIFICATIONS_DELETE_ITEM] Non-fatal delete warning');
      }

      // Sync in-memory cache
      const mem = devNotificationCache.get(userId) || [];
      devNotificationCache.set(
        userId,
        mem.filter((n) => n.id !== id),
      );

      return reply.send({
        success: true,
        data: { id, deleted: true },
      });
    },
  );
}
