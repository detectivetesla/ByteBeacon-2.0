# ADR 0005: Authoritative Source Policy & Telecom Provider Isolation

## Status
`SUPERSEDED / VERIFIED` (CONFIRMED EXTERNAL REQUIREMENT)

## Context
Initial phase: Third-party telecom vendor DataHouse lacked publicly authoritative API documentation, necessitating provider isolation and a strict prohibition against inventing unconfirmed endpoints.
Updated phase: Official authoritative vendor specification has been provided for GetMorePayLess Data House (`https://api.getmorepaylessdatahouse.net/api/v1`).

## Decision
- DataHouse vendor behavior is now reclassified from `AUTHORITATIVE SOURCE NOT VERIFIED` to `CONFIRMED EXTERNAL REQUIREMENT`.
- Full alignment with official endpoints:
  - Base URL: `https://api.getmorepaylessdatahouse.net/api/v1`
  - Authentication: `x-api-key` header with `ak_live_...` (production) and `ak_test_...` (sandbox) prefixes.
  - Agent Profile: `GET /agent/me`
  - Live Key Paywall: `GET /me/agent/api-access/status` & `POST /me/agent/api-access/initiate-payment`
  - Single Order: `POST /agent/orders` (idempotent via body UUID v4)
  - Bulk Orders: `POST /agent/orders/bulk` with partial success (`blocked[]` set aside for first-time MTN numbers)
  - Beneficiary Precheck: Public `POST /orders/beneficiaries/precheck` & Authenticated batch `POST /agent/beneficiaries/precheck`
  - Catalog: `GET /agent/bundles`
  - Wallet: `GET /agent/wallet/balance` & `GET /agent/wallet/ledger`
  - Webhooks: `POST /agent/webhooks`, `GET /agent/webhooks`, `POST /agent/webhooks/:id/rotate-secret`, `DELETE /agent/webhooks/:id`
  - Webhook Verification: HMAC-SHA256 over `${ts}.${rawBody}` using `whsec_...` via `X-Telecom-Signature: t=<unix-ts>,v1=<hex-sig>`.

## Consequences
- Protects codebase integrity with 100% test-backed compliance against the official vendor specification.
- Production readiness established with both live and sandbox execution modes.
