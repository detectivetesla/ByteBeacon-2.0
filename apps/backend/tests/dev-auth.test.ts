import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config/env.js';

describe('Development Auth & Production Hardening Security Invariants', () => {
  const baseEnv = {
    PORT: '3000',
    DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/bytebeacon_test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    CORS_ORIGINS: 'http://localhost:5173',
  };

  it('FATAL STARTUP CHECK: fails immediately when DEV_AUTH_ENABLED is true in production environment', () => {
    expect(() => {
      loadConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        DEV_AUTH_ENABLED: 'true',
        CORS_ORIGINS: 'https://app.bytebeacon.com',
      });
    }).toThrow(/FATAL SECURITY VIOLATION: DEV_AUTH_ENABLED cannot be true in production environment!/);
  });

  it('allows DEV_AUTH_ENABLED in development environment with granular role credentials', () => {
    const config = loadConfig({
      ...baseEnv,
      NODE_ENV: 'development',
      DEV_AUTH_ENABLED: 'true',
      DEV_CUSTOMER_EMAIL: 'dev.customer@bytebeacon.local',
      DEV_CUSTOMER_PASSWORD: 'DevCust_9#mP2$vL8!qZ4*wY7@jR1',
      DEV_AGENT_EMAIL: 'dev.agent@bytebeacon.local',
      DEV_AGENT_PASSWORD: 'DevAgent_7$kX4!vN9#pQ2*mY5@wL3',
      DEV_ADMIN_EMAIL: 'dev.admin@bytebeacon.local',
      DEV_ADMIN_PASSWORD: 'DevAdmin_3*wQ8!mY5#pR9$vK2@zL7',
      DEV_SUPER_ADMIN_EMAIL: 'dev.superadmin@bytebeacon.local',
      DEV_SUPER_ADMIN_PASSWORD: 'DevSuperAdmin_5@zL9#mP2$vK8!qY4*wR6',
    });

    expect(config.DEV_AUTH_ENABLED).toBe(true);
    expect(config.DEV_CUSTOMER_EMAIL).toBe('dev.customer@bytebeacon.local');
    expect(config.DEV_SUPER_ADMIN_EMAIL).toBe('dev.superadmin@bytebeacon.local');
  });

  it('supports environment rotation without code modification', () => {
    // Initial configuration
    const initialConfig = loadConfig({
      ...baseEnv,
      NODE_ENV: 'development',
      DEV_AUTH_ENABLED: 'true',
      DEV_ADMIN_PASSWORD: 'Initial_Password_123!',
    });
    expect(initialConfig.DEV_ADMIN_PASSWORD).toBe('Initial_Password_123!');

    // Rotated configuration
    const rotatedConfig = loadConfig({
      ...baseEnv,
      NODE_ENV: 'development',
      DEV_AUTH_ENABLED: 'true',
      DEV_ADMIN_PASSWORD: 'Rotated_New_Password_456#',
    });
    expect(rotatedConfig.DEV_ADMIN_PASSWORD).toBe('Rotated_New_Password_456#');
  });

  it('permits production startup when DEV_AUTH_ENABLED is false (or omitted)', () => {
    const config = loadConfig({
      ...baseEnv,
      NODE_ENV: 'production',
      DEV_AUTH_ENABLED: 'false',
      CORS_ORIGINS: 'https://app.bytebeacon.com',
    });

    expect(config.DEV_AUTH_ENABLED).toBe(false);
    expect(config.NODE_ENV).toBe('production');
  });
});
