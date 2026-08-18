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
   * Prechecks a list of phone numbers for MTN Up2U or carrier-specific validation.
   */
  public async precheckBeneficiaries(params: {
    phoneNumbers: string[];
    network: NetworkProvider;
    record?: boolean;
    userId?: string;
  }): Promise<PrecheckBeneficiaryResult> {
    const { phoneNumbers, network, record = false } = params;

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
          phoneNumber: r.phoneNumber,
          network,
          isValid: r.isValid,
          isKnown: r.isKnown,
          accountName: r.accountName,
        })),
      };
    }

    // Fallback: Perform local verification
    const ghanaPhoneRegex = /^(?:\+233|0)[235]\d{8}$/;
    const results = [];

    for (const phone of phoneNumbers) {
      const clean = phone.trim().replace(/\s+/g, '');
      const isValid = ghanaPhoneRegex.test(clean);
      results.push({
        phoneNumber: clean,
        network,
        isValid,
        isKnown: isValid,
        accountName: isValid ? `Subscriber ${clean.slice(-4)}` : undefined,
      });
    }

    return {
      network,
      enforced: network === NetworkProvider.MTN,
      results,
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
