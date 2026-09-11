import type { Redis } from 'ioredis';
import { logger } from '../logging/logger.js';

export interface CachedBeneficiaryVerification {
  phoneNumber: string;
  normalized: string;
  network: string;
  status: 'APPROVED' | 'UNAPPROVED' | 'REJECTED' | 'PENDING_VERIFICATION' | 'PROVIDER_ERROR';
  isValid: boolean;
  isKnown: boolean;
  orderable: boolean;
  source?: string;
  verifiedAt?: string;
  accountName?: string;
  message?: string;
  cachedAt: number;
  ttlSeconds: number;
}

export class BeneficiaryCacheService {
  private readonly redis: Redis | null;
  private readonly keyPrefix = 'bb:cache:beneficiary';
  private readonly inMemoryCache = new Map<string, { value: CachedBeneficiaryVerification; expiresAt: number }>();

  // Authoritative TTL policies:
  // - APPROVED: 2 hours (frequent enough to catch revocations, long enough to minimize upstream costs)
  // - UNAPPROVED: 5 minutes (short window to allow newly approved numbers to clear quickly)
  // - REJECTED: 24 hours (invalid format or permanently rejected)
  public static readonly TTL_APPROVED = 7200; // 2 hours
  public static readonly TTL_UNAPPROVED = 300; // 5 minutes
  public static readonly TTL_REJECTED = 86400; // 24 hours

  constructor(redis: Redis | null = null) {
    this.redis = redis;
  }

  private isRedisReady(): boolean {
    return Boolean(
      this.redis &&
      (!this.redis.status || this.redis.status === 'ready' || this.redis.status === 'connect')
    );
  }

  private buildKey(network: string, normalizedPhone: string): string {
    return `${this.keyPrefix}:${network.toUpperCase()}:${normalizedPhone}`;
  }

  /**
   * Bulk-retrieves cached beneficiary verification records using Redis MGET in a single round-trip,
   * with automatic in-memory fallback if Redis is unavailable or unconfigured.
   */
  public async getCachedResults(
    network: string,
    phoneNumbers: string[],
  ): Promise<Map<string, CachedBeneficiaryVerification>> {
    const result = new Map<string, CachedBeneficiaryVerification>();
    if (phoneNumbers.length === 0) {
      return result;
    }

    const now = Date.now();

    // 1. Try Redis first if available
    if (this.isRedisReady()) {
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
        return result;
      } catch (err: any) {
        logger.warn({ err: err?.message, network, count: phoneNumbers.length }, '[BeneficiaryCache] Redis get failed; falling back to in-memory');
      }
    }

    // 2. In-memory fallback lookup
    for (const phone of phoneNumbers) {
      const key = this.buildKey(network, phone);
      const entry = this.inMemoryCache.get(key);
      if (entry) {
        if (entry.expiresAt > now) {
          result.set(phone, entry.value);
          if (entry.value.normalized && entry.value.normalized !== phone) {
            result.set(entry.value.normalized, entry.value);
          }
        } else {
          this.inMemoryCache.delete(key);
        }
      }
    }

    return result;
  }

  /**
   * Bulk-saves verified beneficiary records into Redis using pipelined SETEX,
   * and mirrors to in-memory cache for instant local access.
   */
  public async setCachedResults(
    network: string,
    items: CachedBeneficiaryVerification[],
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const now = Date.now();

    // Save to in-memory cache
    for (const item of items) {
      const phone = item.normalized || item.phoneNumber;
      if (!phone) continue;

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

      const key = this.buildKey(network, phone);
      const enrichedItem: CachedBeneficiaryVerification = {
        ...item,
        source: item.source || 'DATAHOUSE',
        verifiedAt: item.verifiedAt || new Date(now).toISOString(),
        cachedAt: now,
        ttlSeconds: ttl,
      };

      this.inMemoryCache.set(key, {
        value: enrichedItem,
        expiresAt: now + ttl * 1000,
      });
    }

    // Also persist to Redis if available
    if (this.isRedisReady()) {
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

          const enrichedItem: CachedBeneficiaryVerification = {
            ...item,
            source: item.source || 'DATAHOUSE',
            verifiedAt: item.verifiedAt || new Date(now).toISOString(),
            cachedAt: now,
            ttlSeconds: ttl,
          };

          pipeline.setex(key, ttl, JSON.stringify(enrichedItem));
        }

        await pipeline.exec();
      } catch (err: any) {
        logger.warn({ err: err?.message, network, count: items.length }, '[BeneficiaryCache] Redis set failed; in-memory retained');
      }
    }
  }

  /**
   * Invalidates cached verification records for specified phone numbers.
   */
  public async deleteCachedResults(
    network: string,
    phoneNumbers: string[],
  ): Promise<void> {
    if (phoneNumbers.length === 0) {
      return;
    }

    // Invalidate in-memory
    for (const phone of phoneNumbers) {
      this.inMemoryCache.delete(this.buildKey(network, phone));
    }

    if (this.isRedisReady()) {
      try {
        const keys = phoneNumbers.map((p) => this.buildKey(network, p));
        await (this.redis as any).del(...keys);
      } catch (err: any) {
        logger.warn({ err: err?.message, network }, '[BeneficiaryCache] Redis cache delete failed');
      }
    }
  }
}
