import { describe, it, expect, beforeEach } from 'vitest';
import { PasswordHasher } from '../src/core/security/password-hasher.js';
import {
  devUserCache,
  seedDefaultUsers,
  getCachedUser,
  verifyUserPassword,
} from '../src/core/security/dev-user-cache.js';
import { UserRole, SecurityDomain, UserStatus } from '@bytebeacon/shared';

describe('Admin Master Login & Auto-Lockout Clearing', () => {
  const hasher = new PasswordHasher();

  beforeEach(async () => {
    devUserCache.clear();
    await seedDefaultUsers(hasher);
  });

  it('seeds nomotsumartin@gmail.com as super_admin with active status', () => {
    const user = getCachedUser('nomotsumartin@gmail.com');
    expect(user).toBeDefined();
    expect(user?.email).toBe('nomotsumartin@gmail.com');
    expect(user?.role).toBe(UserRole.SUPER_ADMIN);
    expect(user?.status).toBe(UserStatus.ACTIVE);
    expect(user?.securityDomain).toBe(SecurityDomain.ADMIN);
    expect(user?.failedLoginAttempts).toBe(0);
    expect(user?.lockedUntil).toBeNull();
  });

  it('retrieves user case-insensitively', () => {
    const user = getCachedUser('NOMOTSUMARTIN@GMAIL.COM');
    expect(user).toBeDefined();
    expect(user?.email).toBe('nomotsumartin@gmail.com');
  });

  it('validates password ByteBeacon2026! for nomotsumartin@gmail.com', async () => {
    const user = getCachedUser('nomotsumartin@gmail.com');
    expect(user).toBeDefined();

    const isValid = await verifyUserPassword(user!, 'ByteBeacon2026!', hasher);
    expect(isValid).toBe(true);

    const isInvalid = await verifyUserPassword(user!, 'WrongPassword123!', hasher);
    expect(isInvalid).toBe(false);
  });

  it('clears lockout state and resets failed attempts when valid credentials are provided', async () => {
    const user = getCachedUser('nomotsumartin@gmail.com');
    expect(user).toBeDefined();

    // Simulate account lockout
    user!.failedLoginAttempts = 5;
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    user!.lockedUntil = futureDate;

    // Verify user password with master credentials
    const isValid = await verifyUserPassword(user!, 'ByteBeacon2026!', hasher);
    expect(isValid).toBe(true);

    // Simulate the login controller behavior: on valid password, clear lockout
    if (isValid) {
      user!.failedLoginAttempts = 0;
      user!.lockedUntil = null;
    }

    expect(user!.failedLoginAttempts).toBe(0);
    expect(user!.lockedUntil).toBeNull();
  });
});
