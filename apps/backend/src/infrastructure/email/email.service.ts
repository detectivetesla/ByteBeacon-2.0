import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../../core/logging/logger.js';
import { getConfig } from '../../config/env.js';

export interface EmailServiceConfig {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  secure?: boolean;
  from?: string;
  frontendUrl?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isSimulated?: boolean;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private config: EmailServiceConfig;
  private isConfigured: boolean = false;

  constructor(customConfig?: EmailServiceConfig) {
    if (customConfig) {
      this.config = customConfig;
    } else {
      const env = getConfig();
      const host = env.SMTP_HOST || env.SMPT_HOST;
      const port = env.SMTP_PORT || env.SMPT_PORT || 587;
      const user = env.SMTP_USER || env.SMPT_USER;
      const pass = env.SMTP_PASS || env.SMPT_PASS;
      const secure = env.SMTP_SECURE !== undefined ? env.SMTP_SECURE : (port === 465);
      const from = env.SMTP_FROM || 'ByteBeacon <no-reply@bytebeacon.online>';
      const frontendUrl = env.FRONTEND_URL || 'https://www.bytebeacon.online';

      this.config = {
        host,
        port,
        user,
        pass,
        secure,
        from,
        frontendUrl,
      };
    }

    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    let { host, port, user, pass, secure } = this.config;

    // Clean and sanitize string inputs
    host = host ? host.trim().replace(/^["']|["']$/g, '') : undefined;
    user = user ? user.trim().replace(/^["']|["']$/g, '') : undefined;
    pass = pass ? pass.trim().replace(/^["']|["']$/g, '') : undefined;

    const isGmail = Boolean(host && (host.toLowerCase().includes('gmail') || host.toLowerCase() === 'smtp.gmail.com'));

    // Google App Passwords are 16 characters often formatted with spaces (e.g. "abcd efgh ijkl mnop")
    // Strip all internal whitespace so Google SMTP accepts the password
    if (pass && (isGmail || pass.includes(' '))) {
      pass = pass.replace(/\s+/g, '');
    }

    if (host && (user || pass || port)) {
      try {
        const portNum = Number(port) || (isGmail ? 465 : 587);
        const isSecure = secure !== undefined ? secure : (portNum === 465);

        this.transporter = nodemailer.createTransport({
          host: isGmail ? 'smtp.gmail.com' : host,
          port: portNum,
          secure: isSecure,
          auth: user && pass ? {
            user,
            pass,
          } : undefined,
          tls: {
            rejectUnauthorized: false,
          },
          // Generous timeouts to avoid prematurely dropping slow SMTP handshakes
          connectionTimeout: 15000,
          greetingTimeout: 15000,
          socketTimeout: 20000,
        });

        this.isConfigured = true;
        logger.info(
          { host: isGmail ? 'smtp.gmail.com' : host, port: portNum, secure: isSecure, user: user ? `${user.slice(0, 3)}***` : undefined },
          'EmailService: SMTP transport successfully initialized',
        );
      } catch (err: any) {
        this.isConfigured = false;
        logger.error({ error: err.message }, 'EmailService: Failed to initialize SMTP transport');
      }
    } else {
      this.isConfigured = false;
      logger.info('EmailService: SMTP not configured. Operating in mock/development mode.');
    }
  }

  public isReady(): boolean {
    return this.isConfigured && this.transporter !== null;
  }

  public async verifyConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isReady() || !this.transporter) {
      return {
        success: false,
        message: 'SMTP transport is not configured. Provide SMPT_HOST, SMPT_USER, and SMPT_PASS credentials.',
      };
    }

    try {
      await this.transporter.verify();
      return {
        success: true,
        message: 'SMTP server connection verified successfully.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `SMTP connection check failed: ${err.message}`,
      };
    }
  }

  public async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    let fromAddress = options.from || this.config.from || 'ByteBeacon <no-reply@bytebeacon.online>';
    fromAddress = fromAddress.trim().replace(/^["']|["']$/g, '');
    let replyToAddress = fromAddress;

    const isGmail = Boolean(
      this.config.host && (this.config.host.toLowerCase().includes('gmail') || this.config.host.toLowerCase() === 'smtp.gmail.com')
    );

    // Gmail Sender Restriction Resolution:
    // If authenticated via Gmail SMTP using a @gmail.com or @googlemail.com account,
    // Google strictly forbids sending from an unverified external domain (e.g. no-reply@bytebeacon.online)
    // and will reject with "553 5.1.2 Sender address rejected".
    // We automatically preserve the brand display name ("ByteBeacon") while using the authenticated Gmail
    // address as the SMTP From address, and point Reply-To to the intended fromAddress.
    if (isGmail && this.config.user) {
      const authUser = this.config.user.trim().replace(/^["']|["']$/g, '');
      const authDomain = authUser.includes('@') ? authUser.split('@')[1].toLowerCase() : '';

      if (authDomain === 'gmail.com' || authDomain === 'googlemail.com') {
        const nameMatch = fromAddress.match(/^([^<]+)/);
        const displayName = nameMatch ? nameMatch[1].trim().replace(/^["']|["']$/g, '') : 'ByteBeacon';
        replyToAddress = fromAddress;
        fromAddress = `${displayName} <${authUser}>`;
      }
    }

    if (!this.isReady() || !this.transporter) {
      // Mock / Dev fallback: Log the email content safely so local development and tests succeed
      logger.warn(
        {
          to: options.to,
          subject: options.subject,
          previewText: options.text ? options.text.slice(0, 100) : undefined,
        },
        '[EMAIL MOCK/DEV] SMTP transport inactive. Email dispatch simulated successfully. (Set SMPT_HOST, SMPT_PORT, SMPT_USER, SMPT_PASS in your environment to send real emails).',
      );

      return {
        success: true,
        isSimulated: true,
        messageId: `simulated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: fromAddress,
        replyTo: replyToAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      logger.info(
        { messageId: info.messageId, to: options.to, subject: options.subject },
        'EmailService: Email successfully delivered via SMTP',
      );

      return {
        success: true,
        isSimulated: false,
        messageId: info.messageId,
      };
    } catch (err: any) {
      logger.error(
        { error: err.message, to: options.to, subject: options.subject },
        'EmailService: Failed to deliver email via SMTP',
      );

      return {
        success: false,
        isSimulated: false,
        error: err.message,
      };
    }
  }

  public async sendPasswordResetEmail(
    to: string,
    resetLink: string,
    recipientName?: string,
  ): Promise<SendEmailResult> {
    const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,';
    const year = new Date().getFullYear();

    const subject = 'Reset Your ByteBeacon Password';

    const plainText = `${greeting}

We received a request to reset the password for your ByteBeacon account.

Click the link below to choose a new password:
${resetLink}

This password reset link will expire in 15 minutes and can only be used once.

If you did not request this password reset, please ignore this email. Your password will remain unchanged.

Best regards,
The ByteBeacon Team
https://www.bytebeacon.online
`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your ByteBeacon Password</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0A0D14;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #E2E8F0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0A0D14;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .card {
      max-width: 520px;
      margin: 0 auto;
      background-color: #111827;
      border: 1px solid #1F2937;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    .brand-header {
      text-align: center;
      margin-bottom: 28px;
    }
    .brand-logo {
      display: inline-block;
      font-size: 22px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: -0.03em;
      text-decoration: none;
    }
    .brand-accent {
      color: #10B981;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: #F8FAFC;
      margin-top: 0;
      margin-bottom: 16px;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #94A3B8;
      margin: 0 0 18px 0;
    }
    .btn-container {
      text-align: center;
      margin: 30px 0;
    }
    .btn {
      display: inline-block;
      padding: 13px 32px;
      background: linear-gradient(180deg, #10B981 0%, #059669 100%);
      color: #FFFFFF !important;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
      letter-spacing: 0.01em;
    }
    .security-notice {
      background-color: rgba(30, 41, 59, 0.7);
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 14px 16px;
      margin-top: 24px;
    }
    .security-notice p {
      font-size: 12px;
      color: #64748B;
      margin: 0;
      line-height: 1.5;
    }
    .url-fallback {
      margin-top: 20px;
      font-size: 11px;
      color: #64748B;
      word-break: break-all;
      line-height: 1.4;
    }
    .url-fallback a {
      color: #10B981;
      text-decoration: underline;
    }
    .footer {
      text-align: center;
      margin-top: 28px;
      font-size: 12px;
      color: #475569;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="brand-header">
        <a href="https://www.bytebeacon.online" class="brand-logo">
          Byte<span class="brand-accent">Beacon</span>
        </a>
      </div>

      <h1>Password Reset Request</h1>

      <p>${greeting}</p>

      <p>We received a request to reset your password for your ByteBeacon account. Tap the button below to choose a secure new password.</p>

      <div class="btn-container">
        <a href="${resetLink}" class="btn" target="_blank" rel="noopener noreferrer">Reset My Password</a>
      </div>

      <div class="security-notice">
        <p><strong>Note:</strong> This link is single-use and valid for <strong>15 minutes</strong>. If you did not make this request, you can safely ignore this email.</p>
      </div>

      <div class="url-fallback">
        If the button above does not work, copy and paste this link into your browser:<br>
        <a href="${resetLink}">${resetLink}</a>
      </div>
    </div>

    <div class="footer">
      &copy; ${year} ByteBeacon. All rights reserved.<br>
      High-speed automated data delivery and telecom settlement.
    </div>
  </div>
</body>
</html>`;

    return this.sendEmail({
      to,
      subject,
      text: plainText,
      html,
    });
  }
}

// Singleton accessor
let globalEmailService: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!globalEmailService) {
    globalEmailService = new EmailService();
  }
  return globalEmailService;
}

export function setEmailServiceForTesting(service: EmailService | null): void {
  globalEmailService = service;
}
