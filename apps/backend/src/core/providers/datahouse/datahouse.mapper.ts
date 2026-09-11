import crypto from 'node:crypto';
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

    // DataHouse requires idempotencyKey to be a valid UUID v4
    let idempotencyKey = input.idempotencyKey;
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidV4Regex.test(idempotencyKey)) {
      if (uuidV4Regex.test(input.orderId)) {
        idempotencyKey = input.orderId;
      } else {
        const hash = crypto.createHash('md5').update(idempotencyKey || input.orderId).digest('hex');
        idempotencyKey = `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-a${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
      }
    }

    // DataHouse class-validator enforces strict whitelist on /agent/orders:
    // Only bundleId, phoneNumber, idempotencyKey, and optional email are allowed.
    // Fields like network, volume, dataAmountMb, confirmedPorted must not exist in this payload.
    const req: DataHouseSubmitOrderRequest = {
      bundleId,
      phoneNumber: this.normalizePhone(input.recipientPhone),
      idempotencyKey,
    };

    if (input.metadata?.email) {
      req.email = input.metadata.email as string;
    }

    return req;
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
    const rawItems: any[] =
      resp.results ||
      (Array.isArray(resp.data) ? resp.data : (resp.data as any)?.rows || (resp.data as any)?.results) ||
      (resp as any).rows ||
      [];

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return {
        isValid: false,
        network,
        accountName: undefined,
        rawResponse: resp,
      };
    }

    const first = rawItems[0];
    const isKnown =
      first.isKnown !== undefined
        ? Boolean(first.isKnown)
        : first.known !== undefined
        ? Boolean(first.known)
        : network === NetworkProvider.MTN
        ? false
        : Boolean(first.valid || first.isValid);

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
  /**
   * Maps DataHouse precheck response to full DataHousePrecheckResult.
   */
  public static toDataHousePrecheckResult(
    resp: DataHousePrecheckResponse,
    network: NetworkProvider,
    requestedPhones?: string[],
  ): DataHousePrecheckResult {
    const payload: any =
      resp && typeof resp === 'object' && 'data' in resp && resp.data && typeof resp.data === 'object' && !Array.isArray(resp.data)
        ? (resp as any).data
        : resp;

    const dataObj = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data) ? payload.data : {};

    const rawRows: any[] =
      payload.rows ||
      payload.results ||
      (Array.isArray(payload.data) ? payload.data : []) ||
      payload.items ||
      payload.beneficiaries ||
      payload.recipients ||
      dataObj.rows ||
      dataObj.results ||
      dataObj.beneficiaries ||
      dataObj.items ||
      (Array.isArray(payload) ? payload : []);

    const extractPhones = (items: any[]): string[] => {
      const phones: string[] = [];
      if (!Array.isArray(items)) return phones;
      items.forEach((b: any) => {
        if (!b) return;
        const p =
          typeof b === 'string'
            ? b
            : b.phoneNumber ||
              b.phone_number ||
              b.phone ||
              b.number ||
              b.msisdn ||
              b.MSISDN ||
              b.recipient ||
              b.recipientPhone ||
              b.recipient_phone ||
              b.contact;
        if (p) phones.push(String(p).trim());
      });
      return phones;
    };

    const blockedList: any[] = [
      ...(Array.isArray(payload.blockedFirstTime) ? payload.blockedFirstTime : []),
      ...(Array.isArray(payload.blocked_first_time) ? payload.blocked_first_time : []),
      ...(Array.isArray(payload.blocked) ? payload.blocked : []),
      ...(Array.isArray(payload.blockedNumbers) ? payload.blockedNumbers : []),
      ...(Array.isArray(payload.blocked_numbers) ? payload.blocked_numbers : []),
      ...(Array.isArray(payload.blockedRecipients) ? payload.blockedRecipients : []),
      ...(Array.isArray(payload.blocked_recipients) ? payload.blocked_recipients : []),
      ...(Array.isArray(payload.unknown) ? payload.unknown : []),
      ...(Array.isArray(payload.unknownNumbers) ? payload.unknownNumbers : []),
      ...(Array.isArray(payload.unknown_numbers) ? payload.unknown_numbers : []),
      ...(Array.isArray(payload.unvalidated) ? payload.unvalidated : []),
      ...(Array.isArray(payload.unvalidatedNumbers) ? payload.unvalidatedNumbers : []),
      ...(Array.isArray(payload.unvalidated_numbers) ? payload.unvalidated_numbers : []),
      ...(Array.isArray(payload.unvalidatedBeneficiaries) ? payload.unvalidatedBeneficiaries : []),
      ...(Array.isArray(payload.unvalidated_beneficiaries) ? payload.unvalidated_beneficiaries : []),
      ...(Array.isArray(payload.unvalidatedRecipients) ? payload.unvalidatedRecipients : []),
      ...(Array.isArray(payload.unvalidated_recipients) ? payload.unvalidated_recipients : []),
      ...(Array.isArray(payload.setAside) ? payload.setAside : []),
      ...(Array.isArray(payload.set_aside) ? payload.set_aside : []),
      ...(Array.isArray(payload.setAsideBeneficiaries) ? payload.setAsideBeneficiaries : []),
      ...(Array.isArray(payload.set_aside_beneficiaries) ? payload.set_aside_beneficiaries : []),
      ...(Array.isArray(payload.setAsideNumbers) ? payload.setAsideNumbers : []),
      ...(Array.isArray(payload.set_aside_numbers) ? payload.set_aside_numbers : []),
      ...(Array.isArray(payload.unapproved) ? payload.unapproved : []),
      ...(Array.isArray(payload.unapprovedNumbers) ? payload.unapprovedNumbers : []),
      ...(Array.isArray(payload.unapproved_numbers) ? payload.unapproved_numbers : []),
      ...(Array.isArray(payload.unapprovedBeneficiaries) ? payload.unapprovedBeneficiaries : []),
      ...(Array.isArray(payload.unapproved_beneficiaries) ? payload.unapproved_beneficiaries : []),
      ...(Array.isArray(payload.notValidated) ? payload.notValidated : []),
      ...(Array.isArray(payload.not_validated) ? payload.not_validated : []),
      ...(Array.isArray(payload.notValidatedBeneficiaries) ? payload.notValidatedBeneficiaries : []),
      ...(Array.isArray(payload.not_validated_beneficiaries) ? payload.not_validated_beneficiaries : []),
      ...(Array.isArray(payload.notValidatedNumbers) ? payload.notValidatedNumbers : []),
      ...(Array.isArray(payload.not_validated_numbers) ? payload.not_validated_numbers : []),
      ...(Array.isArray(payload.unregistered) ? payload.unregistered : []),
      ...(Array.isArray(payload.unregistered_numbers) ? payload.unregistered_numbers : []),
      ...(Array.isArray(payload.pendingValidation) ? payload.pendingValidation : []),
      ...(Array.isArray(payload.pending_validation) ? payload.pending_validation : []),
      ...(Array.isArray(payload.pendingApproval) ? payload.pendingApproval : []),
      ...(Array.isArray(payload.pending_approval) ? payload.pending_approval : []),
      ...(Array.isArray(payload.pendingBeneficiaries) ? payload.pendingBeneficiaries : []),
      ...(Array.isArray(payload.pending_beneficiaries) ? payload.pending_beneficiaries : []),
      ...(Array.isArray(payload.pendingNumbers) ? payload.pendingNumbers : []),
      ...(Array.isArray(payload.pending_numbers) ? payload.pending_numbers : []),
      ...(Array.isArray(payload.newNumbers) ? payload.newNumbers : []),
      ...(Array.isArray(payload.new_numbers) ? payload.new_numbers : []),
      // Nested under payload.data
      ...(Array.isArray(dataObj.blockedFirstTime) ? dataObj.blockedFirstTime : []),
      ...(Array.isArray(dataObj.blocked_first_time) ? dataObj.blocked_first_time : []),
      ...(Array.isArray(dataObj.blocked) ? dataObj.blocked : []),
      ...(Array.isArray(dataObj.blocked_numbers) ? dataObj.blocked_numbers : []),
      ...(Array.isArray(dataObj.unknown) ? dataObj.unknown : []),
      ...(Array.isArray(dataObj.unvalidated) ? dataObj.unvalidated : []),
      ...(Array.isArray(dataObj.unvalidated_numbers) ? dataObj.unvalidated_numbers : []),
      ...(Array.isArray(dataObj.unvalidatedBeneficiaries) ? dataObj.unvalidatedBeneficiaries : []),
      ...(Array.isArray(dataObj.unvalidated_beneficiaries) ? dataObj.unvalidated_beneficiaries : []),
      ...(Array.isArray(dataObj.setAside) ? dataObj.setAside : []),
      ...(Array.isArray(dataObj.set_aside) ? dataObj.set_aside : []),
      ...(Array.isArray(dataObj.set_aside_numbers) ? dataObj.set_aside_numbers : []),
      ...(Array.isArray(dataObj.unapproved) ? dataObj.unapproved : []),
      ...(Array.isArray(dataObj.unapproved_numbers) ? dataObj.unapproved_numbers : []),
      ...(Array.isArray(dataObj.notValidated) ? dataObj.notValidated : []),
      ...(Array.isArray(dataObj.not_validated) ? dataObj.not_validated : []),
      ...(Array.isArray(dataObj.pendingValidation) ? dataObj.pendingValidation : []),
      ...(Array.isArray(dataObj.pending_validation) ? dataObj.pending_validation : []),
      ...(Array.isArray(dataObj.pending_numbers) ? dataObj.pending_numbers : []),
    ];

    const blockedSet = new Set<string>();
    extractPhones(blockedList).forEach((p) => {
      const norm = DataHouseMapper.normalizePhone(p);
      const local = norm.startsWith('233') ? '0' + norm.slice(3) : norm;
      blockedSet.add(p);
      blockedSet.add(norm);
      blockedSet.add(local);
      blockedSet.add(`+${norm}`);
    });

    const placeableList: any[] = [
      ...(Array.isArray(payload.placeable) ? payload.placeable : []),
      ...(Array.isArray(payload.placeableBeneficiaries) ? payload.placeableBeneficiaries : []),
      ...(Array.isArray(payload.placeable_beneficiaries) ? payload.placeable_beneficiaries : []),
      ...(Array.isArray(payload.placeableNumbers) ? payload.placeableNumbers : []),
      ...(Array.isArray(payload.placeable_numbers) ? payload.placeable_numbers : []),
      ...(Array.isArray(payload.validBeneficiaries) ? payload.validBeneficiaries : []),
      ...(Array.isArray(payload.valid_beneficiaries) ? payload.valid_beneficiaries : []),
      ...(Array.isArray(payload.approved) ? payload.approved : []),
      ...(Array.isArray(payload.approved_numbers) ? payload.approved_numbers : []),
      ...(Array.isArray(payload.approvedBeneficiaries) ? payload.approvedBeneficiaries : []),
      ...(Array.isArray(payload.approved_beneficiaries) ? payload.approved_beneficiaries : []),
      ...(Array.isArray(dataObj.placeable) ? dataObj.placeable : []),
      ...(Array.isArray(dataObj.placeable_numbers) ? dataObj.placeable_numbers : []),
      ...(Array.isArray(dataObj.placeableBeneficiaries) ? dataObj.placeableBeneficiaries : []),
      ...(Array.isArray(dataObj.placeable_beneficiaries) ? dataObj.placeable_beneficiaries : []),
      ...(Array.isArray(dataObj.approved) ? dataObj.approved : []),
      ...(Array.isArray(dataObj.approved_numbers) ? dataObj.approved_numbers : []),
    ];
    const placeableSet = new Set<string>();
    extractPhones(placeableList).forEach((p) => {
      const norm = DataHouseMapper.normalizePhone(p);
      const local = norm.startsWith('233') ? '0' + norm.slice(3) : norm;
      placeableSet.add(p);
      placeableSet.add(norm);
      placeableSet.add(local);
      placeableSet.add(`+${norm}`);
    });

    const portedList: any[] = [
      ...(Array.isArray(payload.flaggedPorted) ? payload.flaggedPorted : []),
      ...(Array.isArray(payload.flagged_ported) ? payload.flagged_ported : []),
      ...(Array.isArray(payload.mismatched) ? payload.mismatched : []),
      ...(Array.isArray(payload.mismatched_numbers) ? payload.mismatched_numbers : []),
      ...(Array.isArray(payload.mismatchedNumbers) ? payload.mismatchedNumbers : []),
      ...(Array.isArray(dataObj.flaggedPorted) ? dataObj.flaggedPorted : []),
      ...(Array.isArray(dataObj.flagged_ported) ? dataObj.flagged_ported : []),
      ...(Array.isArray(dataObj.mismatched) ? dataObj.mismatched : []),
      ...(Array.isArray(dataObj.mismatched_numbers) ? dataObj.mismatched_numbers : []),
    ];
    const portedMap = new Map<string, string>();
    portedList.forEach((item: any) => {
      const p = typeof item === 'string' ? item : item.phoneNumber || item.phone_number || item.phone || item.number || item.msisdn;
      if (p) {
        const norm = DataHouseMapper.normalizePhone(p);
        const local = norm.startsWith('233') ? '0' + norm.slice(3) : norm;
        const net = item.detectedNetwork || item.detected_network || 'UNKNOWN';
        portedMap.set(p, net);
        portedMap.set(norm, net);
        portedMap.set(local, net);
        portedMap.set(`+${norm}`, net);
      }
    });

    const portedCandidatesList: string[] = [
      ...(Array.isArray(payload.portedCandidates) ? payload.portedCandidates : []),
      ...(Array.isArray(payload.ported_candidates) ? payload.ported_candidates : []),
      ...extractPhones(portedList),
      ...(Array.isArray(dataObj.portedCandidates) ? dataObj.portedCandidates : []),
      ...(Array.isArray(dataObj.ported_candidates) ? dataObj.ported_candidates : []),
    ].filter(Boolean);
    const portedCandidates = Array.from(new Set(portedCandidatesList));

    const effectiveRows: any[] =
      rawRows.length > 0
        ? rawRows
        : (requestedPhones || []).map((p) => ({
            phoneNumber: p,
            matchesSelected: true,
          }));

    const blockedCountVal = payload.blockedCount ?? payload.blocked_count ?? dataObj.blockedCount ?? dataObj.blocked_count;
    const placeableCountVal = payload.placeableCount ?? payload.placeable_count ?? dataObj.placeableCount ?? dataObj.placeable_count;
    const unvalidatedCountVal = payload.unvalidatedCount ?? payload.unvalidated_count ?? dataObj.unvalidatedCount ?? dataObj.unvalidated_count;

    const hasDataHouseGatingData =
      blockedList.length > 0 ||
      blockedSet.size > 0 ||
      placeableSet.size > 0 ||
      blockedCountVal !== undefined ||
      unvalidatedCountVal !== undefined ||
      placeableCountVal !== undefined;

    const results = effectiveRows.map((r: any) => {
      const phone = r.phoneNumber || r.phone_number || r.phone || r.number || r.msisdn || '';
      const norm = DataHouseMapper.normalizePhone(phone);
      const local = norm.startsWith('233') ? '0' + norm.slice(3) : norm;

      const isPorted =
        portedMap.has(phone) ||
        portedMap.has(norm) ||
        portedMap.has(local) ||
        r.matchesSelected === false ||
        r.matches_selected === false;

      const isExplicitlyBlocked =
        blockedSet.has(phone) ||
        blockedSet.has(norm) ||
        blockedSet.has(local);

      const isInPlaceableSet =
        placeableSet.has(phone) ||
        placeableSet.has(norm) ||
        placeableSet.has(local);

      const rawStatus = String(r.status || '').toUpperCase();
      const isUnapprovedStatus =
        rawStatus === 'PENDING' ||
        rawStatus === 'UNAPPROVED' ||
        rawStatus === 'UNVALIDATED' ||
        rawStatus === 'PENDING_VALIDATION' ||
        rawStatus === 'PENDING_APPROVAL' ||
        rawStatus === 'NOT_VALIDATED' ||
        rawStatus === 'SET_ASIDE' ||
        rawStatus === 'BLOCKED' ||
        rawStatus === 'FIRST_TIME' ||
        rawStatus === 'NEW';

      const isExplicitlyUnapproved =
        isExplicitlyBlocked ||
        isUnapprovedStatus ||
        r.validated === false ||
        r.isValidated === false ||
        r.is_validated === false ||
        r.setAside === true ||
        r.set_aside === true ||
        r.isSetAside === true ||
        r.is_set_aside === true ||
        r.blocked === true ||
        r.isBlocked === true ||
        r.is_blocked === true ||
        r.firstTime === true ||
        r.first_time === true ||
        r.isFirstTime === true ||
        r.is_first_time === true ||
        r.unapproved === true ||
        r.isUnapproved === true ||
        r.is_unapproved === true ||
        r.placeable === false ||
        r.isPlaceable === false ||
        r.is_placeable === false ||
        r.isApproved === false ||
        r.is_approved === false ||
        r.approved === false;

      const isExplicitlyKnown =
        r.isKnown !== undefined
          ? Boolean(r.isKnown)
          : r.known !== undefined
          ? Boolean(r.known)
          : r.is_known !== undefined
          ? Boolean(r.is_known)
          : undefined;

      let isKnownRaw = false;
      if (isExplicitlyUnapproved) {
        isKnownRaw = false;
      } else if (placeableSet.size > 0) {
        // Authoritative: If gateway provided placeable set, only numbers in placeableSet are placeable
        isKnownRaw = isInPlaceableSet && !isPorted;
      } else if (isExplicitlyKnown !== undefined) {
        isKnownRaw = isExplicitlyKnown && !isPorted;
      } else if (rawStatus === 'APPROVED' || rawStatus === 'VALID') {
        isKnownRaw = !isPorted;
      } else if (network !== NetworkProvider.MTN) {
        isKnownRaw = !isPorted;
      } else if (hasDataHouseGatingData) {
        if (placeableCountVal === 0) {
          isKnownRaw = false;
        } else if (placeableSet.size > 0) {
          isKnownRaw = isInPlaceableSet && !isPorted && !isExplicitlyBlocked;
        } else if (blockedSet.size > 0) {
          // Blocked numbers are explicitly enumerated; unblocked numbers that match selected are placeable
          isKnownRaw = !isExplicitlyBlocked && !isPorted && r.matchesSelected !== false && r.matches_selected !== false;
        } else if ((blockedCountVal && blockedCountVal > 0) || (unvalidatedCountVal && unvalidatedCountVal > 0)) {
          // Blocked count > 0 but items were not enumerated: safe fallback to unapproved
          isKnownRaw = false;
        } else {
          isKnownRaw = !isExplicitlyBlocked && !isPorted && r.matchesSelected !== false && r.matches_selected !== false;
        }
      } else {
        // No explicit approval or gating data for MTN: strictly default to unapproved
        isKnownRaw = false;
      }

      const isValid =
        r.isValid !== undefined
          ? Boolean(r.isValid)
          : r.valid !== undefined
          ? Boolean(r.valid)
          : r.is_valid !== undefined
          ? Boolean(r.is_valid)
          : !isPorted;

      const isBlocked = isExplicitlyUnapproved || (!isKnownRaw && isValid && !isPorted);
      const isKnown = !isPorted && isKnownRaw && !isBlocked;

      const isExplicitlyOrderable =
        r.orderable !== undefined
          ? Boolean(r.orderable)
          : r.is_orderable !== undefined
          ? Boolean(r.is_orderable)
          : undefined;

      let orderable = false;
      if (isExplicitlyOrderable !== undefined) {
        orderable = isExplicitlyOrderable;
      } else if (payload.enforced === false) {
        orderable = isValid;
      } else {
        orderable = isValid && isKnown && !isBlocked && !isPorted;
      }

      const status = isPorted
        ? 'REJECTED'
        : (isBlocked || isExplicitlyUnapproved)
        ? 'UNAPPROVED'
        : (isKnown ? (r.status || 'APPROVED') : 'UNAPPROVED');

      const message = isPorted
        ? `Carrier mismatch: detected as ${r.detectedNetwork || r.detected_network || portedMap.get(norm) || 'non-MTN'}`
        : isBlocked
        ? 'First-time MTN recipient - pending approval'
        : (r.message || 'Validated recipient');

      return {
        phoneNumber: phone || local,
        phone: local || phone,
        normalized: local,
        isKnown,
        isValid,
        orderable,
        status,
        accountName: r.accountName || r.account_name,
        network: r.detectedNetwork || r.detected_network || r.network || payload.network || network,
        message,
      };
    });

    const summary = {
      requested: payload.summary?.requested ?? payload.count ?? effectiveRows.length,
      unique: payload.summary?.unique ?? results.length,
      valid: payload.summary?.valid ?? (payload.matchingCount !== undefined ? payload.matchingCount : (payload.matching_count !== undefined ? payload.matching_count : results.filter((r: any) => r.isValid).length)),
      invalid: payload.summary?.invalid ?? (payload.mismatchedCount !== undefined ? payload.mismatchedCount : (payload.mismatched_count !== undefined ? payload.mismatched_count : results.filter((r: any) => !r.isValid).length)),
      known: placeableCountVal !== undefined ? placeableCountVal : (payload.summary?.known ?? results.filter((r: any) => r.isKnown).length),
      unknown: (blockedCountVal !== undefined ? blockedCountVal : (unvalidatedCountVal !== undefined ? unvalidatedCountVal : (payload.summary?.unknown ?? results.filter((r: any) => !r.isKnown && r.isValid).length))),
      orderable: payload.summary?.orderable ?? (placeableCountVal !== undefined ? placeableCountVal : results.filter((r: any) => r.orderable).length),
    };

    return {
      network: (payload.network as NetworkProvider) || network,
      enforced: payload.enforced !== undefined ? payload.enforced : true,
      sandbox: Boolean(payload.sandbox),
      recorded: Boolean(payload.recorded),
      reason: payload.reason,
      summary,
      unknown:
        payload.unknown ||
        results.filter((r: any) => !r.isKnown).map((r: any) => r.phoneNumber || r.phone || r.normalized || ''),
      results,
      blockedCount: blockedCountVal !== undefined ? blockedCountVal : results.filter((r: any) => !r.isKnown && r.isValid).length,
      placeableCount: placeableCountVal !== undefined ? placeableCountVal : results.filter((r: any) => r.isKnown).length,
      blockedFirstTime: payload.blockedFirstTime || payload.blocked_first_time,
      flaggedPorted: payload.flaggedPorted || payload.flagged_ported,
      portedCandidates,
      rawResponse: resp,
    };
  }

  /**
   * Maps DataHouse beneficiaries list response to DataHouseBeneficiaryStatusListDto.
   */
  public static toBeneficiaryStatusListDto(
    resp: DataHouseBeneficiariesListResponse,
  ): DataHouseBeneficiaryStatusListDto {
    const payload =
      resp && typeof resp === 'object' && 'data' in resp && resp.data && typeof resp.data === 'object' && !Array.isArray(resp.data) && 'data' in (resp.data as any)
        ? (resp.data as any)
        : resp && typeof resp === 'object' && 'data' in resp && Array.isArray(resp.data)
        ? resp
        : resp;

    const items =
      payload.data && Array.isArray(payload.data)
        ? payload.data
        : payload.items && Array.isArray(payload.items)
        ? payload.items
        : payload.results && Array.isArray(payload.results)
        ? payload.results
        : Array.isArray(resp)
        ? resp
        : Array.isArray((resp as any)?.data)
        ? (resp as any).data
        : [];

    const meta = payload.meta || (resp as any)?.meta || {};

    const formattedItems = (items as any[]).map((b) => ({
      msisdn: b.msisdn || b.phoneNumber || b.phone_number || b.phone || '',
      network: (b.network || 'MTN').toUpperCase(),
      status: String(b.status || 'pending').toLowerCase(),
      attemptCount: Number(b.attemptCount ?? b.attempt_count ?? 1),
      lastBundleSizeGb:
        b.lastBundleSizeGb != null
          ? String(b.lastBundleSizeGb)
          : b.last_bundle_size_gb != null
          ? String(b.last_bundle_size_gb)
          : undefined,
      firstDetectedAt: b.firstDetectedAt || b.first_detected_at || b.created_at || new Date().toISOString(),
      lastDetectedAt: b.lastDetectedAt || b.last_detected_at || b.updated_at || new Date().toISOString(),
      submittedAt: b.submittedAt || b.submitted_at || null,
      resolvedAt: b.resolvedAt || b.resolved_at || null,
    }));

    return {
      items: formattedItems,
      page: Number(meta.page || 1),
      limit: Number(meta.limit || 30),
      total: Number(meta.total ?? formattedItems.length),
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

