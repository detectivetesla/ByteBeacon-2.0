import argon2 from 'argon2';
import bcrypt from 'bcryptjs';
import { logger } from '../logging/logger.js';

export interface Argon2Options {
  memoryCost: number; // in KiB (e.g. 65536 = 64MB)
  timeCost: number; // iterations
  parallelism: number; // threads
}

// OWASP Recommended Default Options for Argon2id
export const DEFAULT_ARGON2_OPTIONS: Argon2Options = {
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
};

export class PasswordHasher {
  private readonly options: Argon2Options;

  constructor(options: Argon2Options = DEFAULT_ARGON2_OPTIONS) {
    this.options = options;
  }

  /**
   * Hashes a plain password using Argon2id.
   * Passwords must NEVER be logged.
   */
  public async hashPassword(password: string): Promise<string> {
    try {
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: this.options.memoryCost,
        timeCost: this.options.timeCost,
        parallelism: this.options.parallelism,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to hash password');
      throw new Error('Password hashing error');
    }
  }

  /**
   * Verifies a plain password against an Argon2id or legacy bcrypt hash.
   */
  public async verifyPassword(hash: string, password: string): Promise<boolean> {
    if (!hash || !password) return false;

    // Check if this is a legacy bcrypt hash ($2a$, $2b$, $2y$, $2x$)
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$') || hash.startsWith('$2x$')) {
      try {
        return await bcrypt.compare(password, hash);
      } catch (err) {
        logger.error({ err }, 'Failed to verify legacy bcrypt password hash');
        return false;
      }
    }

    // Default to Argon2id
    try {
      return await argon2.verify(hash, password);
    } catch (err) {
      logger.error({ err }, 'Failed to verify argon2 password hash');
      return false;
    }
  }

  /**
   * Checks whether a hash is legacy (e.g. bcrypt) and needs upgrading to Argon2id.
   */
  public needsRehash(hash: string): boolean {
    if (!hash) return true;
    return !hash.startsWith('$argon2');
  }
}

export const defaultPasswordHasher = new PasswordHasher();
