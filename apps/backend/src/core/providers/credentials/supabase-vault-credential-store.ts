import type pg from 'pg';
import crypto from 'node:crypto';
import {
  IProviderCredentialStore,
  StoredCredentialMetadata,
  DecryptedProviderSecrets,
} from './credential-store.interface.js';
import { AuditService } from '../../security/audit.service.js';
import { BadRequestError, NotFoundError } from '../../errors/app-error.js';

export class SupabaseVaultCredentialStore implements IProviderCredentialStore {
  private readonly db: pg.Pool;
  private readonly auditService?: AuditService;
  private readonly encryptionKey: Buffer;

  constructor(db: pg.Pool, auditService?: AuditService) {
    this.db = db;
    this.auditService = auditService;
    this.encryptionKey = crypto
      .createHash('sha256')
      .update(process.env.PROVIDER_VAULT_MASTER_KEY || process.env.JWT_SECRET || 'bytebeacon_telecom_secret_master_key_2026')
      .digest();
  }

  private encrypt(plainText: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  private decrypt(cipherText: string): string {
    try {
      const parts = cipherText.split(':');
      if (parts.length !== 3) return cipherText;
      const [ivHex, tagHex, encryptedHex] = parts;
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        Buffer.from(ivHex, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return '';
    }
  }

  private mask(secret: string, visibleSuffix = 4): string {
    if (!secret) return '••••••••••••••••';
    const clean = secret.trim();
    if (clean.length <= visibleSuffix) {
      return '••••••••••••••••';
    }
    const prefix = clean.substring(0, Math.min(4, clean.indexOf('_') + 1 || 4));
    const suffix = clean.slice(-visibleSuffix);
    return `${prefix}••••••••${suffix}`;
  }

  public async getSecrets(
    providerId: string,
    environment: 'SANDBOX' | 'PRODUCTION' | string,
  ): Promise<DecryptedProviderSecrets | null> {
    const res = await this.db.query(
      `SELECT api_key_encrypted, api_secret_encrypted, webhook_secret_encrypted
       FROM provider_credentials
       WHERE provider_id = $1 AND environment = $2 AND status = 'ACTIVE'
       ORDER BY created_at DESC LIMIT 1`,
      [providerId, environment],
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    const apiKey = this.decrypt(row.api_key_encrypted);
    const apiSecret = row.api_secret_encrypted ? this.decrypt(row.api_secret_encrypted) : null;
    const webhookSecret = row.webhook_secret_encrypted ? this.decrypt(row.webhook_secret_encrypted) : null;

    return {
      apiKey,
      apiSecret,
      webhookSecret,
    };
  }

  public async storeCredentials(
    providerId: string,
    environment: 'SANDBOX' | 'PRODUCTION' | string,
    secrets: { apiKey: string; apiSecret?: string; webhookSecret?: string },
    actorId?: string,
  ): Promise<StoredCredentialMetadata> {
    if (!secrets.apiKey || secrets.apiKey.trim().length === 0) {
      throw new BadRequestError('API key is required');
    }

    const keyEncrypted = this.encrypt(secrets.apiKey.trim());
    const keyMasked = this.mask(secrets.apiKey.trim());
    const secretEncrypted = secrets.apiSecret ? this.encrypt(secrets.apiSecret.trim()) : null;
    const whSecretEncrypted = secrets.webhookSecret ? this.encrypt(secrets.webhookSecret.trim()) : null;
    const whSecretMasked = secrets.webhookSecret ? this.mask(secrets.webhookSecret.trim()) : null;

    // Archive current active credentials for this environment
    await this.db.query(
      `UPDATE provider_credentials
       SET status = 'ROTATED', updated_at = CURRENT_TIMESTAMP
       WHERE provider_id = $1 AND environment = $2 AND status = 'ACTIVE'`,
      [providerId, environment],
    );

    const insertRes = await this.db.query(
      `INSERT INTO provider_credentials (
         provider_id, environment, api_key_masked, api_key_encrypted,
         api_secret_encrypted, webhook_secret_encrypted, webhook_secret_masked,
         status, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8)
       RETURNING id, provider_id as "providerId", environment,
                 api_key_masked as "apiKeyMasked", webhook_secret_masked as "webhookSecretMasked",
                 status, last_tested_at as "lastTestedAt", last_test_result as "lastTestResult",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        providerId,
        environment,
        keyMasked,
        keyEncrypted,
        secretEncrypted,
        whSecretEncrypted,
        whSecretMasked,
        actorId || null,
      ],
    );

    const row = insertRes.rows[0];

    if (this.auditService && actorId) {
      await this.auditService.logEvent({
        correlationId: `cred_store_${Date.now()}`,
        actorId,
        actorType: 'ADMIN',
        action: 'PROVIDER_CREDENTIAL_STORED',
        resourceType: 'provider_credentials',
        resourceId: row.id,
        metadata: { providerId, environment },
      });
    }

    return {
      id: row.id,
      providerId: row.providerId,
      environment: row.environment,
      apiKeyMasked: row.apiKeyMasked,
      webhookSecretMasked: row.webhookSecretMasked,
      status: row.status,
      lastTestedAt: row.lastTestedAt ? new Date(row.lastTestedAt).toISOString() : null,
      lastTestResult: row.lastTestResult,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  public async rotateCredentials(
    providerId: string,
    environment: 'SANDBOX' | 'PRODUCTION' | string,
    newSecrets: { newApiKey: string; newApiSecret?: string; newWebhookSecret?: string },
    reason: string,
    actorId?: string,
  ): Promise<StoredCredentialMetadata> {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestError('Justification reason is required for credential rotation');
    }

    const stored = await this.storeCredentials(
      providerId,
      environment,
      {
        apiKey: newSecrets.newApiKey,
        apiSecret: newSecrets.newApiSecret,
        webhookSecret: newSecrets.newWebhookSecret,
      },
      actorId,
    );

    if (this.auditService && actorId) {
      await this.auditService.logEvent({
        correlationId: `cred_rotate_${Date.now()}`,
        actorId,
        actorType: 'ADMIN',
        action: 'PROVIDER_CREDENTIAL_ROTATED',
        resourceType: 'provider_credentials',
        resourceId: stored.id,
        metadata: { providerId, environment, reason },
      });
    }

    return stored;
  }

  public async revokeCredential(
    providerId: string,
    credentialId: string,
    reason: string,
    actorId?: string,
  ): Promise<{ id: string; status: 'REVOKED' }> {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestError('Reason is required to revoke credential');
    }

    const res = await this.db.query(
      `UPDATE provider_credentials
       SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, revocation_reason = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND provider_id = $3
       RETURNING id`,
      [credentialId, reason.trim(), providerId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundError(`Credential ${credentialId} not found for provider ${providerId}`);
    }

    if (this.auditService && actorId) {
      await this.auditService.logEvent({
        correlationId: `cred_revoke_${Date.now()}`,
        actorId,
        actorType: 'ADMIN',
        action: 'PROVIDER_CREDENTIAL_REVOKED',
        resourceType: 'provider_credentials',
        resourceId: credentialId,
        metadata: { providerId, reason },
      });
    }

    return { id: credentialId, status: 'REVOKED' };
  }

  public async listMaskedCredentials(providerId: string): Promise<StoredCredentialMetadata[]> {
    const res = await this.db.query(
      `SELECT id, provider_id as "providerId", environment,
              api_key_masked as "apiKeyMasked", webhook_secret_masked as "webhookSecretMasked",
              status, last_tested_at as "lastTestedAt", last_test_result as "lastTestResult",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM provider_credentials
       WHERE provider_id = $1
       ORDER BY created_at DESC`,
      [providerId],
    );

    return res.rows.map((row: any) => ({
      id: row.id,
      providerId: row.providerId,
      environment: row.environment,
      apiKeyMasked: row.apiKeyMasked,
      webhookSecretMasked: row.webhookSecretMasked,
      status: row.status,
      lastTestedAt: row.lastTestedAt ? new Date(row.lastTestedAt).toISOString() : null,
      lastTestResult: row.lastTestResult,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
  }
}
