/**
 * Neutral Provider Credential Store Interface.
 * Decouples credential storage mechanisms (Supabase Vault, KMS, AWS Secrets Manager, Local Encrypted DB)
 * from the telecom provider execution engine.
 */

export interface StoredCredentialMetadata {
  id: string;
  providerId: string;
  environment: 'SANDBOX' | 'PRODUCTION' | string;
  apiKeyMasked: string;
  webhookSecretMasked?: string;
  status: 'ACTIVE' | 'ROTATED' | 'REVOKED' | 'EXPIRED';
  lastTestedAt?: string | null;
  lastTestResult?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedProviderSecrets {
  apiKey: string;
  apiSecret?: string | null;
  webhookSecret?: string | null;
}

export interface IProviderCredentialStore {
  /**
   * Retrieves decrypted secrets for a provider and environment.
   * Internal backend use ONLY. Never expose in API replies.
   */
  getSecrets(
    providerId: string,
    environment: 'SANDBOX' | 'PRODUCTION' | string,
  ): Promise<DecryptedProviderSecrets | null>;

  /**
   * Stores new credentials for a provider.
   */
  storeCredentials(
    providerId: string,
    environment: 'SANDBOX' | 'PRODUCTION' | string,
    secrets: { apiKey: string; apiSecret?: string; webhookSecret?: string },
    actorId?: string,
  ): Promise<StoredCredentialMetadata>;

  /**
   * Rotates credentials for a provider with audit justification.
   */
  rotateCredentials(
    providerId: string,
    environment: 'SANDBOX' | 'PRODUCTION' | string,
    newSecrets: { newApiKey: string; newApiSecret?: string; newWebhookSecret?: string },
    reason: string,
    actorId?: string,
  ): Promise<StoredCredentialMetadata>;

  /**
   * Revokes a specific credential entry.
   */
  revokeCredential(
    providerId: string,
    credentialId: string,
    reason: string,
    actorId?: string,
  ): Promise<{ id: string; status: 'REVOKED' }>;

  /**
   * Lists masked credential metadata for a provider (safe for UI).
   */
  listMaskedCredentials(providerId: string): Promise<StoredCredentialMetadata[]>;
}
