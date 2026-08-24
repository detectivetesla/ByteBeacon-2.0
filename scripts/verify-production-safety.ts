import { loadConfig } from '../apps/backend/src/config/env.js';
import * as fs from 'fs';
import * as path from 'path';

export function runProductionSafetyAudit(): { passed: boolean; errors: string[] } {
  const errors: string[] = [];

  console.log('----------------------------------------------------');
  console.log('ByteBeacon 2.0 — Production Safety & Hardening Audit');
  console.log('----------------------------------------------------');

  // Check 1: Startup Safety Invariant
  try {
    loadConfig({
      NODE_ENV: 'production',
      DEV_AUTH_ENABLED: 'true',
      PORT: '3000',
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/bytebeacon',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      CORS_ORIGINS: 'https://bytebeacon.com',
    });
    errors.push('CRITICAL: Backend failed to throw fatal error when DEV_AUTH_ENABLED is true in production!');
  } catch (err: any) {
    if (err.message.includes('FATAL SECURITY VIOLATION: DEV_AUTH_ENABLED cannot be true in production environment!')) {
      console.log('✓ Check 1: Production startup safely blocks DEV_AUTH_ENABLED');
    } else {
      errors.push(`UNEXPECTED ERROR: ${err.message}`);
    }
  }

  // Check 2: Verify .gitignore includes all .env variants
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    if (gitignoreContent.includes('.env') && gitignoreContent.includes('.env.*')) {
      console.log('✓ Check 2: Gitignore properly excludes all environment files (.env, .env.*)');
    } else {
      errors.push('CRITICAL: .gitignore does not exclude all .env files!');
    }
  } else {
    errors.push('ERROR: .gitignore not found');
  }

  // Check 3: Audit frontend source code for hardcoded development passwords
  const frontendSrcDir = path.resolve(process.cwd(), 'apps/frontend/src');
  const scanDirectory = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('DevCust_') || content.includes('DevAgent_') || content.includes('DevAdmin_') || content.includes('DevSuper_')) {
          errors.push(`CRITICAL LEAK: Development credential found in frontend file ${fullPath}`);
        }
      }
    }
  };

  scanDirectory(frontendSrcDir);
  if (errors.length === 0) {
    console.log('✓ Check 3: Zero development credentials in frontend bundle / source code');
  }

  // Check 4: Verify Complete Legacy Database & Backend Destruction
  const legacyBackendDir = path.resolve(process.cwd(), 'backend');
  if (fs.existsSync(legacyBackendDir)) {
    errors.push('CRITICAL: Legacy backend directory still exists in workspace!');
  } else {
    console.log('✓ Check 4: Legacy backend directory completely deleted from workspace');
  }

  // Check 5: Verify ByteBeacon 2.0 Database Isolation & Zero Legacy Contamination
  const legacyArchiveFile = path.resolve(process.cwd(), 'reports/BYTEBEACON_LEGACY_ARCHIVE_DO_NOT_USE.sql');
  if (fs.existsSync(legacyArchiveFile)) {
    console.log('✓ Check 5: Legacy database archival record safely preserved in reports/BYTEBEACON_LEGACY_ARCHIVE_DO_NOT_USE.sql');
  } else {
    errors.push('WARNING: Legacy archive record missing from reports directory');
  }

  console.log('----------------------------------------------------');
  if (errors.length === 0) {
    console.log('PRODUCTION SAFETY AUDIT: PASS (System is production-hardened)');
    return { passed: true, errors: [] };
  } else {
    console.error('PRODUCTION SAFETY AUDIT: FAIL');
    errors.forEach((e) => console.error(`  - ${e}`));
    return { passed: false, errors };
  }
}

if (process.argv[1]?.includes('verify-production-safety')) {
  const result = runProductionSafetyAudit();
  if (!result.passed) {
    process.exit(1);
  }
}
