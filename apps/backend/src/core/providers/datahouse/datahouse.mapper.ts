import {
  NetworkProvider,
  ProviderStatus,
  SubmitOrderInput,
  SubmitOrderResult,
  ProviderOrderStatus,
  BeneficiaryValidationResult,
  DataHouseAgentProfileDto,
  DataHouseBundleDto,
  SubmitBulkOrderInput,
  SubmitBulkOrderResult,
  DataHousePrecheckResult,
  DataHouseBeneficiaryStatusListDto,
  DataHouseOrderDetailsDto,
  DataHouseOrdersListDto,
  DataHouseWalletBalanceDto,
  DataHouseWalletLedgerDto,
  DataHouseWalletLedgerEntryDto,
} from '@bytebeacon/shared';
import {
  DataHouseAgentProfile,
  DataHouseSubmitOrderRequest,
  DataHouseSubmitOrderResponse,
  DataHouseBulkOrderRequest,
  DataHouseBulkOrderResponse,
  DataHouseOrderStatusResponse,
  DataHouseBundlesResponse,
  DataHousePrecheckResponse,
  DataHouseBeneficiariesListResponse,
  DataHouseWalletBalanceResponse,
  DataHouseWalletLedgerResponse,
} from './datahouse.types.js';

export class DataHouseMapper {
  /**
   * Normalizes Ghanaian phone numbers into 233XXXXXXXXX international standard or 0XXXXXXXXX local.
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
   * Maps agent profile response to DataHouseAgentProfileDto.
   */
  public static toAgentProfileDto(profile: DataHouseAgentProfile): DataHouseAgentProfileDto {
    return {
      id: profile.id,
      publicId: profile.publicId || profile.id,
      businessName: profile.businessName,
      businessPhone: profile.businessPhone,
      address: profile.address,
      tier: profile.tier,
      status: profile.status,
      pricePerGb: profile.pricePerGb,
      apiAccessStatus: profile.apiAccessStatus,
      apiAccessPaidAt: profile.apiAccessPaidAt,
      registrationFeePaidAt: profile.registrationFeePaidAt,
      userId: profile.userId,
      user: {
        id: profile.user?.id || '',
        name: profile.user?.name || '',
        email: profile.user?.email || '',
        phone: profile.user?.phone || '',
      },
      createdAt: profile.createdAt,
      raw: profile,
    };
  }

  /**
   * Maps single order input to DataHouse payload.
   */
  public static toDataHouseSubmitRequest(input: SubmitOrderInput): DataHouseSubmitOrderRequest {
    const bundleId = (input.metadata?.bundleId as string) || (input.metadata?.providerProductId as string) || input.orderId;
    const volumeGb = Math.max(1, Math.round((input.dataAmountMb || 1024) / 1024));
    return {
      bundleId,
      phoneNumber: this.normalizePhone(input.recipientPhone),
      idempotencyKey: input.idempotencyKey,
      email: (input.metadata?.email as string) || undefined,
      volume: volumeGb,
      dataAmountMb: input.dataAmountMb,
      network: input.network,
    };
  }

  /**
   * Maps DataHouse single submission response to standardized SubmitOrderResult.
   */
  public static toSubmitOrderResult(resp: DataHouseSubmitOrderResponse): SubmitOrderResult {
    const providerOrderId = resp.publicId || resp.id || resp.order_id || resp.orderId || `dh_${Date.now()}`;
    const providerReference = resp.referenceCode || resp.reference || providerOrderId;
    const providerStatus = this.mapStatus(resp.status);

    return {
      providerOrderId,
      providerReference,
      providerStatus,
      acceptedAt: resp.createdAt || resp.created_at || new Date().toISOString(),
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
    const providerOrderId = resp.id || resp.submissionId || resp.batchId || `sub_${Date.now()}`;
    const providerReference = resp.referenceCode || providerOrderId;
    const providerStatus = this.mapStatus(resp.status);

    const childOrders = (resp.orders || []).map((o) => ({
      id: o.id || o.publicId,
      publicId: o.publicId || o.id,
      referenceCode: o.referenceCode,
      sizeGb: o.sizeGb,
      beneficiaryCount: o.beneficiaryCount,
      amount: String(o.amount),
      status: o.status,
    }));

    return {
      providerOrderId,
      providerReference,
      network,
      totalRecipients: resp.beneficiaryCount ?? (resp.totalRecipients || 0),
      acceptedRecipients: resp.beneficiaryCount ?? (resp.acceptedRecipients || 0),
      queuedRecipients: resp.queuedRecipients ?? (resp.beneficiaryCount || 0),
      rejectedRecipients: resp.blocked?.length ?? (resp.rejectedRecipients || 0),
      providerStatus,
      groupCount: resp.groupCount ?? childOrders.length,
      orders: childOrders,
      blocked: resp.blocked || [],
      rawResponse: resp,
    };
  }

  /**
   * Maps DataHouse order status response to ProviderOrderStatus.
   */
  public static toProviderOrderStatus(resp: DataHouseOrderStatusResponse): ProviderOrderStatus {
    const providerOrderId = resp.publicId || resp.id || resp.order_id || '';
    const providerReference = resp.referenceCode || resp.reference || providerOrderId;
    const providerStatus = this.mapStatus(resp.status);

    return {
      providerOrderId,
      providerReference,
      providerStatus,
      completedAt:
        resp.completedAt ||
        resp.completed_at ||
        resp.approvedAt ||
        (providerStatus === ProviderStatus.COMPLETED ? resp.updatedAt || resp.updated_at || new Date().toISOString() : null),
      errorMessage: resp.error || resp.errorMessage || null,
      rawResponse: resp,
    };
  }

  /**
   * Maps DataHouse detailed order response to DataHouseOrderDetailsDto.
   */
  public static toOrderDetailsDto(resp: DataHouseOrderStatusResponse): DataHouseOrderDetailsDto {
    const delivery = resp.delivery || {
      approved: resp.status === 'approved' || resp.status === 'delivered' ? (resp.beneficiaryCount || 1) : 0,
      pending: resp.status === 'received' || resp.status === 'processing' ? (resp.beneficiaryCount || 1) : 0,
      failed: resp.status === 'rejected' || resp.status === 'failed' ? (resp.beneficiaryCount || 1) : 0,
      total: resp.beneficiaryCount || 1,
    };

    const beneficiaries = (resp.beneficiaries || []).map((b) => ({
      id: b.id,
      phoneNumber: b.phoneNumber,
      dataVolumeGb: b.dataVolumeGb,
      amount: String(b.amount),
      network: b.network,
      status: b.status,
      isPorted: Boolean(b.isPorted),
    }));

    return {
      id: resp.publicId || resp.id,
      referenceCode: resp.referenceCode || resp.reference || resp.id,
      network: resp.network,
      status: resp.status,
      paymentStatus: resp.paymentStatus || 'paid',
      amount: String(resp.amount || '0.00'),
      groupSizeGb: resp.groupSizeGb || resp.dataSizeGb || 0,
      submissionId: resp.submissionId || null,
      createdAt: resp.createdAt || resp.created_at || new Date().toISOString(),
      approvedAt: resp.approvedAt || null,
      approvedByName: resp.approvedByName || null,
      paymentSplit: resp.paymentSplit || null,
      beneficiaryCount: resp.beneficiaryCount ?? beneficiaries.length,
      totalDataGb: resp.totalDataGb ?? (resp.groupSizeGb || resp.dataSizeGb || 0),
      delivery,
      beneficiaries,
      rawResponse: resp,
    };
  }

  /**
   * Maps DataHouse list orders response to DataHouseOrdersListDto.
   */
  public static toOrdersListDto(resp: any): DataHouseOrdersListDto {
    const rawItems = Array.isArray(resp) ? resp : resp?.data || [];
    const meta = resp?.meta || {};

    const orders = rawItems.map((o: any) => ({
      id: o.id || o.publicId,
      referenceCode: o.referenceCode || o.reference,
      network: o.network,
      status: o.status,
      paymentStatus: o.paymentStatus || 'paid',
      amount: String(o.amount || '0.00'),
      groupSizeGb: o.groupSizeGb || o.dataSizeGb || 0,
      submissionId: o.submissionId || null,
      createdAt: o.createdAt || o.created_at || new Date().toISOString(),
      approvedAt: o.approvedAt || null,
      approvedByName: o.approvedByName || null,
      beneficiaryCount: o.beneficiaryCount || 0,
      totalDataGb: o.totalDataGb || 0,
      delivery: o.delivery || { approved: 0, pending: 0, failed: 0, total: 0 },
      beneficiaries: [] as never[],
    }));

    return {
      orders,
      page: meta.page || 1,
      limit: meta.limit || 30,
      total: meta.total || orders.length,
      totalPages: meta.totalPages,
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

    const summary = resp.summary || {
      requested: results.length,
      unique: results.length,
      valid: results.filter((r) => r.isValid || r.valid).length,
      invalid: results.filter((r) => r.isValid === false || r.valid === false).length,
      known: results.filter((r) => r.isKnown || r.known).length,
      unknown: results.filter((r) => r.isKnown === false || r.known === false).length,
    };

    return {
      network: (resp.network as NetworkProvider) || network,
      enforced: resp.enforced !== undefined ? resp.enforced : true,
      sandbox: Boolean(resp.sandbox),
      recorded: Boolean(resp.recorded),
      reason: resp.reason,
      summary,
      unknown: resp.unknown || results.filter((r) => !r.isKnown && !r.known).map((r) => r.phoneNumber || r.phone || r.msisdn || ''),
      results: results.map((r) => ({
        phoneNumber: r.phoneNumber || r.phone || r.msisdn || '',
        phone: r.phone || r.phoneNumber || r.msisdn || '',
        normalized: r.normalized || r.phoneNumber || r.phone || '',
        isKnown: Boolean(r.isKnown || r.known),
        isValid: Boolean(r.isValid !== undefined ? r.isValid : r.valid !== undefined ? r.valid : true),
        status: r.status,
        accountName: r.accountName,
        network: r.network || resp.network,
        message: r.message,
      })),
      rawResponse: resp,
    };
  }

  /**
   * Maps DataHouse beneficiaries list response to DataHouseBeneficiaryStatusListDto.
   */
  public static toBeneficiaryStatusListDto(
    resp: DataHouseBeneficiariesListResponse,
  ): DataHouseBeneficiaryStatusListDto {
    const payload = resp.data && typeof resp.data === 'object' && !Array.isArray(resp.data) && 'data' in resp.data
      ? (resp.data as any)
      : resp;

    const items = payload.data || payload.items || payload.results || (Array.isArray(resp) ? resp : []);
    const meta = payload.meta || resp.meta || {};

    const formattedItems = (items as any[]).map((b) => ({
      msisdn: b.msisdn || b.phoneNumber || b.phone || '',
      network: b.network || 'MTN',
      status: b.status || 'pending',
      attemptCount: b.attemptCount ?? 1,
      lastBundleSizeGb: b.lastBundleSizeGb ? String(b.lastBundleSizeGb) : undefined,
      firstDetectedAt: b.firstDetectedAt || b.first_detected_at || new Date().toISOString(),
      lastDetectedAt: b.lastDetectedAt || b.last_detected_at || new Date().toISOString(),
      submittedAt: b.submittedAt || b.submitted_at || null,
      resolvedAt: b.resolvedAt || b.resolved_at || null,
    }));

    return {
      items: formattedItems,
      page: meta.page || 1,
      limit: meta.limit || 30,
      total: meta.total || formattedItems.length,
    };
  }

  /**
   * Maps DataHouse bundles catalog to DataHouseBundleDto array.
   */
  public static toDataHouseBundleDtos(resp: DataHouseBundlesResponse): DataHouseBundleDto[] {
    const payload = resp.data && typeof resp.data === 'object' && !Array.isArray(resp.data) && 'data' in resp.data
      ? (resp.data as any)
      : resp;

    const items = payload.data || payload.bundles || payload.items || (Array.isArray(resp) ? resp : []);

    return items.map((b: any) => {
      const priceGhs = parseFloat(String(b.amount || b.price || 0));
      const agentAmountGhs = parseFloat(String(b.agentAmount || b.agentPrice || priceGhs));
      const pricePesewas = Math.round(priceGhs * 100);
      const agentPricePesewas = Math.round(agentAmountGhs * 100);
      const dataSizeGb = parseFloat(String(b.dataSizeGb || b.dataVolume?.replace(/[^0-9.]/g, '') || 0));
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
        agentPricePesewas,
        agentAmountGhs,
        amountGhs: priceGhs,
        validityDays: parseInt(String(b.validityDays || b.validity || 30), 10),
        isActive: b.is_active !== undefined ? Boolean(b.is_active) : (b.isActive !== undefined ? Boolean(b.isActive) : true),
        type: b.bundleType || b.type || 'DATA',
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
    const payload = resp.data && typeof resp.data === 'object' && !Array.isArray(resp.data) && 'data' in resp.data
      ? (resp.data as any)
      : resp;

    const items = payload.data || payload.ledger || payload.items || (Array.isArray(resp) ? resp : []);
    const meta = payload.meta || resp.meta || {};

    const entries: DataHouseWalletLedgerEntryDto[] = (items as any[]).map((item, idx) => {
      const amountGhs = parseFloat(String(item.amount || 0));
      const direction = item.direction || (amountGhs < 0 ? 'debit' : 'credit');
      return {
        id: item.id || `entry_${idx}_${Date.now()}`,
        walletId: item.walletId || item.wallet_id,
        transactionId: item.transactionId || item.transaction_id,
        direction,
        type: item.type || direction.toUpperCase(),
        amountPesewas: Math.round(Math.abs(amountGhs) * 100),
        amountGhs: Math.abs(amountGhs),
        balanceBeforePesewas: item.balanceBefore ? Math.round(parseFloat(String(item.balanceBefore)) * 100) : undefined,
        balanceAfterPesewas: item.balanceAfter ? Math.round(parseFloat(String(item.balanceAfter)) * 100) : undefined,
        category: item.category || 'purchase',
        referenceType: item.referenceType || item.reference_type,
        referenceId: item.referenceId || item.reference_id || item.orderId || item.order_id,
        description: item.description || item.narration || 'Telecom transaction',
        source: item.source || null,
        reference: item.reference || item.orderId || item.order_id,
        createdAt: item.createdAt || item.created_at || new Date().toISOString(),
      };
    });

    return {
      entries,
      total: meta.total || entries.length,
      page: meta.page || 1,
      limit: meta.limit || 50,
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
      case 'APPROVED':
      case 'FULFILLED':
        return ProviderStatus.COMPLETED;

      case 'PARTIALLY_APPROVED':
        return ProviderStatus.COMPLETED;

      case 'FAILED':
      case 'ERROR':
      case 'EXPIRED':
      case 'COULD_NOT_DELIVER':
      case 'FULFILLMENT_FAILED':
        return ProviderStatus.FAILED;

      case 'REJECTED':
      case 'CANCELLED':
      case 'DECLINED':
      case 'UNVALIDATED':
      case 'REFUNDED':
        return ProviderStatus.REJECTED;

      default:
        return ProviderStatus.UNKNOWN;
    }
  }
}

