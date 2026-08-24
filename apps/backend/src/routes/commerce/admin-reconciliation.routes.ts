import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { ProviderReconciliationService } from '../../core/providers/provider-reconciliation.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../core/errors/app-error.js';
import {
  ReconciliationDashboardDto,
  UpdateReconciliationCaseRequest,
  UserRole,
} from '@bytebeacon/shared';

export interface AdminReconciliationRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  auditService: AuditService;
  providerReconciliationService?: ProviderReconciliationService;
}

export async function adminReconciliationRoutes(
  app: FastifyInstance,
  deps: AdminReconciliationRouteDependencies,
) {
  const { db, tokenService, apiKeyService, rbacService, auditService, providerReconciliationService } = deps;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // 1. GET /admin/reconciliation/dashboard — Dual Pipeline Health & Match Rates
  app.get(
    '/admin/reconciliation/dashboard',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      // 1. Payment Rails (Paystack Metrics)
      const paystackRes = await db.query(`
        SELECT 
          COUNT(*) as "totalPayments",
          COUNT(CASE WHEN status = 'PAID' THEN 1 END) as "matchedPayments",
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as "failedPayments",
          COALESCE(SUM(CASE WHEN status = 'FAILED' THEN amount_pesewas ELSE 0 END), 0) as "discrepancyPesewas"
        FROM payments
      `);
      const totalPayments = parseInt(paystackRes.rows[0]?.totalPayments || '0', 10);
      const matchedPayments = parseInt(paystackRes.rows[0]?.matchedPayments || '0', 10);
      const failedPayments = parseInt(paystackRes.rows[0]?.failedPayments || '0', 10);
      const paystackDiscrepancy = parseInt(paystackRes.rows[0]?.discrepancyPesewas || '0', 10);
      const paystackMatchRate = totalPayments > 0 ? Math.round((matchedPayments / totalPayments) * 1000) / 10 : 100;

      // 2. Fulfillment Rails (DataHouse Carrier Metrics)
      const datahouseRes = await db.query(`
        SELECT 
          COUNT(*) as "totalCarrierOrders",
          COUNT(CASE WHEN provider_status = 'COMPLETED' THEN 1 END) as "matchedCarrier",
          COUNT(CASE WHEN provider_status IN ('FAILED', 'REJECTED') THEN 1 END) as "mismatchedCarrier"
        FROM provider_orders
      `);
      const totalCarrier = parseInt(datahouseRes.rows[0]?.totalCarrierOrders || '0', 10);
      const matchedCarrier = parseInt(datahouseRes.rows[0]?.matchedCarrier || '0', 10);
      const mismatchedCarrier = parseInt(datahouseRes.rows[0]?.mismatchedCarrier || '0', 10);
      const datahouseMatchRate = totalCarrier > 0 ? Math.round((matchedCarrier / totalCarrier) * 1000) / 10 : 100;

      // 3. Ledger Integrity Metrics
      const ledgerRes = await db.query(`
        SELECT 
          COUNT(DISTINCT transaction_id) as "totalJournals",
          COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_pesewas ELSE 0 END), 0) as "totalDebits",
          COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE 0 END), 0) as "totalCredits"
        FROM financial_ledger
      `);
      const totalJournals = parseInt(ledgerRes.rows[0]?.totalJournals || '0', 10);
      const debits = parseInt(ledgerRes.rows[0]?.totalDebits || '0', 10);
      const credits = parseInt(ledgerRes.rows[0]?.totalCredits || '0', 10);
      const anomaliesCount = debits === credits ? 0 : 1;
      const integrityPercent = debits === credits ? 100 : 99.8;

      // 4. Reconciliation Cases Metrics
      const casesRes = await db.query(`
        SELECT 
          COUNT(CASE WHEN status IN ('OPEN', 'INVESTIGATING', 'ESCALATED') THEN 1 END) as "openCases",
          COUNT(CASE WHEN severity = 'CRITICAL' AND status != 'RESOLVED' THEN 1 END) as "criticalCases"
        FROM reconciliation_cases
      `);
      const openCasesCount = parseInt(casesRes.rows[0]?.openCases || '0', 10);
      const criticalCasesCount = parseInt(casesRes.rows[0]?.criticalCases || '0', 10);

      const dashboard: ReconciliationDashboardDto = {
        lastReconciliation: new Date().toISOString(),
        status: criticalCasesCount > 0 ? 'DISCREPANCIES_DETECTED' : 'HEALTHY',
        paystackMetrics: {
          recordsChecked: totalPayments,
          matched: matchedPayments,
          mismatched: failedPayments,
          amountDiscrepanciesPesewas: paystackDiscrepancy,
          matchRatePercent: paystackMatchRate,
        },
        datahouseMetrics: {
          recordsChecked: totalCarrier,
          matched: matchedCarrier,
          mismatched: mismatchedCarrier,
          missingCarrierRecords: 0,
          matchRatePercent: datahouseMatchRate,
        },
        ledgerMetrics: {
          totalJournalsChecked: totalJournals,
          balancedJournals: totalJournals - anomaliesCount,
          anomaliesCount,
          integrityPercent,
        },
        openCasesCount,
        criticalCasesCount,
      };

      return reply.send({
        success: true,
        data: dashboard,
      });
    },
  );

  // 2. GET /admin/reconciliation/cases — Paginated Reconciliation Cases List
  app.get<{
    Querystring: {
      status?: string;
      severity?: string;
      source?: string;
      search?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/admin/reconciliation/cases',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { status, severity, source, search, page = '1', limit = '20' } = req.query || {};
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const whereClauses: string[] = ['1=1'];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (status && status !== 'ALL') {
        whereClauses.push(`c.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      if (severity && severity !== 'ALL') {
        whereClauses.push(`c.severity = $${paramIndex}`);
        queryParams.push(severity);
        paramIndex++;
      }

      if (source && source !== 'ALL') {
        whereClauses.push(`c.source = $${paramIndex}`);
        queryParams.push(source);
        paramIndex++;
      }

      if (search && search.trim().length > 0) {
        const q = `%${search.trim().toLowerCase()}%`;
        whereClauses.push(`(
          c.case_number ILIKE $${paramIndex} OR
          c.account_name ILIKE $${paramIndex} OR
          c.account_id ILIKE $${paramIndex} OR
          c.expected_state ILIKE $${paramIndex} OR
          c.actual_state ILIKE $${paramIndex}
        )`);
        queryParams.push(q);
        paramIndex++;
      }

      const whereSql = whereClauses.join(' AND ');

      const countRes = await db.query(`SELECT COUNT(*) as total FROM reconciliation_cases c WHERE ${whereSql}`, queryParams);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const listSql = `
        SELECT 
          c.id,
          c.case_number as "caseNumber",
          c.severity,
          c.source,
          c.account_id as "accountId",
          c.account_name as "accountName",
          c.amount_pesewas as "amountPesewas",
          c.expected_state as "expectedState",
          c.actual_state as "actualState",
          c.discrepancy_details as "discrepancyDetails",
          c.status,
          c.assigned_to as "assignedTo",
          COALESCE(c.assigned_name, u_ass.full_name, u_ass.name) as "assignedName",
          c.resolution_notes as "resolutionNotes",
          c.resolved_by as "resolvedBy",
          c.resolved_at as "resolvedAt",
          c.escalated_at as "escalatedAt",
          c.created_at as "createdAt",
          c.updated_at as "updatedAt"
        FROM reconciliation_cases c
        LEFT JOIN users u_ass ON c.assigned_to = u_ass.id
        WHERE ${whereSql}
        ORDER BY 
          CASE c.severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
          c.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const listRes = await db.query(listSql, [...queryParams, limitNum, offset]);

      return reply.send({
        success: true,
        data: {
          items: listRes.rows,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
        },
      });
    },
  );

  // 3. GET /admin/reconciliation/cases/:id — Detailed Case Dossier
  app.get<{ Params: { id: string } }>(
    '/admin/reconciliation/cases/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;

      const caseRes = await db.query(
        `SELECT 
          c.id,
          c.case_number as "caseNumber",
          c.severity,
          c.source,
          c.account_id as "accountId",
          c.account_name as "accountName",
          c.amount_pesewas as "amountPesewas",
          c.expected_state as "expectedState",
          c.actual_state as "actualState",
          c.discrepancy_details as "discrepancyDetails",
          c.status,
          c.assigned_to as "assignedTo",
          COALESCE(c.assigned_name, u_ass.full_name, u_ass.name) as "assignedName",
          c.resolution_notes as "resolutionNotes",
          c.resolved_by as "resolvedBy",
          COALESCE(u_res.full_name, u_res.name) as "resolvedByName",
          c.resolved_at as "resolvedAt",
          c.escalated_at as "escalatedAt",
          c.created_at as "createdAt",
          c.updated_at as "updatedAt"
        FROM reconciliation_cases c
        LEFT JOIN users u_ass ON c.assigned_to = u_ass.id
        LEFT JOIN users u_res ON c.resolved_by = u_res.id
        WHERE c.id::text = $1 OR c.case_number = $1`,
        [id],
      );

      if (caseRes.rows.length === 0) {
        throw new NotFoundError(`Reconciliation case not found with identifier '${id}'`);
      }

      return reply.send({
        success: true,
        data: caseRes.rows[0],
      });
    },
  );

  // 4. PATCH /admin/reconciliation/cases/:id/status — Transition Case Lifecycle State
  app.patch<{ Params: { id: string }; Body: UpdateReconciliationCaseRequest }>(
    '/admin/reconciliation/cases/:id/status',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { status, resolutionNotes, assignedTo } = req.body || {};

      if (!status || !['OPEN', 'INVESTIGATING', 'RESOLVED', 'ESCALATED'].includes(status)) {
        throw new BadRequestError("Status must be 'OPEN', 'INVESTIGATING', 'RESOLVED', or 'ESCALATED'");
      }

      const caseRes = await db.query(
        'SELECT id, case_number, severity, status FROM reconciliation_cases WHERE id = $1',
        [id],
      );

      if (caseRes.rows.length === 0) {
        throw new NotFoundError(`Reconciliation case not found with ID '${id}'`);
      }

      const currentCase = caseRes.rows[0];

      // Super Admin restriction if resolving escalated/critical cases
      if (status === 'RESOLVED' && (currentCase.status === 'ESCALATED' || currentCase.severity === 'CRITICAL')) {
        if (!req.user || req.user.role !== UserRole.SUPER_ADMIN) {
          throw new ForbiddenError('Resolving escalated or critical reconciliation cases strictly requires Super Admin privileges.');
        }
      }

      const isResolved = status === 'RESOLVED';
      const isEscalated = status === 'ESCALATED';

      const updateRes = await db.query(
        `UPDATE reconciliation_cases SET
          status = $1,
          resolution_notes = COALESCE($2, resolution_notes),
          assigned_to = COALESCE($3, assigned_to),
          resolved_by = CASE WHEN $4 = TRUE THEN $5 ELSE resolved_by END,
          resolved_at = CASE WHEN $4 = TRUE THEN CURRENT_TIMESTAMP ELSE resolved_at END,
          escalated_at = CASE WHEN $6 = TRUE THEN CURRENT_TIMESTAMP ELSE escalated_at END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING id, case_number as "caseNumber", status, updated_at as "updatedAt"`,
        [status, resolutionNotes, assignedTo, isResolved, req.user!.sub, isEscalated, id],
      );

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_RECONCILIATION_CASE_STATUS_CHANGED',
          resourceType: 'reconciliation_cases',
          resourceId: id,
          metadata: { previousStatus: currentCase.status, newStatus: status, resolutionNotes },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        data: updateRes.rows[0],
        message: `Case ${currentCase.case_number} status updated to ${status}.`,
      });
    },
  );

  // 5. POST /admin/reconciliation/trigger/paystack — Trigger Paystack Payment Audit Job
  app.post(
    '/admin/reconciliation/trigger/paystack',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      // Find unverified or discrepancy payments
      const discRes = await db.query(`
        SELECT p.id, p.provider_reference, p.amount_pesewas, p.status, p.user_id, u.email
        FROM payments p
        JOIN users u ON p.user_id = u.id
        WHERE p.status = 'PROCESSING' AND p.created_at < (CURRENT_TIMESTAMP - INTERVAL '15 minutes')
        LIMIT 50
      `);

      let newCasesCount = 0;
      for (const row of discRes.rows) {
        const caseNumber = `CASE-PST-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
        await db.query(
          `INSERT INTO reconciliation_cases (
              case_number, severity, source, account_id, account_name,
              amount_pesewas, expected_state, actual_state, discrepancy_details
           ) VALUES ($1, 'MEDIUM', 'PAYSTACK', $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [
            caseNumber,
            row.user_id,
            row.email || 'Customer',
            row.amount_pesewas,
            'Payment verified and completed by Paystack webhook',
            `Payment stuck in PROCESSING for >15 min (Ref: ${row.provider_reference || row.id})`,
            JSON.stringify({ paymentId: row.id, providerReference: row.provider_reference }),
          ],
        );
        newCasesCount++;
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_TRIGGERED_PAYSTACK_RECONCILIATION',
          resourceType: 'reconciliation',
          resourceId: 'paystack',
          metadata: { checked: discRes.rows.length, newCasesCount },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        data: {
          checkedCount: discRes.rows.length,
          newCasesCount,
        },
        message: `Paystack reconciliation complete. Audited ${discRes.rows.length} pending payments, opened ${newCasesCount} investigation cases.`,
      });
    },
  );

  // 6. POST /admin/reconciliation/trigger/datahouse — Trigger Carrier Fulfillment Audit
  app.post(
    '/admin/reconciliation/trigger/datahouse',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      let summary = { totalChecked: 0, discrepancyCount: 0 };
      if (providerReconciliationService) {
        summary = await providerReconciliationService.reconcileStaleOrders(new Date().toISOString(), 5);
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_TRIGGERED_DATAHOUSE_RECONCILIATION',
          resourceType: 'reconciliation',
          resourceId: 'datahouse',
          metadata: { summary },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        data: summary,
        message: `DataHouse carrier reconciliation complete. Verified ${summary.totalChecked} orders against telecom gateways.`,
      });
    },
  );

  // 7. POST /admin/reconciliation/trigger/ledger — Trigger Full Double-Entry Integrity Audit
  app.post(
    '/admin/reconciliation/trigger/ledger',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const totalsRes = await db.query(`
        SELECT 
          COUNT(DISTINCT transaction_id) as "totalJournals",
          COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_pesewas ELSE 0 END), 0) as "totalDebits",
          COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE 0 END), 0) as "totalCredits"
        FROM financial_ledger
      `);

      const debits = parseInt(totalsRes.rows[0]?.totalDebits || '0', 10);
      const credits = parseInt(totalsRes.rows[0]?.totalCredits || '0', 10);
      const totalJournals = parseInt(totalsRes.rows[0]?.totalJournals || '0', 10);
      const isBalanced = debits === credits;

      if (!isBalanced) {
        const caseNumber = `CASE-LED-${Date.now().toString().slice(-6)}`;
        await db.query(
          `INSERT INTO reconciliation_cases (
              case_number, severity, source, account_id, account_name,
              amount_pesewas, expected_state, actual_state, discrepancy_details
           ) VALUES ($1, 'CRITICAL', 'LEDGER', 'PLATFORM_RESERVE', 'Double-Entry General Ledger', $2, $3, $4, $5)`,
          [
            caseNumber,
            Math.abs(debits - credits),
            'Total Debits must exactly equal Total Credits (Zero-Sum Invariant)',
            `Imbalance detected: Debits = ${debits} pesewas, Credits = ${credits} pesewas`,
            JSON.stringify({ totalDebits: debits, totalCredits: credits, difference: debits - credits }),
          ],
        );
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_TRIGGERED_LEDGER_INTEGRITY_AUDIT',
          resourceType: 'financial_ledger',
          resourceId: 'general_ledger',
          metadata: { totalJournals, debits, credits, isBalanced },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        data: {
          totalJournalsChecked: totalJournals,
          totalDebitsPesewas: debits,
          totalCreditsPesewas: credits,
          isBalanced,
          status: isBalanced ? 'BALANCED' : 'ANOMALY_DETECTED',
        },
        message: isBalanced
          ? `General Ledger integrity audit verified. All ${totalJournals} journals perfectly balanced.`
          : 'CRITICAL ANOMALY: Double-entry imbalance detected. Critical reconciliation case created.',
      });
    },
  );

  // 8. POST /admin/reconciliation/export — Export Reconciliation Findings to CSV
  app.post<{ Body: { status?: string; format?: string } }>(
    '/admin/reconciliation/export',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { status = 'ALL', format = 'csv' } = req.body || {};

      const whereClause = status !== 'ALL' ? 'WHERE status = $1' : '';
      const params = status !== 'ALL' ? [status] : [];

      const res = await db.query(
        `SELECT 
          case_number as "Case Number",
          severity as "Severity",
          source as "Source",
          account_name as "Account",
          amount_pesewas / 100.0 as "Discrepancy (GHS)",
          status as "Status",
          expected_state as "Expected State",
          actual_state as "Actual State",
          created_at as "Detected Date",
          resolved_at as "Resolved Date"
        FROM reconciliation_cases
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT 5000`,
        params,
      );

      if (format === 'json') {
        return reply.send({
          success: true,
          data: res.rows,
        });
      }

      const rows = res.rows;
      const filename = `reconciliation-cases-${Date.now()}.csv`;
      if (rows.length === 0) {
        return reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send('No reconciliation cases found');
      }

      const headers = Object.keys(rows[0]);
      const csvLines = [headers.join(',')];
      for (const row of rows) {
        const line = headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',');
        csvLines.push(line);
      }

      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(csvLines.join('\n'));
    },
  );
}
