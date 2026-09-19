import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import nodemailer from 'nodemailer';
import { EmailService } from '../../src/infrastructure/email/email.service.js';
import { loadConfig } from '../../src/config/env.js';
import { createApp } from '../../src/app.js';
import { PasswordHasher } from '../../src/core/security/password-hasher.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { SessionService } from '../../src/core/security/session.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import { RateLimiterService } from '../../src/core/security/rate-limiter.service.js';
import type pg from 'pg';

describe('Transactional Email & SMTP/SMPT Configuration', () => {
  const baseEnv: Record<string, string | undefined> = {
    NODE_ENV: 'test',
    JWT_SECRET: '0123456789abcdef0123456789abcdef',
    ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    CORS_ORIGINS: 'http://localhost:5173',
  };

  it('should recognize and cross-mirror SMPT_* environment variables', () => {
    const config = loadConfig({
      ...baseEnv,
      SMPT_HOST: 'smtp.sendgrid.net',
      SMPT_PORT: '465',
      SMPT_USER: 'apikey',
      SMPT_PASS: 'SG.test_password_secret',
      SMPT_FROM: 'ByteBeacon Support <support@bytebeacon.online>',
      APP_URL: 'https://www.bytebeacon.online',
    });

    // Test that user-requested SMPT_* variables are properly loaded and mapped to SMTP_*
    expect(config.SMPT_HOST).toBe('smtp.sendgrid.net');
    expect(config.SMTP_HOST).toBe('smtp.sendgrid.net');
    expect(config.SMPT_PORT).toBe(465);
    expect(config.SMTP_PORT).toBe(465);
    expect(config.SMPT_USER).toBe('apikey');
    expect(config.SMTP_USER).toBe('apikey');
    expect(config.SMPT_PASS).toBe('SG.test_password_secret');
    expect(config.SMTP_PASS).toBe('SG.test_password_secret');
    expect(config.FRONTEND_URL).toBe('https://www.bytebeacon.online');
  });

  it('should handle standard SMTP_* environment variables and map them to SMPT_*', () => {
    const config = loadConfig({
      ...baseEnv,
      SMTP_HOST: 'smtp.mailgun.org',
      SMTP_PORT: '587',
      SMTP_USER: 'postmaster@bytebeacon.online',
      SMTP_PASS: 'mailgun_secret_pass',
    });

    expect(config.SMTP_HOST).toBe('smtp.mailgun.org');
    expect(config.SMPT_HOST).toBe('smtp.mailgun.org');
    expect(config.SMTP_PORT).toBe(587);
    expect(config.SMPT_PORT).toBe(587);
    expect(config.SMTP_USER).toBe('postmaster@bytebeacon.online');
    expect(config.SMPT_USER).toBe('postmaster@bytebeacon.online');
  });
});

describe('EmailService Unit Tests', () => {
  let sendMailMock: any;
  let verifyMock: any;

  beforeEach(() => {
    sendMailMock = vi.fn().mockResolvedValue({ messageId: 'msg_test_123' });
    verifyMock = vi.fn().mockResolvedValue(true);

    vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail: sendMailMock,
      verify: verifyMock,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize transporter when host and credentials are provided', () => {
    const service = new EmailService({
      host: 'smtp.bytebeacon.online',
      port: 587,
      user: 'admin@bytebeacon.online',
      pass: 'secure_smpt_pass',
      from: 'ByteBeacon <no-reply@bytebeacon.online>',
      frontendUrl: 'https://www.bytebeacon.online',
    });

    expect(service.isReady()).toBe(true);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.bytebeacon.online',
        port: 587,
        secure: false,
        auth: {
          user: 'admin@bytebeacon.online',
          pass: 'secure_smpt_pass',
        },
      }),
    );
  });

  it('should verify SMTP connection successfully', async () => {
    const service = new EmailService({
      host: 'smtp.bytebeacon.online',
      port: 587,
      user: 'admin@bytebeacon.online',
      pass: 'secure_smpt_pass',
    });

    const status = await service.verifyConnection();
    expect(status.success).toBe(true);
    expect(verifyMock).toHaveBeenCalled();
  });

  it('should send email using nodemailer transport', async () => {
    const service = new EmailService({
      host: 'smtp.bytebeacon.online',
      port: 587,
      user: 'admin@bytebeacon.online',
      pass: 'secure_smpt_pass',
      from: 'ByteBeacon <no-reply@bytebeacon.online>',
    });

    const result = await service.sendEmail({
      to: 'customer@example.com',
      subject: 'Welcome to ByteBeacon',
      html: '<p>Hello!</p>',
      text: 'Hello!',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg_test_123');
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        subject: 'Welcome to ByteBeacon',
        from: 'ByteBeacon <no-reply@bytebeacon.online>',
      }),
    );
  });

  it('should generate properly branded password reset email with correct reset link', async () => {
    const service = new EmailService({
      host: 'smtp.bytebeacon.online',
      port: 587,
      user: 'admin@bytebeacon.online',
      pass: 'secure_smpt_pass',
      from: 'ByteBeacon <no-reply@bytebeacon.online>',
    });

    const resetLink = 'https://www.bytebeacon.online/reset-password?token=secret-token-abc';
    const result = await service.sendPasswordResetEmail('alice@example.com', resetLink, 'Alice');

    expect(result.success).toBe(true);
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const callArgs = sendMailMock.mock.calls[0][0];
    expect(callArgs.to).toBe('alice@example.com');
    expect(callArgs.subject).toBe('Reset Your ByteBeacon Password');
    expect(callArgs.text).toContain('Hello Alice,');
    expect(callArgs.text).toContain(resetLink);
    expect(callArgs.text).toContain('expire in 15 minutes');
    expect(callArgs.html).toContain('Reset Your ByteBeacon Password');
    expect(callArgs.html).toContain(resetLink);
    expect(callArgs.html).toContain('Alice');
  });

  it('should operate safely in mock/dev mode when SMTP credentials are not configured', async () => {
    const service = new EmailService({});

    expect(service.isReady()).toBe(false);

    // Should not crash and should return simulated message ID
    const result = await service.sendPasswordResetEmail(
      'dev@example.com',
      'https://www.bytebeacon.online/reset-password?token=mock-token',
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^simulated-/);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});

describe('Forgot Password Flow with EmailService Integration', () => {
  const hasher = new PasswordHasher({ memoryCost: 4096, timeCost: 2, parallelism: 1 });
  const tokenService = new TokenService('0123456789abcdef0123456789abcdef');

  it('should dispatch password reset email and log delivery to communication logs', async () => {
    const sendPasswordResetEmailSpy = vi.fn().mockResolvedValue({
      success: true,
      messageId: 'mail_reset_test_123',
    });

    const mockEmailService = {
      isReady: () => true,
      sendPasswordResetEmail: sendPasswordResetEmailSpy,
      sendEmail: vi.fn(),
      verifyConnection: vi.fn().mockResolvedValue({ success: true, message: 'OK' }),
    } as unknown as EmailService;

    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('SELECT id, email, full_name FROM users')) {
          return Promise.resolve({
            rows: [{ id: 'usr_forgot_1', email: 'merchant@bytebeacon.online', full_name: 'Merchant Joe' }],
          });
        }
        if (q.includes('INSERT INTO password_resets')) {
          return Promise.resolve({ rows: [{ id: 'pwr_1' }] });
        }
        if (q.includes('INSERT INTO communication_delivery_logs')) {
          return Promise.resolve({ rows: [{ id: 'deliv_1' }] });
        }
        if (q.includes('INSERT INTO audit_logs')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const sessionService = new SessionService(mockDb, null);
    const apiKeyService = new ApiKeyService(mockDb);
    const rbacService = new RbacService(mockDb);
    const auditService = new AuditService(mockDb);
    const rateLimiter = new RateLimiterService(null);

    const app = createApp({
      dbPool: mockDb,
      hasher,
      tokenService,
      sessionService,
      apiKeyService,
      rbacService,
      auditService,
      rateLimiter,
      emailService: mockEmailService,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: {
        email: 'merchant@bytebeacon.online',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // Verify email service was called with correct recipient, generated link, and user name
    expect(sendPasswordResetEmailSpy).toHaveBeenCalledTimes(1);
    const [recipientEmail, link, fullName] = sendPasswordResetEmailSpy.mock.calls[0];
    expect(recipientEmail).toBe('merchant@bytebeacon.online');
    expect(link).toContain('/reset-password?token=');
    expect(fullName).toBe('Merchant Joe');

    // Verify communication_delivery_logs was updated
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO communication_delivery_logs'),
      expect.arrayContaining(['merchant@bytebeacon.online', 'Reset Your ByteBeacon Password']),
    );
  });
});
