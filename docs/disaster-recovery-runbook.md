# ByteBeacon 2.0 — Disaster Recovery & Backup Runbook

## 1. Objectives & SLA Targets

| Metric | Target | Description |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **< 1 Minute** | Maximum allowable data loss in the event of catastrophic failure. Financial transactions must achieve near-zero data loss. |
| **RTO (Recovery Time Objective)** | **< 30 Minutes** | Time required to restore core platform operations and payment processing. |
| **Financial Consistency Guarantee** | **100% Exact** | Reconstructed ledger balances must match debit/credit invariants to the exact Ghanaian Pesewa. |

---

## 2. Three-Layer Backup Architecture

```
Layer 1: Supabase Automated Backups & PITR (Continuous WAL Archiving)
   ↓
Layer 2: Daily Off-Site Encrypted Database Dumps (S3 / Cloud Storage)
   ↓
Layer 3: Automated Staging Restoration & Ledger Verification Tests
```

---

## 3. Disaster Recovery Execution Procedures

### Scenario A: Accidental Data Corruption or Unbalanced Ledger

1. **Isolate Traffic**:
   - Enable maintenance mode immediately: `FF_MAINTENANCE_MODE=true`.
   - Pause BullMQ worker queues:
     ```bash
     curl -X POST https://api.bytebeacon.com/api/v1/admin/queues/pause \
       -H "Authorization: Bearer $ADMIN_TOKEN"
     ```

2. **Compute Corrupted State Checksum**:
   - Execute ledger anomaly audit:
     ```bash
     node dist/infrastructure/database/disaster-recovery.service.js --audit
     ```

3. **Perform Supabase Point-in-Time Recovery (PITR)**:
   - Navigate to Supabase Dashboard -> Database -> Backups -> Point in Time.
   - Select the exact timestamp immediately preceding the incident.
   - Restore into a temporary staging instance (`bytebeacon_recovery_temp`).

4. **Verify Restored Backup Integrity**:
   - Run the automated `DisasterRecoveryService.verifyRestoredBackup` suite against the restored database.
   - Confirm:
     - `isVerified === true`
     - `isBalanced === true` ($\sum \text{Debits} \equiv \sum \text{Credits}$)
     - `discrepancies.length === 0`

5. **Promote Restored Database**:
   - Update `DATABASE_URL` connection strings in production API & Worker container environment configs.
   - Restart API and Worker services.
   - Clear maintenance mode: `FF_MAINTENANCE_MODE=false`.

---

### Scenario B: Complete Redis Cache Loss

Redis is **never** the authoritative store for financial records, order states, or user credentials. If the managed Redis cluster experiences catastrophic failure:

1. **Provision New Redis Instance**:
   - Deploy a replacement Redis cluster.
2. **Update Connection String**:
   - Update `REDIS_URL` in environment secrets.
3. **Restart API and Worker Processes**:
   - BullMQ will automatically reinitialize queue structures (`bb:fulfillment`, `bb:reconciliation`).
4. **Trigger Provider Reconciliation Audit**:
   - Run carrier reconciliation to recover in-flight fulfillment jobs:
     ```bash
     curl -X POST https://api.bytebeacon.com/api/v1/admin/reconciliation/trigger \
       -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
     ```
   - Any unfulfilled orders in PostgreSQL will be re-queued and reconciled against DataHouse.
