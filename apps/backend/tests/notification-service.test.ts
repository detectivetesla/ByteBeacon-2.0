import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '../src/core/notifications/notification.service.js';
import type { EmailService } from '../src/infrastructure/email/email.service.js';
import type pg from 'pg';

describe('NotificationService Comprehensive Test Suite', () => {
  let mockDbQueries: Array<{ text: string; values?: any[] }> = [];
  let mockDb: pg.Pool;
  let mockEmailService: EmailService;

  beforeEach(() => {
    mockDbQueries = [];
    mockDb = {
      query: vi.fn().mockImplementation((text: string, values?: any[]) => {
        mockDbQueries.push({ text, values });
        if (text.includes('SELECT email, full_name')) {
          return Promise.resolve({
            rows: [
              {
                id: values?.[0] || 'usr-123',
                email: 'testuser@example.com',
                full_name: 'Test User',
                name: 'Test User',
                phone: '0244123456',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [{ id: 'mock-uuid-123' }] });
      }),
    } as unknown as pg.Pool;

    mockEmailService = {
      sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-mock-123' }),
      isReady: vi.fn().mockReturnValue(true),
    } as unknown as EmailService;
  });

  it('1. sendInAppNotification inserts into notifications table setting both body and message columns', async () => {
    const service = new NotificationService(mockDb, mockEmailService);

    const notifId = await service.sendInAppNotification({
      userId: 'usr-123',
      title: 'Order Completed',
      body: 'Your data bundle has been fulfilled successfully.',
      type: 'ORDER_COMPLETED',
      severity: 'INFO',
      actionUrl: '/orders',
    });

    expect(notifId).toBeDefined();
    expect(mockDbQueries).toHaveLength(1);
    const query = mockDbQueries[0];
    expect(query.text).toContain('INSERT INTO notifications');
    expect(query.text).toContain('body, message');
    expect(query.values?.[1]).toBe('usr-123'); // user_id
    expect(query.values?.[4]).toBe('Order Completed'); // title
    expect(query.values?.[5]).toBe('Your data bundle has been fulfilled successfully.'); // body
    expect(query.values?.[6]).toBe('Your data bundle has been fulfilled successfully.'); // message
    expect(query.values?.[7]).toBe('/orders'); // action_url
  });

  it('2. sendEmailNotification creates branded email and invokes EmailService', async () => {
    const service = new NotificationService(mockDb, mockEmailService);

    const success = await service.sendEmailNotification({
      to: 'recipient@example.com',
      subject: 'Security Alert',
      body: 'A new device logged into your account.',
      recipientName: 'Kofi Mensah',
      actionUrl: 'https://bytebeacon.online/settings',
      actionButtonText: 'Review Security',
    });

    expect(success).toBe(true);
    expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
    const emailCall = (mockEmailService.sendEmail as any).mock.calls[0][0];
    expect(emailCall.to).toBe('recipient@example.com');
    expect(emailCall.subject).toBe('Security Alert');
    expect(emailCall.html).toContain('ByteBeacon');
    expect(emailCall.html).toContain('Hello Kofi Mensah,');
    expect(emailCall.html).toContain('Review Security');
    expect(emailCall.html).toContain('https://bytebeacon.online/settings');
  });

  it('3. notifyUser performs both in-app notification and email delivery with audit logging', async () => {
    const service = new NotificationService(mockDb, mockEmailService);

    const result = await service.notifyUser({
      userId: 'usr-456',
      title: 'Deposit Received',
      body: 'GH₵ 50.00 has been credited to your wallet.',
      email: 'agent@bytebeacon.online',
      fullName: 'Kwame Agent',
      sendEmail: true,
    });

    expect(result.inAppId).toBeDefined();
    expect(result.emailSent).toBe(true);
    expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);

    // Verify delivery logs inserted: one for IN_APP and one for EMAIL
    const logQueries = mockDbQueries.filter((q) => q.text.includes('communication_delivery_logs'));
    expect(logQueries).toHaveLength(2);
    expect(logQueries.some((q) => q.values?.includes('IN_APP'))).toBe(true);
    expect(logQueries.some((q) => q.values?.includes('EMAIL'))).toBe(true);
  });

  it('4. sendWelcomeCustomer sends welcome in-app and transactional email', async () => {
    const service = new NotificationService(mockDb, mockEmailService);

    await service.sendWelcomeCustomer({
      userId: 'usr-new-customer',
      email: 'newcustomer@gmail.com',
      fullName: 'Ama Serwaa',
    });

    const notifQuery = mockDbQueries.find((q) => q.text.includes('INSERT INTO notifications'));
    expect(notifQuery).toBeDefined();
    expect(notifQuery?.values?.[4]).toContain('Welcome to ByteBeacon');
    expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
    const emailCall = (mockEmailService.sendEmail as any).mock.calls[0][0];
    expect(emailCall.to).toBe('newcustomer@gmail.com');
    expect(emailCall.subject).toContain('Welcome to ByteBeacon');
  });

  it('5. sendAgentOpportunityPrompt encourages non-agent customers to become resellers', async () => {
    const service = new NotificationService(mockDb, mockEmailService);

    await service.sendAgentOpportunityPrompt({
      userId: 'usr-cust-1',
      email: 'cust1@gmail.com',
      fullName: 'Yaw Boateng',
    });

    const notifQuery = mockDbQueries.find((q) => q.text.includes('INSERT INTO notifications'));
    expect(notifQuery).toBeDefined();
    expect(notifQuery?.values?.[4]).toContain('Start Your Data Business');
    expect(notifQuery?.values?.[7]).toBe('/register-agent');
    expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('6. sendWelcomeAgent sends agent onboarding guidance', async () => {
    const service = new NotificationService(mockDb, mockEmailService);

    await service.sendWelcomeAgent({
      userId: 'usr-new-agent',
      email: 'agent@gmail.com',
      fullName: 'Kojo Antwi',
      businessName: 'Kojo Data Hub',
    });

    const notifQuery = mockDbQueries.find((q) => q.text.includes('INSERT INTO notifications'));
    expect(notifQuery).toBeDefined();
    expect(notifQuery?.values?.[4]).toContain('Welcome to the ByteBeacon Agent Network');
    expect(notifQuery?.values?.[7]).toBe('/agent/store');
  });

  it('7. sendWithdrawalNotification formats approved payout with disbursement reference', async () => {
    const service = new NotificationService(mockDb, mockEmailService);

    await service.sendWithdrawalNotification({
      userId: 'usr-agent-payout',
      email: 'agentpayout@gmail.com',
      fullName: 'Agent Payout',
      amountPesewas: 15000, // GH₵ 150.00
      destinationAccount: '0244123456',
      destinationProvider: 'MTN Mobile Money',
      status: 'PAID',
      disbursementReference: 'MOMO-TRANS-REF-#99281',
    });

    const notifQuery = mockDbQueries.find((q) => q.text.includes('INSERT INTO notifications'));
    expect(notifQuery).toBeDefined();
    expect(notifQuery?.values?.[4]).toContain('Withdrawal Approved & Settled');
    expect(notifQuery?.values?.[5]).toContain('GH₵ 150.00');
    expect(notifQuery?.values?.[5]).toContain('MOMO-TRANS-REF-#99281');

    const emailCall = (mockEmailService.sendEmail as any).mock.calls[0][0];
    expect(emailCall.subject).toContain('Withdrawal Paid: GH₵ 150.00');
    expect(emailCall.text).toContain('MOMO-TRANS-REF-#99281');
  });

  it('8. sendWithdrawalNotification formats rejected payout with refund notice', async () => {
    const service = new NotificationService(mockDb, mockEmailService);

    await service.sendWithdrawalNotification({
      userId: 'usr-agent-payout-rej',
      email: 'agentrej@gmail.com',
      fullName: 'Agent Rej',
      amountPesewas: 5000, // GH₵ 50.00
      destinationAccount: '0244999999',
      destinationProvider: 'MTN Mobile Money',
      status: 'REJECTED',
      adminNote: 'KYC name mismatch on MOMO account',
    });

    const notifQuery = mockDbQueries.find((q) => q.text.includes('INSERT INTO notifications'));
    expect(notifQuery).toBeDefined();
    expect(notifQuery?.values?.[4]).toContain('Withdrawal Request Declined');
    expect(notifQuery?.values?.[5]).toContain('KYC name mismatch on MOMO account');
    expect(notifQuery?.values?.[5]).toContain('refunded back to your wallet balance');
  });
});
