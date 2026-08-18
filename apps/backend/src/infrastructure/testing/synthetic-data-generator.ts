import crypto from 'node:crypto';
import { UserRole, NetworkProvider, OrderStatus, ProviderStatus, PaymentStatus } from '@bytebeacon/shared';

export interface SyntheticUser {
  id: string;
  email: string;
  phone: string;
  role: UserRole;
  fullName: string;
  isActive: boolean;
  createdAt: Date;
}

export interface SyntheticOrder {
  id: string;
  publicId: string;
  userId: string;
  recipientPhone: string;
  network: NetworkProvider;
  dataAmountMb: number;
  amountPesewas: bigint;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  providerStatus: ProviderStatus;
  providerReference: string;
  idempotencyKey: string;
  createdAt: Date;
}

export interface SyntheticLedgerEntry {
  id: string;
  transactionId: string;
  accountId: string;
  accountType: 'CUSTOMER_WALLET' | 'PLATFORM_ESCROW' | 'REVENUE' | 'PROVIDER_CLEARING';
  entryType: 'DEBIT' | 'CREDIT';
  amountPesewas: bigint;
  description: string;
  createdAt: Date;
}

/**
 * PII Masking Utility enforcing privacy standards across audit logs, debug outputs, and synthetic datasets.
 * - Phone numbers: 024****567
 * - Email addresses: kw***@example.com
 * - Secrets/Keys/Passwords: [REDACTED]
 */
export class PiiMasker {
  public static maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return '***';
    const clean = phone.trim();
    return `${clean.substring(0, 3)}****${clean.substring(clean.length - 3)}`;
  }

  public static maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***@***.***';
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local.charAt(0)}***@${domain}`;
    }
    return `${local.substring(0, 2)}***@${domain}`;
  }

  public static redactSecret(_secret?: string): string {
    return '[REDACTED]';
  }
}

/**
 * High-performance Synthetic Data Generator for ByteBeacon 2.0.
 * Capable of generating realistic anonymized datasets (100k+ records) with balanced double-entry ledger chains.
 */
export class SyntheticDataGenerator {
  private readonly networks: NetworkProvider[] = [
    NetworkProvider.MTN,
    NetworkProvider.TELECEL,
    NetworkProvider.AIRTELTIGO,
  ];

  private readonly bundleSizes = [1024, 2560, 5120, 10240, 20480, 51200]; // MB

  /**
   * Generates a batch of synthetic user accounts.
   */
  public generateUsers(count: number): SyntheticUser[] {
    const users: SyntheticUser[] = [];
    for (let i = 1; i <= count; i++) {
      const role = i === 1 ? UserRole.SUPER_ADMIN : i <= 5 ? UserRole.ADMIN : i <= 20 ? UserRole.AGENT : UserRole.CUSTOMER;
      users.push({
        id: `usr_syn_${i}_${crypto.randomBytes(4).toString('hex')}`,
        email: `user_${i}_${crypto.randomBytes(3).toString('hex')}@synthetic-bytebeacon.test`,
        phone: `024${String(1000000 + (i % 9000000)).padStart(7, '0')}`,
        role,
        fullName: `Synthetic Test User ${i}`,
        isActive: true,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)),
      });
    }
    return users;
  }

  /**
   * Generates synthetic orders with matching balanced double-entry ledger entries.
   */
  public generateOrdersWithLedger(
    count: number,
    users: SyntheticUser[],
  ): { orders: SyntheticOrder[]; ledgerEntries: SyntheticLedgerEntry[] } {
    const orders: SyntheticOrder[] = [];
    const ledgerEntries: SyntheticLedgerEntry[] = [];

    const userCount = users.length;

    for (let i = 1; i <= count; i++) {
      const user = users[i % userCount];
      const network = this.networks[i % this.networks.length];
      const dataAmountMb = this.bundleSizes[i % this.bundleSizes.length];
      const ratePerGbPesewas = network === NetworkProvider.MTN ? 450n : 420n;
      const amountPesewas = (BigInt(dataAmountMb) * ratePerGbPesewas) / 1024n;

      const orderId = `ord_syn_${i}_${crypto.randomBytes(4).toString('hex')}`;
      const transactionId = `txn_syn_${i}_${crypto.randomBytes(6).toString('hex')}`;
      const providerRef = `dh_syn_${100000 + (i % 900000)}`;

      const isSuccess = i % 20 !== 0; // 95% success rate
      const orderStatus = isSuccess ? OrderStatus.COMPLETED : OrderStatus.FAILED;
      const providerStatus = isSuccess ? ProviderStatus.COMPLETED : ProviderStatus.FAILED;
      const paymentStatus = PaymentStatus.PAID;

      const createdAt = new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));

      orders.push({
        id: orderId,
        publicId: `BB-${100000 + i}`,
        userId: user.id,
        recipientPhone: `024${String(2000000 + (i % 8000000)).padStart(7, '0')}`,
        network,
        dataAmountMb,
        amountPesewas,
        orderStatus,
        paymentStatus,
        providerStatus,
        providerReference: providerRef,
        idempotencyKey: `idem_syn_${orderId}`,
        createdAt,
      });

      // Balanced Double-Entry Journal Entry:
      // DEBIT: CUSTOMER_WALLET
      // CREDIT: REVENUE
      ledgerEntries.push({
        id: `led_${i}_d_${crypto.randomBytes(4).toString('hex')}`,
        transactionId,
        accountId: user.id,
        accountType: 'CUSTOMER_WALLET',
        entryType: 'DEBIT',
        amountPesewas,
        description: `Synthetic Order purchase: ${dataAmountMb}MB on ${network}`,
        createdAt,
      });

      ledgerEntries.push({
        id: `led_${i}_c_${crypto.randomBytes(4).toString('hex')}`,
        transactionId,
        accountId: 'acc_platform_revenue',
        accountType: 'REVENUE',
        entryType: 'CREDIT',
        amountPesewas,
        description: `Synthetic Revenue credit for order ${orderId}`,
        createdAt,
      });
    }

    return { orders, ledgerEntries };
  }

  /**
   * Generates a streaming batch generator for 100k+ stress testing without memory exhaustion.
   */
  public *generateLargeDatasetStream(
    totalRecords = 100000,
    chunkSize = 5000,
  ): Generator<{ chunkIndex: number; totalChunks: number; orders: SyntheticOrder[] }> {
    const totalChunks = Math.ceil(totalRecords / chunkSize);
    const mockUsers = this.generateUsers(100);

    for (let chunk = 0; chunk < totalChunks; chunk++) {
      const count = Math.min(chunkSize, totalRecords - chunk * chunkSize);
      const { orders } = this.generateOrdersWithLedger(count, mockUsers);
      yield {
        chunkIndex: chunk + 1,
        totalChunks,
        orders,
      };
    }
  }
}
