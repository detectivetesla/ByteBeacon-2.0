import type pg from 'pg';
import {
  NetworkProvider,
  BeneficiaryValidationStatus,
  BeneficiaryValidationDto,
} from '@bytebeacon/shared';
import { ITelecomProvider } from '../providers/telecom/telecom-provider.interface.js';
import { BadRequestError, NotFoundError } from '../errors/app-error.js';
import { BeneficiaryCacheService, CachedBeneficiaryVerification } from '../cache/beneficiary-cache.service.js';
import { TelecomCircuitBreaker } from '../providers/telecom-circuit-breaker.js';

export interface PrecheckBeneficiaryResult {
  network: NetworkProvider;
  enforced: boolean;
  results: Array<{
    phoneNumber: string;
    network: NetworkProvider;
    isValid: boolean;
    isKnown: boolean;
    accountName?: string;
  }>;
}

export class BeneficiaryService {
  private readonly db: pg.Pool;
  private readonly telecomProvider: ITelecomProvider | null;
  private readonly cacheService: BeneficiaryCacheService | null;
  private readonly circuitBreaker: TelecomCircuitBreaker | null;

  constructor(
    db: pg.Pool,
    telecomProvider: ITelecomProvider | null = null,
    cacheService: BeneficiaryCacheService | null = null,
    circuitBreaker: TelecomCircuitBreaker | null = null,
  ) {
    this.db = db;
    this.telecomProvider = telecomProvider;
    this.cacheService = cacheService;
    this.circuitBreaker =
      circuitBreaker ||
      (telecomProvider ? new TelecomCircuitBreaker({ providerName: telecomProvider.providerName }) : null);
  }

  public getCircuitBreaker(): TelecomCircuitBreaker | null {
    return this.circuitBreaker;
  }

  public async validatePhoneNumber(
    phoneNumber: string,
    network: NetworkProvider,
  ): Promise<BeneficiaryValidationDto> {
    const cleanPhone = phoneNumber.trim().replace(/\s+/g, '');

    // Ghana phone format check (10 digits starting with 02/05 or +233)
    const ghanaPhoneRegex = /^(?:\+233|0)[235]\d{8}$/;
    if (!ghanaPhoneRegex.test(cleanPhone)) {
      throw new BadRequestError(
        'Invalid Ghana phone number format. Must be a valid 10-digit number (e.g. 024XXXXXXX).',
      );
    }

    // Check existing valid cache (valid for 30 days)
    const existingQuery = `
      SELECT id, phone_number as "phoneNumber", network, validation_status as "status",
             provider_reference as "providerReference", validated_at as "validatedAt",
             expires_at as "expiresAt", created_at as "createdAt"
      FROM beneficiary_validation
      WHERE phone_number = $1 AND network = $2 AND validation_status = 'VALID' AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const cachedRes = await this.db.query(existingQuery, [cleanPhone, network]);
    if (cachedRes.rows.length > 0) {
      const r = cachedRes.rows[0];
      return {
        id: r.id,
        phoneNumber: r.phoneNumber,
        network: r.network as NetworkProvider,
        status: r.status as BeneficiaryValidationStatus,
        providerReference: r.providerReference,
        validatedAt: r.validatedAt ? new Date(r.validatedAt).toISOString() : null,
        expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
        createdAt: new Date(r.createdAt).toISOString(),
      };
    }

    // Create new validation record (Valid for 30 days)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const insertQuery = `
      INSERT INTO beneficiary_validation (phone_number, network, validation_status, validated_at, expires_at)
      VALUES ($1, $2, 'VALID', CURRENT_TIMESTAMP, $3)
      RETURNING id, phone_number as "phoneNumber", network, validation_status as "status",
                provider_reference as "providerReference", validated_at as "validatedAt",
                expires_at as "expiresAt", created_at as "createdAt"
    `;

    const result = await this.db.query(insertQuery, [cleanPhone, network, expiresAt]);
    const r = result.rows[0];

    return {
      id: r.id,
      phoneNumber: r.phoneNumber,
      network: r.network as NetworkProvider,
      status: r.status as BeneficiaryValidationStatus,
      providerReference: r.providerReference,
      validatedAt: r.validatedAt ? new Date(r.validatedAt).toISOString() : null,
      expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
      createdAt: new Date(r.createdAt).toISOString(),
    };
  }

  public async getBeneficiaryStatus(
    phoneNumber: string,
    network?: NetworkProvider,
  ): Promise<BeneficiaryValidationDto | null> {
    const cleanPhone = phoneNumber.trim().replace(/\s+/g, '');
    let query = `
      SELECT id, phone_number as "phoneNumber", network, validation_status as "status",
             provider_reference as "providerReference", validated_at as "validatedAt",
             expires_at as "expiresAt", created_at as "createdAt"
      FROM beneficiary_validation
      WHERE phone_number = $1
    `;
    const params: unknown[] = [cleanPhone];

    if (network) {
      query += ' AND network = $2';
      params.push(network);
    }

    query += ' ORDER BY created_at DESC LIMIT 1';

    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return null;

    const r = result.rows[0];
    return {
      id: r.id,
      phoneNumber: r.phoneNumber,
      network: r.network as NetworkProvider,
      status: r.status as BeneficiaryValidationStatus,
      providerReference: r.providerReference,
      validatedAt: r.validatedAt ? new Date(r.validatedAt).toISOString() : null,
      expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
      createdAt: new Date(r.createdAt).toISOString(),
    };
  }

  /**
   * Normalizes and validates a Ghanaian MSISDN.
   */
  public normalizeGhanaPhone(phone: string): { normalized: string; valid: boolean; raw: string } {
    const raw = String(phone || '').trim();
    let clean = raw.replace(/[\s\-()]/g, '');

    if (clean.startsWith('+233')) {
      clean = '0' + clean.slice(4);
    } else if (clean.startsWith('233') && clean.length === 12) {
      clean = '0' + clean.slice(3);
    } else if (/^[235]\d{8}$/.test(clean)) {
      clean = '0' + clean;
    }

    const ghanaPhoneRegex = /^0[235]\d{8}$/;
    const valid = ghanaPhoneRegex.test(clean);

    return {
      raw,
      normalized: valid ? clean : raw,
      valid,
    };
  }

  /**
   * Public Beneficiary Precheck (up to 10 numbers per call).
   * POST /orders/beneficiaries/precheck
   */
  public async precheckPublicBeneficiaries(params: {
    network: NetworkProvider | string;
    phoneNumbers: string[];
    record?: boolean;
    userId?: string;
  }): Promise<{
    network: NetworkProvider | string;
    enforced?: boolean;
    sandbox?: boolean;
    recorded?: boolean;
    reason?: string;
    summary?: {
      requested: number;
      unique: number;
      valid: number;
      invalid: number;
      known: number;
      unknown: number;
      orderable: number;
    };
    unknown?: string[];
    portedCandidates?: string[];
    results: Array<{
      phone: string;
      phoneNumber: string;
      normalized: string;
      valid: boolean;
      isValid: boolean;
      known: boolean;
      isKnown: boolean;
      orderable: boolean;
      status: string;
      message: string;
      accountName?: string;
    }>;
  }> {
    const { network, phoneNumbers } = params;
    const net = (typeof network === 'string' ? network.toUpperCase() : network) as NetworkProvider;

    const parsedItems = phoneNumbers.map((p) => this.normalizeGhanaPhone(p));
    const validNormalizedPhones = Array.from(
      new Set(parsedItems.filter((item) => item.valid).map((item) => item.normalized)),
    );

    // If TELECEL or non-MTN, every valid Ghanaian MSISDN is known: true and orderable: true
    if (net !== NetworkProvider.MTN) {
      const results = parsedItems.map((item) => ({
        phone: item.raw,
        phoneNumber: item.raw,
        normalized: item.normalized,
        valid: item.valid,
        isValid: item.valid,
        known: item.valid,
        isKnown: item.valid,
        orderable: item.valid,
        status: item.valid ? 'APPROVED' : 'REJECTED',
        message: item.valid ? 'Direct carrier fulfillment' : 'Invalid Ghanaian phone number format',
      }));
      return {
        network: net,
        enforced: false,
        sandbox: false,
        recorded: false,
        reason: 'non_mtn',
        summary: {
          requested: phoneNumbers.length,
          unique: parsedItems.length,
          valid: results.filter((r) => r.valid).length,
          invalid: results.filter((r) => !r.valid).length,
          known: results.filter((r) => r.known).length,
          unknown: 0,
          orderable: results.filter((r) => r.orderable).length,
        },
        unknown: [],
        portedCandidates: [],
        results,
      };
    }

    const knownPhonesSet = new Set<string>();
    const accountNamesMap = new Map<string, string>();
    const portedCandidatesSet = new Set<string>();
    const upstreamOrderableMap = new Map<string, boolean>();
    const liveUnapprovedSet = new Set<string>();

    // 0. Query Redis Cache first (Sub-millisecond lookup for previously verified numbers)
    // For small interactive sets (<= 10 numbers, e.g. Single Orders), live telecom precheck
    // must ALWAYS be performed to guarantee 100% real-time whitelist accuracy against carrier changes.
    const uncachedPhones: string[] = [];
    const isSmallInteractiveBatch = validNormalizedPhones.length <= 10;
    if (!isSmallInteractiveBatch && this.cacheService && validNormalizedPhones.length > 0) {
      try {
        const cachedMap = await this.cacheService.getCachedResults(String(net), validNormalizedPhones);
        for (const p of validNormalizedPhones) {
          const cached = cachedMap.get(p);
          if (cached) {
            if (cached.status === 'APPROVED') {
              knownPhonesSet.add(p);
              knownPhonesSet.add(`+233${p.slice(1)}`);
              knownPhonesSet.add(`233${p.slice(1)}`);
              if (cached.accountName) accountNamesMap.set(p, cached.accountName);
              upstreamOrderableMap.set(p, true);
            } else if (cached.status === 'UNAPPROVED') {
              liveUnapprovedSet.add(p);
              liveUnapprovedSet.add(`+233${p.slice(1)}`);
              liveUnapprovedSet.add(`233${p.slice(1)}`);
              upstreamOrderableMap.set(p, false);
            }
          } else {
            uncachedPhones.push(p);
          }
        }
      } catch {
        uncachedPhones.push(...validNormalizedPhones);
      }
    } else {
      uncachedPhones.push(...validNormalizedPhones);
    }

    // 1. Query upstream authoritative telecom provider (DataHouse) for live MTN precheck
    if (uncachedPhones.length > 0 && this.telecomProvider) {
      const newlyApprovedPhones: string[] = [];
      const newlyUnapprovedPhones: string[] = [];

      // For large batches (> 20 numbers, e.g. Excel uploads), pre-resolve numbers that were
      // authoritatively verified by DataHouse within the last 24h to avoid hitting public rate limits.
      // For small sets (<= 20) or single orders, 100% live telecom check is always performed.
      let phonesToQueryLive = uncachedPhones;
      if (uncachedPhones.length > 20) {
        try {
          const queryPhones = Array.from(
            new Set(
              uncachedPhones.flatMap((p) => [
                p,
                `+233${p.startsWith('0') ? p.slice(1) : p}`,
                `233${p.startsWith('0') ? p.slice(1) : p}`,
              ]),
            ),
          );
          const recentApprovedRes = await this.db.query(
            `SELECT phone_number as "phoneNumber"
             FROM beneficiary_validation
             WHERE phone_number = ANY($1)
               AND network = 'MTN'
               AND validation_status IN ('VALID', 'APPROVED')
               AND provider_reference = 'DH-PRECHECK'
               AND validated_at > CURRENT_TIMESTAMP - INTERVAL '2 hours'`,
            [queryPhones],
          );
          recentApprovedRes.rows.forEach((r: any) => {
            if (r.phoneNumber) {
              const norm = this.normalizeGhanaPhone(r.phoneNumber).normalized;
              if (norm) {
                knownPhonesSet.add(norm);
                knownPhonesSet.add(r.phoneNumber);
                knownPhonesSet.add(`+233${norm.slice(1)}`);
                knownPhonesSet.add(`233${norm.slice(1)}`);
              }
            }
          });
          phonesToQueryLive = uncachedPhones.filter((p) => !knownPhonesSet.has(p));
        } catch {
          phonesToQueryLive = uncachedPhones;
        }
      }

      const chunkSize = this.telecomProvider.precheckBeneficiaries ? 500 : 10;
      const chunks: string[][] = [];
      for (let i = 0; i < phonesToQueryLive.length; i += chunkSize) {
        chunks.push(phonesToQueryLive.slice(i, i + chunkSize));
      }

      for (const chunk of chunks) {
        try {
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 300000));
          const isPublicPrecheck = Boolean(chunk.length <= 10 && this.telecomProvider.precheckPublicBeneficiaries);
          const providerMethod = isPublicPrecheck
            ? this.telecomProvider.precheckPublicBeneficiaries!.bind(this.telecomProvider)
            : (this.telecomProvider.precheckBeneficiaries
                ? this.telecomProvider.precheckBeneficiaries.bind(this.telecomProvider)
                : this.telecomProvider.precheckPublicBeneficiaries!.bind(this.telecomProvider));

          const providerCall = isPublicPrecheck
            ? (providerMethod as any)({ network: net, phoneNumbers: chunk })
            : (providerMethod as any)({ network: net, phoneNumbers: chunk, record: params.record });
          const safeCall = providerCall.catch(() => null);

          const providerRes: any = await Promise.race([safeCall, timeoutPromise]);
          if (providerRes && Array.isArray(providerRes.results) && providerRes.results.length > 0) {

            if (Array.isArray(providerRes.portedCandidates)) {
              providerRes.portedCandidates.forEach((p: string) => {
                const norm = this.normalizeGhanaPhone(p).normalized;
                if (norm) portedCandidatesSet.add(norm);
                portedCandidatesSet.add(p);
              });
            }
            if (Array.isArray(providerRes.flaggedPorted)) {
              providerRes.flaggedPorted.forEach((f: any) => {
                const p = typeof f === 'string' ? f : f.phoneNumber || f.phone;
                if (p) {
                  const norm = this.normalizeGhanaPhone(p).normalized;
                  if (norm) portedCandidatesSet.add(norm);
                  portedCandidatesSet.add(p);
                }
              });
            }

            providerRes.results.forEach((r: any) => {
              const norm = this.normalizeGhanaPhone(r.phoneNumber || (r as any).phone || (r as any).normalized || '').normalized;
              if (norm && r.orderable !== undefined) {
                upstreamOrderableMap.set(norm, Boolean(r.orderable));
              }
              if ((r as any).isPorted || r.status === 'REJECTED') {
                if (norm) portedCandidatesSet.add(norm);
              }

              const isApproved = Boolean(
                (r.isKnown === true || (r as any).known === true) &&
                r.status !== 'UNAPPROVED' &&
                r.status !== 'REJECTED' &&
                r.orderable !== false
              );
              if (isApproved) {
                if (norm) {
                  knownPhonesSet.add(norm);
                  knownPhonesSet.add(`+233${norm.slice(1)}`);
                  knownPhonesSet.add(`233${norm.slice(1)}`);
                  newlyApprovedPhones.push(norm);
                }
                if (r.phoneNumber) knownPhonesSet.add(r.phoneNumber);
                if ((r as any).phone) knownPhonesSet.add((r as any).phone);
                if (r.accountName && norm) accountNamesMap.set(norm, r.accountName);
              } else {
                if (norm) {
                  knownPhonesSet.delete(norm);
                  knownPhonesSet.delete(`+233${norm.slice(1)}`);
                  knownPhonesSet.delete(`233${norm.slice(1)}`);
                  newlyUnapprovedPhones.push(norm);
                  liveUnapprovedSet.add(norm);
                  liveUnapprovedSet.add(`+233${norm.slice(1)}`);
                  liveUnapprovedSet.add(`233${norm.slice(1)}`);
                  upstreamOrderableMap.set(norm, false);
                }
                if (r.phoneNumber) {
                  knownPhonesSet.delete(r.phoneNumber);
                  liveUnapprovedSet.add(r.phoneNumber);
                }
                if ((r as any).phone) {
                  knownPhonesSet.delete((r as any).phone);
                  liveUnapprovedSet.add((r as any).phone);
                }
              }
            });

            // Also check unknown, blocked, unvalidated, or set-aside arrays in provider response
            const explicitBlocked = [
              ...(Array.isArray(providerRes.unknown) ? providerRes.unknown : []),
              ...(Array.isArray(providerRes.blockedFirstTime) ? providerRes.blockedFirstTime : []),
              ...(Array.isArray(providerRes.blocked) ? providerRes.blocked : []),
              ...(Array.isArray(providerRes.unvalidated) ? providerRes.unvalidated : []),
              ...(Array.isArray(providerRes.unvalidatedBeneficiaries) ? providerRes.unvalidatedBeneficiaries : []),
              ...(Array.isArray(providerRes.setAside) ? providerRes.setAside : []),
              ...(Array.isArray(providerRes.unapproved) ? providerRes.unapproved : []),
              ...(Array.isArray(providerRes.notValidated) ? providerRes.notValidated : []),
            ];
            explicitBlocked.forEach((b: any) => {
              const p = typeof b === 'string' ? b : b.phoneNumber || b.phone || b.msisdn;
              if (p) {
                const norm = this.normalizeGhanaPhone(p).normalized;
                if (norm) {
                  knownPhonesSet.delete(norm);
                  knownPhonesSet.delete(`+233${norm.slice(1)}`);
                  knownPhonesSet.delete(`233${norm.slice(1)}`);
                  newlyUnapprovedPhones.push(norm);
                  liveUnapprovedSet.add(norm);
                  liveUnapprovedSet.add(`+233${norm.slice(1)}`);
                  liveUnapprovedSet.add(`233${norm.slice(1)}`);
                  upstreamOrderableMap.set(norm, false);
                }
                knownPhonesSet.delete(p);
                liveUnapprovedSet.add(p);
              }
            });
          }
        } catch {
          // Non-fatal per-chunk error: do not taint liveUnapprovedSet on network errors.
          // Unresolved numbers will be verified against local DB cache or defaulted to unapproved in step 4.
        }
      }

      // 3. Persist newly discovered approved numbers to local DB cache (30 days validity) via bulk queries
      if (newlyApprovedPhones.length > 0) {
        const uniqueNewlyApproved = Array.from(new Set(newlyApprovedPhones));
        const meta = JSON.stringify({
          source: 'telecom_provider_precheck',
          verifiedAt: new Date().toISOString(),
        });
        await this.db.query(
          `INSERT INTO beneficiary_validation (
            phone_number, network, validation_status, validated_at, expires_at,
            provider_reference, provider_response_metadata, created_at, updated_at
          )
          SELECT unk, 'MTN', 'VALID', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 'DH-PRECHECK', $2::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          FROM unnest($1::text[]) AS unk
          ON CONFLICT (phone_number, network) DO UPDATE
          SET validation_status = 'VALID',
              validated_at = CURRENT_TIMESTAMP,
              expires_at = CURRENT_TIMESTAMP + INTERVAL '30 days',
              provider_reference = 'DH-PRECHECK',
              updated_at = CURRENT_TIMESTAMP`,
          [uniqueNewlyApproved, meta],
        ).catch(() => {});

        await this.db.query(
          `UPDATE pending_beneficiary_approvals
           SET status = 'APPROVED', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE phone_number = ANY($1) AND network = 'MTN'`,
          [uniqueNewlyApproved],
        ).catch(() => {});
      }

      // Demote newly unapproved numbers so stale VALID rows are fixed across all phone variations
      if (newlyUnapprovedPhones.length > 0) {
        const uniqueNewlyUnapproved = Array.from(new Set(newlyUnapprovedPhones));
        const allVariations = uniqueNewlyUnapproved.flatMap((p) => [
          p,
          `+233${p.startsWith('0') ? p.slice(1) : p}`,
          `233${p.startsWith('0') ? p.slice(1) : p}`,
        ]);
        await this.db.query(
          `UPDATE beneficiary_validation
           SET validation_status = 'PENDING', updated_at = CURRENT_TIMESTAMP
           WHERE phone_number = ANY($1) AND network = 'MTN'`,
          [allVariations],
        ).catch(() => {});

        // Invalidate stale approved cache in Redis/in-memory immediately
        if (this.cacheService) {
          this.cacheService.deleteCachedResults(String(net), uniqueNewlyUnapproved).catch(() => {});
        }
      }
    }

    // 2. Database validation check: consult local beneficiary_validation and pending approvals (only if not unapproved by live check)
    if (validNormalizedPhones.length > 0) {
      try {
        const queryPhones = Array.from(
          new Set(
            validNormalizedPhones.flatMap((p) => [
              p,
              `+233${p.startsWith('0') ? p.slice(1) : p}`,
              `233${p.startsWith('0') ? p.slice(1) : p}`,
            ]),
          ),
        );

        // Check local approved records (Live telecom precheck is strictly authoritative over cache)
        const approvedRes = await this.db.query(
          `SELECT phone_number as "phoneNumber", NULL as "accountName"
           FROM beneficiary_validation
           WHERE phone_number = ANY($1)
             AND network = 'MTN'
             AND validation_status IN ('VALID', 'APPROVED')
             AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
           UNION
           SELECT phone_number as "phoneNumber", NULL as "accountName"
           FROM pending_beneficiary_approvals
           WHERE phone_number = ANY($1)
             AND network = 'MTN'
             AND status = 'APPROVED'`,
          [queryPhones],
        );
        approvedRes.rows.forEach((r: any) => {
          if (r.phoneNumber) {
            const norm = this.normalizeGhanaPhone(r.phoneNumber).normalized;
            // Live telecom precheck is authoritative: never re-approve if live check reported unapproved
            const isLiveUnapproved =
              liveUnapprovedSet.has(norm) ||
              liveUnapprovedSet.has(r.phoneNumber) ||
              upstreamOrderableMap.get(norm) === false;

            if (isLiveUnapproved) {
              knownPhonesSet.delete(norm);
              knownPhonesSet.delete(r.phoneNumber);
            } else if (!isSmallInteractiveBatch) {
              // Only allow database cache fallback for large offline batches (> 10 numbers) where DB pre-resolution was intentional.
              // For small interactive sets (<= 10 numbers, e.g. Single Orders), live telecom precheck is strictly mandatory;
              // stale DB records MUST NEVER falsely approve an MTN number that was not confirmed live by the carrier!
              knownPhonesSet.add(norm);
              knownPhonesSet.add(r.phoneNumber);
            }
          }
        });

        // Check explicit pending or rejected records in local DB
        const pendingRes = await this.db.query(
          `SELECT phone_number as "phoneNumber"
           FROM pending_beneficiary_approvals
           WHERE phone_number = ANY($1)
             AND network = 'MTN'
             AND status IN ('PENDING', 'REJECTED')
           UNION
           SELECT phone_number as "phoneNumber"
           FROM beneficiary_validation
           WHERE phone_number = ANY($1)
             AND network = 'MTN'
             AND validation_status IN ('PENDING', 'REJECTED')`,
          [queryPhones],
        );
        pendingRes.rows.forEach((r: any) => {
          if (r.phoneNumber) {
            const norm = this.normalizeGhanaPhone(r.phoneNumber).normalized;
            // If it's pending/rejected and not approved in approvedRes, ensure it is removed from known
            const hasApproved = approvedRes.rows.some((ap: any) => {
              const apNorm = this.normalizeGhanaPhone(ap.phoneNumber).normalized;
              return apNorm === norm;
            });
            if (!hasApproved || liveUnapprovedSet.has(norm)) {
              knownPhonesSet.delete(norm);
              knownPhonesSet.delete(r.phoneNumber);
              upstreamOrderableMap.set(norm, false);
            }
          }
        });
      } catch {
        // Non-fatal
      }
    }

    const results = parsedItems.map((item) => {
      const isLiveUnapproved = liveUnapprovedSet.has(item.normalized) || liveUnapprovedSet.has(item.raw);
      const isKnown = item.valid && !isLiveUnapproved ? (knownPhonesSet.has(item.normalized) || knownPhonesSet.has(item.raw)) : false;
      const isPortedCandidate = portedCandidatesSet.has(item.normalized) || portedCandidatesSet.has(item.raw);

      let isOrderable = false;
      if (upstreamOrderableMap.has(item.normalized)) {
        isOrderable = Boolean(upstreamOrderableMap.get(item.normalized)) && isKnown;
      } else {
        isOrderable = item.valid && isKnown && !isPortedCandidate;
      }

      const status = !item.valid ? 'REJECTED' : isKnown ? 'APPROVED' : 'UNAPPROVED';
      const message = !item.valid
        ? 'Invalid Ghanaian phone number format'
        : isKnown
        ? 'Validated MTN recipient'
        : 'First-time MTN recipient - pending approval';
      return {
        phone: item.raw,
        phoneNumber: item.raw,
        normalized: item.normalized,
        valid: item.valid,
        isValid: item.valid,
        known: isKnown,
        isKnown,
        orderable: isOrderable,
        status,
        message,
        accountName: accountNamesMap.get(item.normalized),
      };
    });

    const unknownList = results
      .filter((r) => r.valid && !r.known)
      .map((r) => r.normalized);

    let recorded = false;
    if (params.record && unknownList.length > 0) {
      recorded = true;
      try {
        const effectiveAgentId = params.userId;

        if (effectiveAgentId) {
          await this.db.query(
            `INSERT INTO pending_beneficiary_approvals (
              phone_number, network, agent_id, status, attempt_count,
              first_detected_at, last_detected_at, created_at, updated_at
            )
            SELECT unk, 'MTN', $2, 'PENDING', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            FROM unnest($1::text[]) AS unk
            ON CONFLICT (agent_id, phone_number, network) DO UPDATE
            SET attempt_count = pending_beneficiary_approvals.attempt_count + 1,
                last_detected_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP`,
            [unknownList, effectiveAgentId],
          ).catch(() => {});
        }

        const metadata = JSON.stringify({
          agentId: params.userId || null,
          recordedVia: 'precheck',
          recordedAt: new Date().toISOString(),
        });
        await this.db.query(
          `INSERT INTO beneficiary_validation (phone_number, network, validation_status, provider_response_metadata, agent_id, created_at, updated_at)
           SELECT unk, 'MTN', 'PENDING', $2::jsonb, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
           FROM unnest($1::text[]) AS unk
           ON CONFLICT (phone_number, network) DO UPDATE
           SET validation_status = 'PENDING',
               updated_at = CURRENT_TIMESTAMP
           WHERE beneficiary_validation.validation_status != 'APPROVED'`,
          [unknownList, metadata, params.userId || null],
        ).catch(() => {});
      } catch {
        // Non-fatal recording failure
      }
    }

    // Persist verified results to Redis cache asynchronously
    if (this.cacheService && results.length > 0) {
      const cacheItems: CachedBeneficiaryVerification[] = results
        .filter((r) => r.valid)
        .map((r) => ({
          phoneNumber: r.phone,
          normalized: r.normalized,
          network: String(net),
          status: r.status as 'APPROVED' | 'UNAPPROVED' | 'REJECTED',
          isValid: r.valid,
          isKnown: r.known,
          orderable: r.orderable,
          accountName: r.accountName,
          message: r.message,
          cachedAt: Date.now(),
          ttlSeconds:
            r.status === 'APPROVED'
              ? BeneficiaryCacheService.TTL_APPROVED
              : r.status === 'REJECTED'
              ? BeneficiaryCacheService.TTL_REJECTED
              : BeneficiaryCacheService.TTL_UNAPPROVED,
        }));
      this.cacheService.setCachedResults(String(net), cacheItems).catch(() => {});
    }

    return {
      network: net,
      enforced: true,
      sandbox: false,
      recorded,
      summary: {
        requested: phoneNumbers.length,
        unique: results.length,
        valid: results.filter((r) => r.valid).length,
        invalid: results.filter((r) => !r.valid).length,
        known: results.filter((r) => r.known).length,
        unknown: unknownList.length,
        orderable: results.filter((r) => r.orderable).length,
      },
      unknown: unknownList,
      portedCandidates: Array.from(portedCandidatesSet),
      results,
    };
  }

  /**
   * Bulk-sized Agent Beneficiary Precheck with opt-in recording.
   * POST /agent/beneficiaries/precheck
   */
  public async precheckAgentBeneficiaries(params: {
    network: NetworkProvider | string;
    phoneNumbers: string[];
    record?: boolean;
    isSandbox?: boolean;
    userId?: string;
  }): Promise<{
    network: NetworkProvider | string;
    enforced: boolean;
    sandbox: boolean;
    recorded: boolean;
    reason?: string;
    summary: {
      requested: number;
      unique: number;
      valid: number;
      invalid: number;
      known: number;
      unknown: number;
      orderable: number;
    };
    unknown: string[];
    portedCandidates: string[];
    results: Array<{
      phone: string;
      phoneNumber: string;
      normalized: string;
      valid: boolean;
      isValid: boolean;
      known: boolean;
      isKnown: boolean;
      orderable: boolean;
      status: string;
      message: string;
    }>;
  }> {
    const { network, phoneNumbers, record = false, isSandbox = false, userId: _userId } = params;
    const net = (typeof network === 'string' ? network.toUpperCase() : network) as NetworkProvider;

    const requestedCount = phoneNumbers.length;

    // Deduplicate while preserving original order
    const seen = new Set<string>();
    const uniqueItems: Array<{ phone: string; normalized: string; valid: boolean }> = [];

    for (const phone of phoneNumbers) {
      const parsed = this.normalizeGhanaPhone(phone);
      if (!seen.has(parsed.normalized)) {
        seen.add(parsed.normalized);
        uniqueItems.push({
          phone: parsed.raw,
          normalized: parsed.normalized,
          valid: parsed.valid,
        });
      }
    }

    // 1. Check Sandbox Short-Circuit
    if (isSandbox) {
      const results = uniqueItems.map((item) => ({
        phone: item.phone,
        phoneNumber: item.phone,
        normalized: item.normalized,
        valid: item.valid,
        isValid: item.valid,
        known: item.valid,
        isKnown: item.valid,
        orderable: item.valid,
        status: item.valid ? 'APPROVED' : 'REJECTED',
        message: item.valid ? 'Sandbox validated recipient' : 'Invalid Ghanaian phone number format',
      }));

      return {
        network: net,
        enforced: false,
        sandbox: true,
        recorded: false,
        reason: 'sandbox',
        summary: {
          requested: requestedCount,
          unique: uniqueItems.length,
          valid: results.filter((r) => r.valid).length,
          invalid: results.filter((r) => !r.valid).length,
          known: results.filter((r) => r.known).length,
          unknown: 0,
          orderable: results.filter((r) => r.orderable).length,
        },
        unknown: [],
        portedCandidates: [],
        results,
      };
    }

    // 2. Check Non-MTN Short-Circuit (TELECEL / AIRTELTIGO)
    if (net !== NetworkProvider.MTN) {
      const results = uniqueItems.map((item) => ({
        phone: item.phone,
        phoneNumber: item.phone,
        normalized: item.normalized,
        valid: item.valid,
        isValid: item.valid,
        known: item.valid,
        isKnown: item.valid,
        orderable: item.valid,
        status: item.valid ? 'APPROVED' : 'REJECTED',
        message: item.valid ? 'Direct carrier fulfillment' : 'Invalid Ghanaian phone number format',
      }));

      return {
        network: net,
        enforced: false,
        sandbox: false,
        recorded: false,
        reason: 'non_mtn',
        summary: {
          requested: requestedCount,
          unique: uniqueItems.length,
          valid: results.filter((r) => r.valid).length,
          invalid: results.filter((r) => !r.valid).length,
          known: results.filter((r) => r.known).length,
          unknown: 0,
          orderable: results.filter((r) => r.orderable).length,
        },
        unknown: [],
        portedCandidates: [],
        results,
      };
    }

    // 3. Check Global Kill Switch (enforcement_off)
    const isEnforcementOff =
      process.env.MTN_UP2U_ENFORCEMENT === 'false' ||
      process.env.ENABLE_UP2U_ENFORCEMENT === 'false' ||
      process.env.UP2U_KILL_SWITCH === 'true';

    if (isEnforcementOff) {
      const results = uniqueItems.map((item) => ({
        phone: item.phone,
        phoneNumber: item.phone,
        normalized: item.normalized,
        valid: item.valid,
        isValid: item.valid,
        known: item.valid,
        isKnown: item.valid,
        orderable: item.valid,
        status: item.valid ? 'APPROVED' : 'REJECTED',
        message: item.valid ? 'Enforcement disabled' : 'Invalid Ghanaian phone number format',
      }));

      return {
        network: net,
        enforced: false,
        sandbox: false,
        recorded: false,
        reason: 'enforcement_off',
        summary: {
          requested: requestedCount,
          unique: uniqueItems.length,
          valid: results.filter((r) => r.valid).length,
          invalid: results.filter((r) => !r.valid).length,
          known: results.filter((r) => r.known).length,
          unknown: 0,
          orderable: results.filter((r) => r.orderable).length,
        },
        unknown: [],
        portedCandidates: [],
        results,
      };
    }

    // 4. Live MTN Enforcement
    const validNormalizedPhones = uniqueItems.filter((item) => item.valid).map((item) => item.normalized);
    const knownPhonesSet = new Set<string>();
    const portedCandidatesSet = new Set<string>();
    const upstreamOrderableMap = new Map<string, boolean>();
    const liveUnapprovedSet = new Set<string>();

    // 0. Query Redis Cache first (Sub-millisecond lookup for previously verified numbers)
    const uncachedPhones: string[] = [];
    if (this.cacheService && validNormalizedPhones.length > 0) {
      try {
        const cachedMap = await this.cacheService.getCachedResults(String(net), validNormalizedPhones);
        for (const p of validNormalizedPhones) {
          const cached = cachedMap.get(p);
          if (cached) {
            if (cached.status === 'APPROVED') {
              knownPhonesSet.add(p);
              knownPhonesSet.add(`+233${p.slice(1)}`);
              knownPhonesSet.add(`233${p.slice(1)}`);
              upstreamOrderableMap.set(p, true);
            } else if (cached.status === 'UNAPPROVED') {
              liveUnapprovedSet.add(p);
              liveUnapprovedSet.add(`+233${p.slice(1)}`);
              liveUnapprovedSet.add(`233${p.slice(1)}`);
              upstreamOrderableMap.set(p, false);
            }
          } else {
            uncachedPhones.push(p);
          }
        }
      } catch {
        uncachedPhones.push(...validNormalizedPhones);
      }
    } else {
      uncachedPhones.push(...validNormalizedPhones);
    }

    // 1. Query upstream authoritative telecom provider (DataHouse) for live MTN precheck
    const provider = this.telecomProvider;
    if (
      uncachedPhones.length > 0 &&
      provider &&
      (provider.precheckBeneficiaries || provider.precheckPublicBeneficiaries)
    ) {
      try {
        const newlyApprovedPhones: string[] = [];
        const newlyUnapprovedPhones: string[] = [];
        const chunkSize = provider.precheckBeneficiaries ? 500 : 10;
        const phoneChunks: string[][] = [];
        for (let i = 0; i < uncachedPhones.length; i += chunkSize) {
          phoneChunks.push(uncachedPhones.slice(i, i + chunkSize));
        }

        for (const chunk of phoneChunks) {
          let providerRes: any = null;
          if (provider.precheckBeneficiaries) {
            try {
              const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 120000));
              const call = provider.precheckBeneficiaries({
                network: net,
                phoneNumbers: chunk,
                record,
              }).catch(() => null);
              providerRes = await Promise.race([call, timeoutPromise]);
            } catch {
              providerRes = null;
            }
          }

          if ((!providerRes || !Array.isArray(providerRes.results) || providerRes.results.length === 0) && provider.precheckPublicBeneficiaries) {
            try {
              const subChunks: string[][] = [];
              for (let s = 0; s < chunk.length; s += 10) {
                subChunks.push(chunk.slice(s, s + 10));
              }
              const subResults = await Promise.all(
                subChunks.map(async (sc) => {
                  try {
                    const timeoutSub = new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000));
                    const callSub = provider.precheckPublicBeneficiaries!({
                      network: net,
                      phoneNumbers: sc,
                    }).catch(() => null);
                    return await Promise.race([callSub, timeoutSub]);
                  } catch {
                    return null;
                  }
                }),
              );
              const validSubs = subResults.filter(Boolean) as any[];
              if (validSubs.length > 0) {
                providerRes = {
                  network: net,
                  results: validSubs.flatMap((vs: any) => vs.results || []),
                  unknown: validSubs.flatMap((vs: any) => vs.unknown || []),
                };
              }
            } catch {
              providerRes = null;
            }
          }
          if (providerRes && Array.isArray(providerRes.results) && providerRes.results.length > 0) {

            if (Array.isArray(providerRes.portedCandidates)) {
              providerRes.portedCandidates.forEach((p: string) => {
                const norm = this.normalizeGhanaPhone(p).normalized;
                if (norm) portedCandidatesSet.add(norm);
                portedCandidatesSet.add(p);
              });
            }
            if (Array.isArray(providerRes.flaggedPorted)) {
              providerRes.flaggedPorted.forEach((f: any) => {
                const p = typeof f === 'string' ? f : f.phoneNumber || f.phone;
                if (p) {
                  const norm = this.normalizeGhanaPhone(p).normalized;
                  if (norm) portedCandidatesSet.add(norm);
                  portedCandidatesSet.add(p);
                }
              });
            }

            providerRes.results.forEach((r: any) => {
              const norm = this.normalizeGhanaPhone(r.phoneNumber || (r as any).phone || (r as any).normalized || '').normalized;
              if (norm && r.orderable !== undefined) {
                upstreamOrderableMap.set(norm, Boolean(r.orderable));
              }
              if ((r as any).isPorted || r.status === 'REJECTED') {
                if (norm) portedCandidatesSet.add(norm);
              }

              const isApproved = Boolean(
                (r.isKnown === true || (r as any).known === true) &&
                r.status !== 'UNAPPROVED' &&
                r.status !== 'REJECTED' &&
                r.orderable !== false
              );
              if (isApproved) {
                if (norm) {
                  knownPhonesSet.add(norm);
                  knownPhonesSet.add(`+233${norm.slice(1)}`);
                  knownPhonesSet.add(`233${norm.slice(1)}`);
                  newlyApprovedPhones.push(norm);
                }
                if (r.phoneNumber) knownPhonesSet.add(r.phoneNumber);
                if ((r as any).phone) knownPhonesSet.add((r as any).phone);
              } else {
                if (norm) {
                  knownPhonesSet.delete(norm);
                  knownPhonesSet.delete(`+233${norm.slice(1)}`);
                  knownPhonesSet.delete(`233${norm.slice(1)}`);
                  newlyUnapprovedPhones.push(norm);
                  liveUnapprovedSet.add(norm);
                  liveUnapprovedSet.add(`+233${norm.slice(1)}`);
                  liveUnapprovedSet.add(`233${norm.slice(1)}`);
                  upstreamOrderableMap.set(norm, false);
                }
                if (r.phoneNumber) {
                  knownPhonesSet.delete(r.phoneNumber);
                  liveUnapprovedSet.add(r.phoneNumber);
                }
                if ((r as any).phone) {
                  knownPhonesSet.delete((r as any).phone);
                  liveUnapprovedSet.add((r as any).phone);
                }
              }
            });

            // Also check unknown or blocked arrays in provider response
            const explicitBlocked = [
              ...(Array.isArray(providerRes.unknown) ? providerRes.unknown : []),
              ...(Array.isArray(providerRes.blockedFirstTime) ? providerRes.blockedFirstTime : []),
              ...(Array.isArray(providerRes.blocked) ? providerRes.blocked : []),
              ...(Array.isArray(providerRes.unvalidated) ? providerRes.unvalidated : []),
              ...(Array.isArray(providerRes.unvalidatedBeneficiaries) ? providerRes.unvalidatedBeneficiaries : []),
              ...(Array.isArray(providerRes.setAside) ? providerRes.setAside : []),
              ...(Array.isArray(providerRes.unapproved) ? providerRes.unapproved : []),
              ...(Array.isArray(providerRes.notValidated) ? providerRes.notValidated : []),
            ];
            explicitBlocked.forEach((b: any) => {
              const p = typeof b === 'string' ? b : b.phoneNumber || b.phone || b.msisdn;
              if (p) {
                const norm = this.normalizeGhanaPhone(p).normalized;
                if (norm) {
                  knownPhonesSet.delete(norm);
                  knownPhonesSet.delete(`+233${norm.slice(1)}`);
                  knownPhonesSet.delete(`233${norm.slice(1)}`);
                  newlyUnapprovedPhones.push(norm);
                  liveUnapprovedSet.add(norm);
                  liveUnapprovedSet.add(`+233${norm.slice(1)}`);
                  liveUnapprovedSet.add(`233${norm.slice(1)}`);
                  upstreamOrderableMap.set(norm, false);
                }
                knownPhonesSet.delete(p);
                liveUnapprovedSet.add(p);
              }
            });
          }
        }

        // Persist newly discovered approved numbers to local DB (fire-and-forget for speed)
        if (newlyApprovedPhones.length > 0) {
          const uniqueNewlyApproved = Array.from(new Set(newlyApprovedPhones));
          const meta = JSON.stringify({
            source: 'telecom_provider_precheck',
            verifiedAt: new Date().toISOString(),
          });
          this.db.query(
            `INSERT INTO beneficiary_validation (
              phone_number, network, validation_status, validated_at, expires_at,
              provider_reference, provider_response_metadata, created_at, updated_at
            )
            SELECT unk, 'MTN', 'VALID', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 'DH-PRECHECK', $2::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            FROM unnest($1::text[]) AS unk
            ON CONFLICT (phone_number, network) DO UPDATE
            SET validation_status = 'VALID',
                validated_at = CURRENT_TIMESTAMP,
                expires_at = CURRENT_TIMESTAMP + INTERVAL '30 days',
                provider_reference = 'DH-PRECHECK',
                updated_at = CURRENT_TIMESTAMP`,
            [uniqueNewlyApproved, meta],
          ).catch(() => {});

          this.db.query(
            `UPDATE pending_beneficiary_approvals
             SET status = 'APPROVED', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE phone_number = ANY($1) AND network = 'MTN'`,
            [uniqueNewlyApproved],
          ).catch(() => {});
        }

        // Demote unapproved numbers in local DB (fire-and-forget for speed)
        if (newlyUnapprovedPhones.length > 0) {
          const uniqueNewlyUnapproved = Array.from(new Set(newlyUnapprovedPhones));
          const allVariations = uniqueNewlyUnapproved.flatMap((p) => [
            p,
            `+233${p.startsWith('0') ? p.slice(1) : p}`,
            `233${p.startsWith('0') ? p.slice(1) : p}`,
          ]);
          this.db.query(
            `UPDATE beneficiary_validation
             SET validation_status = 'PENDING', updated_at = CURRENT_TIMESTAMP
             WHERE phone_number = ANY($1) AND network = 'MTN'`,
            [allVariations],
          ).catch(() => {});
        }
      } catch {
        // Non-fatal provider error
      }
    }

    // 2. Database validation check: consult local beneficiary_validation, pending approvals, and historical orders
    if (validNormalizedPhones.length > 0) {
      try {
        const queryPhones = Array.from(
          new Set(
            validNormalizedPhones.flatMap((p) => [
              p,
              `+233${p.startsWith('0') ? p.slice(1) : p}`,
              `233${p.startsWith('0') ? p.slice(1) : p}`,
            ]),
          ),
        );

        // Run both queries in parallel for faster results
        const [approvedRes, pendingRes] = await Promise.all([
          this.db.query(
            `SELECT phone_number as "phoneNumber"
             FROM beneficiary_validation
             WHERE phone_number = ANY($1)
               AND network = 'MTN'
               AND validation_status IN ('VALID', 'APPROVED')
               AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
             UNION
             SELECT phone_number as "phoneNumber"
             FROM pending_beneficiary_approvals
             WHERE phone_number = ANY($1)
               AND network = 'MTN'
               AND status = 'APPROVED'`,
            [queryPhones],
          ),
          this.db.query(
            `SELECT phone_number as "phoneNumber"
             FROM pending_beneficiary_approvals
             WHERE phone_number = ANY($1)
               AND network = 'MTN'
               AND status IN ('PENDING', 'REJECTED')
             UNION
             SELECT phone_number as "phoneNumber"
             FROM beneficiary_validation
             WHERE phone_number = ANY($1)
               AND network = 'MTN'
               AND validation_status IN ('PENDING', 'REJECTED')`,
            [queryPhones],
          ),
        ]);

        approvedRes.rows.forEach((r: any) => {
          if (r.phoneNumber) {
            const norm = this.normalizeGhanaPhone(r.phoneNumber).normalized;
            // Live telecom precheck is authoritative: never re-approve if live check reported unapproved
            const isLiveUnapproved =
              liveUnapprovedSet.has(norm) ||
              liveUnapprovedSet.has(r.phoneNumber) ||
              upstreamOrderableMap.get(norm) === false;

            if (!isLiveUnapproved) {
              knownPhonesSet.add(norm);
              knownPhonesSet.add(r.phoneNumber);
            }
          }
        });

        pendingRes.rows.forEach((r: any) => {
          if (r.phoneNumber) {
            const norm = this.normalizeGhanaPhone(r.phoneNumber).normalized;
            const hasApproved = approvedRes.rows.some((ap: any) => {
              const apNorm = this.normalizeGhanaPhone(ap.phoneNumber).normalized;
              return apNorm === norm;
            });
            if (!hasApproved || liveUnapprovedSet.has(norm)) {
              knownPhonesSet.delete(norm);
              knownPhonesSet.delete(r.phoneNumber);
              upstreamOrderableMap.set(norm, false);
            }
          }
        });
      } catch {
        // Non-fatal
      }
    }

    const results = uniqueItems.map((item) => {
      const isLiveUnapproved = liveUnapprovedSet.has(item.normalized) || liveUnapprovedSet.has(item.phone);
      const isKnown = item.valid && !isLiveUnapproved ? (knownPhonesSet.has(item.normalized) || knownPhonesSet.has(item.phone)) : false;
      const isPortedCandidate = portedCandidatesSet.has(item.normalized) || portedCandidatesSet.has(item.phone);

      let isOrderable = false;
      if (upstreamOrderableMap.has(item.normalized)) {
        isOrderable = Boolean(upstreamOrderableMap.get(item.normalized));
      } else {
        isOrderable = item.valid && isKnown && !isPortedCandidate;
      }

      const status = !item.valid ? 'REJECTED' : isKnown ? 'APPROVED' : 'UNAPPROVED';
      const message = !item.valid
        ? 'Invalid Ghanaian phone number format'
        : isKnown
        ? 'Validated MTN recipient'
        : 'First-time MTN recipient - pending approval';
      return {
        phone: item.phone,
        phoneNumber: item.phone,
        normalized: item.normalized,
        valid: item.valid,
        isValid: item.valid,
        known: isKnown,
        isKnown,
        orderable: isOrderable,
        status,
        message,
      };
    });

    const unknownList = results
      .filter((r) => r.valid && !r.known)
      .map((r) => r.normalized);

    let recorded = false;
    if (record && unknownList.length > 0) {
      recorded = true;
      try {
        if (_userId) {
          await this.db.query(
            `INSERT INTO pending_beneficiary_approvals (
              phone_number, network, agent_id, status, attempt_count,
              first_detected_at, last_detected_at, created_at, updated_at
            )
            SELECT unk, 'MTN', $2, 'PENDING', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            FROM unnest($1::text[]) AS unk
            ON CONFLICT (agent_id, phone_number, network) DO UPDATE
            SET attempt_count = pending_beneficiary_approvals.attempt_count + 1,
                last_detected_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP`,
            [unknownList, _userId],
          ).catch(() => {});
        }

        const metadata = JSON.stringify({
          agentId: _userId || null,
          recordedVia: 'agent_precheck',
          recordedAt: new Date().toISOString(),
        });
        const insertPendingQuery = `
          INSERT INTO beneficiary_validation (phone_number, network, validation_status, provider_response_metadata, agent_id, created_at, updated_at)
          SELECT unk, 'MTN', 'PENDING', $2::jsonb, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          FROM unnest($1::text[]) AS unk
          ON CONFLICT (phone_number, network) DO UPDATE
          SET validation_status = 'PENDING',
              updated_at = CURRENT_TIMESTAMP
          WHERE beneficiary_validation.validation_status != 'APPROVED'
        `;
        await this.db.query(insertPendingQuery, [unknownList, metadata, _userId || null]).catch(() => {});
      } catch {
        // Non-fatal recording error
      }
    }

    // Persist verified results to Redis cache asynchronously
    if (this.cacheService && results.length > 0) {
      const cacheItems: CachedBeneficiaryVerification[] = results
        .filter((r) => r.valid)
        .map((r) => ({
          phoneNumber: r.phone,
          normalized: r.normalized,
          network: String(net),
          status: r.status as 'APPROVED' | 'UNAPPROVED' | 'REJECTED',
          isValid: r.valid,
          isKnown: r.known,
          orderable: r.orderable,
          message: r.message,
          cachedAt: Date.now(),
          ttlSeconds:
            r.status === 'APPROVED'
              ? BeneficiaryCacheService.TTL_APPROVED
              : r.status === 'REJECTED'
              ? BeneficiaryCacheService.TTL_REJECTED
              : BeneficiaryCacheService.TTL_UNAPPROVED,
        }));
      this.cacheService.setCachedResults(String(net), cacheItems).catch(() => {});
    }

    return {
      network: net,
      enforced: true,
      sandbox: false,
      recorded,
      summary: {
        requested: requestedCount,
        unique: results.length,
        valid: results.filter((r) => r.valid).length,
        invalid: results.filter((r) => !r.valid).length,
        known: results.filter((r) => r.known).length,
        unknown: unknownList.length,
        orderable: results.filter((r) => r.orderable).length,
      },
      unknown: unknownList,
      portedCandidates: Array.from(portedCandidatesSet),
      results,
    };
  }

  /**
   * Prechecks a list of phone numbers for MTN Up2U or carrier-specific validation.
   * Maintained for backwards compatibility.
   */
  public async precheckBeneficiaries(params: {
    phoneNumbers: string[];
    network: NetworkProvider;
    record?: boolean;
    userId?: string;
  }): Promise<PrecheckBeneficiaryResult> {
    const { phoneNumbers, network, record = false, userId } = params;

    const res = await this.precheckPublicBeneficiaries({
      network,
      phoneNumbers,
      record,
      userId,
    });

    return {
      network,
      enforced: res.enforced ?? true,
      results: res.results.map((r) => ({
        phoneNumber: r.normalized || r.phone,
        network,
        isValid: r.valid,
        isKnown: r.known,
        accountName: (r as any).accountName,
      })),
    };
  }

  /**
   * Records scanned unapproved beneficiary items with bundle metadata for Pending MTN Approvals tracking.
   */
  public async recordUnapprovedBeneficiaries(params: {
    items: Array<{
      phoneNumber: string;
      network?: NetworkProvider | string;
      dataSize?: string;
      dataAmountMb?: number;
      pricePesewas?: number;
      detectedFrom?: string;
    }>;
    userId?: string;
  }): Promise<{ count: number }> {
    const { items, userId } = params;
    if (!items || items.length === 0) {
      return { count: 0 };
    }

    let recordedCount = 0;
    const effectiveAgentId = userId;

    const validItemsMap = new Map<string, { phone: string; net: string; sizeGb: number | null; metadata: string; detectedFrom: string }>();

    for (const item of items) {
      const norm = this.normalizeGhanaPhone(item.phoneNumber);
      if (!norm.valid) continue;

      const phone = norm.normalized;
      const net = (item.network ? String(item.network).toUpperCase() : 'MTN') as NetworkProvider;

      let sizeGb: number | null = null;
      if (typeof item.dataAmountMb === 'number' && item.dataAmountMb > 0) {
        sizeGb = parseFloat((item.dataAmountMb / 1024).toFixed(2));
      } else if (item.dataSize) {
        const m = String(item.dataSize).match(/([\d.]+)\s*(GB|MB)?/i);
        if (m) {
          const val = parseFloat(m[1]);
          const unit = (m[2] || 'GB').toUpperCase();
          sizeGb = unit === 'MB' ? parseFloat((val / 1024).toFixed(2)) : val;
        }
      }

      const detectedFrom = item.detectedFrom || 'Excel Upload';
      const metadata = JSON.stringify({
        detectedFrom,
        channel: detectedFrom,
        dataSize: item.dataSize || (sizeGb ? `${sizeGb} GB` : null),
        dataAmountMb: item.dataAmountMb || (sizeGb ? Math.round(sizeGb * 1024) : null),
        pricePesewas: item.pricePesewas || null,
        recordedAt: new Date().toISOString(),
        agentId: effectiveAgentId || null,
      });

      const key = `${phone}_${net}`;
      validItemsMap.set(key, { phone, net, sizeGb, metadata, detectedFrom });
    }

    const uniqueItems = Array.from(validItemsMap.values());
    if (uniqueItems.length === 0) {
      return { count: 0 };
    }

    const phones = uniqueItems.map((u) => u.phone);
    const networks = uniqueItems.map((u) => u.net);
    const sizesGb = uniqueItems.map((u) => u.sizeGb);
    const metadatas = uniqueItems.map((u) => u.metadata);
    const detectedFromList = uniqueItems.map((u) => u.detectedFrom);

    try {
      // 1. Ensure unique index exists on beneficiary_validation for ON CONFLICT (phone_number, network)
      await this.db
        .query(
          `DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_indexes 
              WHERE tablename = 'beneficiary_validation' 
              AND indexname = 'uq_beneficiary_validation_phone_network'
            ) THEN
              BEGIN
                DELETE FROM beneficiary_validation a USING beneficiary_validation b
                WHERE a.id < b.id AND a.phone_number = b.phone_number AND a.network = b.network;
                CREATE UNIQUE INDEX uq_beneficiary_validation_phone_network ON beneficiary_validation (phone_number, network);
              EXCEPTION WHEN OTHERS THEN
                NULL;
              END;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pending_beneficiary_approvals') THEN
              ALTER TABLE pending_beneficiary_approvals ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
              ALTER TABLE pending_beneficiary_approvals ADD COLUMN IF NOT EXISTS detected_from VARCHAR(50);
              ALTER TABLE pending_beneficiary_approvals ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(255);
            END IF;
          END $$;`,
        )
        .catch(() => {});

      if (effectiveAgentId) {
        await this.db.query(
          `INSERT INTO pending_beneficiary_approvals (
            phone_number, network, agent_id, status, attempt_count,
            last_bundle_size_gb, metadata, detected_from, first_detected_at, last_detected_at, created_at, updated_at
          )
          SELECT t.phone, t.net, $6, 'PENDING', 1, t.size_gb, t.meta::jsonb, t.det_from, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          FROM unnest($1::text[], $2::text[], $3::numeric[], $4::text[], $5::text[]) AS t(phone, net, size_gb, meta, det_from)
          ON CONFLICT (agent_id, phone_number, network) DO UPDATE
          SET attempt_count = pending_beneficiary_approvals.attempt_count + 1,
              last_bundle_size_gb = COALESCE(EXCLUDED.last_bundle_size_gb, pending_beneficiary_approvals.last_bundle_size_gb),
              metadata = EXCLUDED.metadata,
              detected_from = COALESCE(EXCLUDED.detected_from, pending_beneficiary_approvals.detected_from),
              last_detected_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP`,
          [phones, networks, sizesGb, metadatas, detectedFromList, effectiveAgentId],
        ).catch(() => {});
      }

      let validationUpsertSucceeded = false;
      try {
        await this.db.query(
          `INSERT INTO beneficiary_validation (
            phone_number, network, validation_status, attempt_count,
            last_bundle_size_gb, agent_id, provider_response_metadata, created_at, updated_at
          )
          SELECT t.phone, t.net, 'PENDING', 1, t.size_gb, $5, t.meta::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          FROM unnest($1::text[], $2::text[], $3::numeric[], $4::text[]) AS t(phone, net, size_gb, meta)
          ON CONFLICT (phone_number, network) DO UPDATE
          SET attempt_count = beneficiary_validation.attempt_count + 1,
              last_bundle_size_gb = COALESCE(EXCLUDED.last_bundle_size_gb, beneficiary_validation.last_bundle_size_gb),
              agent_id = COALESCE(EXCLUDED.agent_id, beneficiary_validation.agent_id),
              provider_response_metadata = EXCLUDED.provider_response_metadata,
              updated_at = CURRENT_TIMESTAMP`,
          [phones, networks, sizesGb, metadatas, effectiveAgentId || null],
        );
        validationUpsertSucceeded = true;
      } catch {
        // Fallback: resilient row-by-row update/insert if unique index mismatch or batch failure
        for (const u of uniqueItems) {
          try {
            const updateRes = await this.db.query(
              `UPDATE beneficiary_validation
               SET attempt_count = attempt_count + 1,
                   last_bundle_size_gb = COALESCE($3, last_bundle_size_gb),
                   provider_response_metadata = $4::jsonb,
                   updated_at = CURRENT_TIMESTAMP
               WHERE phone_number = $1 AND network = $2`,
              [u.phone, u.net, u.sizeGb, u.metadata],
            );
            if (!updateRes || updateRes.rowCount === 0) {
              await this.db.query(
                `INSERT INTO beneficiary_validation (
                  phone_number, network, validation_status, attempt_count,
                  last_bundle_size_gb, agent_id, provider_response_metadata, created_at, updated_at
                ) VALUES ($1, $2, 'PENDING', 1, $3, $4, $5::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [u.phone, u.net, u.sizeGb, effectiveAgentId || null, u.metadata],
              );
            }
          } catch {
            // ignore individual row failure
          }
        }
        validationUpsertSucceeded = true;
      }

      if (validationUpsertSucceeded) {
        recordedCount = uniqueItems.length;
      }
    } catch {
      // Non-fatal recording error
    }

    return { count: recordedCount };
  }

  /**
   * Lists pending or historical beneficiary validation/approval records.
   */
  public async listBeneficiaryApprovals(params: {
    network?: NetworkProvider;
    status?: string;
    page?: number;
    limit?: number;
    userId?: string;
    role?: string;
  } = {}) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(10000, Math.max(1, params.limit || 50));
    const offset = (page - 1) * limit;

    const userRole = params.role?.toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

    // If non-admin and no userId, return empty isolated result
    if (!isAdmin && !params.userId) {
      return {
        items: [],
        total: 0,
        counts: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          processing: 0,
        },
        page,
        limit,
        totalPages: 0,
      };
    }

    if (isAdmin && !params.userId) {
      // Administrator view: platform-wide records from beneficiary_validation
      const conditions: string[] = [];
      const queryParams: any[] = [];
      let idx = 1;

      if (params.network) {
        conditions.push(`network = $${idx}`);
        queryParams.push(params.network);
        idx++;
      }

      if (params.status) {
        conditions.push(`validation_status = $${idx}`);
        queryParams.push(params.status);
        idx++;
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await this.db.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN validation_status IN ('PENDING', 'VALIDATING', 'PENDING_APPROVAL') THEN 1 END) as pending,
          COUNT(CASE WHEN validation_status IN ('VALID', 'APPROVED') THEN 1 END) as approved,
          COUNT(CASE WHEN validation_status IN ('INVALID', 'REJECTED') THEN 1 END) as rejected,
          COUNT(CASE WHEN validation_status = 'PROCESSING' THEN 1 END) as processing
         FROM beneficiary_validation ${where}`,
        queryParams,
      );
      const summaryRow = countRes.rows[0] || {};
      const total = parseInt(summaryRow.total || '0', 10);
      const pending = parseInt(summaryRow.pending || '0', 10);
      const approved = parseInt(summaryRow.approved || '0', 10);
      const rejected = parseInt(summaryRow.rejected || '0', 10);
      const processing = parseInt(summaryRow.processing || '0', 10);

      const selectQuery = `
        SELECT id, phone_number as "phoneNumber", network, validation_status as "status",
               provider_reference as "providerReference", validated_at as "validatedAt",
               expires_at as "expiresAt", created_at as "createdAt",
               last_bundle_size_gb as "lastBundleSizeGb",
               provider_response_metadata as "metadata",
               COALESCE(attempt_count, 1) as "occurrences"
        FROM beneficiary_validation
        ${where}
        ORDER BY created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `;
      queryParams.push(limit, offset);

      const itemsRes = await this.db.query(selectQuery, queryParams);

      return {
        items: itemsRes.rows.map((r: any) => {
          const meta = r.metadata || {};
          let dataSize = meta.dataSize;
          if (!dataSize && r.lastBundleSizeGb) {
            dataSize = `${r.lastBundleSizeGb} GB`;
          }

          return {
            id: r.id,
            phoneNumber: r.phoneNumber,
            network: r.network as NetworkProvider,
            status: r.status as BeneficiaryValidationStatus,
            providerReference: r.providerReference || 'DH-AUTO',
            dataSize: dataSize || '5 GB',
            detectedFrom: meta.detectedFrom || meta.channel || 'Excel Upload',
            validatedAt: r.validatedAt ? new Date(r.validatedAt).toISOString() : null,
            expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
            createdAt: new Date(r.createdAt).toISOString(),
            occurrences: Math.max(1, Number(r.occurrences || 1)),
          };
        }),
        total,
        counts: {
          total,
          pending,
          approved,
          rejected,
          processing,
        },
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }

    // User view (Customer or Agent): strict isolation by agent_id (user's UUID)
    const conditions: string[] = ['p.agent_id = $1'];
    const queryParams: any[] = [params.userId];
    let idx = 2;

    if (params.network) {
      conditions.push(`p.network = $${idx}`);
      queryParams.push(params.network);
      idx++;
    }

    if (params.status) {
      if (params.status === 'APPROVED' || params.status === 'VALID') {
        conditions.push(`COALESCE(b.validation_status, p.status) IN ('APPROVED', 'VALID')`);
      } else if (params.status === 'REJECTED' || params.status === 'INVALID') {
        conditions.push(`COALESCE(b.validation_status, p.status) IN ('REJECTED', 'INVALID')`);
      } else if (params.status === 'PROCESSING' || params.status === 'VALIDATING') {
        conditions.push(`COALESCE(b.validation_status, p.status) IN ('PROCESSING', 'VALIDATING')`);
      } else if (params.status === 'PENDING') {
        conditions.push(`COALESCE(b.validation_status, p.status) IN ('PENDING', 'SUBMITTED', 'PENDING_APPROVAL')`);
      } else {
        conditions.push(`COALESCE(b.validation_status, p.status) = $${idx}`);
        queryParams.push(params.status);
        idx++;
      }
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // Count summaries for this specific user
    const countRes = await this.db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN COALESCE(b.validation_status, p.status) IN ('PENDING', 'VALIDATING', 'PENDING_APPROVAL', 'SUBMITTED') THEN 1 END) as pending,
        COUNT(CASE WHEN COALESCE(b.validation_status, p.status) IN ('VALID', 'APPROVED') THEN 1 END) as approved,
        COUNT(CASE WHEN COALESCE(b.validation_status, p.status) IN ('INVALID', 'REJECTED') THEN 1 END) as rejected,
        COUNT(CASE WHEN COALESCE(b.validation_status, p.status) = 'PROCESSING' THEN 1 END) as processing
       FROM pending_beneficiary_approvals p
       LEFT JOIN beneficiary_validation b ON p.phone_number = b.phone_number AND p.network = b.network
       WHERE p.agent_id = $1`,
      [params.userId],
    );
    const summaryRow = countRes.rows[0] || {};
    const total = parseInt(summaryRow.total || '0', 10);
    const pending = parseInt(summaryRow.pending || '0', 10);
    const approved = parseInt(summaryRow.approved || '0', 10);
    const rejected = parseInt(summaryRow.rejected || '0', 10);
    const processing = parseInt(summaryRow.processing || '0', 10);

    const selectQuery = `
      SELECT p.id, p.phone_number as "phoneNumber", p.network,
             COALESCE(b.validation_status, p.status) as "status",
             COALESCE(b.provider_reference, p.provider_reference, 'DH-AUTO') as "providerReference",
             COALESCE(b.validated_at, p.resolved_at) as "validatedAt",
             b.expires_at as "expiresAt",
             p.created_at as "createdAt",
             COALESCE(p.last_bundle_size_gb, b.last_bundle_size_gb) as "lastBundleSizeGb",
             COALESCE(p.metadata, b.provider_response_metadata, '{}'::jsonb) as "metadata",
             COALESCE(p.detected_from, b.provider_response_metadata->>'detectedFrom', b.provider_response_metadata->>'channel', 'Excel Upload') as "detectedFrom",
             COALESCE(p.attempt_count, b.attempt_count, 1) as "occurrences"
      FROM pending_beneficiary_approvals p
      LEFT JOIN beneficiary_validation b ON p.phone_number = b.phone_number AND p.network = b.network
      ${where}
      ORDER BY p.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    queryParams.push(limit, offset);

    const itemsRes = await this.db.query(selectQuery, queryParams);

    return {
      items: itemsRes.rows.map((r: any) => {
        const meta = r.metadata || {};
        let dataSize = meta.dataSize;
        if (!dataSize && r.lastBundleSizeGb) {
          dataSize = `${r.lastBundleSizeGb} GB`;
        }

        return {
          id: r.id,
          phoneNumber: r.phoneNumber,
          network: r.network as NetworkProvider,
          status: r.status as BeneficiaryValidationStatus,
          providerReference: r.providerReference || 'DH-AUTO',
          dataSize: dataSize || '5 GB',
          detectedFrom: r.detectedFrom || meta.detectedFrom || meta.channel || 'Excel Upload',
          validatedAt: r.validatedAt ? new Date(r.validatedAt).toISOString() : null,
          expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
          createdAt: new Date(r.createdAt).toISOString(),
          occurrences: Math.max(1, Number(r.occurrences || 1)),
        };
      }),
      total,
      counts: {
        total,
        pending,
        approved,
        rejected,
        processing,
      },
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Approves a pending beneficiary verification record.
   */
  public async approveBeneficiary(id: string) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    let res = await this.db.query(
      `UPDATE beneficiary_validation
       SET validation_status = 'VALID',
           validated_at = CURRENT_TIMESTAMP,
           expires_at = $1
       WHERE id = $2
       RETURNING id, phone_number as "phoneNumber", network, validation_status as "status"`,
      [expiresAt, id],
    );

    if (res.rows.length > 0) {
      const phone = res.rows[0].phoneNumber;
      const net = res.rows[0].network;
      await this.db.query(
        `UPDATE pending_beneficiary_approvals
         SET status = 'APPROVED', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE phone_number = $1 AND network = $2`,
        [phone, net],
      ).catch(() => {});
      return res.rows[0];
    }

    // Try finding by id in pending_beneficiary_approvals
    const pendingRes = await this.db.query(
      `UPDATE pending_beneficiary_approvals
       SET status = 'APPROVED', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, phone_number as "phoneNumber", network, status`,
      [id],
    );

    if (pendingRes.rows.length > 0) {
      const phone = pendingRes.rows[0].phoneNumber;
      const net = pendingRes.rows[0].network;
      await this.db.query(
        `UPDATE beneficiary_validation
         SET validation_status = 'VALID',
             validated_at = CURRENT_TIMESTAMP,
             expires_at = $1
         WHERE phone_number = $2 AND network = $3`,
        [expiresAt, phone, net],
      ).catch(() => {});
      return {
        id: pendingRes.rows[0].id,
        phoneNumber: phone,
        network: net,
        status: 'VALID',
      };
    }

    throw new NotFoundError(`Beneficiary record with ID [${id}] not found`);
  }

  /**
   * Rejects a pending beneficiary record.
   */
  public async rejectBeneficiary(id: string) {
    let res = await this.db.query(
      `UPDATE beneficiary_validation
       SET validation_status = 'INVALID'
       WHERE id = $1
       RETURNING id, phone_number as "phoneNumber", network, validation_status as "status"`,
      [id],
    );

    if (res.rows.length > 0) {
      const phone = res.rows[0].phoneNumber;
      const net = res.rows[0].network;
      await this.db.query(
        `UPDATE pending_beneficiary_approvals
         SET status = 'REJECTED', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE phone_number = $1 AND network = $2`,
        [phone, net],
      ).catch(() => {});
      return res.rows[0];
    }

    const pendingRes = await this.db.query(
      `UPDATE pending_beneficiary_approvals
       SET status = 'REJECTED', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, phone_number as "phoneNumber", network, status`,
      [id],
    );

    if (pendingRes.rows.length > 0) {
      const phone = pendingRes.rows[0].phoneNumber;
      const net = pendingRes.rows[0].network;
      await this.db.query(
        `UPDATE beneficiary_validation
         SET validation_status = 'INVALID'
         WHERE phone_number = $1 AND network = $2`,
        [phone, net],
      ).catch(() => {});
      return {
        id: pendingRes.rows[0].id,
        phoneNumber: phone,
        network: net,
        status: 'INVALID',
      };
    }

    throw new NotFoundError(`Beneficiary record with ID [${id}] not found`);
  }

  /**
   * Synchronizes MTN beneficiaries approval statuses from upstream telecom provider (DataHouse/GMPL)
   * into local beneficiary_validation and pending_beneficiary_approvals tables.
   */
  public async syncBeneficiariesFromProvider(params: {
    network?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    agentId?: string;
  } = {}): Promise<{
    synced: number;
    approved: number;
    rejected: number;
    submitted: number;
    pending: number;
  }> {
    const limit = Math.min(100, Math.max(1, params.limit || 100));

    if (!this.telecomProvider || !this.telecomProvider.listBeneficiaries) {
      return { synced: 0, approved: 0, rejected: 0, submitted: 0, pending: 0 };
    }

    try {
      const queryParams: any = { limit };
      if (params.network && params.network.toUpperCase() !== 'ALL') {
        queryParams.network = params.network.toUpperCase();
      }
      if (params.status && params.status.toLowerCase() !== 'all') {
        queryParams.status = params.status.toLowerCase();
      }
      if (params.search && params.search.trim().length > 0) {
        queryParams.search = params.search.trim();
      }
      if (params.page) {
        queryParams.page = params.page;
      }

      const res = await this.telecomProvider.listBeneficiaries(queryParams);

      const items = res?.items || [];
      let approvedCount = 0;
      let rejectedCount = 0;
      let submittedCount = 0;
      let pendingCount = 0;

      for (const item of items) {
        const rawPhone = item.msisdn || (item as any).phoneNumber || (item as any).phone;
        if (!rawPhone) continue;

        const norm = this.normalizeGhanaPhone(rawPhone);
        if (!norm.valid) continue;

        const phone = norm.normalized;
        const phoneAlt = `+233${phone.slice(1)}`;
        const status = String(item.status || 'pending').toLowerCase();
        const itemNet = (item.network || 'MTN').toUpperCase();
        const attemptCount = Number(item.attemptCount || 1);
        const lastBundleSizeGb = item.lastBundleSizeGb ? String(item.lastBundleSizeGb) : null;
        const submittedAt = item.submittedAt ? new Date(item.submittedAt) : null;
        const resolvedAt = item.resolvedAt ? new Date(item.resolvedAt) : null;

        const meta = JSON.stringify({
          source: 'telecom_provider_sync',
          providerStatus: item.status,
          syncedAt: new Date().toISOString(),
          lastBundleSizeGb,
          attemptCount,
        });

        if (status === 'approved' || status === 'valid') {
          approvedCount++;

          // 1. Update beneficiary_validation as VALID for 30 days
          await this.db.query(
            `INSERT INTO beneficiary_validation (
              phone_number, network, validation_status, validated_at, expires_at,
              provider_reference, provider_response_metadata, attempt_count, last_bundle_size_gb,
              created_at, updated_at
            ) VALUES ($1, $2, 'VALID', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 'DH-SYNC', $3::jsonb, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (phone_number, network) DO UPDATE
            SET validation_status = 'VALID',
                validated_at = CURRENT_TIMESTAMP,
                expires_at = CURRENT_TIMESTAMP + INTERVAL '30 days',
                provider_reference = 'DH-SYNC',
                provider_response_metadata = $3::jsonb,
                attempt_count = GREATEST(beneficiary_validation.attempt_count, EXCLUDED.attempt_count),
                last_bundle_size_gb = COALESCE(EXCLUDED.last_bundle_size_gb, beneficiary_validation.last_bundle_size_gb),
                updated_at = CURRENT_TIMESTAMP`,
            [phone, itemNet, meta, attemptCount, lastBundleSizeGb ? parseFloat(lastBundleSizeGb) : null],
          ).catch(() => {});

          // 2. Mark pending approval as APPROVED
          await this.db.query(
            `UPDATE pending_beneficiary_approvals
             SET status = 'APPROVED',
                 resolved_at = COALESCE($1, CURRENT_TIMESTAMP),
                 attempt_count = GREATEST(attempt_count, $2),
                 last_bundle_size_gb = COALESCE($3, last_bundle_size_gb),
                 updated_at = CURRENT_TIMESTAMP
             WHERE (phone_number = $4 OR phone_number = $5) AND network = $6`,
            [resolvedAt, attemptCount, lastBundleSizeGb ? parseFloat(lastBundleSizeGb) : null, phone, phoneAlt, itemNet],
          ).catch(() => {});
        } else if (status === 'rejected' || status === 'invalid') {
          rejectedCount++;

          // 1. Mark in beneficiary_validation as INVALID
          await this.db.query(
            `INSERT INTO beneficiary_validation (
              phone_number, network, validation_status, validated_at, expires_at,
              provider_reference, provider_response_metadata, attempt_count, last_bundle_size_gb,
              created_at, updated_at
            ) VALUES ($1, $2, 'INVALID', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 'DH-SYNC', $3::jsonb, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (phone_number, network) DO UPDATE
            SET validation_status = 'INVALID',
                validated_at = CURRENT_TIMESTAMP,
                provider_reference = 'DH-SYNC',
                provider_response_metadata = $3::jsonb,
                attempt_count = GREATEST(beneficiary_validation.attempt_count, EXCLUDED.attempt_count),
                last_bundle_size_gb = COALESCE(EXCLUDED.last_bundle_size_gb, beneficiary_validation.last_bundle_size_gb),
                updated_at = CURRENT_TIMESTAMP`,
            [phone, itemNet, meta, attemptCount, lastBundleSizeGb ? parseFloat(lastBundleSizeGb) : null],
          ).catch(() => {});

          // 2. Mark pending approval as REJECTED
          await this.db.query(
            `UPDATE pending_beneficiary_approvals
             SET status = 'REJECTED',
                 resolved_at = COALESCE($1, CURRENT_TIMESTAMP),
                 attempt_count = GREATEST(attempt_count, $2),
                 last_bundle_size_gb = COALESCE($3, last_bundle_size_gb),
                 updated_at = CURRENT_TIMESTAMP
             WHERE (phone_number = $4 OR phone_number = $5) AND network = $6`,
            [resolvedAt, attemptCount, lastBundleSizeGb ? parseFloat(lastBundleSizeGb) : null, phone, phoneAlt, itemNet],
          ).catch(() => {});
        } else if (status === 'submitted') {
          submittedCount++;

          // Update pending approval status to SUBMITTED
          await this.db.query(
            `UPDATE pending_beneficiary_approvals
             SET status = 'SUBMITTED',
                 submitted_at = COALESCE($1, CURRENT_TIMESTAMP),
                 attempt_count = GREATEST(attempt_count, $2),
                 last_bundle_size_gb = COALESCE($3, last_bundle_size_gb),
                 updated_at = CURRENT_TIMESTAMP
             WHERE (phone_number = $4 OR phone_number = $5) AND network = $6 AND status = 'PENDING'`,
            [submittedAt, attemptCount, lastBundleSizeGb ? parseFloat(lastBundleSizeGb) : null, phone, phoneAlt, itemNet],
          ).catch(() => {});
        } else {
          pendingCount++;

          // Update attempt count and last bundle size
          await this.db.query(
            `UPDATE pending_beneficiary_approvals
             SET attempt_count = GREATEST(attempt_count, $1),
                 last_bundle_size_gb = COALESCE($2, last_bundle_size_gb),
                 updated_at = CURRENT_TIMESTAMP
             WHERE (phone_number = $3 OR phone_number = $4) AND network = $5`,
            [attemptCount, lastBundleSizeGb ? parseFloat(lastBundleSizeGb) : null, phone, phoneAlt, itemNet],
          ).catch(() => {});
        }
      }

      return {
        synced: items.length,
        approved: approvedCount,
        rejected: rejectedCount,
        submitted: submittedCount,
        pending: pendingCount,
      };
    } catch {
      return { synced: 0, approved: 0, rejected: 0, submitted: 0, pending: 0 };
    }
  }
}
