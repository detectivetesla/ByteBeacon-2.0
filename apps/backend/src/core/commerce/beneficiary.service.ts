import type pg from 'pg';
import {
  NetworkProvider,
  BeneficiaryValidationStatus,
  BeneficiaryValidationDto,
} from '@bytebeacon/shared';
import { ITelecomProvider } from '../providers/telecom/telecom-provider.interface.js';
import { BadRequestError, NotFoundError } from '../errors/app-error.js';

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

  constructor(db: pg.Pool, telecomProvider: ITelecomProvider | null = null) {
    this.db = db;
    this.telecomProvider = telecomProvider;
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
    results: Array<{
      phone: string;
      normalized: string;
      valid: boolean;
      known: boolean;
      accountName?: string;
    }>;
  }> {
    const { network, phoneNumbers } = params;
    const net = (typeof network === 'string' ? network.toUpperCase() : network) as NetworkProvider;

    const parsedItems = phoneNumbers.map((p) => this.normalizeGhanaPhone(p));
    const validNormalizedPhones = Array.from(
      new Set(parsedItems.filter((item) => item.valid).map((item) => item.normalized)),
    );

    // If TELECEL or non-MTN, every valid Ghanaian MSISDN is known: true
    if (net !== NetworkProvider.MTN) {
      return {
        network: net,
        results: parsedItems.map((item) => ({
          phone: item.raw,
          normalized: item.normalized,
          valid: item.valid,
          known: item.valid,
        })),
      };
    }

    // For MTN: check DB validated list first, then query provider for remaining unknown
    const knownPhonesSet = new Set<string>();

    // 1. Check local DB first for validated beneficiary records (ultra-fast < 2ms)
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

        const dbQuery = `
          SELECT phone_number as "phoneNumber"
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
            AND status = 'APPROVED'
        `;
        const dbRes = await this.db.query(dbQuery, [queryPhones]);
        dbRes.rows.forEach((r: any) => {
          if (r.phoneNumber) {
            const norm = this.normalizeGhanaPhone(r.phoneNumber).normalized;
            knownPhonesSet.add(norm);
            knownPhonesSet.add(r.phoneNumber);
          }
        });

        // Also check if any orders have been fulfilled/processing for this number
        const orderQuery = `
          SELECT DISTINCT recipient_phone as "recipientPhone"
          FROM orders
          WHERE recipient_phone = ANY($1)
            AND network = 'MTN'
            AND order_status IN ('COMPLETED', 'DELIVERED', 'PROCESSING', 'SUBMITTED', 'READY_FOR_FULFILLMENT')
        `;
        const orderRes = await this.db.query(orderQuery, [queryPhones]);
        orderRes.rows.forEach((r: any) => {
          if (r.recipientPhone) {
            const norm = this.normalizeGhanaPhone(r.recipientPhone).normalized;
            knownPhonesSet.add(norm);
            knownPhonesSet.add(r.recipientPhone);
          }
        });
      } catch {
        // Continue with memory set
      }
    }

    // For bulk requests (>10 numbers) or if record is requested, delegate to precheckAgentBeneficiaries
    if (phoneNumbers.length > 10 || params.record) {
      const agentRes = await this.precheckAgentBeneficiaries({
        network: net,
        phoneNumbers,
        record: params.record,
        userId: params.userId,
      });
      return {
        network: net,
        results: agentRes.results.map((r) => ({
          phone: r.phone,
          normalized: r.normalized,
          valid: r.valid,
          known: r.known,
        })),
      };
    }

    // 2. Query upstream telecom provider only for remaining unknown numbers (timeout 10000ms)
    const unknownForProvider = validNormalizedPhones.filter(
      (p) => !knownPhonesSet.has(p) && !knownPhonesSet.has(this.normalizeGhanaPhone(p).normalized),
    );

    if (unknownForProvider.length > 0 && this.telecomProvider) {
      try {
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000));
        const providerCall = (
          this.telecomProvider.precheckPublicBeneficiaries
            ? this.telecomProvider.precheckPublicBeneficiaries({ network: net, phoneNumbers: unknownForProvider })
            : this.telecomProvider.precheckBeneficiaries
            ? this.telecomProvider.precheckBeneficiaries({ network: net, phoneNumbers: unknownForProvider, record: false })
            : Promise.resolve(null)
        ).catch(() => null);

        const providerRes: any = await Promise.race([providerCall, timeoutPromise]);
        if (providerRes && Array.isArray(providerRes.results)) {
          providerRes.results.forEach((r: any) => {
            if (r.isKnown || r.known) {
              const norm = this.normalizeGhanaPhone(r.phoneNumber || r.phone || r.normalized || '').normalized;
              knownPhonesSet.add(norm);
              if (r.phoneNumber) knownPhonesSet.add(r.phoneNumber);
              if (r.phone) knownPhonesSet.add(r.phone);
            }
          });
        }
      } catch {
        // Fallback to local DB check
      }
    }

    const results = parsedItems.map((item) => ({
      phone: item.raw,
      normalized: item.normalized,
      valid: item.valid,
      known: item.valid ? (knownPhonesSet.has(item.normalized) || knownPhonesSet.has(item.raw)) : false,
    }));

    // If record is requested, persist any unknown valid MTN numbers for approval concurrently
    if (params.record) {
      const unknownList = results.filter((r) => r.valid && !r.known).map((r) => r.normalized);
      if (unknownList.length > 0) {
        try {
          await Promise.all(
            unknownList.map(async (unkPhone) => {
              if (params.userId) {
                await this.db.query(
                  `INSERT INTO pending_beneficiary_approvals (
                    phone_number, network, agent_id, status, attempt_count,
                    first_detected_at, last_detected_at, created_at, updated_at
                  ) VALUES ($1, 'MTN', $2, 'PENDING', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                  ON CONFLICT (agent_id, phone_number, network) DO UPDATE
                  SET attempt_count = pending_beneficiary_approvals.attempt_count + 1,
                      last_detected_at = CURRENT_TIMESTAMP,
                      updated_at = CURRENT_TIMESTAMP`,
                  [unkPhone, params.userId],
                ).catch(() => {});
              } else {
                await this.db.query(
                  `INSERT INTO pending_beneficiary_approvals (
                    phone_number, network, status, attempt_count,
                    first_detected_at, last_detected_at, created_at, updated_at
                  ) VALUES ($1, 'MTN', 'PENDING', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                  ON CONFLICT DO NOTHING`,
                  [unkPhone],
                ).catch(() => {});
              }

              await this.db.query(
                `INSERT INTO beneficiary_validation (phone_number, network, validation_status, created_at, updated_at)
                 VALUES ($1, 'MTN', 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 ON CONFLICT (phone_number, network) DO NOTHING`,
                [unkPhone],
              ).catch(() => {});
            }),
          );
        } catch {
          // Non-fatal recording failure
        }
      }
    }

    return {
      network: net,
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
    };
    unknown: string[];
    results: Array<{
      phone: string;
      normalized: string;
      valid: boolean;
      known: boolean;
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
        normalized: item.normalized,
        valid: item.valid,
        known: item.valid,
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
        },
        unknown: [],
        results,
      };
    }

    // 2. Check Non-MTN Short-Circuit (TELECEL / AIRTELTIGO)
    if (net !== NetworkProvider.MTN) {
      const results = uniqueItems.map((item) => ({
        phone: item.phone,
        normalized: item.normalized,
        valid: item.valid,
        known: item.valid,
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
        },
        unknown: [],
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
        normalized: item.normalized,
        valid: item.valid,
        known: item.valid,
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
        },
        unknown: [],
        results,
      };
    }

    // 4. Live MTN Enforcement
    const validNormalizedPhones = uniqueItems.filter((item) => item.valid).map((item) => item.normalized);
    const knownPhonesSet = new Set<string>();

    // 1. Query DB for known/validated MTN beneficiaries first (ultra-fast < 2ms)
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

        const dbQuery = `
          SELECT phone_number as "phoneNumber"
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
            AND status = 'APPROVED'
        `;
        const dbRes = await this.db.query(dbQuery, [queryPhones]);
        dbRes.rows.forEach((r: any) => {
          if (r.phoneNumber) {
            const norm = this.normalizeGhanaPhone(r.phoneNumber).normalized;
            knownPhonesSet.add(norm);
            knownPhonesSet.add(r.phoneNumber);
          }
        });

        // Query historical successful orders
        const orderQuery = `
          SELECT DISTINCT recipient_phone as "recipientPhone"
          FROM orders
          WHERE recipient_phone = ANY($1)
            AND network = 'MTN'
            AND order_status IN ('COMPLETED', 'DELIVERED', 'PROCESSING', 'SUBMITTED', 'READY_FOR_FULFILLMENT')
        `;
        const orderRes = await this.db.query(orderQuery, [queryPhones]);
        orderRes.rows.forEach((r: any) => {
          if (r.recipientPhone) {
            const norm = this.normalizeGhanaPhone(r.recipientPhone).normalized;
            knownPhonesSet.add(norm);
            knownPhonesSet.add(r.recipientPhone);
          }
        });
      } catch {
        // Continue with available known set
      }
    }

    // 2. Query upstream provider for remaining unknown numbers with safe batching & 20s timeout
    const unknownForProvider = validNormalizedPhones.filter(
      (p) => !knownPhonesSet.has(p) && !knownPhonesSet.has(this.normalizeGhanaPhone(p).normalized),
    );

    if (unknownForProvider.length > 0 && this.telecomProvider && (this.telecomProvider.precheckBeneficiaries || this.telecomProvider.precheckPublicBeneficiaries)) {
      try {
        const newlyApprovedPhones: string[] = [];
        const chunkSize = 150;
        const unknownChunks: string[][] = [];
        for (let i = 0; i < unknownForProvider.length; i += chunkSize) {
          unknownChunks.push(unknownForProvider.slice(i, i + chunkSize));
        }

        for (const chunk of unknownChunks) {
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 20000));
          const providerMethod = this.telecomProvider.precheckBeneficiaries
            ? this.telecomProvider.precheckBeneficiaries.bind(this.telecomProvider)
            : this.telecomProvider.precheckPublicBeneficiaries!.bind(this.telecomProvider);

          const providerCall = providerMethod({
            network: net,
            phoneNumbers: chunk,
            record,
          }).catch(() => null);

          const providerRes: any = await Promise.race([providerCall, timeoutPromise]);
          if (providerRes && Array.isArray(providerRes.results)) {
            providerRes.results.forEach((r: any) => {
              const isApproved = Boolean(
                r.isKnown ||
                (r as any).known ||
                (r.isValid === true && (r.status === 'APPROVED' || r.status === 'VALID' || r.status === 'approved' || r.status === 'valid'))
              );
              if (isApproved) {
                const norm = this.normalizeGhanaPhone(r.phoneNumber || (r as any).phone || (r as any).normalized || '').normalized;
                if (norm) {
                  knownPhonesSet.add(norm);
                  knownPhonesSet.add(`+233${norm.slice(1)}`);
                  knownPhonesSet.add(`233${norm.slice(1)}`);
                  newlyApprovedPhones.push(norm);
                }
                if (r.phoneNumber) knownPhonesSet.add(r.phoneNumber);
                if ((r as any).phone) knownPhonesSet.add((r as any).phone);
              }
            });
          }
        }

        // Persist newly discovered approved numbers to local DB so subsequent lookups are instant
        if (newlyApprovedPhones.length > 0) {
          const uniqueNewlyApproved = Array.from(new Set(newlyApprovedPhones));
          await Promise.all(
            uniqueNewlyApproved.map(async (p) => {
              const meta = JSON.stringify({
                source: 'telecom_provider_precheck',
                verifiedAt: new Date().toISOString(),
              });
              await this.db.query(
                `INSERT INTO beneficiary_validation (
                  phone_number, network, validation_status, validated_at, expires_at,
                  provider_reference, provider_response_metadata, created_at, updated_at
                ) VALUES ($1, 'MTN', 'VALID', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 'DH-PRECHECK', $2::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (phone_number, network) DO UPDATE
                SET validation_status = 'VALID',
                    validated_at = CURRENT_TIMESTAMP,
                    expires_at = CURRENT_TIMESTAMP + INTERVAL '30 days',
                    provider_reference = 'DH-PRECHECK',
                    updated_at = CURRENT_TIMESTAMP`,
                [p, meta],
              ).catch(() => {});

              await this.db.query(
                `UPDATE pending_beneficiary_approvals
                 SET status = 'APPROVED', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE phone_number = $1 AND network = 'MTN'`,
                [p],
              ).catch(() => {});
            }),
          );
        }
      } catch {
        // Fallback to local DB check
      }
    }

    const results = uniqueItems.map((item) => ({
      phone: item.phone,
      normalized: item.normalized,
      valid: item.valid,
      known: item.valid ? (knownPhonesSet.has(item.normalized) || knownPhonesSet.has(item.phone)) : false,
    }));

    const unknownList = results
      .filter((r) => r.valid && !r.known)
      .map((r) => r.normalized);

    let recorded = false;
    if (record && unknownList.length > 0) {
      recorded = true;
      try {
        await Promise.all(
          unknownList.map(async (unkPhone) => {
            // 1. Record into pending_beneficiary_approvals attributed to this agent
            if (_userId) {
              await this.db.query(
                `INSERT INTO pending_beneficiary_approvals (
                  phone_number, network, agent_id, status, attempt_count,
                  first_detected_at, last_detected_at, created_at, updated_at
                ) VALUES ($1, 'MTN', $2, 'PENDING', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (agent_id, phone_number, network) DO UPDATE
                SET attempt_count = pending_beneficiary_approvals.attempt_count + 1,
                    last_detected_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP`,
                [unkPhone, _userId],
              ).catch(() => {});
            }

            // 2. Also record in beneficiary_validation for system-wide validation tracking
            const metadata = JSON.stringify({
              agentId: _userId || null,
              recordedVia: 'agent_precheck',
              recordedAt: new Date().toISOString(),
            });
            const insertPendingQuery = `
              INSERT INTO beneficiary_validation (phone_number, network, validation_status, provider_response_metadata, agent_id, created_at, updated_at)
              VALUES ($1, 'MTN', 'PENDING', $2::jsonb, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT (phone_number, network) DO NOTHING
            `;
            await this.db.query(insertPendingQuery, [unkPhone, metadata, _userId || null]).catch(() => {});
          }),
        );
      } catch {
        // Non-fatal recording error
      }
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
      },
      unknown: unknownList,
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

    const agentResult = await this.precheckAgentBeneficiaries({
      network,
      phoneNumbers,
      record,
      userId,
    });

    return {
      network,
      enforced: agentResult.enforced,
      results: agentResult.results.map((r) => ({
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
    await Promise.all(
      items.map(async (item) => {
        const norm = this.normalizeGhanaPhone(item.phoneNumber);
        if (!norm.valid) return;

        const phone = norm.normalized;
        const net = (item.network ? String(item.network).toUpperCase() : 'MTN') as NetworkProvider;

        // Parse numeric GB volume from dataSize or dataAmountMb
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

        const metadata = JSON.stringify({
          detectedFrom: item.detectedFrom || 'Excel Upload',
          channel: item.detectedFrom || 'Excel Upload',
          dataSize: item.dataSize || (sizeGb ? `${sizeGb} GB` : null),
          dataAmountMb: item.dataAmountMb || (sizeGb ? Math.round(sizeGb * 1024) : null),
          pricePesewas: item.pricePesewas || null,
          recordedAt: new Date().toISOString(),
          agentId: userId || null,
        });

        try {
          if (userId) {
            await this.db.query(
              `INSERT INTO pending_beneficiary_approvals (
                phone_number, network, agent_id, status, attempt_count,
                last_bundle_size_gb, first_detected_at, last_detected_at, created_at, updated_at
              ) VALUES ($1, $2, $3, 'PENDING', 1, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT (agent_id, phone_number, network) DO UPDATE
              SET attempt_count = pending_beneficiary_approvals.attempt_count + 1,
                  last_bundle_size_gb = COALESCE(EXCLUDED.last_bundle_size_gb, pending_beneficiary_approvals.last_bundle_size_gb),
                  last_detected_at = CURRENT_TIMESTAMP,
                  updated_at = CURRENT_TIMESTAMP`,
              [phone, net, userId, sizeGb],
            ).catch(() => {});
          }

          await this.db.query(
            `INSERT INTO beneficiary_validation (
              phone_number, network, validation_status, attempt_count,
              last_bundle_size_gb, agent_id, provider_response_metadata, created_at, updated_at
            ) VALUES ($1, $2, 'PENDING', 1, $3, $4, $5::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (phone_number, network) DO UPDATE
            SET attempt_count = beneficiary_validation.attempt_count + 1,
                last_bundle_size_gb = COALESCE(EXCLUDED.last_bundle_size_gb, beneficiary_validation.last_bundle_size_gb),
                agent_id = COALESCE(EXCLUDED.agent_id, beneficiary_validation.agent_id),
                provider_response_metadata = $5::jsonb,
                updated_at = CURRENT_TIMESTAMP`,
            [phone, net, sizeGb, userId || null, metadata],
          ).catch(() => {});

          recordedCount++;
        } catch {
          // Non-fatal per-item error
        }
      }),
    );

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
  } = {}) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

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

    const countRes = await this.db.query(`SELECT COUNT(*) as total FROM beneficiary_validation ${where}`, queryParams);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const selectQuery = `
      SELECT id, phone_number as "phoneNumber", network, validation_status as "status",
             provider_reference as "providerReference", validated_at as "validatedAt",
             expires_at as "expiresAt", created_at as "createdAt",
             last_bundle_size_gb as "lastBundleSizeGb",
             provider_response_metadata as "metadata"
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
        };
      }),
      total,
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
    const res = await this.db.query(
      `UPDATE beneficiary_validation
       SET validation_status = 'VALID',
           validated_at = CURRENT_TIMESTAMP,
           expires_at = $1
       WHERE id = $2
       RETURNING id, phone_number as "phoneNumber", network, validation_status as "status"`,
      [expiresAt, id],
    );

    if (res.rows.length === 0) {
      throw new NotFoundError(`Beneficiary record with ID [${id}] not found`);
    }

    return res.rows[0];
  }

  /**
   * Rejects a pending beneficiary record.
   */
  public async rejectBeneficiary(id: string) {
    const res = await this.db.query(
      `UPDATE beneficiary_validation
       SET validation_status = 'INVALID'
       WHERE id = $1
       RETURNING id, phone_number as "phoneNumber", network, validation_status as "status"`,
      [id],
    );

    if (res.rows.length === 0) {
      throw new NotFoundError(`Beneficiary record with ID [${id}] not found`);
    }

    return res.rows[0];
  }

  /**
   * Synchronizes approved MTN beneficiaries from upstream telecom provider (DataHouse/GMPL)
   * into local beneficiary_validation and pending_beneficiary_approvals tables.
   */
  public async syncBeneficiariesFromProvider(params: {
    network?: string;
    limit?: number;
  } = {}): Promise<{ synced: number; approved: number }> {
    const net = (params.network || 'MTN').toUpperCase();
    const limit = params.limit || 100;

    if (!this.telecomProvider || !this.telecomProvider.listBeneficiaries) {
      return { synced: 0, approved: 0 };
    }

    try {
      const res = await this.telecomProvider.listBeneficiaries({
        network: net,
        status: 'approved',
        limit,
      });

      const items = res?.items || [];
      let approvedCount = 0;

      for (const item of items) {
        const rawPhone = item.msisdn || (item as any).phoneNumber || (item as any).phone;
        if (!rawPhone) continue;

        const norm = this.normalizeGhanaPhone(rawPhone);
        if (!norm.valid) continue;

        const meta = JSON.stringify({
          source: 'telecom_provider_sync',
          providerStatus: item.status,
          syncedAt: new Date().toISOString(),
        });

        await this.db.query(
          `INSERT INTO beneficiary_validation (
            phone_number, network, validation_status, validated_at, expires_at,
            provider_reference, provider_response_metadata, created_at, updated_at
          ) VALUES ($1, 'MTN', 'VALID', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 'DH-SYNC', $2::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (phone_number, network) DO UPDATE
          SET validation_status = 'VALID',
              validated_at = CURRENT_TIMESTAMP,
              expires_at = CURRENT_TIMESTAMP + INTERVAL '30 days',
              provider_reference = 'DH-SYNC',
              updated_at = CURRENT_TIMESTAMP`,
          [norm.normalized, meta],
        ).catch(() => {});

        await this.db.query(
          `UPDATE pending_beneficiary_approvals
           SET status = 'APPROVED', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE phone_number = $1 AND network = 'MTN'`,
          [norm.normalized],
        ).catch(() => {});

        approvedCount++;
      }

      return { synced: items.length, approved: approvedCount };
    } catch {
      return { synced: 0, approved: 0 };
    }
  }
}
