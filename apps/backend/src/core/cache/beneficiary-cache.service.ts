import type { Redis } from 'ioredis';
import { logger } from '../logging/logger.js';

export interface CachedBeneficiaryVerification {
  phoneNumber: string;
  normalized: string;
  network: string;
  status: 'APPROVED' | 'UNAPPROVED' | 'REJECTED';
  isValid: boolean;
  isKnown: boolean;
  orderable: boolean;
  accountName?: string;
  message?: string;
  cachedAt: number;
  ttlSeconds: number;
}

export class BeneficiaryCacheService {
  private readonly redis: Redis | null;
  private readonly keyPrefix = 'bb:cache:beneficiary';

  // TTL policies in seconds
  public static readonly TTL_APPROVED = 86400; // 24 hours
  public static readonly TTL_UNAPPROVED = 3600; // 1 hour
  public static readonly TTL_REJECTED = 86400; // 24 hours

  constructor(redis: Redis | null = null) {
    this.redis = redis;
  }

  private buildKey(network: string, normalizedPhone: string): string {
    return `${this.keyPrefix}:${network.toUpperCase()}:${normalizedPhone}`;
  }

  /**
   * Bulk-retrieves cached beneficiary verification records using Redis MGET in a single round-trip.
   */
  public async getCachedResults(
    network: string,
    phoneNumbers: string[],
  ): Promise<Map<string, CachedBeneficiaryVerification>> {
    const result = new Map<string, CachedBeneficiaryVerification>();
    if (!this.redis || phoneNumbers.length === 0) {
      return result;
    }

    try {
      const keys = phoneNumbers.map((p) => this.buildKey(network, p));
      const values: Array<string | null> = await (this.redis as any).mget(...keys);

      values.forEach((raw: string | null, idx: number) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as CachedBeneficiaryVerification;
            const phone = phoneNumbers[idx];
            result.set(phone, parsed);
            if (parsed.normalized && parsed.normalized !== phone) {
              result.set(parsed.normalized, parsed);
            }
          } catch {
            // Ignore malformed cache record
          }
        }
      });
    } catch (err: any) {
      logger.warn({ err: err?.message, network, count: phoneNumbers.length }, '[BeneficiaryCache] Cache get failed; bypassing cache');
    }

    return result;
  }

  /**
   * Bulk-saves verified beneficiary records into Redis using pipelined SETEX.
   */
  public async setCachedResults(
    network: string,
    items: CachedBeneficiaryVerification[],
  ): Promise<void> {
    if (!this.redis || items.length === 0) {
      return;
    }

    try {
      const pipeline = (this.redis as any).pipeline();

      for (const item of items) {
        const phone = item.normalized || item.phoneNumber;
        if (!phone) continue;

        const key = this.buildKey(network, phone);
        let ttl = item.ttlSeconds;
        if (!ttl || ttl <= 0) {
          if (item.status === 'APPROVED') {
            ttl = BeneficiaryCacheService.TTL_APPROVED;
          } else if (item.status === 'REJECTED') {
            ttl = BeneficiaryCacheService.TTL_REJECTED;
          } else {
            ttl = BeneficiaryCacheService.TTL_UNAPPROVED;
          }
        }

        pipeline.setex(key, ttl, JSON.stringify({ ...item, ttlSeconds: ttl }));
      }

      await pipeline.exec();
    } catch (err: any) {
      logger.warn({ err: err?.message, network, count: items.length }, '[BeneficiaryCache] Cache set failed; continuing');
    }
  }

  /**
   * Invalidates cached verification records for specified phone numbers.
   */
  public async deleteCachedResults(
    network: string,
    phoneNumbers: string[],
  ): Promise<void> {
    if (!this.redis || phoneNumbers.length === 0) {
      return;
    }

    try {
      const keys = phoneNumbers.map((p) => this.buildKey(network, p));
      await (this.redis as any).del(...keys);
    } catch (err: any) {
      logger.warn({ err: err?.message, network }, '[BeneficiaryCache] Cache delete failed');
    }
  }
}
