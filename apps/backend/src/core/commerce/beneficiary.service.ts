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

    // For MTN: check provider and DB validated list
    const knownPhonesSet = new Set<string>();

    if (this.telecomProvider && this.telecomProvider.precheckPublicBeneficiaries) {
      try {
        const providerRes = await this.telecomProvider.precheckPublicBeneficiaries({
          network: net,
          phoneNumbers: validNormalizedPhones,
        });
        if (providerRes && Array.isArray(providerRes.results)) {
          providerRes.results.forEach((r) => {
            if (r.isKnown || (r as any).known) {
              const norm = this.normalizeGhanaPhone(r.phoneNumber || (r as any).phone || (r as any).normalized || '').normalized;
              knownPhonesSet.add(norm);
            }
          });
        }
      } catch {
        // Fallback to local DB check
      }
    }

    // Check DB for validated beneficiary records
    if (validNormalizedPhones.length > 0) {
      try {
        const dbQuery = `
          SELECT phone_number as "phoneNumber"
          FROM beneficiary_validation
          WHERE phone_number = ANY($1)
            AND network = 'MTN'
            AND validation_status = 'VALID'
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
          UNION
          SELECT phone_number as "phoneNumber"
          FROM pending_beneficiary_approvals
          WHERE phone_number = ANY($1)
            AND network = 'MTN'
            AND status = 'APPROVED'
        `;
        const dbRes = await this.db.query(dbQuery, [validNormalizedPhones]);
        dbRes.rows.forEach((r: any) => {
          knownPhonesSet.add(r.phoneNumber);
        });

        // Also check if any orders have been fulfilled/processing for this number
        const orderQuery = `
          SELECT DISTINCT recipient_phone as "recipientPhone"
          FROM orders
          WHERE recipient_phone = ANY($1)
            AND network = 'MTN'
            AND order_status IN ('COMPLETED', 'DELIVERED', 'PROCESSING', 'SUBMITTED')
        `;
        const orderRes = await this.db.query(orderQuery, [validNormalizedPhones]);
        orderRes.rows.forEach((r: any) => {
          knownPhonesSet.add(r.recipientPhone);
        });
      } catch {
        // Continue with memory set
      }
    }

    const results = parsedItems.map((item) => ({
      phone: item.raw,
      normalized: item.normalized,
      valid: item.valid,
      known: item.valid ? knownPhonesSet.has(item.normalized) : false,
    }));

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

    if (this.telecomProvider && this.telecomProvider.precheckBeneficiaries) {
      try {
        const providerRes = await this.telecomProvider.precheckBeneficiaries({
          network: net,
          phoneNumbers: validNormalizedPhones,
          record,
        });
        if (providerRes && Array.isArray(providerRes.results)) {
          providerRes.results.forEach((r) => {
            if (r.isKnown || (r as any).known) {
              const norm = this.normalizeGhanaPhone(r.phoneNumber || (r as any).phone || (r as any).normalized || '').normalized;
              knownPhonesSet.add(norm);
            }
          });
        }
      } catch {
        // Fallback to local DB check
      }
    }

    // Query DB for known/validated MTN beneficiaries
    if (validNormalizedPhones.length > 0) {
      try {
        const dbQuery = `
          SELECT phone_number as "phoneNumber"
          FROM beneficiary_validation
          WHERE phone_number = ANY($1)
            AND network = 'MTN'
            AND validation_status = 'VALID'
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
          UNION
          SELECT phone_number as "phoneNumber"
          FROM pending_beneficiary_approvals
          WHERE phone_number = ANY($1)
            AND network = 'MTN'
            AND status = 'APPROVED'
        `;
        const dbRes = await this.db.query(dbQuery, [validNormalizedPhones]);
        dbRes.rows.forEach((r: any) => {
          knownPhonesSet.add(r.phoneNumber);
        });

        // Query historical successful orders
        const orderQuery = `
          SELECT DISTINCT recipient_phone as "recipientPhone"
          FROM orders
          WHERE recipient_phone = ANY($1)
            AND network = 'MTN'
            AND order_status IN ('COMPLETED', 'DELIVERED', 'PROCESSING', 'SUBMITTED')
        `;
        const orderRes = await this.db.query(orderQuery, [validNormalizedPhones]);
        orderRes.rows.forEach((r: any) => {
          knownPhonesSet.add(r.recipientPhone);
        });
      } catch {
        // Continue with available known set
      }
    }

    const results = uniqueItems.map((item) => ({
      phone: item.phone,
      normalized: item.normalized,
      valid: item.valid,
      known: item.valid ? knownPhonesSet.has(item.normalized) : false,
    }));

    const unknownList = results
      .filter((r) => r.valid && !r.known)
      .map((r) => r.normalized);

    let recorded = false;
    if (record && unknownList.length > 0) {
      recorded = true;
      try {
        for (const unkPhone of unknownList) {
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
        }
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

    if (this.telecomProvider && this.telecomProvider.precheckBeneficiaries) {
      const dhResult = await this.telecomProvider.precheckBeneficiaries({
        network,
        phoneNumbers,
        record,
      });

      return {
        network,
        enforced: dhResult.enforced,
        results: dhResult.results.map((r) => ({
          phoneNumber: r.phoneNumber || (r as any).phone || (r as any).normalized || '',
          network,
          isValid: Boolean(r.isValid !== undefined ? r.isValid : (r as any).valid !== undefined ? (r as any).valid : true),
          isKnown: Boolean(r.isKnown !== undefined ? r.isKnown : (r as any).known !== undefined ? (r as any).known : false),
          accountName: r.accountName,
        })),
      };
    }

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
        phoneNumber: r.normalized,
        network,
        isValid: r.valid,
        isKnown: r.known,
      })),
    };
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
             expires_at as "expiresAt", created_at as "createdAt"
      FROM beneficiary_validation
      ${where}
      ORDER BY created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    queryParams.push(limit, offset);

    const itemsRes = await this.db.query(selectQuery, queryParams);

    return {
      items: itemsRes.rows.map((r) => ({
        id: r.id,
        phoneNumber: r.phoneNumber,
        network: r.network as NetworkProvider,
        status: r.status as BeneficiaryValidationStatus,
        providerReference: r.providerReference,
        validatedAt: r.validatedAt ? new Date(r.validatedAt).toISOString() : null,
        expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
        createdAt: new Date(r.createdAt).toISOString(),
      })),
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
}
