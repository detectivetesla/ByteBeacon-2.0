# Webhook Threats & Ingestion Defense

Status: `FOUNDATION ONLY`

---

## 1. Webhook Attack Vectors

### 1.1 Webhook Spoofing / Forgery
- **Threat**: Attacker sends simulated payment success webhooks to credit wallets or trigger telecom data dispatches.
- **Mitigation**: Every incoming webhook must validate its cryptographic signature (`x-paystack-signature` using HMAC-SHA512 with the secret key). Fastify route captures raw request buffer for byte-for-byte signature verification before parsing JSON.

### 1.2 Webhook Replay Attacks
- **Threat**: Attacker intercepts and replays a valid webhook payload to credit a balance multiple times.
- **Mitigation**: Redis distributed lock / idempotency record: `SET webhook:lock:{providerTxId} EX 86400 NX`. If the key already exists, return `200 OK` immediately without re-processing.

### 1.3 Telecom Webhooks (DataHouse Status)
- **Status**: `CONFIRMED EXTERNAL REQUIREMENT`
- **Specification**: Validated against authoritative DataHouse Gateway specification (`https://api.getmorepaylessdatahouse.net/api/v1`).
- **Signature Scheme**: Header `X-Telecom-Signature: t=<unix-ts>,v1=<hex-sig>`.
- **Verification Rule**: HMAC-SHA256 computed over `${ts}.${rawBody}` using the subscription secret (`whsec_...`).
- **Replay Protection**: Reject timestamps outside the 5-minute window (`Math.abs(nowSec - ts) > 300`) and enforce Redis deduplication (`webhook:datahouse:dedup:{eventId}`) with PostgreSQL durable uniqueness check on `provider_events`.
