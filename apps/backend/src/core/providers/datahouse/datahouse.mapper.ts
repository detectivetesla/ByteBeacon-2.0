import {
  NetworkProvider,
  ProviderStatus,
  SubmitOrderInput,
  SubmitOrderResult,
  ProviderOrderStatus,
  BeneficiaryValidationResult,
  DataHouseBundleDto,
  SubmitBulkOrderInput,
  SubmitBulkOrderResult,
  DataHousePrecheckResult,
  DataHouseWalletBalanceDto,
  DataHouseWalletLedgerDto,
  DataHouseWalletLedgerEntryDto,
} from '@bytebeacon/shared';
import {
  DataHouseSubmitOrderRequest,
  DataHouseSubmitOrderResponse,
  DataHouseBulkOrderRequest,
  DataHouseBulkOrderResponse,
  DataHouseOrderStatusResponse,
  DataHouseBundlesResponse,
  DataHousePrecheckResponse,
  DataHouseWalletBalanceResponse,
  DataHouseWalletLedgerResponse,
} from './datahouse.types.js';

export class DataHouseMapper {
  /**
   * Normalizes Ghanaian phone numbers into 233XXXXXXXXX international standard.
   */
  public static normalizePhone(phone: string): string {
    let digits = (phone ?? '').replace(/\D/g, '');
    if (digits.startsWith('2330') && digits.length === 13) {
      digits = `233${digits.slice(4)}`;
    }
    if (digits.startsWith('233') && digits.length === 12) return digits;
    if (digits.startsWith('0') && digits.length === 10) return `233${digits.slice(1)}`;
    return digits;
  }

  /**
   * Maps single order input to DataHouse payload.
   */
  public static toDataHouseSubmitRequest(input: SubmitOrderInput): DataHouseSubmitOrderRequest {
    const bundleId = (input.metadata?.bundleId as string) || (input.metadata?.providerProductId as string) || input.orderId;
    return {
      bundleId,
      phoneNumber: this.normalizePhone(input.recipientPhone),
      idempotencyKey: input.idempotencyKey,
      email: (input.metadata?.email as string) || undefined,
    };
  }

  /**
   * Maps DataHouse single submission response to standardized SubmitOrderResult.
   */
  public static toSubmitOrderResult(resp: DataHouseSubmitOrderResponse): SubmitOrderResult {
    const providerOrderId = resp.id || resp.order_id || resp.orderId || `dh_${Date.now()}`;
    const providerReference = resp.referenceCode || resp.reference || providerOrderId;
    const providerStatus = this.mapStatus(resp.status);

    return {
      providerOrderId,
      providerReference,
      providerStatus,
      acceptedAt: resp.created_at || resp.createdAt || new Date().toISOString(),
      rawResponse: resp,
    };
  }

  /**
   * Maps bulk order input to DataHouse bulk order payload.
   */
  public static toDataHouseBulkRequest(input: SubmitBulkOrderInput): DataHouseBulkOrderRequest {
    return {
      network: input.network.toUpperCase(),
      recipients: input.recipients.map((r) => ({
        phoneNumber: this.normalizePhone(r.phoneNumber),
        dataSizeGb: r.dataSizeGb,
        bundleId: r.bundleId,
      })),
      idempotencyKey: input.idempotencyKey || `bulk_${Date.now()}`,
      confirmedPorted: input.confirmedPorted?.map(this.normalizePhone),
      onUnvalidated: input.onUnvalidated || 'set_aside',
    };
  }

  /**
   * Maps DataHouse bulk response to standardized SubmitBulkOrderResult.
   */
  public static toBulkSubmitOrderResult(
    resp: DataHouseBulkOrderResponse,
    network: NetworkProvider,
  ): SubmitBulkOrderResult {
    const providerOrderId = resp.batchId || resp.id || `batch_${Date.now()}`;
    const providerReference = providerOrderId;
    const providerStatus = this.mapStatus(resp.status);

    return {
      providerOrderId,
      providerReference,
      network,
      totalRecipients: resp.totalRecipients || 0,
      acceptedRecipients: resp.acceptedRecipients || 0,
      queuedRecipients: resp.queuedRecipients || 0,
      rejectedRecipients: resp.rejectedRecipients || 0,
      providerStatus,
      rawResponse: resp,
    };
  }

  /**
   * Maps DataHouse order status response to ProviderOrderStatus.
   */
  public static toProviderOrderStatus(resp: DataHouseOrderStatusResponse): ProviderOrderStatus {
    const providerOrderId = resp.id || resp.order_id || '';
    const providerReference = resp.referenceCode || resp.reference || providerOrderId;
    const providerStatus = this.mapStatus(resp.status);

    return {
      providerOrderId,
      providerReference,
      providerStatus,
      completedAt: resp.completed_at || (providerStatus === ProviderStatus.COMPLETED ? resp.updated_at || new Date().toISOString() : null),
      errorMessage: resp.error || resp.errorMessage || null,
      rawResponse: resp,
    };
  }

  /**
   * Maps DataHouse precheck response to standardized BeneficiaryValidationResult.
   */
  public static toBeneficiaryResult(
    resp: DataHousePrecheckResponse,
    _requestedPhone?: string,
    requestedNetwork?: NetworkProvider,
  ): BeneficiaryValidationResult {
    const network = (resp.network as NetworkProvider) || requestedNetwork || NetworkProvider.MTN;
    const results = resp.results || resp.data || [];

    if (results.length === 0) {
      return {
        isValid: false,
        network,
        accountName: undefined,
        rawResponse: resp,
      };
    }

    const first = results[0];
    const isKnown = Boolean(first.isKnown || first.known || first.valid || first.isValid);

    return {
      isValid: isKnown,
      network,
      accountName: first.accountName || undefined,
      rawResponse: resp,
    };
  }

  /**
   * Maps DataHouse precheck response to full DataHousePrecheckResult.
   */
  public static toDataHousePrecheckResult(
    resp: DataHousePrecheckResponse,
    network: NetworkProvider,
  ): DataHousePrecheckResult {
    const results = resp.results || resp.data || [];

    return {
      network: (resp.network as NetworkProvider) || network,
      enforced: resp.enforced !== undefined ? resp.enforced : true,
      sandbox: Boolean(resp.sandbox),
      recorded: Boolean(resp.recorded),
      summary: resp.summary || {},
      unknown: resp.unknown || [],
      results: results.map((r) => ({
        phoneNumber: r.phoneNumber || r.msisdn || r.phone || '',
        isKnown: Boolean(r.isKnown || r.known),
        isValid: Boolean(r.isValid || r.valid),
        status: r.status,
        accountName: r.accountName,
        network: r.network,
        message: r.message,
      })),
      rawResponse: resp,
    };
  }

  /**
   * Maps DataHouse bundles catalog to DataHouseBundleDto array.
   */
  public static toDataHouseBundleDtos(resp: DataHouseBundlesResponse): DataHouseBundleDto[] {
    const items = resp.data || resp.bundles || resp.items || (Array.isArray(resp) ? resp : []);

    return items.map((b) => {
      const priceGhs = parseFloat(String(b.price || b.agentPrice || 0));
      const pricePesewas = Math.round(priceGhs * 100);
      const dataSizeGb = parseFloat(String(b.dataSizeGb || 0));
      const dataAmountMb = Math.round(dataSizeGb * 1024);

      let network = NetworkProvider.MTN;
      const netStr = (b.network || '').toUpperCase();
      if (netStr.includes('TELECEL') || netStr.includes('VODAFONE')) {
        network = NetworkProvider.TELECEL;
      } else if (netStr.includes('AIRTEL') || netStr.includes('TIGO')) {
        network = NetworkProvider.AIRTELTIGO;
      }

      return {
        id: b.id || `bdl_${b.name}`,
        name: b.name || `${dataSizeGb}GB Data`,
        network,
        dataSizeGb,
        dataAmountMb,
        pricePesewas,
        validityDays: parseInt(String(b.validityDays || b.validity || 30), 10),
        isActive: b.is_active !== undefined ? Boolean(b.is_active) : (b.isActive !== undefined ? Boolean(b.isActive) : true),
        type: b.type || 'DATA',
        raw: b,
      };
    });
  }

  /**
   * Maps DataHouse wallet balance to DataHouseWalletBalanceDto.
   */
  public static toWalletBalanceDto(resp: DataHouseWalletBalanceResponse): DataHouseWalletBalanceDto {
    const balanceGhs = parseFloat(String(resp.balance || 0));
    const balancePesewas = Math.round(balanceGhs * 100);
    const overdraftLimit = parseFloat(String(resp.overdraftLimit || 0));
    const overdraftUsed = parseFloat(String(resp.overdraftUsed || 0));
    const overdraftAvailable = parseFloat(String(resp.overdraftAvailable || 0));
    const availableToSpend = parseFloat(String(resp.availableToSpend || (balanceGhs + overdraftAvailable)));

    return {
      balancePesewas,
      balanceGhs,
      currency: resp.currency || 'GHS',
      overdraftLimitPesewas: Math.round(overdraftLimit * 100),
      overdraftUsedPesewas: Math.round(overdraftUsed * 100),
      overdraftAvailablePesewas: Math.round(overdraftAvailable * 100),
      overdraftActive: Boolean(resp.overdraftActive),
      availableToSpendPesewas: Math.round(availableToSpend * 100),
      availableToSpendGhs: availableToSpend,
      raw: resp,
    };
  }

  /**
   * Maps DataHouse wallet ledger response to DataHouseWalletLedgerDto.
   */
  public static toWalletLedgerDto(resp: DataHouseWalletLedgerResponse): DataHouseWalletLedgerDto {
    const items = resp.data || resp.ledger || resp.items || (Array.isArray(resp) ? resp : []);

    const entries: DataHouseWalletLedgerEntryDto[] = (items as any[]).map((item, idx) => {
      const amountGhs = parseFloat(String(item.amount || 0));
      return {
        id: item.id || `entry_${idx}_${Date.now()}`,
        transactionId: item.transactionId || item.transaction_id,
        type: item.type || (amountGhs < 0 ? 'DEBIT' : 'CREDIT'),
        amountPesewas: Math.round(Math.abs(amountGhs) * 100),
        amountGhs: Math.abs(amountGhs),
        balanceBeforePesewas: item.balanceBefore ? Math.round(parseFloat(item.balanceBefore) * 100) : undefined,
        balanceAfterPesewas: item.balanceAfter ? Math.round(parseFloat(item.balanceAfter) * 100) : undefined,
        description: item.description || item.narration || 'Telecom transaction',
        reference: item.reference || item.orderId || item.order_id,
        createdAt: item.createdAt || item.created_at || new Date().toISOString(),
      };
    });

    return {
      entries,
      total: resp.meta?.total || entries.length,
      page: resp.meta?.page || 1,
      limit: resp.meta?.limit || 50,
    };
  }

  /**
   * Maps raw DataHouse order status string to ByteBeacon ProviderStatus enum.
   */
  public static mapStatus(statusString?: string): ProviderStatus {
    if (!statusString) return ProviderStatus.UNKNOWN;

    const s = statusString.toUpperCase().trim();

    switch (s) {
      case 'PENDING':
      case 'RECEIVED':
      case 'QUEUED':
      case 'SUBMITTED':
      case 'ACCEPTED':
        return ProviderStatus.RECEIVED;

      case 'PROCESSING':
      case 'IN_PROGRESS':
      case 'DISPATCHED':
        return ProviderStatus.PROCESSING;

      case 'COMPLETED':
      case 'SUCCESS':
      case 'SUCCESSFUL':
      case 'DELIVERED':
        return ProviderStatus.COMPLETED;

      case 'FAILED':
      case 'ERROR':
      case 'EXPIRED':
        return ProviderStatus.FAILED;

      case 'REJECTED':
      case 'CANCELLED':
      case 'DECLINED':
      case 'UNVALIDATED':
        return ProviderStatus.REJECTED;

      default:
        return ProviderStatus.UNKNOWN;
    }
  }
}
