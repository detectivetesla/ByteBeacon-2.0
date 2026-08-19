import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

function loadEnvFiles() {
  if (process.env.NODE_ENV === 'production') return;

  const envFiles = ['.env.development', '.env'];
  for (const file of envFiles) {
    const candidates = [
      path.resolve(process.cwd(), file),
      path.resolve(process.cwd(), '..', file),
      path.resolve(process.cwd(), '../..', file),
    ];
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
              const key = trimmed.slice(0, eqIdx).trim();
              const val = trimmed.slice(eqIdx + 1).trim();
              if (process.env[key] === undefined) {
                process.env[key] = val;
              }
            }
          }
        } catch {
          // Ignore read error
        }
      }
    }
  }
}

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'staging', 'production'])
    .default('development'),
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(65535))
    .default('3000'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .default('postgres://postgres:postgres@localhost:5432/bytebeacon_dev'),
  REDIS_URL: z
    .string()
    .min(1, 'REDIS_URL is required')
    .transform((val) => {
      let cleaned = val.trim();
      const match = cleaned.match(/(rediss?:\/\/[^\s"']+)/g);
      if (match && match.length > 0) {
        cleaned = match[match.length - 1];
      }
      return cleaned;
    })
    .default('redis://localhost:6379'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) {
        return ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'];
      }
      return val.split(',').map((origin) => origin.trim()).filter(Boolean);
    })
    .pipe(z.array(z.string().url('Invalid CORS origin URL'))),
  ALLOW_MOCK_PROVIDERS: z
    .string()
    .optional()
    .transform((val) => {
      if (val !== undefined) {
        return val === 'true' || val === '1';
      }
      return process.env.NODE_ENV !== 'production';
    }),

  // --- Telecom & Payment Provider Configuration ---
  DATAHOUSE_BASE_URL: z
    .string()
    .default('https://api.getmorepaylessdatahouse.net/api/v1'),
  DATAHOUSE_API_KEY: z
    .string()
    .default('dh_live_test_api_key'),
  DATAHOUSE_WEBHOOK_SECRET: z
    .string()
    .default('dh_whsec_test_webhook_secret'),
  PAYSTACK_SECRET_KEY: z
    .string()
    .default('sk_test_paystack_secret_key'),

  // --- Strict Development Authentication Controls ---
  DEV_AUTH_ENABLED: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .default('false'),
  DEV_CUSTOMER_EMAIL: z.string().email().optional(),
  DEV_CUSTOMER_PASSWORD: z.string().min(8).optional(),
  DEV_AGENT_EMAIL: z.string().email().optional(),
  DEV_AGENT_PASSWORD: z.string().min(8).optional(),
  DEV_ADMIN_EMAIL: z.string().email().optional(),
  DEV_ADMIN_PASSWORD: z.string().min(8).optional(),
  DEV_SUPER_ADMIN_EMAIL: z.string().email().optional(),
  DEV_SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env | null = null;

export function loadConfig(overrideEnv?: Record<string, string | undefined>): Env {
  if (!overrideEnv) {
    loadEnvFiles();
  }

  // Support ALLOWED_ORIGINS alias for CORS_ORIGINS
  const rawEnv: Record<string, string | undefined> = {
    ...(overrideEnv ?? process.env),
  };
  if (rawEnv.ALLOWED_ORIGINS && !rawEnv.CORS_ORIGINS) {
    rawEnv.CORS_ORIGINS = rawEnv.ALLOWED_ORIGINS;
  }

  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const formattedErrors = result.error.format();
    const errorMessage = `FATAL: Invalid environment configuration:\n${JSON.stringify(
      formattedErrors,
      null,
      2,
    )}`;
    throw new Error(errorMessage);
  }

  // --- Mandatory Production Invariants ---
  if (result.data.NODE_ENV === 'production') {
    // 1. DEV_AUTH_ENABLED must NEVER be true in production!
    if (result.data.DEV_AUTH_ENABLED) {
      throw new Error('FATAL SECURITY VIOLATION: DEV_AUTH_ENABLED cannot be true in production environment!');
    }

    // 2. Production must have an explicit CORS origin configured (no default localhost fallback)
    const rawOrigins = rawEnv.CORS_ORIGINS || rawEnv.ALLOWED_ORIGINS;
    if (!rawOrigins || rawOrigins.trim() === '') {
      throw new Error('FATAL SECURITY VIOLATION: Production requires explicit CORS_ORIGINS / ALLOWED_ORIGINS configuration!');
    }

    // 3. Production must never permit localhost or 127.0.0.1 or wildcards
    for (const origin of result.data.CORS_ORIGINS) {
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('*')) {
        throw new Error(`FATAL SECURITY VIOLATION: Production CORS cannot include local development origins or wildcards [${origin}]!`);
      }
    }
  } else {
    // In development and test environments, ensure loopback pairs (localhost <-> 127.0.0.1) are both present
    const devOrigins = new Set(result.data.CORS_ORIGINS);
    for (const origin of result.data.CORS_ORIGINS) {
      if (origin.includes('localhost')) {
        devOrigins.add(origin.replace('localhost', '127.0.0.1'));
      } else if (origin.includes('127.0.0.1')) {
        devOrigins.add(origin.replace('127.0.0.1', 'localhost'));
      }
    }
    result.data.CORS_ORIGINS = Array.from(devOrigins);
  }

  parsedEnv = result.data;
  return result.data;
}

export function getConfig(): Env {
  if (!parsedEnv) {
    return loadConfig();
  }
  return parsedEnv;
}
