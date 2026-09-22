import type pg from 'pg';
import crypto from 'node:crypto';
import { logger } from '../logging/logger.js';
import { EmailService, getEmailService } from '../../infrastructure/email/email.service.js';
import {
  NotificationType,
  NotificationSeverity,
  CommunicationChannel,
  CommunicationPriority,
  CommunicationDeliveryStatus,
} from '@bytebeacon/shared';

export interface InMemoryNotification {
  id: string;
  userId: string;
  userEmail?: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  actionUrl?: string;
  channel: string;
  isRead: boolean;
  createdAt: string;
}

// Global in-memory notification cache so in-app notifications are guaranteed in both PostgreSQL and development/offline environments
export const devNotificationCache = new Map<string, InMemoryNotification[]>();

export interface InAppNotificationOptions {
  userId: string;
  userEmail?: string;
  title: string;
  body: string;
  type?: string;
  severity?: string;
  actionUrl?: string;
}

export interface EmailNotificationOptions {
  to: string;
  subject: string;
  body: string;
  recipientName?: string;
  actionUrl?: string;
  actionButtonText?: string;
}

export interface NotifyUserOptions {
  userId: string;
  title: string;
  body: string;
  type?: string;
  severity?: string;
  actionUrl?: string;
  actionButtonText?: string;
  sendEmail?: boolean;
  emailSubject?: string;
  emailBody?: string;
  priority?: CommunicationPriority;
  email?: string;
  fullName?: string;
  phone?: string;
}

export interface WithdrawalNotificationParams {
  userId: string;
  email?: string;
  fullName?: string;
  amountPesewas: number | string;
  destinationAccount: string;
  destinationProvider?: string;
  bankName?: string;
  status: 'PAID' | 'REJECTED' | 'SCHEDULED' | 'HELD';
  adminNote?: string;
  disbursementReference?: string;
  scheduledAt?: string | null;
}

export class NotificationService {
  private db: pg.Pool;
  private emailService: EmailService;

  constructor(db: pg.Pool, emailService?: EmailService) {
    this.db = db;
    this.emailService = emailService ?? getEmailService();
  }

  /**
   * Insert an in-app notification for a user.
   * Guarantees storage in both centralized in-memory cache and PostgreSQL (when available).
   * Sets both body and message columns to prevent empty-body display bugs.
   */
  public async sendInAppNotification(options: InAppNotificationOptions): Promise<string | null> {
    const {
      userId,
      userEmail,
      title,
      body,
      type = NotificationType.EMERGENCY_BROADCAST,
      severity = NotificationSeverity.INFO,
      actionUrl,
    } = options;

    if (!userId || !title || !body) {
      logger.warn({ userId, title }, '[NotificationService] In-app notification skipped: missing required fields');
      return null;
    }

    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const memItem: InMemoryNotification = {
      id,
      userId,
      userEmail: userEmail?.toLowerCase(),
      type,
      severity,
      title: title.trim(),
      body: body.trim(),
      actionUrl: actionUrl || undefined,
      channel: 'IN_APP',
      isRead: false,
      createdAt: nowIso,
    };

    // 1. Always store in in-memory cache indexed by userId
    const userExisting = devNotificationCache.get(userId) || [];
    devNotificationCache.set(userId, [memItem, ...userExisting]);

    // Also index by email if available so lookup by email immediately succeeds
    if (userEmail && userEmail.includes('@')) {
      const emailExisting = devNotificationCache.get(userEmail.toLowerCase()) || [];
      devNotificationCache.set(userEmail.toLowerCase(), [memItem, ...emailExisting]);
    }

    // 2. Also persist to PostgreSQL when available
    try {
      await this.db.query(
        `INSERT INTO notifications (
           id, user_id, type, severity, title, body, message, action_url, channel, is_read, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'IN_APP', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [id, userId, type, severity, title.trim(), body.trim(), body.trim(), actionUrl || null],
      );
    } catch (err: any) {
      // In-memory cache guarantees the notification is preserved if DB is offline or column schema is evolving
      logger.warn({ err: err?.message, userId, title }, '[NotificationService] DB insert warning, preserved in memory cache');
    }

    return id;
  }

  /**
   * Log an event into communication_delivery_logs for auditing & admin dashboard tracking.
   */
  public async logDelivery(params: {
    messageId?: string;
    recipientUserId?: string | null;
    recipientEmail?: string | null;
    recipientPhone?: string | null;
    channel?: string;
    priority?: string;
    subject: string;
    body: string;
    status?: string;
    errorMessage?: string;
  }): Promise<string | null> {
    const {
      messageId = `msg_${crypto.randomUUID()}`,
      recipientUserId = null,
      recipientEmail = null,
      recipientPhone = null,
      channel = 'IN_APP',
      priority = 'NORMAL',
      subject,
      body,
      status = 'DELIVERED',
      errorMessage = null,
    } = params;

    try {
      const logId = crypto.randomUUID();
      const idempotencyKey = `deliv_${messageId}_${recipientUserId || recipientEmail || 'ext'}_${channel}_${Date.now()}`;
      await this.db.query(
        `INSERT INTO communication_delivery_logs (
           id, message_id, recipient_user_id, recipient_email, recipient_phone,
           channel, priority, subject, body, status, error_message,
           idempotency_key, sent_at, delivered_at, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          logId,
          messageId,
          recipientUserId,
          recipientEmail,
          recipientPhone,
          channel,
          priority,
          subject.trim(),
          body.trim(),
          status,
          errorMessage,
          idempotencyKey,
        ],
      );
      return logId;
    } catch (err: any) {
      logger.warn({ err: err?.message }, '[NotificationService] Failed to write delivery log (non-fatal)');
      return null;
    }
  }

  /**
   * Dispatch a branded transactional email.
   */
  public async sendEmailNotification(options: EmailNotificationOptions): Promise<boolean> {
    const { to, subject, body, recipientName, actionUrl, actionButtonText = 'View Details' } = options;

    if (!to || !to.includes('@') || !subject || !body) {
      logger.warn({ to, subject }, '[NotificationService] Email dispatch skipped: missing required fields');
      return false;
    }

    const sanitizedBody = body
      .trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br/>');

    const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,';
    const frontendBase = process.env.FRONTEND_URL || 'https://www.bytebeacon.online';
    const absoluteActionUrl = actionUrl
      ? actionUrl.startsWith('http://') || actionUrl.startsWith('https://')
        ? actionUrl
        : `${frontendBase.replace(/\/$/, '')}${actionUrl.startsWith('/') ? '' : '/'}${actionUrl}`
      : undefined;

    const actionButtonHtml = absoluteActionUrl
      ? `
      <div style="text-align:center;margin:28px 0;">
        <a href="${absoluteActionUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(180deg, #10B981 0%, #059669 100%);color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;border-radius:8px;box-shadow:0 4px 14px rgba(16, 185, 129, 0.35);">
          ${actionButtonText}
        </a>
      </div>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject.trim()}</title>
</head>
<body style="margin:0;padding:0;background-color:#0A0D14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#E2E8F0;">
  <div style="max-width:560px;margin:32px auto;background-color:#111827;border:1px solid #1F2937;border-radius:14px;padding:32px 28px;box-shadow:0 10px 25px rgba(0,0,0,0.45);">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:22px;font-weight:900;letter-spacing:-0.03em;color:#FFFFFF;">
        Byte<span style="color:#10B981;">Beacon</span>
      </span>
    </div>
    <h2 style="margin:0 0 16px 0;font-size:18px;font-weight:700;color:#F8FAFC;">${subject.trim()}</h2>
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#94A3B8;">${greeting}</p>
    <div style="font-size:14px;line-height:1.7;color:#CBD5E1;margin-bottom:20px;">
      ${sanitizedBody}
    </div>
    ${actionButtonHtml}
    <div style="border-top:1px solid #1F2937;padding-top:16px;margin-top:24px;font-size:12px;color:#64748B;text-align:center;line-height:1.5;">
      Sent securely from <strong>ByteBeacon</strong> &bull; Fast, Reliable Telecom Settlement<br/>
      If you did not expect this message, please contact support at support@bytebeacon.online
    </div>
  </div>
</body>
</html>`;

    try {
      const res = await this.emailService.sendEmail({
        to: to.trim().toLowerCase(),
        subject: subject.trim(),
        text: body.trim(),
        html,
      });
      return res.success;
    } catch (err: any) {
      logger.warn({ err: err?.message, to }, '[NotificationService] Email transmission failed');
      return false;
    }
  }

  /**
   * Unified dispatch: sends both in-app notification and email (when email is available and desired).
   * Automatically queries recipient details if not supplied.
   */
  public async notifyUser(options: NotifyUserOptions): Promise<{ inAppId: string | null; emailSent: boolean }> {
    const {
      userId,
      title,
      body,
      type = 'SYSTEM',
      severity = 'INFO',
      actionUrl,
      actionButtonText,
      sendEmail = true,
      emailSubject,
      emailBody,
      priority = CommunicationPriority.NORMAL,
    } = options;

    let email = options.email;
    let fullName = options.fullName;
    let phone = options.phone;

    // Resolve user details if email or name missing
    if (userId && (!email || !fullName)) {
      try {
        const uRes = await this.db.query<{ email: string; full_name?: string; name?: string; phone?: string }>(
          'SELECT email, full_name, name, phone FROM users WHERE id = $1',
          [userId],
        );
        if (uRes.rows.length > 0) {
          const row = uRes.rows[0];
          email = email || row.email;
          fullName = fullName || row.full_name || row.name;
          phone = phone || row.phone;
        }
      } catch (err: any) {
        logger.warn({ err: err?.message, userId }, '[NotificationService] Could not look up user for notification');
      }
    }

    const messageId = `msg_${crypto.randomUUID()}`;

    // 1. Send In-App Notification (always cached in memory + DB)
    const inAppId = await this.sendInAppNotification({
      userId,
      userEmail: email,
      title,
      body,
      type,
      severity,
      actionUrl,
    });

    // Log In-App delivery
    await this.logDelivery({
      messageId,
      recipientUserId: userId,
      recipientEmail: email,
      recipientPhone: phone,
      channel: CommunicationChannel.IN_APP,
      priority,
      subject: title,
      body,
      status: inAppId ? CommunicationDeliveryStatus.DELIVERED : CommunicationDeliveryStatus.FAILED,
    });

    // 2. Send Transactional Email
    let emailSent = false;
    if (sendEmail && email && email.includes('@')) {
      emailSent = await this.sendEmailNotification({
        to: email,
        subject: emailSubject || title,
        body: emailBody || body,
        recipientName: fullName,
        actionUrl,
        actionButtonText,
      });

      // Log Email delivery
      await this.logDelivery({
        messageId,
        recipientUserId: userId,
        recipientEmail: email,
        recipientPhone: phone,
        channel: CommunicationChannel.EMAIL,
        priority,
        subject: emailSubject || title,
        body: emailBody || body,
        status: emailSent ? CommunicationDeliveryStatus.DELIVERED : CommunicationDeliveryStatus.FAILED,
      });
    }

    return { inAppId, emailSent };
  }

  /**
   * Automated Welcome Notification for new customers.
   */
  public async sendWelcomeCustomer(params: { userId: string; email: string; fullName: string }): Promise<void> {
    const { userId, email, fullName } = params;

    const title = 'Welcome to ByteBeacon! 🎉';
    const body = `Hi ${fullName || 'there'}, your ByteBeacon account is active! You can now browse data bundles, top up your wallet, and enjoy instant telecom delivery across Ghana.`;

    await this.notifyUser({
      userId,
      email,
      fullName,
      title,
      body,
      type: 'NEW_USER_REGISTRATION',
      severity: 'INFO',
      actionUrl: '/dashboard',
      actionButtonText: 'Go to Dashboard',
      sendEmail: true,
      emailSubject: 'Welcome to ByteBeacon — Fast Telecom Data & Bundles',
      emailBody: `Welcome to ByteBeacon! We're excited to have you on board.\n\nYour account has been created successfully. You can now log in, fund your wallet with Mobile Money or card, and buy data bundles at wholesale rates for MTN, Telecel, and AirtelTigo.\n\nNeed assistance? Our support team is always ready to help.`,
    });
  }

  /**
   * Automated "Become an Agent" prompt for non-agent customers.
   */
  public async sendAgentOpportunityPrompt(params: { userId: string; email: string; fullName: string }): Promise<void> {
    const { userId, email, fullName } = params;

    const title = 'Start Your Data Business with ByteBeacon 💼';
    const body = `Did you know you can earn daily commissions by selling data to others? Register as a ByteBeacon Agent to get wholesale pricing, your own customizable online storefront, and automated payouts.`;

    await this.notifyUser({
      userId,
      email,
      fullName,
      title,
      body,
      type: NotificationType.NEW_AGENT_APPLICATION,
      severity: 'INFO',
      actionUrl: '/register-agent',
      actionButtonText: 'Become an Agent',
      sendEmail: true,
      emailSubject: 'Earn Money with ByteBeacon — Become a Data Reseller Agent',
      emailBody: `Hi ${fullName || 'Partner'},\n\nTurn your network into income! As a ByteBeacon Agent, you get access to:\n\n• Deep wholesale discounts on MTN, Telecel, and AirtelTigo data bundles\n• Your own branded online storefront (e.g. apisolutions.store/yourstore)\n• Real-time profit tracking and instant withdrawal to your Mobile Money or bank\n• Automated telecom fulfillment that works 24/7\n\nClick the button below or visit ByteBeacon to activate your agent account today.`,
    });
  }

  /**
   * Automated Welcome Notification for new agents.
   */
  public async sendWelcomeAgent(params: {
    userId: string;
    email: string;
    fullName: string;
    businessName?: string;
  }): Promise<void> {
    const { userId, email, fullName, businessName } = params;

    const title = 'Welcome to the ByteBeacon Agent Network! 🚀';
    const body = `Congratulations ${fullName || 'Agent'}! Your agent reseller account is ready. Visit the Agent Console to customize your storefront, configure your data profit margins, and start selling.`;

    await this.notifyUser({
      userId,
      email,
      fullName,
      title,
      body,
      type: 'STORE_APPROVED',
      severity: 'INFO',
      actionUrl: '/agent/store',
      actionButtonText: 'Open Agent Console',
      sendEmail: true,
      emailSubject: 'Welcome to ByteBeacon Agent Network — Your Store is Ready!',
      emailBody: `Congratulations ${fullName || 'Agent'}!\n\nYour ByteBeacon Agent account${businessName ? ` (${businessName})` : ''} is now active.\n\nHere is how to get started in 3 easy steps:\n1. Open your Agent Store Console\n2. Set your custom bundle retail prices and profit margins\n3. Share your unique storefront link with customers and start receiving orders\n\nAll customer purchases are fulfilled automatically and your profits are credited to your reseller float immediately.`,
    });
  }

  /**
   * Self-healing: ensure a user has received their welcome & agent opportunity messages.
   * Checks both in-memory store and database; dispatches automatically if not yet present.
   */
  public async ensureWelcomeNotifications(params: {
    userId: string;
    email?: string;
    fullName?: string;
    role?: string;
  }): Promise<void> {
    const { userId, email = '', fullName = '', role = 'customer' } = params;
    if (!userId && !email) return;

    // Check in-memory cache first
    const inMemById = userId ? devNotificationCache.get(userId) || [] : [];
    const inMemByEmail = email ? devNotificationCache.get(email.toLowerCase()) || [] : [];
    const allInMem = [...inMemById, ...inMemByEmail];
    const hasWelcomeInMem = allInMem.some(
      (n) => n.type === 'NEW_USER_REGISTRATION' || n.type === 'NEW_AGENT_APPLICATION' || n.title.includes('Welcome')
    );
    if (hasWelcomeInMem) return;

    // Check DB if available
    try {
      const dbCheck = await this.db.query(
        `SELECT id FROM notifications WHERE (user_id = $1 OR user_id = $2) AND (type = 'NEW_USER_REGISTRATION' OR type = 'NEW_AGENT_APPLICATION' OR title ILIKE '%Welcome%') LIMIT 1`,
        [userId, email.toLowerCase()],
      );
      if (dbCheck && dbCheck.rows && dbCheck.rows.length > 0) {
        return;
      }
    } catch {
      // Ignore DB errors in offline/dev environments
    }

    // Auto-dispatch now!
    if (role === 'agent') {
      await this.sendWelcomeAgent({ userId, email, fullName });
    } else {
      await this.sendWelcomeCustomer({ userId, email, fullName });
      await this.sendAgentOpportunityPrompt({ userId, email, fullName });
    }
  }

  /**
   * Automated Withdrawal Payout Notification (Approval, Rejection, or Scheduling).
   * Incorporates the admin's disbursement ID / reference notes directly into the notification.
   */
  public async sendWithdrawalNotification(params: WithdrawalNotificationParams): Promise<void> {
    const {
      userId,
      email,
      fullName,
      amountPesewas,
      destinationAccount,
      destinationProvider,
      bankName,
      status,
      adminNote,
      disbursementReference,
      scheduledAt,
    } = params;

    const amountGhs = (Number(amountPesewas) / 100).toFixed(2);
    const destinationDesc = `${destinationAccount} (${bankName || destinationProvider || 'Mobile Money'})`;
    const noteContent = disbursementReference || adminNote || '';

    let title: string;
    let body: string;
    let emailSubject: string;
    let emailBody: string;
    let severity: string = 'INFO';
    let type: string = 'WITHDRAWAL_APPROVED';

    if (status === 'PAID') {
      title = 'Withdrawal Approved & Settled ✅';
      severity = 'INFO';
      type = 'WITHDRAWAL_APPROVED';
      emailSubject = `Withdrawal Paid: GH₵ ${amountGhs} Disbursed Successfully`;

      body = `Your withdrawal request of GH₵ ${amountGhs} to ${destinationDesc} has been approved and paid.`;
      if (noteContent) {
        body += `\n\nDisbursement Reference: ${noteContent}`;
      }

      emailBody = `Great news! Your payout request has been approved and processed.\n\n• Amount: GH₵ ${amountGhs}\n• Destination: ${destinationDesc}\n• Status: Settled (PAID)`;
      if (noteContent) {
        emailBody += `\n• Disbursement Reference / Note: ${noteContent}`;
      }
      emailBody += `\n\nThe funds should reflect in your account shortly. Thank you for partnering with ByteBeacon!`;
    } else if (status === 'REJECTED') {
      title = 'Withdrawal Request Declined ❌';
      severity = 'WARNING';
      type = 'WITHDRAWAL_REJECTED';
      emailSubject = `Update on Your Withdrawal Request (GH₵ ${amountGhs})`;

      body = `Your withdrawal request of GH₵ ${amountGhs} to ${destinationDesc} was not approved. The amount has been refunded back to your wallet balance.`;
      if (noteContent) {
        body += `\n\nReason: ${noteContent}`;
      }

      emailBody = `We regret to inform you that your withdrawal request for GH₵ ${amountGhs} could not be completed.\n\n• Amount: GH₵ ${amountGhs}\n• Destination: ${destinationDesc}`;
      if (noteContent) {
        emailBody += `\n• Reason for Rejection: ${noteContent}`;
      }
      emailBody += `\n\nThe full amount has been reversed back to your wallet balance. Please verify your payout destination details and contact support if you believe this was an error.`;
    } else if (status === 'SCHEDULED') {
      title = 'Withdrawal Settlement Scheduled 📅';
      severity = 'INFO';
      type = 'STORE_PAYOUT_UPDATE';
      emailSubject = `Withdrawal Scheduled: GH₵ ${amountGhs}`;

      const schedText = scheduledAt ? ` for ${new Date(scheduledAt).toLocaleString()}` : '';
      body = `Your withdrawal of GH₵ ${amountGhs} to ${destinationDesc} has been approved and scheduled for settlement${schedText}.`;
      if (noteContent) {
        body += `\n\nNotes: ${noteContent}`;
      }

      emailBody = `Your withdrawal request has been scheduled for settlement.\n\n• Amount: GH₵ ${amountGhs}\n• Destination: ${destinationDesc}\n• Scheduled Execution: ${scheduledAt ? new Date(scheduledAt).toLocaleString() : 'Upcoming settlement batch'}`;
      if (noteContent) {
        emailBody += `\n• Notes: ${noteContent}`;
      }
      emailBody += `\n\nYou will receive a confirmation once the funds have been dispatched.`;
    } else {
      title = 'Withdrawal Placed on Hold ⚠️';
      severity = 'WARNING';
      type = 'STORE_PAYOUT_UPDATE';
      emailSubject = `Withdrawal On Hold: GH₵ ${amountGhs}`;

      body = `Your withdrawal of GH₵ ${amountGhs} to ${destinationDesc} has been temporarily placed on hold for verification.`;
      if (noteContent) {
        body += `\n\nNotice: ${noteContent}`;
      }

      emailBody = `Your withdrawal request for GH₵ ${amountGhs} has been temporarily placed on hold for routine administrative verification.\n\n• Amount: GH₵ ${amountGhs}\n• Destination: ${destinationDesc}`;
      if (noteContent) {
        emailBody += `\n• Note: ${noteContent}`;
      }
      emailBody += `\n\nOur team is reviewing this payout and will update you shortly.`;
    }

    await this.notifyUser({
      userId,
      email,
      fullName,
      title,
      body,
      type,
      severity,
      actionUrl: '/agent/withdrawals',
      actionButtonText: 'View Withdrawals',
      sendEmail: true,
      emailSubject,
      emailBody,
    });
  }
}
