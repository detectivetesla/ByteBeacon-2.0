import { ITelecomProvider } from './telecom/telecom-provider.interface.js';
import {
  SubmitOrderInput,
  SubmitOrderResult,
  SubmitBulkOrderInput,
  SubmitBulkOrderResult,
  GetOrderStatusInput,
  ProviderOrderStatus,
  ValidateBeneficiaryInput,
  BeneficiaryValidationResult,
  DataHousePrecheckInput,
  DataHousePrecheckResult,
  DataHouseWalletBalanceDto,
  ProviderHealth,
} from '@bytebeacon/shared';
import { logger } from '../logging/logger.js';

export interface ProviderRegistrationOptions {
  isAuthoritative?: boolean;
  priority?: number;
  environment?: 'LIVE' | 'SANDBOX' | 'MOCK';
}

export interface RegisteredProviderEntry {
  provider: ITelecomProvider;
  isAuthoritative: boolean;
  priority: number;
  environment: 'LIVE' | 'SANDBOX' | 'MOCK';
}

/**
 * Dynamic Telecom Provider Registry for ByteBeacon 2.0.
 * Decouples commerce and fulfillment workflows from specific telecom APIs (e.g. DataHouse).
 * Enables runtime provider switching, multi-carrier failover, and sandbox testing.
 */
export class TelecomProviderRegistry implements ITelecomProvider {
  private readonly providers: Map<string, RegisteredProviderEntry> = new Map();
  private activeProviderName: string = 'DataHouse';

  constructor(initialProviders?: Record<string, ITelecomProvider>) {
    if (initialProviders) {
      for (const [name, provider] of Object.entries(initialProviders)) {
        this.registerProvider(name, provider);
      }
    }
  }

  public registerProvider(
    name: string,
    provider: ITelecomProvider,
    options: ProviderRegistrationOptions = {},
  ): void {
    const isAuth = options.isAuthoritative ?? (this.providers.size === 0);
    this.providers.set(name.toLowerCase(), {
      provider,
      isAuthoritative: isAuth,
      priority: options.priority ?? 100,
      environment: options.environment ?? 'LIVE',
    });

    if (isAuth) {
      this.activeProviderName = name.toLowerCase();
    }

    logger.info(
      { providerName: name, isAuthoritative: isAuth, environment: options.environment ?? 'LIVE' },
      '[TELECOM_REGISTRY] Registered telecom provider adapter',
    );
  }

  public setActiveProvider(name: string): void {
    const key = name.toLowerCase();
    if (!this.providers.has(key)) {
      throw new Error(`Telecom provider [${name}] is not registered in registry.`);
    }

    for (const [k, entry] of this.providers.entries()) {
      entry.isAuthoritative = k === key;
    }
    this.activeProviderName = key;

    logger.info({ activeProvider: name }, '[TELECOM_REGISTRY] Switched active authoritative telecom provider');
  }

  public getActiveProvider(): ITelecomProvider {
    const entry = this.providers.get(this.activeProviderName.toLowerCase());
    if (!entry) {
      // Fallback to first available provider
      const first = Array.from(this.providers.values())[0];
      if (!first) {
        throw new Error('No telecom providers registered in TelecomProviderRegistry.');
      }
      return first.provider;
    }
    return entry.provider;
  }

  public getProvider(name: string): ITelecomProvider | undefined {
    return this.providers.get(name.toLowerCase())?.provider;
  }

  public listRegisteredProviders(): Array<{
    name: string;
    isAuthoritative: boolean;
    priority: number;
    environment: string;
  }> {
    return Array.from(this.providers.entries()).map(([name, entry]) => ({
      name: entry.provider.providerName || name,
      isAuthoritative: entry.isAuthoritative,
      priority: entry.priority,
      environment: entry.environment,
    }));
  }

  // --- ITelecomProvider Delegation to Active Authoritative Provider ---

  public get providerName(): string {
    return this.getActiveProvider().providerName;
  }

  public async submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
    return this.getActiveProvider().submitOrder(input);
  }

  public async submitBulkOrder(input: SubmitBulkOrderInput): Promise<SubmitBulkOrderResult> {
    const active = this.getActiveProvider();
    if (active.submitBulkOrder) {
      return active.submitBulkOrder(input);
    }
    throw new Error(`Active provider [${active.providerName}] does not support submitBulkOrder.`);
  }

  public async getOrderStatus(input: GetOrderStatusInput): Promise<ProviderOrderStatus> {
    return this.getActiveProvider().getOrderStatus(input);
  }

  public async validateBeneficiary(input: ValidateBeneficiaryInput): Promise<BeneficiaryValidationResult> {
    const active = this.getActiveProvider();
    if (active.validateBeneficiary) {
      return active.validateBeneficiary(input);
    }
    return { isValid: true, network: input.network };
  }

  public async precheckBeneficiaries(input: DataHousePrecheckInput): Promise<DataHousePrecheckResult> {
    const active = this.getActiveProvider();
    if (active.precheckBeneficiaries) {
      return active.precheckBeneficiaries(input);
    }
    return {
      network: input.network,
      enforced: false,
      sandbox: false,
      recorded: false,
      summary: {
        total: input.phoneNumbers.length,
        known: input.phoneNumbers.length,
        unknown: 0,
        valid: input.phoneNumbers.length,
        invalid: 0,
      },
      unknown: [],
      results: input.phoneNumbers.map((phone) => ({
        phoneNumber: phone,
        isKnown: true,
        isValid: true,
      })),
    };
  }

  public async getWalletBalance(): Promise<DataHouseWalletBalanceDto> {
    const active = this.getActiveProvider();
    if (active.getWalletBalance) {
      return active.getWalletBalance();
    }
    return {
      balanceGhs: 0,
      balancePesewas: 0,
      currency: 'GHS',
      overdraftLimitPesewas: 0,
      overdraftUsedPesewas: 0,
      overdraftAvailablePesewas: 0,
      overdraftActive: false,
      availableToSpendPesewas: 0,
      availableToSpendGhs: 0,
    };
  }

  public async healthCheck(): Promise<ProviderHealth> {
    return this.getActiveProvider().healthCheck();
  }

  public verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    return this.getActiveProvider().verifyWebhookSignature(rawBody, signature);
  }
}
