import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MigrationEngine, LegacyUserRecord, LegacyOrderRecord } from '../../src/infrastructure/database/migration-engine.js';
import { ITelecomProvider } from '../../src/core/providers/telecom/telecom-provider.interface.js';
import { ProviderStatus } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Phase 8.2: Database & Migration Verification Engine', () => {
  let mockDb: pg.Pool;
  let mockTelecomProvider: ITelecomProvider;

  beforeEach(() => {
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: 'usr_target_1' }] }),
    } as unknown as pg.Pool;

    mockTelecomProvider = {
      providerName: 'DATAHOUSE',
      getOrderStatus: vi.fn().mockResolvedValue({
        providerStatus: ProviderStatus.COMPLETED,
        rawResponse: {},
      }),
      precheckBeneficiaries: vi.fn(),
      submitOrder: vi.fn(),
      submitBatch: vi.fn(),
      getBalance: vi.fn(),
      healthCheck: vi.fn(),
    } as unknown as ITelecomProvider;
  });

  it('should migrate valid accounts and flag incompatible password hashes for reset', async () => {
    const engine = new MigrationEngine(mockDb, mockTelecomProvider);

    const legacyUsers: LegacyUserRecord[] = [
      {
        id: 'leg_1',
        email: 'agent1@legacy.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$validhash',
        isHashCompatible: true,
        legacyRole: 'RESELLER_AGENT',
        walletBalancePesewas: 50000n,
        isBalanceVerified: true,
        createdAt: new Date(),
      },
      {
        id: 'leg_2',
        email: 'olduser@legacy.com',
        passwordHash: 'md5_insecure_hash_12345',
        isHashCompatible: false,
        legacyRole: 'CUSTOMER',
        walletBalancePesewas: 1000n,
        isBalanceVerified: true,
        createdAt: new Date(),
      },
    ];

    const summary = await engine.executeMigration(legacyUsers, [], { dryRun: false });

    expect(summary.validAccountsMigrated).toBe(2);
    expect(summary.passwordResetRequiredCount).toBe(1);
    expect(summary.verifiedWalletsMigrated).toBe(2);
    expect(summary.totalOpeningBalancePesewas).toBe(51000n);
  });

  it('should hold disputed or unverified wallet balances for reconciliation rather than minting spendable funds', async () => {
    const engine = new MigrationEngine(mockDb, mockTelecomProvider);

    const legacyUsers: LegacyUserRecord[] = [
      {
        id: 'leg_disputed_1',
        email: 'disputed@legacy.com',
        passwordHash: '$argon2id$valid',
        isHashCompatible: true,
        legacyRole: 'CUSTOMER',
        walletBalancePesewas: 999999n, // Disputed balance
        isBalanceVerified: false, // Flagged unverified
        createdAt: new Date(),
      },
    ];

    const summary = await engine.executeMigration(legacyUsers, [], { dryRun: false });

    expect(summary.validAccountsMigrated).toBe(1);
    expect(summary.verifiedWalletsMigrated).toBe(0);
    expect(summary.disputedWalletsHeldForRecon).toBe(1);
    expect(summary.totalOpeningBalancePesewas).toBe(0n);
  });

  it('should reconcile non-terminal orders with DataHouse before migration', async () => {
    const engine = new MigrationEngine(mockDb, mockTelecomProvider);

    const legacyOrders: LegacyOrderRecord[] = [
      {
        id: 'ord_leg_100',
        userId: 'usr_leg_1',
        recipientPhone: '0241234567',
        network: 'MTN',
        dataAmountMb: 5120,
        amountPesewas: 2500n,
        legacyStatus: 'PROCESSING',
        providerReference: 'dh_ref_9988',
        createdAt: new Date(),
      },
    ];

    const summary = await engine.executeMigration([], legacyOrders, { dryRun: false });

    expect(summary.ordersMigrated).toBe(1);
    expect(summary.ordersReconciledWithDataHouse).toBe(1);
    expect(mockTelecomProvider.getOrderStatus).toHaveBeenCalledWith({
      providerReference: 'dh_ref_9988',
      orderId: 'ord_leg_100',
    });
  });
});
