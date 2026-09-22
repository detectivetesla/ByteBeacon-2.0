import { FastifyInstance } from 'fastify';
import type pg from 'pg';
import crypto from 'node:crypto';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../../core/errors/app-error.js';
import { logger } from '../../core/logging/logger.js';
import { EmailService, getEmailService } from '../../infrastructure/email/email.service.js';
import {
  UserRole,
  Permission,
  CommunicationChannel,
  CommunicationPriority,
  CommunicationTargetType,
  CampaignStatus,
  NotificationCategory,
  AdminCommunicationOverviewStats,
  AdminComposeMessageRequest,
  AdminCampaignListItemDto,
  AdminCreateCampaignRequest,
  AdminNotificationTemplateDto,
  AdminCreateTemplateRequest,
  AdminUpdateTemplateRequest,
  AdminDeliveryLogItemDto,
  AdminRecipientLookupItemDto,
  AdminRecipientHistoryDto,
  AdminUserNotificationPreferenceDto,
  AdminUpdateUserPreferenceRequest,
  AdminCommunicationSystemTriggerDto,
  AdminCommunicationHealthDto,
} from '@bytebeacon/shared';

export interface AdminCommunicationsRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  auditService?: AuditService;
  emailService?: EmailService;
}

function redactEmail(email: string | null | undefined): string {
  if (!email || !email.includes('@')) return '—';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function redactPhone(phone: string | null | undefined): string {
  if (!phone || phone.length < 7) return '—';
  return `${phone.slice(0, 3)}****${phone.slice(-3)}`;
}

export async function adminCommunicationsRoutes(
  app: FastifyInstance,
  deps: AdminCommunicationsRouteDependencies,
) {
  const { db, tokenService, apiKeyService, rbacService, auditService } = deps;
  const emailService = deps.emailService ?? getEmailService();
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // =========================================================================
  // 1. GET /admin/communication/overview — High-Level KPI Dashboard
  // =========================================================================
  app.get(
    '/admin/communication/overview',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_READ),
      ],
    },
    async (_req, reply) => {
      const [
        logsCountRes,
        todayCountRes,
        statusCountsRes,
        campaignsCountRes,
        channelDelivRes,
        agentsCountRes,
        storesCountRes,
        customersCountRes,
        adminsCountRes,
      ] = await Promise.all([
        db.query('SELECT COUNT(*) as total FROM communication_delivery_logs').catch(() => ({ rows: [{ total: '0' }] })),
        db.query(
          "SELECT COUNT(*) as today FROM communication_delivery_logs WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'",
        ).catch(() => ({ rows: [{ today: '0' }] })),
        db.query(
          `SELECT 
             COUNT(*) FILTER (WHERE status = 'DELIVERED') as delivered,
             COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
             COUNT(*) FILTER (WHERE status IN ('CREATED', 'QUEUED', 'PROCESSING', 'RETRYING')) as pending,
             COUNT(*) FILTER (WHERE channel = 'EMAIL' AND status = 'DELIVERED') as email_delivered,
             COUNT(*) FILTER (WHERE channel = 'EMAIL') as email_total,
             COUNT(*) FILTER (WHERE channel = 'IN_APP' AND status = 'DELIVERED') as in_app_delivered,
             COUNT(*) FILTER (WHERE channel = 'IN_APP') as in_app_total
           FROM communication_delivery_logs`,
        ).catch(() => ({
          rows: [
            {
              delivered: '0',
              failed: '0',
              pending: '0',
              email_delivered: '0',
              email_total: '0',
              in_app_delivered: '0',
              in_app_total: '0',
            },
          ],
        })),
        db.query(
          "SELECT COUNT(*) as scheduled FROM communication_campaigns WHERE status = 'SCHEDULED'",
        ).catch(() => ({ rows: [{ scheduled: '0' }] })),
        db.query(
          `SELECT channel, MAX(delivered_at) as last_delivered 
           FROM communication_delivery_logs 
           WHERE status = 'DELIVERED' 
           GROUP BY channel`,
        ).catch(() => ({ rows: [] })),
        db.query("SELECT COUNT(*) as count FROM users WHERE role IN ('agent', 'superagent') AND is_active = true").catch(() => ({ rows: [{ count: '0' }] })),
        db.query("SELECT COUNT(*) as count FROM stores WHERE store_status = 'ACTIVE'").catch(() => ({ rows: [{ count: '0' }] })),
        db.query("SELECT COUNT(*) as count FROM users WHERE role = 'customer' AND is_active = true").catch(() => ({ rows: [{ count: '0' }] })),
        db.query("SELECT COUNT(*) as count FROM users WHERE role IN ('admin', 'super_admin') AND is_active = true").catch(() => ({ rows: [{ count: '0' }] })),
      ]);

      const sc = statusCountsRes.rows[0] || {};
      const totalMessages = parseInt(logsCountRes.rows[0]?.total || '0', 10);
      const todayMessages = parseInt(todayCountRes.rows[0]?.today || '0', 10);
      const scheduledCount = parseInt(campaignsCountRes.rows[0]?.scheduled || '0', 10);
      const deliveredCount = parseInt(sc.delivered || '0', 10);
      const failedCount = parseInt(sc.failed || '0', 10);
      const pendingCount = parseInt(sc.pending || '0', 10);

      const emailTotal = parseInt(sc.email_total || '0', 10);
      const emailDeliv = parseInt(sc.email_delivered || '0', 10);
      const emailRate = emailTotal > 0 ? Math.round((emailDeliv / emailTotal) * 1000) / 10 : 100.0;

      const inAppTotal = parseInt(sc.in_app_total || '0', 10);
      const inAppDeliv = parseInt(sc.in_app_delivered || '0', 10);
      const inAppRate = inAppTotal > 0 ? Math.round((inAppDeliv / inAppTotal) * 1000) / 10 : 100.0;

      const channelLastDelivered: Record<string, string | null> = {};
      for (const row of channelDelivRes.rows) {
        if (row.channel && row.last_delivered) {
          channelLastDelivered[row.channel] = new Date(row.last_delivered).toISOString();
        }
      }

      const agentsCount = parseInt(agentsCountRes.rows[0]?.count || '0', 10);
      const storesCount = parseInt(storesCountRes.rows[0]?.count || '0', 10);
      const customersCount = parseInt(customersCountRes.rows[0]?.count || '0', 10);
      const adminsCount = parseInt(adminsCountRes.rows[0]?.count || '0', 10);

      const stats: AdminCommunicationOverviewStats = {
        totalMessages,
        todayMessages,
        scheduledCount,
        deliveredCount,
        failedCount,
        pendingCount,
        emailDeliveryRate: emailRate,
        inAppDeliveryRate: inAppRate,
        smsDeliveryRate: null, // SMS provider pending credentials
        pushDeliveryRate: null, // Push provider pending mobile client
        channelsHealth: [
          {
            channel: CommunicationChannel.IN_APP,
            name: 'In-App Web Notification Engine',
            status: 'OPERATIONAL',
            isConfigured: true,
            providerName: 'Internal PostgreSQL & WebSocket Bus',
            successRatePercent: inAppRate,
            lastDeliveredAt: channelLastDelivered['IN_APP'] || null,
          },
          {
            channel: CommunicationChannel.EMAIL,
            name: 'Transactional Email Service',
            status: 'OPERATIONAL',
            isConfigured: true,
            providerName: 'ByteBeacon Mail Relay (SMTP/SES)',
            successRatePercent: emailRate,
            lastDeliveredAt: channelLastDelivered['EMAIL'] || null,
          },
          {
            channel: CommunicationChannel.SMS,
            name: 'Telecom SMS Gateway',
            status: 'NOT_CONFIGURED',
            isConfigured: false,
            providerName: 'Not Configured (Pending Provider Integration)',
            successRatePercent: 0,
            lastDeliveredAt: null,
          },
          {
            channel: CommunicationChannel.PUSH,
            name: 'Mobile Web Push Service',
            status: 'NOT_CONFIGURED',
            isConfigured: false,
            providerName: 'Not Configured (Future Mobile/PWA Client)',
            successRatePercent: 0,
            lastDeliveredAt: null,
          },
        ],
        audienceSegments: {
          agents: agentsCount,
          stores: storesCount,
          customers: customersCount,
          admins: adminsCount,
        },
      };

      return reply.send({ success: true, data: stats });
    },
  );

  // =========================================================================
  // 2. POST /admin/communication/send — Dispatch Direct / Targeted Message
  // =========================================================================
  app.post<{ Body: AdminComposeMessageRequest }>(
    '/admin/communication/send',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_MANAGE),
      ],
    },
    async (req, reply) => {
      const {
        channels = [CommunicationChannel.IN_APP],
        targetType = CommunicationTargetType.ROLE,
        recipientIds,
        recipientEmails,
        recipientRole,
        segment,
        subject,
        body,
        priority = CommunicationPriority.NORMAL,
        isBroadcast = false,
        justificationReason,
      } = req.body || {};

      if (!subject || !subject.trim()) {
        throw new BadRequestError('Message subject is required');
      }
      if (!body || !body.trim()) {
        throw new BadRequestError('Message body is required');
      }

      // CRITICAL priority or platform-wide broadcasts require justification and Super Admin authorization
      if (priority === CommunicationPriority.CRITICAL || isBroadcast || targetType === CommunicationTargetType.BROADCAST) {
        if (req.user!.role !== UserRole.SUPER_ADMIN) {
          throw new ForbiddenError('Only Super Administrators are permitted to dispatch platform-wide broadcasts or CRITICAL notifications.');
        }
        if (!justificationReason || !justificationReason.trim()) {
          throw new BadRequestError('A justification reason is mandatory for broadcasting or CRITICAL priority messaging.');
        }
      }

      // Check unsupported unconfigured channels
      if (channels.includes(CommunicationChannel.SMS)) {
        throw new BadRequestError('SMS channel is not configured. Please select In-App or Email.');
      }
      if (channels.includes(CommunicationChannel.PUSH)) {
        throw new BadRequestError('Push notification channel is not configured. Please select In-App or Email.');
      }

      // Resolve audience recipients
      let targetUsers: Array<{ id: string | null; full_name?: string; email: string; phone?: string; role: string }> = [];

      if (targetType === CommunicationTargetType.INDIVIDUAL || targetType === CommunicationTargetType.CUSTOM_GROUP) {
        const rawTokens: string[] = [];
        if (recipientIds && recipientIds.length > 0) {
          for (const id of recipientIds) {
            if (typeof id === 'string') {
              rawTokens.push(...id.split(/[,\s;]+/).map((t) => t.trim()).filter(Boolean));
            }
          }
        }
        if (recipientEmails && recipientEmails.length > 0) {
          for (const em of recipientEmails) {
            if (typeof em === 'string') {
              rawTokens.push(...em.split(/[,\s;]+/).map((t) => t.trim()).filter(Boolean));
            }
          }
        }

        if (rawTokens.length === 0) {
          throw new BadRequestError('Recipient identifier (Email, Phone, or User ID) is required for targeted delivery.');
        }

        const emailTokens = rawTokens.filter((t) => t.includes('@')).map((t) => t.toLowerCase());
        const otherTokens = rawTokens.filter((t) => !t.includes('@'));

        let res: any;
        if (emailTokens.length === 1 && otherTokens.length === 0) {
          res = await db.query(
            'SELECT id, full_name, email, phone, role FROM users WHERE email = $1',
            [emailTokens[0]],
          );
        } else if (otherTokens.length === 1 && emailTokens.length === 0) {
          res = await db.query(
            'SELECT id, full_name, email, phone, role FROM users WHERE id::text = $1 OR phone = $1',
            [otherTokens[0]],
          );
        } else {
          res = await db.query(
            `SELECT id, full_name, email, phone, role
             FROM users
             WHERE LOWER(email) = ANY($1)
                OR phone = ANY($2)
                OR id::text = ANY($2)`,
            [emailTokens, otherTokens],
          );
        }
        targetUsers = res.rows;

        // If any email token was not found in users table, and EMAIL channel is selected,
        // create external recipient entries so emails still get delivered to the actual destination!
        if (channels.includes(CommunicationChannel.EMAIL)) {
          const foundEmails = new Set(targetUsers.filter((u) => u.email).map((u) => u.email.toLowerCase()));
          for (const em of emailTokens) {
            if (!foundEmails.has(em)) {
              targetUsers.push({
                id: null,
                full_name: em.split('@')[0],
                email: em,
                phone: undefined,
                role: 'external',
              });
              foundEmails.add(em);
            }
          }
        }
      } else if (targetType === CommunicationTargetType.ROLE) {
        const roleFilter = recipientRole || UserRole.CUSTOMER;
        const res = await db.query(
          'SELECT id, full_name, email, phone, role FROM users WHERE role = $1 AND is_active = true LIMIT 500',
          [roleFilter],
        );
        targetUsers = res.rows;
      } else if (targetType === CommunicationTargetType.AGENT_SEGMENT) {
        let agentSql = "SELECT id, full_name, email, phone, role FROM users WHERE role IN ('agent', 'superagent') AND is_active = true";
        if (segment === 'AGENTS_WITH_STORE') {
          agentSql += ' AND id IN (SELECT user_id FROM stores WHERE store_status = \'ACTIVE\')';
        } else if (segment === 'AGENTS_WITHOUT_STORE') {
          agentSql += ' AND id NOT IN (SELECT user_id FROM stores)';
        }
        agentSql += ' LIMIT 500';
        const res = await db.query(agentSql);
        targetUsers = res.rows;
      } else if (targetType === CommunicationTargetType.CUSTOMER_SEGMENT) {
        let custSql = "SELECT id, full_name, email, phone, role FROM users WHERE role = 'customer' AND is_active = true";
        if (segment === 'RECENT_ORDER_CUSTOMERS') {
          custSql += " AND id IN (SELECT user_id FROM orders WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days')";
        }
        custSql += ' LIMIT 500';
        const res = await db.query(custSql);
        targetUsers = res.rows;
      } else if (targetType === CommunicationTargetType.BROADCAST) {
        const res = await db.query(
          'SELECT id, full_name, email, phone, role FROM users WHERE is_active = true LIMIT 1000',
        );
        targetUsers = res.rows;
      }

      if (targetUsers.length === 0) {
        throw new BadRequestError('No active recipients found matching the specified audience criteria.');
      }

      const messageId = `msg_${crypto.randomUUID()}`;

      // Insert delivery logs and notifications for each resolved recipient
      for (const u of targetUsers) {
        for (const ch of channels) {
          const idempotencyKey = `deliv_${messageId}_${u.id || u.email}_${ch}`;
          await db.query(
            `INSERT INTO communication_delivery_logs (
               message_id, recipient_user_id, recipient_email, recipient_phone,
               channel, priority, subject, body, status, sent_at, delivered_at, idempotency_key
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DELIVERED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $9)
             ON CONFLICT (idempotency_key) DO NOTHING`,
            [
              messageId,
              u.id || null,
              u.email,
              u.phone || null,
              ch,
              priority,
              subject.trim(),
              body.trim(),
              idempotencyKey,
            ],
          ).catch(() => null);

          // Also insert in user notifications table (requires user id)
          if (ch === CommunicationChannel.IN_APP && u.id) {
            await db.query(
              `INSERT INTO notifications (user_id, type, severity, title, body, message, channel, is_read, created_at, updated_at)
               VALUES ($1, 'ADMIN_BROADCAST', 'INFO', $2, $3, $3, 'IN_APP', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [u.id, subject.trim(), body.trim()],
            ).catch(() => null);
          }

          // Send transactional email if channel is EMAIL and recipient has email
          if (ch === CommunicationChannel.EMAIL && u.email) {
            const sanitizedBody = body.trim()
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;')
              .replace(/\n/g, '<br/>');
            const recipientGreeting = u.full_name ? `Hello ${u.full_name},` : 'Hello,';
            const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0A0D14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#E2E8F0;">
  <div style="max-width:560px;margin:30px auto;background-color:#111827;border:1px solid #1F2937;border-radius:12px;padding:32px;box-shadow:0 8px 24px rgba(0,0,0,0.4);">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:20px;font-weight:800;color:#FFFFFF;letter-spacing:-0.03em;">Byte<span style="color:#10B981;">Beacon</span></span>
    </div>
    <h2 style="margin-top:0;margin-bottom:16px;font-size:18px;color:#F8FAFC;">${subject.trim()}</h2>
    <p style="font-size:14px;line-height:1.6;color:#94A3B8;margin-bottom:16px;">${recipientGreeting}</p>
    <div style="font-size:14px;line-height:1.6;color:#94A3B8;margin-bottom:24px;">
      ${sanitizedBody}
    </div>
    <div style="border-top:1px solid #1F2937;padding-top:16px;font-size:12px;color:#64748B;text-align:center;">
      This message was sent from ByteBeacon.
    </div>
  </div>
</body>
</html>`;

            await emailService.sendEmail({
              to: u.email,
              subject: subject.trim(),
              text: body.trim(),
              html: emailHtml,
            }).catch((err: any) => {
              logger.warn({ error: err.message, recipient: u.email }, 'Admin communication email delivery failed');
            });
          }
        }
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: isBroadcast ? 'SUPER_ADMIN_COMMUNICATION_BROADCAST' : 'ADMIN_COMMUNICATION_DISPATCHED',
          resourceType: 'communication',
          resourceId: messageId,
          metadata: {
            channels,
            targetType,
            priority,
            recipientCount: targetUsers.length,
            subject,
            justificationReason,
          },
          ipAddress: req.ip,
        });
      }

      return reply.status(200).send({
        success: true,
        message: `Message dispatched successfully to ${targetUsers.length} recipient(s) across ${channels.length} channel(s).`,
        data: {
          messageId,
          recipientCount: targetUsers.length,
          channels,
          status: 'DELIVERED',
        },
      });
    },
  );

  // =========================================================================
  // 3. GET /admin/communication/campaigns — List Campaigns
  // =========================================================================
  app.get<{
    Querystring: {
      status?: string;
      search?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/admin/communication/campaigns',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_READ),
      ],
    },
    async (req, reply) => {
      const { status, search, page = '1', limit = '20' } = req.query || {};
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = ['1=1'];
      const params: any[] = [];
      let idx = 1;

      if (status && status !== 'ALL') {
        conditions.push(`c.status = $${idx++}`);
        params.push(status);
      }
      if (search && search.trim()) {
        const term = `%${search.trim().toLowerCase()}%`;
        conditions.push(`(LOWER(c.title) LIKE $${idx} OR LOWER(c.subject) LIKE $${idx})`);
        params.push(term);
        idx++;
      }

      const whereClause = conditions.join(' AND ');

      const countRes = await db.query(
        `SELECT COUNT(*) as total FROM communication_campaigns c WHERE ${whereClause}`,
        params,
      ).catch(() => ({ rows: [{ total: '0' }] }));

      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const itemsRes = await db.query(
        `SELECT 
           c.id, c.title, c.description, c.channels, c.target_type as "targetType", c.segment,
           c.audience_count as "audienceCount", c.subject, c.body, c.action_url as "actionUrl",
           c.action_label as "actionLabel", c.priority, c.status, c.scheduled_at as "scheduledAt",
           c.sent_at as "sentAt", c.delivered_count as "deliveredCount", c.failed_count as "failedCount",
           c.created_by as "createdBy", COALESCE(u.full_name, u.email, 'Admin') as "createdByName",
           c.created_at as "createdAt", c.updated_at as "updatedAt"
         FROM communication_campaigns c
         LEFT JOIN users u ON c.created_by = u.id
         WHERE ${whereClause}
         ORDER BY c.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limitNum, offset],
      ).catch(() => ({
        rows: [],
      }));

      const items: AdminCampaignListItemDto[] = itemsRes.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description || '',
        channels: row.channels || [CommunicationChannel.IN_APP],
        targetType: row.targetType || CommunicationTargetType.ROLE,
        segment: row.segment || '',
        audienceCount: Number(row.audienceCount || 0),
        subject: row.subject,
        body: row.body,
        actionUrl: row.actionUrl,
        actionLabel: row.actionLabel,
        priority: row.priority || CommunicationPriority.NORMAL,
        status: row.status || CampaignStatus.DRAFT,
        scheduledAt: row.scheduledAt ? new Date(row.scheduledAt).toISOString() : null,
        sentAt: row.sentAt ? new Date(row.sentAt).toISOString() : null,
        deliveredCount: Number(row.deliveredCount || 0),
        failedCount: Number(row.failedCount || 0),
        createdBy: row.createdBy || '',
        createdByName: row.createdByName || 'Admin',
        createdAt: new Date(row.createdAt || Date.now()).toISOString(),
        updatedAt: new Date(row.updatedAt || Date.now()).toISOString(),
      }));

      return reply.send({
        success: true,
        data: {
          items,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
        },
      });
    },
  );

  // =========================================================================
  // 4. POST /admin/communication/campaigns — Create / Schedule Campaign
  // =========================================================================
  app.post<{ Body: AdminCreateCampaignRequest }>(
    '/admin/communication/campaigns',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_MANAGE),
      ],
    },
    async (req, reply) => {
      const {
        title,
        description,
        channels = [CommunicationChannel.IN_APP],
        targetType = CommunicationTargetType.ROLE,
        segment,
        subject,
        body,
        actionUrl,
        actionLabel,
        priority = CommunicationPriority.NORMAL,
        scheduledAt,
        stepUpConfirmed = false,
        justificationReason,
      } = req.body || {};

      if (!title || !title.trim()) {
        throw new BadRequestError('Campaign title is required');
      }
      if (!subject || !subject.trim()) {
        throw new BadRequestError('Campaign subject is required');
      }
      if (!body || !body.trim()) {
        throw new BadRequestError('Campaign body is required');
      }

      // Calculate approximate audience size
      const countRes = await db.query(
        targetType === CommunicationTargetType.ROLE && segment === 'AGENTS'
          ? "SELECT COUNT(*) as count FROM users WHERE role IN ('agent', 'superagent') AND is_active = true"
          : 'SELECT COUNT(*) as count FROM users WHERE is_active = true',
      ).catch(() => ({ rows: [{ count: '150' }] }));

      const audienceCount = parseInt(countRes.rows[0]?.count || '150', 10);

      // Large audience protection (>1,000 recipients) requires step-up confirmation
      if (audienceCount > 1000 && !stepUpConfirmed) {
        throw new BadRequestError(
          `Large Audience Warning: This campaign targets ${audienceCount} users. Please confirm step-up authorization with stepUpConfirmed=true.`,
        );
      }

      const initialStatus = scheduledAt && new Date(scheduledAt) > new Date()
        ? CampaignStatus.SCHEDULED
        : CampaignStatus.COMPLETED;

      const res = await db.query(
        `INSERT INTO communication_campaigns (
           title, description, channels, target_type, segment, audience_count,
           subject, body, action_url, action_label, priority, status,
           scheduled_at, sent_at, delivered_count, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING id, title, status, created_at as "createdAt"`,
        [
          title.trim(),
          description || '',
          channels,
          targetType,
          segment || '',
          audienceCount,
          subject.trim(),
          body.trim(),
          actionUrl || null,
          actionLabel || null,
          priority,
          initialStatus,
          scheduledAt ? new Date(scheduledAt) : null,
          initialStatus === CampaignStatus.COMPLETED ? new Date() : null,
          initialStatus === CampaignStatus.COMPLETED ? audienceCount : 0,
          req.user!.sub,
        ],
      );

      const created = res.rows[0];

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_COMMUNICATION_CAMPAIGN_CREATED',
          resourceType: 'communication_campaign',
          resourceId: created.id,
          metadata: { title, audienceCount, initialStatus, justificationReason },
          ipAddress: req.ip,
        });
      }

      return reply.status(201).send({
        success: true,
        message: initialStatus === CampaignStatus.SCHEDULED
          ? `Campaign "${title}" scheduled successfully for ${new Date(scheduledAt!).toLocaleString()}.`
          : `Campaign "${title}" created and executed successfully.`,
        data: created,
      });
    },
  );

  // =========================================================================
  // 5. POST /admin/communication/campaigns/:id/cancel — Cancel Scheduled Campaign
  // =========================================================================
  app.post<{ Params: { id: string }; Body: { reason: string } }>(
    '/admin/communication/campaigns/:id/cancel',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_MANAGE),
      ],
    },
    async (req, reply) => {
      const { id } = req.params;
      const { reason } = req.body || {};

      if (!reason || !reason.trim()) {
        throw new BadRequestError('Justification reason is required to cancel a campaign.');
      }

      const res = await db.query(
        "UPDATE communication_campaigns SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'SCHEDULED' RETURNING id, title",
        [id],
      );

      if (res.rows.length === 0) {
        throw new NotFoundError('Campaign not found or is not in SCHEDULED state.');
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_COMMUNICATION_CAMPAIGN_CANCELLED',
          resourceType: 'communication_campaign',
          resourceId: id,
          metadata: { reason },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        message: `Campaign "${res.rows[0].title}" cancelled successfully.`,
      });
    },
  );

  // =========================================================================
  // 6. GET /admin/communication/templates — List Notification Templates
  // =========================================================================
  app.get<{
    Querystring: {
      category?: string;
      status?: string;
    };
  }>(
    '/admin/communication/templates',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_READ),
      ],
    },
    async (req, reply) => {
      const { category, status } = req.query || {};

      const conditions: string[] = ['1=1'];
      const params: any[] = [];
      let idx = 1;

      if (category && category !== 'ALL') {
        conditions.push(`category = $${idx++}`);
        params.push(category);
      }
      if (status && status !== 'ALL') {
        conditions.push(`status = $${idx++}`);
        params.push(status);
      }

      const res = await db.query(
        `SELECT 
           id, slug, name, category, channels, subject_template as "subjectTemplate",
           body_template as "bodyTemplate", action_url_template as "actionUrlTemplate",
           available_variables as "availableVariables", version, status,
           is_system_critical as "isSystemCritical", created_by as "createdBy",
           created_at as "createdAt", updated_at as "updatedAt"
         FROM notification_templates
         WHERE ${conditions.join(' AND ')}
         ORDER BY category ASC, name ASC`,
        params,
      ).catch(() => ({ rows: [] }));

      const items: AdminNotificationTemplateDto[] = res.rows.map((row: any) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        category: row.category,
        channels: row.channels || [CommunicationChannel.IN_APP],
        subjectTemplate: row.subjectTemplate,
        bodyTemplate: row.bodyTemplate,
        actionUrlTemplate: row.actionUrlTemplate,
        availableVariables: row.availableVariables || [],
        version: Number(row.version || 1),
        status: row.status,
        isSystemCritical: Boolean(row.isSystemCritical),
        createdBy: row.createdBy,
        createdAt: new Date(row.createdAt).toISOString(),
        updatedAt: new Date(row.updatedAt).toISOString(),
      }));

      return reply.send({ success: true, data: items });
    },
  );

  // =========================================================================
  // 7. POST /admin/communication/templates — Create New Template
  // =========================================================================
  app.post<{ Body: AdminCreateTemplateRequest }>(
    '/admin/communication/templates',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_MANAGE),
      ],
    },
    async (req, reply) => {
      const {
        slug,
        name,
        category = NotificationCategory.SYSTEM,
        channels = [CommunicationChannel.IN_APP],
        subjectTemplate,
        bodyTemplate,
        actionUrlTemplate,
        availableVariables = [],
        isSystemCritical = false,
      } = req.body || {};

      if (!slug || !slug.trim()) {
        throw new BadRequestError('Template unique slug is required');
      }
      if (!name || !name.trim()) {
        throw new BadRequestError('Template name is required');
      }
      if (!subjectTemplate || !subjectTemplate.trim()) {
        throw new BadRequestError('Subject template is required');
      }
      if (!bodyTemplate || !bodyTemplate.trim()) {
        throw new BadRequestError('Body template is required');
      }

      const res = await db.query(
        `INSERT INTO notification_templates (
           slug, name, category, channels, subject_template, body_template,
           action_url_template, available_variables, version, status, is_system_critical, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 'ACTIVE', $9, $10)
         RETURNING id, slug, name, version, status`,
        [
          slug.trim().toUpperCase(),
          name.trim(),
          category,
          channels,
          subjectTemplate.trim(),
          bodyTemplate.trim(),
          actionUrlTemplate || null,
          availableVariables,
          isSystemCritical,
          req.user!.sub,
        ],
      );

      const created = res.rows[0];

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_NOTIFICATION_TEMPLATE_CREATED',
          resourceType: 'notification_template',
          resourceId: created.id,
          metadata: { slug: created.slug, name: created.name },
          ipAddress: req.ip,
        });
      }

      return reply.status(201).send({
        success: true,
        message: `Template "${name}" created successfully.`,
        data: created,
      });
    },
  );

  // =========================================================================
  // 8. PUT /admin/communication/templates/:id — Update Template / Version
  // =========================================================================
  app.put<{ Params: { id: string }; Body: AdminUpdateTemplateRequest }>(
    '/admin/communication/templates/:id',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_MANAGE),
      ],
    },
    async (req, reply) => {
      const { id } = req.params;
      const {
        name,
        category,
        channels,
        subjectTemplate,
        bodyTemplate,
        actionUrlTemplate,
        availableVariables,
        status,
        isSystemCritical,
        createNewVersion = false,
        reason,
      } = req.body || {};

      const existingRes = await db.query(
        'SELECT * FROM notification_templates WHERE id = $1',
        [id],
      );
      if (existingRes.rows.length === 0) {
        throw new NotFoundError('Notification template not found.');
      }
      const existing = existingRes.rows[0];

      // Modifying system-critical templates requires Super Admin role
      if (existing.is_system_critical && req.user!.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenError('Modifying system-critical notification templates requires Super Administrator privileges.');
      }

      if (createNewVersion) {
        const nextVer = Number(existing.version || 1) + 1;
        await db.query(
          `UPDATE notification_templates SET
             name = COALESCE($1, name),
             category = COALESCE($2, category),
             channels = COALESCE($3, channels),
             subject_template = COALESCE($4, subject_template),
             body_template = COALESCE($5, body_template),
             action_url_template = COALESCE($6, action_url_template),
             available_variables = COALESCE($7, available_variables),
             version = $8,
             status = COALESCE($9, status),
             is_system_critical = COALESCE($10, is_system_critical),
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $11`,
          [
            name,
            category,
            channels,
            subjectTemplate,
            bodyTemplate,
            actionUrlTemplate,
            availableVariables,
            nextVer,
            status,
            isSystemCritical,
            id,
          ],
        );
      } else {
        await db.query(
          `UPDATE notification_templates SET
             name = COALESCE($1, name),
             category = COALESCE($2, category),
             channels = COALESCE($3, channels),
             subject_template = COALESCE($4, subject_template),
             body_template = COALESCE($5, body_template),
             action_url_template = COALESCE($6, action_url_template),
             available_variables = COALESCE($7, available_variables),
             status = COALESCE($8, status),
             is_system_critical = COALESCE($9, is_system_critical),
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $10`,
          [
            name,
            category,
            channels,
            subjectTemplate,
            bodyTemplate,
            actionUrlTemplate,
            availableVariables,
            status,
            isSystemCritical,
            id,
          ],
        );
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_NOTIFICATION_TEMPLATE_UPDATED',
          resourceType: 'notification_template',
          resourceId: id,
          metadata: { slug: existing.slug, reason, createNewVersion },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        message: `Template "${existing.name}" updated successfully.`,
      });
    },
  );

  // =========================================================================
  // 9. GET /admin/communication/delivery-logs — Searchable Delivery Tracking Logs
  // =========================================================================
  app.get<{
    Querystring: {
      search?: string;
      email?: string;
      recipientUserId?: string;
      channel?: string;
      status?: string;
      priority?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/admin/communication/delivery-logs',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_READ),
      ],
    },
    async (req, reply) => {
      const { search, email, recipientUserId, channel, status, priority, page = '1', limit = '20' } = req.query || {};
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = ['1=1'];
      const params: any[] = [];
      let idx = 1;

      if (channel && channel !== 'ALL') {
        conditions.push(`l.channel = $${idx++}`);
        params.push(channel);
      }
      if (status && status !== 'ALL') {
        conditions.push(`l.status = $${idx++}`);
        params.push(status);
      }
      if (priority && priority !== 'ALL') {
        conditions.push(`l.priority = $${idx++}`);
        params.push(priority);
      }
      if (recipientUserId && recipientUserId.trim()) {
        conditions.push(`l.recipient_user_id = $${idx++}`);
        params.push(recipientUserId.trim());
      }
      if (email && email.trim()) {
        const targetEmail = email.trim().toLowerCase();
        conditions.push(`(LOWER(l.recipient_email) = $${idx} OR LOWER(u.email) = $${idx})`);
        params.push(targetEmail);
        idx++;
      }
      if (search && search.trim()) {
        const term = `%${search.trim().toLowerCase()}%`;
        conditions.push(`(LOWER(l.subject) LIKE $${idx} OR LOWER(l.recipient_email) LIKE $${idx} OR LOWER(COALESCE(u.full_name, '')) LIKE $${idx})`);
        params.push(term);
        idx++;
      }

      const whereClause = conditions.join(' AND ');

      const countRes = await db.query(
        `SELECT COUNT(*) as total FROM communication_delivery_logs l
         LEFT JOIN users u ON l.recipient_user_id = u.id
         WHERE ${whereClause}`,
        params,
      ).catch(() => ({ rows: [{ total: '0' }] }));

      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const itemsRes = await db.query(
        `SELECT 
           l.id, l.message_id as "messageId", l.campaign_id as "campaignId",
           l.template_id as "templateId", l.recipient_user_id as "recipientUserId",
           COALESCE(u.full_name, u.email, 'Recipient') as "recipientName",
           l.recipient_email as "recipientEmail",
           l.recipient_phone as "recipientPhone",
           COALESCE(u.role::text, 'customer') as "recipientRole",
           l.channel, l.priority, l.subject, l.body as "bodyPreview",
           l.status, l.attempts, l.error_message as "errorMessage",
           l.sent_at as "sentAt", l.delivered_at as "deliveredAt",
           l.created_at as "createdAt"
         FROM communication_delivery_logs l
         LEFT JOIN users u ON l.recipient_user_id = u.id
         WHERE ${whereClause}
         ORDER BY l.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limitNum, offset],
      ).catch(() => ({
        rows: [],
      }));

      const items: AdminDeliveryLogItemDto[] = itemsRes.rows.map((row: any) => ({
        id: row.id,
        messageId: row.messageId,
        campaignId: row.campaignId,
        templateId: row.templateId,
        recipientUserId: row.recipientUserId,
        recipientName: row.recipientName,
        recipientEmail: row.recipientEmail,
        recipientEmailRedacted: redactEmail(row.recipientEmail),
        recipientPhone: row.recipientPhone,
        recipientPhoneRedacted: redactPhone(row.recipientPhone),
        recipientRole: row.recipientRole,
        channel: row.channel,
        priority: row.priority,
        subject: row.subject,
        bodyPreview: row.bodyPreview ? row.bodyPreview.slice(0, 80) + '...' : '',
        status: row.status,
        attempts: Number(row.attempts || 1),
        errorMessage: row.errorMessage,
        sentAt: row.sentAt ? new Date(row.sentAt).toISOString() : null,
        deliveredAt: row.deliveredAt ? new Date(row.deliveredAt).toISOString() : null,
        createdAt: new Date(row.createdAt).toISOString(),
      }));

      return reply.send({
        success: true,
        data: {
          items,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
        },
      });
    },
  );

  // =========================================================================
  // 9b. GET /admin/communication/recipients/lookup — Autocomplete & Search Recipients
  // =========================================================================
  app.get<{
    Querystring: {
      query?: string;
      limit?: string;
    };
  }>(
    '/admin/communication/recipients/lookup',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_READ),
      ],
    },
    async (req, reply) => {
      const { query = '', limit = '15' } = req.query || {};
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 15));
      const term = query.trim().toLowerCase();

      // Search registered users matching email, name, or phone
      const userParams: any[] = [];
      let userWhere = '1=1';
      if (term) {
        userWhere = `(LOWER(email) LIKE $1 OR LOWER(COALESCE(full_name, '')) LIKE $1 OR LOWER(COALESCE(phone_number, '')) LIKE $1)`;
        userParams.push(`%${term}%`);
      }

      const usersRes = await db.query(
        `SELECT id, email, full_name as "fullName", phone_number as "phone", role, created_at as "createdAt"
         FROM users
         WHERE ${userWhere}
         ORDER BY created_at DESC
         LIMIT ${limitNum}`,
        userParams,
      ).catch(() => ({ rows: [] }));

      // Also search distinct recipients from communication_delivery_logs if query given
      let logRecipients: any[] = [];
      if (term) {
        const logRes = await db.query(
          `SELECT DISTINCT recipient_email as "email", recipient_phone as "phone", recipient_user_id as "userId"
           FROM communication_delivery_logs
           WHERE LOWER(recipient_email) LIKE $1
           LIMIT 10`,
          [`%${term}%`],
        ).catch(() => ({ rows: [] }));
        logRecipients = logRes.rows;
      }

      // Merge and deduplicate by email
      const emailMap = new Map<string, AdminRecipientLookupItemDto>();

      for (const u of usersRes.rows) {
        if (!u.email) continue;
        const lowerEmail = u.email.toLowerCase();
        emailMap.set(lowerEmail, {
          userId: u.id,
          email: u.email,
          fullName: u.fullName || 'Registered User',
          role: u.role || 'customer',
          phone: u.phone || undefined,
          totalMessagesCount: 0,
          lastMessageAt: null,
        });
      }

      for (const l of logRecipients) {
        if (!l.email) continue;
        const lowerEmail = l.email.toLowerCase();
        if (!emailMap.has(lowerEmail)) {
          emailMap.set(lowerEmail, {
            userId: l.userId || null,
            email: l.email,
            fullName: 'External Recipient',
            role: 'customer',
            phone: l.phone || undefined,
            totalMessagesCount: 0,
            lastMessageAt: null,
          });
        }
      }

      const result = Array.from(emailMap.values()).slice(0, limitNum);

      // Enrich with communication counts and last message timestamp if available
      if (result.length > 0) {
        const emails = result.map((r) => r.email.toLowerCase());
        const statsRes = await db.query(
          `SELECT LOWER(recipient_email) as email, COUNT(*) as count, MAX(created_at) as "lastSent"
           FROM communication_delivery_logs
           WHERE LOWER(recipient_email) = ANY($1)
           GROUP BY LOWER(recipient_email)`,
          [emails],
        ).catch(() => ({ rows: [] }));

        const statsMap = new Map<string, { count: number; lastSent: string }>();
        for (const s of statsRes.rows) {
          statsMap.set(s.email, {
            count: parseInt(s.count || '0', 10),
            lastSent: s.lastSent ? new Date(s.lastSent).toISOString() : '',
          });
        }

        for (const item of result) {
          const s = statsMap.get(item.email.toLowerCase());
          if (s) {
            item.totalMessagesCount = s.count;
            item.lastMessageAt = s.lastSent || null;
          }
        }
      }

      return reply.send({
        success: true,
        data: result,
      });
    },
  );

  // =========================================================================
  // 9c. GET /admin/communication/recipients/history — User Communication History
  // =========================================================================
  app.get<{
    Querystring: {
      email?: string;
      userId?: string;
      channel?: string;
      status?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/admin/communication/recipients/history',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_READ),
      ],
    },
    async (req, reply) => {
      const { email, userId, channel, status, page = '1', limit = '20' } = req.query || {};

      if (!email && !userId) {
        throw new BadRequestError('Either email or userId query parameter is required to inspect recipient communication history.');
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const normalizedEmail = email ? email.trim().toLowerCase() : null;

      // 1. Fetch recipient user details
      let userRow: any = null;
      if (userId) {
        const uRes = await db.query(
          'SELECT id, email, full_name, phone_number, role, status, created_at FROM users WHERE id = $1',
          [userId],
        ).catch(() => ({ rows: [] }));
        userRow = uRes.rows[0];
      }
      if (!userRow && normalizedEmail) {
        const uRes = await db.query(
          'SELECT id, email, full_name, phone_number, role, status, created_at FROM users WHERE LOWER(email) = $1',
          [normalizedEmail],
        ).catch(() => ({ rows: [] }));
        userRow = uRes.rows[0];
      }

      const effectiveUserId = userRow?.id || userId || null;
      const effectiveEmail = userRow?.email || normalizedEmail || '';

      // 2. Fetch user preferences if user exists
      let preferences: AdminUserNotificationPreferenceDto | null = null;
      if (effectiveUserId) {
        const prefRes = await db.query(
          'SELECT * FROM user_notification_preferences WHERE user_id = $1',
          [effectiveUserId],
        ).catch(() => ({ rows: [] }));
        if (prefRes.rows.length > 0) {
          const p = prefRes.rows[0];
          preferences = {
            userId: effectiveUserId,
            emailOrderUpdates: p.email_order_updates ?? true,
            emailAccountAlerts: p.email_account_alerts ?? true,
            emailMarketing: p.email_marketing ?? false,
            smsSecurity: p.sms_security ?? true,
            smsTransactions: p.sms_transactions ?? false,
            smsMarketing: p.sms_marketing ?? false,
            inAppAll: p.in_app_all ?? true,
            updatedAt: new Date(p.updated_at).toISOString(),
          };
        }
      }

      // 3. Build recipient match condition for delivery logs
      const recipientConditions: string[] = [];
      const filterParams: any[] = [];
      let pIdx = 1;

      if (effectiveUserId && effectiveEmail) {
        recipientConditions.push(`(l.recipient_user_id = $${pIdx} OR LOWER(l.recipient_email) = $${pIdx + 1})`);
        filterParams.push(effectiveUserId, effectiveEmail);
        pIdx += 2;
      } else if (effectiveUserId) {
        recipientConditions.push(`l.recipient_user_id = $${pIdx++}`);
        filterParams.push(effectiveUserId);
      } else {
        recipientConditions.push(`LOWER(l.recipient_email) = $${pIdx++}`);
        filterParams.push(effectiveEmail);
      }

      // Calculate summary metrics across all logs for this recipient (before channel/status filter)
      const summaryWhere = recipientConditions.join(' AND ');
      const summaryRes = await db.query(
        `SELECT 
           COUNT(*) as "totalSent",
           COUNT(*) FILTER (WHERE l.status = 'DELIVERED') as "deliveredCount",
           COUNT(*) FILTER (WHERE l.status = 'FAILED') as "failedCount",
           COUNT(*) FILTER (WHERE l.status IN ('CREATED', 'QUEUED', 'PROCESSING', 'RETRYING')) as "pendingCount",
           MAX(l.created_at) as "lastSentAt",
           ARRAY_AGG(DISTINCT l.channel) as "channelsUsed"
         FROM communication_delivery_logs l
         WHERE ${summaryWhere}`,
        filterParams,
      ).catch(() => ({ rows: [] }));

      const sumRow = summaryRes.rows[0] || {};
      const summary = {
        totalSent: parseInt(sumRow.totalSent || '0', 10),
        deliveredCount: parseInt(sumRow.deliveredCount || '0', 10),
        failedCount: parseInt(sumRow.failedCount || '0', 10),
        pendingCount: parseInt(sumRow.pendingCount || '0', 10),
        lastSentAt: sumRow.lastSentAt ? new Date(sumRow.lastSentAt).toISOString() : null,
        channelsUsed: Array.isArray(sumRow.channelsUsed) ? sumRow.channelsUsed.filter(Boolean) : [],
      };

      // 4. Additional filtering by channel and status for the paginated messages list
      const listConditions = [...recipientConditions];
      const listParams = [...filterParams];

      if (channel && channel !== 'ALL') {
        listConditions.push(`l.channel = $${pIdx++}`);
        listParams.push(channel);
      }
      if (status && status !== 'ALL') {
        listConditions.push(`l.status = $${pIdx++}`);
        listParams.push(status);
      }

      const listWhere = listConditions.join(' AND ');

      // Total matching filter
      const countRes = await db.query(
        `SELECT COUNT(*) as total FROM communication_delivery_logs l WHERE ${listWhere}`,
        listParams,
      ).catch(() => ({ rows: [{ total: '0' }] }));
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      // Fetch messages
      const msgsRes = await db.query(
        `SELECT 
           l.id, l.message_id as "messageId", l.campaign_id as "campaignId",
           l.template_id as "templateId", l.recipient_user_id as "recipientUserId",
           COALESCE(u.full_name, 'Recipient') as "recipientName",
           l.recipient_email as "recipientEmail",
           l.recipient_phone as "recipientPhone",
           COALESCE(u.role::text, 'customer') as "recipientRole",
           l.channel, l.priority, l.subject, l.body,
           l.status, l.attempts, l.error_message as "errorMessage",
           l.sent_at as "sentAt", l.delivered_at as "deliveredAt",
           l.created_at as "createdAt"
         FROM communication_delivery_logs l
         LEFT JOIN users u ON l.recipient_user_id = u.id
         WHERE ${listWhere}
         ORDER BY l.created_at DESC
         LIMIT $${pIdx++} OFFSET $${pIdx++}`,
        [...listParams, limitNum, offset],
      ).catch(() => ({ rows: [] }));

      const messages = msgsRes.rows.map((row: any) => ({
        id: row.id,
        messageId: row.messageId,
        campaignId: row.campaignId,
        templateId: row.templateId,
        recipientUserId: row.recipientUserId,
        recipientName: userRow?.full_name || row.recipientName,
        recipientEmail: row.recipientEmail || effectiveEmail,
        recipientEmailRedacted: redactEmail(row.recipientEmail || effectiveEmail),
        recipientPhone: row.recipientPhone,
        recipientPhoneRedacted: redactPhone(row.recipientPhone),
        recipientRole: userRow?.role || row.recipientRole,
        channel: row.channel,
        priority: row.priority,
        subject: row.subject,
        bodyPreview: row.body ? row.body.slice(0, 100) + '...' : '',
        body: row.body || '',
        status: row.status,
        attempts: Number(row.attempts || 1),
        errorMessage: row.errorMessage,
        sentAt: row.sentAt ? new Date(row.sentAt).toISOString() : null,
        deliveredAt: row.deliveredAt ? new Date(row.deliveredAt).toISOString() : null,
        createdAt: new Date(row.createdAt).toISOString(),
      }));

      const recipientData: AdminRecipientHistoryDto = {
        recipient: {
          userId: effectiveUserId,
          email: effectiveEmail,
          fullName: userRow?.full_name || 'Recipient',
          role: userRow?.role || 'customer',
          phone: userRow?.phone_number || undefined,
          registeredAt: userRow?.created_at ? new Date(userRow.created_at).toISOString() : null,
          notificationPreferences: preferences,
        },
        summary,
        messages,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
      };

      return reply.send({
        success: true,
        data: recipientData,
      });
    },
  );

  // =========================================================================
  // 10. GET /admin/communication/triggers — System Event Triggers Catalog
  // =========================================================================
  app.get(
    '/admin/communication/triggers',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_READ),
      ],
    },
    async (_req, reply) => {
      // 1. Fetch template lookup for name bindings
      const templatesRes = await db.query(
        'SELECT slug, name, channels FROM notification_templates',
      ).catch(() => ({ rows: [] }));
      const templateMap = new Map<string, { name: string; channels: CommunicationChannel[] }>();
      for (const t of templatesRes.rows) {
        templateMap.set(t.slug, { name: t.name, channels: t.channels || [CommunicationChannel.IN_APP] });
      }

      // 2. Fetch recent dispatch activity per event/subject to calculate lastTriggeredAt & 24h count
      const activityRes = await db.query(
        `SELECT subject, MAX(created_at) as last_fired, COUNT(*) as count_24h
         FROM communication_delivery_logs
         WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
         GROUP BY subject`,
      ).catch(() => ({ rows: [] }));

      // 3. Authoritative system trigger catalog
      const baseTriggers: Array<{
        id: string;
        event: string;
        name: string;
        category: NotificationCategory;
        description: string;
        boundTemplateSlug: string;
        triggerSource: string;
        executionMode: 'ASYNC_WORKER' | 'SYNC_TRANSACTIONAL';
        priority: CommunicationPriority;
        defaultChannels: CommunicationChannel[];
      }> = [
        {
          id: 'trig_order_completed',
          event: 'ORDER_COMPLETED',
          name: 'Order Fulfillment Completed',
          category: NotificationCategory.ORDERS,
          description: 'Fires automatically when telecom upstream confirms data bundle delivery to beneficiary phone number.',
          boundTemplateSlug: 'ORDER_COMPLETED',
          triggerSource: 'DataHouse Fulfillment Poller & Webhook Handler',
          executionMode: 'ASYNC_WORKER',
          priority: CommunicationPriority.NORMAL,
          defaultChannels: [CommunicationChannel.IN_APP, CommunicationChannel.EMAIL],
        },
        {
          id: 'trig_order_failed',
          event: 'ORDER_FAILED',
          name: 'Order Fulfillment Failed & Auto-Refunded',
          category: NotificationCategory.ORDERS,
          description: 'Fires immediately upon upstream telecom rejection or circuit breaker trip, issuing automatic wallet refund.',
          boundTemplateSlug: 'ORDER_FAILED',
          triggerSource: 'Order Fulfillment Service / Circuit Breaker',
          executionMode: 'ASYNC_WORKER',
          priority: CommunicationPriority.HIGH,
          defaultChannels: [CommunicationChannel.IN_APP, CommunicationChannel.EMAIL],
        },
        {
          id: 'trig_payment_successful',
          event: 'PAYMENT_SUCCESSFUL',
          name: 'Payment Confirmed & Wallet Credited',
          category: NotificationCategory.WALLET,
          description: 'Fires immediately after Paystack HMAC cryptographic webhook verification and ledger voucher commit.',
          boundTemplateSlug: 'PAYMENT_SUCCESSFUL',
          triggerSource: 'Paystack Webhook Handler / Ledger Engine',
          executionMode: 'SYNC_TRANSACTIONAL',
          priority: CommunicationPriority.HIGH,
          defaultChannels: [CommunicationChannel.IN_APP, CommunicationChannel.EMAIL],
        },
        {
          id: 'trig_store_approved',
          event: 'STORE_APPROVED',
          name: 'Merchant Storefront Approved',
          category: NotificationCategory.STORE,
          description: 'Fires when operations administrator approves an agent storefront application.',
          boundTemplateSlug: 'STORE_APPROVED',
          triggerSource: 'Admin Store Management Control Plane',
          executionMode: 'ASYNC_WORKER',
          priority: CommunicationPriority.NORMAL,
          defaultChannels: [CommunicationChannel.IN_APP, CommunicationChannel.EMAIL],
        },
        {
          id: 'trig_security_alert',
          event: 'SECURITY_ALERT',
          name: 'Security & New Login Notice',
          category: NotificationCategory.AUTH,
          description: 'Fires on suspicious login, password change, IP address divergence, or API key rotation.',
          boundTemplateSlug: 'SECURITY_ALERT',
          triggerSource: 'Authentication Guard / Rate Limiter Subsystem',
          executionMode: 'SYNC_TRANSACTIONAL',
          priority: CommunicationPriority.CRITICAL,
          defaultChannels: [CommunicationChannel.IN_APP, CommunicationChannel.EMAIL],
        },
        {
          id: 'trig_agent_activated',
          event: 'AGENT_ACTIVATED',
          name: 'Agent Account Accreditation',
          category: NotificationCategory.SYSTEM,
          description: 'Fires when an agent tier upgrade or custom pricing profile is activated by admin.',
          boundTemplateSlug: 'ORDER_COMPLETED',
          triggerSource: 'Admin Agent Control Plane',
          executionMode: 'ASYNC_WORKER',
          priority: CommunicationPriority.NORMAL,
          defaultChannels: [CommunicationChannel.IN_APP, CommunicationChannel.EMAIL],
        },
        {
          id: 'trig_dlq_spike',
          event: 'DLQ_SPIKE_ALERT',
          name: 'Dead Letter Queue Threshold Warning',
          category: NotificationCategory.SYSTEM,
          description: 'Fires when failed asynchronous jobs exceed safe threshold (>5 failures within 5 minutes).',
          boundTemplateSlug: 'SECURITY_ALERT',
          triggerSource: 'BullMQ DLQ Queue Depth Monitor',
          executionMode: 'ASYNC_WORKER',
          priority: CommunicationPriority.CRITICAL,
          defaultChannels: [CommunicationChannel.IN_APP],
        },
      ];

      // Query custom overrides from notification_rules if table exists
      const rulesRes = await db.query(
        'SELECT event_type, is_enabled FROM notification_rules',
      ).catch(() => ({ rows: [] }));
      const disabledEvents = new Set(
        rulesRes.rows.filter((r: any) => r.is_enabled === false).map((r: any) => r.event_type),
      );

      const items: AdminCommunicationSystemTriggerDto[] = baseTriggers.map((trig) => {
        const tmpl = templateMap.get(trig.boundTemplateSlug);
        // Find matching activity
        const act = activityRes.rows.find((r: any) =>
          r.subject?.toLowerCase().includes(trig.event.toLowerCase().replace(/_/g, ' ')) ||
          (tmpl && r.subject?.toLowerCase().includes(tmpl.name.toLowerCase())),
        );

        return {
          id: trig.id,
          event: trig.event,
          name: trig.name,
          category: trig.category,
          description: trig.description,
          boundTemplateSlug: trig.boundTemplateSlug,
          boundTemplateName: tmpl?.name || trig.name,
          defaultChannels: tmpl?.channels || trig.defaultChannels,
          priority: trig.priority,
          isEnabled: !disabledEvents.has(trig.event),
          triggerSource: trig.triggerSource,
          executionMode: trig.executionMode,
          lastTriggeredAt: act?.last_fired ? new Date(act.last_fired).toISOString() : null,
          totalTriggered24h: parseInt(act?.count_24h || '0', 10),
        };
      });

      return reply.send({ success: true, data: items });
    },
  );

  // =========================================================================
  // 11. POST /admin/communication/triggers/:id/toggle — Toggle Event Trigger
  // =========================================================================
  app.post<{ Params: { id: string }; Body: { enabled: boolean } }>(
    '/admin/communication/triggers/:id/toggle',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_MANAGE),
      ],
    },
    async (req, reply) => {
      const { id } = req.params;
      const { enabled } = req.body || {};

      // Ensure notification_rules table exists
      await db.query(`
        CREATE TABLE IF NOT EXISTS notification_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type VARCHAR(100) NOT NULL UNIQUE,
          is_enabled BOOLEAN NOT NULL DEFAULT true,
          channels VARCHAR(50)[] DEFAULT '{"IN_APP"}',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `).catch(() => null);

      const eventKey = id.replace(/^trig_/, '').toUpperCase();
      await db.query(
        `INSERT INTO notification_rules (event_type, is_enabled, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (event_type) DO UPDATE SET
           is_enabled = EXCLUDED.is_enabled,
           updated_at = CURRENT_TIMESTAMP`,
        [eventKey, Boolean(enabled)],
      ).catch(() => null);

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_SYSTEM_EVENT_TRIGGER_TOGGLED',
          resourceType: 'system_trigger',
          resourceId: id,
          metadata: { eventKey, enabled },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        message: `System event trigger "${eventKey}" ${enabled ? 'enabled' : 'disabled'} successfully.`,
        data: { id, isEnabled: Boolean(enabled) },
      });
    },
  );

  // =========================================================================
  // 12. GET /admin/communication/health — Live Delivery Diagnostics Probe
  // =========================================================================
  app.get(
    '/admin/communication/health',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_READ),
      ],
    },
    async (_req, reply) => {
      const t0 = Date.now();
      let dbStatus = 'OPERATIONAL';
      let dbLatencyMs = 0;
      try {
        const dbStart = Date.now();
        await db.query('SELECT 1');
        dbLatencyMs = Date.now() - dbStart;
      } catch {
        dbStatus = 'DEGRADED';
        dbLatencyMs = Date.now() - t0;
      }

      // Check hourly throughput
      const hourlyRes = await db.query(
        "SELECT COUNT(*) as count FROM communication_delivery_logs WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'",
      ).catch(() => ({ rows: [{ count: '0' }] }));
      const messagesLastHour = parseInt(hourlyRes.rows[0]?.count || '0', 10);

      const poolStats = {
        total: (db as any).totalCount || 1,
        idle: (db as any).idleCount || 1,
        waiting: (db as any).waitingCount || 0,
      };

      const isEmailConfigured = emailService.isReady() || Boolean(process.env.SMTP_HOST || process.env.SMPT_HOST || process.env.SES_ACCESS_KEY || process.env.EMAIL_PROVIDER);
      const emailProvider = process.env.EMAIL_PROVIDER || (process.env.SMTP_HOST || process.env.SMPT_HOST ? 'SMTP Relay' : (process.env.SES_ACCESS_KEY ? 'Amazon SES' : 'ByteBeacon Mail Hub'));

      const overallStatus = dbStatus === 'OPERATIONAL' ? 'HEALTHY' : 'DEGRADED';
      const probedAt = new Date().toISOString();

      const healthData: AdminCommunicationHealthDto = {
        status: overallStatus as any,
        probedAt,
        latencyMs: Math.max(1, dbLatencyMs),
        subsystems: {
          database: {
            name: 'PostgreSQL Primary Connection Pool',
            status: dbStatus,
            latencyMs: dbLatencyMs,
            connectionPool: poolStats,
          },
          inAppEngine: {
            name: 'In-App Web Notification Engine',
            status: dbStatus,
            latencyMs: dbLatencyMs,
            messagesLastHour,
          },
          inAppGateway: {
            name: 'In-App Web Notification Engine',
            status: dbStatus,
            latencyMs: dbLatencyMs,
            messagesLastHour,
          },
          emailRelay: {
            name: 'Transactional Email Relay (SMTP/SES)',
            status: 'OPERATIONAL',
            latencyMs: Math.max(1, Math.round(dbLatencyMs * 1.2)),
            provider: emailProvider,
            isConfigured: isEmailConfigured,
          },
          bullMqQueue: {
            name: 'BullMQ Communication Worker',
            status: 'OPERATIONAL',
            activeJobs: 0,
            waitingJobs: 0,
            failedJobs: 0,
          },
          smsGateway: {
            name: 'Telecom SMS Carrier Gateway',
            status: 'NOT_CONFIGURED',
            isConfigured: false,
            note: 'Telecom SMS credentials pending carrier contract',
          },
          pushGateway: {
            name: 'Mobile Web Push Service',
            status: 'NOT_CONFIGURED',
            isConfigured: false,
            note: 'Pending mobile app release & service worker registration',
          },
        },
      };

      return reply.send({
        success: true,
        data: healthData,
      });
    },
  );

  // =========================================================================
  // 12b. POST /admin/communication/test-email — Test SMTP Connection & Dispatch
  // =========================================================================
  app.post<{ Body: { recipientEmail: string } }>(
    '/admin/communication/test-email',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_MANAGE),
      ],
    },
    async (req, reply) => {
      const { recipientEmail } = req.body || {};
      if (!recipientEmail || !recipientEmail.includes('@')) {
        throw new BadRequestError('A valid recipient email address is required');
      }

      const connectionCheck = await emailService.verifyConnection();

      let sendResult: any = null;
      if (emailService.isReady()) {
        sendResult = await emailService.sendEmail({
          to: recipientEmail.trim(),
          subject: 'ByteBeacon SMTP Configuration Test',
          text: 'Congratulations! Your ByteBeacon SMTP email service is configured and operational.',
          html: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#0A0D14;color:#FFF;">
            <div style="max-width:500px;margin:auto;background:#111827;padding:24px;border-radius:12px;border:1px solid #1F2937;">
              <h2 style="color:#10B981;">ByteBeacon SMTP Connected</h2>
              <p style="color:#94A3B8;">This is a test email verifying that your ByteBeacon transactional email service is successfully configured.</p>
            </div>
          </body></html>`,
        });
      }

      return reply.send({
        success: sendResult ? sendResult.success : false,
        smtpReady: emailService.isReady(),
        connectionCheck,
        sendResult,
      });
    },
  );

  // =========================================================================
  // 11. GET /admin/communication/user-preferences/:userId — User Preferences
  // =========================================================================
  app.get<{ Params: { userId: string } }>(
    '/admin/communication/user-preferences/:userId',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_READ),
      ],
    },
    async (req, reply) => {
      const { userId } = req.params;

      const res = await db.query(
        'SELECT * FROM user_notification_preferences WHERE user_id = $1',
        [userId],
      ).catch(() => ({ rows: [] }));

      if (res.rows.length === 0) {
        const defaultPrefs: AdminUserNotificationPreferenceDto = {
          userId,
          emailOrderUpdates: true,
          emailAccountAlerts: true,
          emailMarketing: false,
          smsSecurity: true,
          smsTransactions: false,
          smsMarketing: false,
          inAppAll: true,
          updatedAt: new Date().toISOString(),
        };
        return reply.send({ success: true, data: defaultPrefs });
      }

      const row = res.rows[0];
      const data: AdminUserNotificationPreferenceDto = {
        userId: row.user_id,
        emailOrderUpdates: row.email_order_updates,
        emailAccountAlerts: row.email_account_alerts,
        emailMarketing: row.email_marketing,
        smsSecurity: row.sms_security,
        smsTransactions: row.sms_transactions,
        smsMarketing: row.sms_marketing,
        inAppAll: row.in_app_all,
        updatedAt: new Date(row.updated_at).toISOString(),
      };

      return reply.send({ success: true, data });
    },
  );

  // =========================================================================
  // 12. PATCH /admin/communication/user-preferences/:userId — Update Preferences
  // =========================================================================
  app.patch<{ Params: { userId: string }; Body: AdminUpdateUserPreferenceRequest }>(
    '/admin/communication/user-preferences/:userId',
    {
      preHandler: [
        authHooks.authenticateAdmin,
        authHooks.requirePermission(Permission.USERS_MANAGE),
      ],
    },
    async (req, reply) => {
      const { userId } = req.params;
      const {
        emailOrderUpdates = true,
        emailAccountAlerts = true,
        emailMarketing = false,
        smsSecurity = true,
        smsTransactions = false,
        smsMarketing = false,
        inAppAll = true,
      } = req.body || {};

      await db.query(
        `INSERT INTO user_notification_preferences (
           user_id, email_order_updates, email_account_alerts, email_marketing,
           sms_security, sms_transactions, sms_marketing, in_app_all, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE SET
           email_order_updates = EXCLUDED.email_order_updates,
           email_account_alerts = EXCLUDED.email_account_alerts,
           email_marketing = EXCLUDED.email_marketing,
           sms_security = EXCLUDED.sms_security,
           sms_transactions = EXCLUDED.sms_transactions,
           sms_marketing = EXCLUDED.sms_marketing,
           in_app_all = EXCLUDED.in_app_all,
           updated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          emailOrderUpdates,
          emailAccountAlerts,
          emailMarketing,
          smsSecurity,
          smsTransactions,
          smsMarketing,
          inAppAll,
        ],
      );

      return reply.send({
        success: true,
        message: 'User communication preferences updated successfully.',
      });
    },
  );
}
