# ByteBeacon 2.0 — Production Deployment Runbook

## 1. System Architecture Overview

ByteBeacon 2.0 follows a decoupled **Vercel Frontend + Dedicated Fastify API / Worker Container + Dedicated Supabase PostgreSQL + Managed Redis** architecture.

```
                  Client Traffic (HTTPS)
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
         Vercel Edge SPA           Production API
       (React / Vite Build)     (Fastify Container)
               │                         │
               └────────────┬────────────┘
                            │
             Dedicated Supabase PostgreSQL
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
         Managed Redis           Standalone Worker
     (Locks / Queues / Idem)      (BullMQ Runner)
```

---

## 2. Environment Provisioning & Pre-Flight Checklist

### A. Dedicated Production Supabase Project
- Create a new dedicated project on Supabase for **Production** (do NOT reuse development or staging projects).
- Enable Point-in-Time Recovery (PITR) with minimum 7-day retention.
- Copy the Connection Pooler URL (`Transaction` mode on port `6543` or `Session` mode on port `5432`).

### B. Managed Redis Instance
- Provision a managed Redis instance (Upstash, AWS ElastiCache, or Redis Cloud).
- Ensure TLS/SSL is enabled.
- Verify connectivity: `redis-cli -u $REDIS_URL ping` -> `PONG`.

### C. Secrets & Environment Variables Matrix
Set the following secrets on the production container runtime and Vercel:

| Secret Name | Destination | Description | Example / Format |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | API / Worker | Runtime environment | `production` |
| `PORT` | API | HTTP listen port | `3000` |
| `DATABASE_URL` | API / Worker | Supabase PostgreSQL Connection Pooler URL | `postgresql://postgres.[ref]:[pass]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require` |
| `REDIS_URL` | API / Worker | Managed Redis URI | `rediss://default:[pass]@[host]:6379` |
| `JWT_SECRET` | API | Cryptographic JWT signing secret (min 32 chars) | `[SECURE_RANDOM_HEX_64_CHARS]` |
| `PAYSTACK_SECRET_KEY` | API | Live Paystack Secret Key | `sk_live_[32_HEX_CHARS]` |
| `PAYSTACK_PUBLIC_KEY` | Vercel SPA | Live Paystack Public Key | `pk_live_[32_HEX_CHARS]` |
| `DATAHOUSE_BASE_URL` | API / Worker | Live DataHouse Gateway | `https://api.getmorepaylessdatahouse.net/api/v1` |
| `DATAHOUSE_API_KEY` | API / Worker | Live DataHouse API Key | `dh_live_[SECRET_KEY]` |
| `DATAHOUSE_WEBHOOK_SECRET` | API / Worker | DataHouse Webhook HMAC Secret | `dh_whsec_[SECRET_KEY]` |
| `SENTRY_DSN` | API / Worker / Vercel | Sentry Error Monitoring DSN | `https://[key]@[org].ingest.sentry.io/[project]` |
| `VITE_API_BASE_URL` | Vercel SPA | Fastify Production API Endpoint | `https://api.bytebeacon.com` |

---

## 3. Database Migration: Zero-Downtime Expand-Contract Workflow

To guarantee zero-downtime and eliminate migration risk, database schema updates must follow the **Expand-Contract** protocol:

1. **Expand**: Apply additive migrations (new tables, new nullable columns, new indexes) using the migration CLI:
   ```bash
   npm run migrate:up -w @bytebeacon/backend
   ```
2. **Deploy**: Deploy the new backend API and Worker containers.
3. **Migrate Data**: If migrating historical data, run the non-destructive data migration engine:
   ```bash
   node dist/infrastructure/database/migration-engine.js
   ```
4. **Verify**: Check database health and double-entry ledger balance:
   ```bash
   curl https://api.bytebeacon.com/health/integrations
   ```
5. **Switch Application**: Direct 100% of user traffic to the new version via load balancer / Vercel deployment.
6. **Contract**: In a subsequent release cycle, safely drop deprecated columns or legacy tables.

---

## 4. Production Deployment Execution Steps

### Step 1: Execute Automated Release Gate
Verify that all release criteria pass:
```bash
npm run typecheck -w @bytebeacon/backend
npm test -w @bytebeacon/backend
npm run typecheck -w @bytebeacon/frontend
npm test -w @bytebeacon/frontend -- --run
```

### Step 2: Build & Deploy Backend Containers
```bash
# Build production Docker images
docker build -f Dockerfile.api -t bytebeacon/api:v2.0.0 .
docker build -f Dockerfile.worker -t bytebeacon/worker:v2.0.0 .

# Push images to container registry
docker push bytebeacon/api:v2.0.0
docker push bytebeacon/worker:v2.0.0

# Deploy API and Worker instances with rolling replacement
```

### Step 3: Deploy Frontend to Vercel
```bash
# Deploy to Vercel Production
vercel --prod --token $VERCEL_TOKEN
```

### Step 4: Run Post-Deployment Smoke Tests
1. **Liveness Check**: `curl -I https://api.bytebeacon.com/healthz` -> `200 OK`
2. **Readiness Check**: `curl -I https://api.bytebeacon.com/readyz` -> `200 OK`
3. **Integration Health**: `curl https://api.bytebeacon.com/health/integrations` -> All dependencies `HEALTHY`
4. **Prometheus Metrics**: `curl https://api.bytebeacon.com/metrics` -> `200 OK`
5. **Frontend Flow**: Load `https://bytebeacon.vercel.app` and complete a test bundle purchase flow.

---

## 5. Rollback Procedures

If an unexpected error or regression is detected post-deployment:

### Immediate Action (Feature Flag Kill-Switch)
If the issue is isolated to a specific subsystem (e.g. `NEW_ORDER_ENGINE` or `AGENT_STORES`):
- Toggle the runtime feature flag without rolling back infrastructure:
  ```bash
  # Update environment variable or DB override
  FF_NEW_ORDER_ENGINE=false
  ```

### Full Infrastructure Rollback
If a critical API regression occurs:
1. **Backend Rollback**: Revert container image tags to the previous stable release (`bytebeacon/api:v1.9.9`).
2. **Frontend Rollback**: Instant instant-rollback on Vercel Dashboard to the previous immutable deployment hash.
3. **Database Guard**: Because migrations follow the Expand-Contract rule, the previous application version will continue running on the database schema without disruption.
