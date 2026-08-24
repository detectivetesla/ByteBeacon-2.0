import { describe, it, expect } from 'vitest';
import { UserRole } from '@bytebeacon/shared';
import {
  getPermissionsForRole,
  hasPermission,
} from '../auth/permissions.js';
import {
  CUSTOMER_NAVIGATION,
  AGENT_NAVIGATION,
  ADMIN_NAVIGATION,
} from '../components/navigation/navigation.config.js';
import {
  mapToPresentationOrderStatus,
  mapToPresentationPaymentStatus,
} from '../utils/presentation-status.js';

describe('ByteBeacon 2.0 — RBAC Permissions Architecture', () => {
  it('Customer role should strictly possess customer permissions only', () => {
    const customerPerms = getPermissionsForRole(UserRole.CUSTOMER);

    expect(customerPerms).toContain('dashboard.view');
    expect(customerPerms).toContain('bundles.browse');
    expect(customerPerms).toContain('orders.create');
    expect(customerPerms).toContain('orders.view_own');
    expect(customerPerms).toContain('wallet.view_own');

    // Ensure customer has ZERO administrative or agent management capabilities
    expect(customerPerms).not.toContain('admin.users.manage');
    expect(customerPerms).not.toContain('admin.orders.manage');
    expect(customerPerms).not.toContain('admin.payments.manage');
    expect(customerPerms).not.toContain('admin.ledger.view');
    expect(customerPerms).not.toContain('admin.dlq.manage');
    expect(customerPerms).not.toContain('agent_store.manage');
  });

  it('Agent role should possess agent and customer permissions but NOT admin permissions', () => {
    const agentPerms = getPermissionsForRole(UserRole.AGENT);

    expect(agentPerms).toContain('dashboard.view');
    expect(agentPerms).toContain('agent_store.manage');
    expect(agentPerms).toContain('agent_orders.manage');
    expect(agentPerms).toContain('agent_wallet.manage');
    expect(agentPerms).toContain('agent_customers.manage');
    expect(agentPerms).toContain('agent_api.manage');

    // Ensure agent has ZERO administrative capabilities
    expect(agentPerms).not.toContain('admin.users.manage');
    expect(agentPerms).not.toContain('admin.ledger.view');
    expect(agentPerms).not.toContain('admin.reconciliation.manage');
    expect(agentPerms).not.toContain('admin.dlq.manage');
  });

  it('Admin and Super Admin roles should possess all system capabilities', () => {
    const adminPerms = getPermissionsForRole(UserRole.ADMIN);
    const superAdminPerms = getPermissionsForRole(UserRole.SUPER_ADMIN);

    expect(adminPerms).toContain('admin.dashboard.view');
    expect(adminPerms).toContain('admin.users.manage');
    expect(adminPerms).toContain('admin.orders.manage');
    expect(adminPerms).toContain('admin.ledger.view');
    expect(adminPerms).toContain('admin.dlq.manage');

    expect(superAdminPerms).toContain('admin.dashboard.view');
    expect(superAdminPerms).toContain('admin.users.manage');
    expect(superAdminPerms).toContain('admin.dlq.manage');
  });

  it('hasPermission helper should return correct boolean values', () => {
    expect(hasPermission(UserRole.CUSTOMER, 'orders.create')).toBe(true);
    expect(hasPermission(UserRole.CUSTOMER, 'admin.users.manage')).toBe(false);
    expect(hasPermission(UserRole.AGENT, 'agent_store.manage')).toBe(true);
    expect(hasPermission(UserRole.AGENT, 'admin.dlq.manage')).toBe(false);
    expect(hasPermission(UserRole.ADMIN, 'admin.dlq.manage')).toBe(true);
    expect(hasPermission(undefined, 'orders.create')).toBe(false);
  });
});

describe('ByteBeacon 2.0 — Navigation Permission Filtering', () => {
  it('Customer navigation should contain only permitted customer items', () => {
    const customerPerms = getPermissionsForRole(UserRole.CUSTOMER);
    const visibleNav = CUSTOMER_NAVIGATION.filter((item) => customerPerms.includes(item.permission));

    const paths = visibleNav.map((n) => n.path);
    expect(paths).toContain('/app/dashboard');
    expect(paths).toContain('/app/buy-data');
    expect(paths).toContain('/app/orders');
    expect(paths).toContain('/app/pending-approvals');
    expect(paths).toContain('/app/wallet');
    expect(paths).toContain('/app/transactions');
    expect(paths).toContain('/app/settings');

    // No admin or agent paths allowed
    expect(paths.some((p) => p.startsWith('/admin'))).toBe(false);
    expect(paths.some((p) => p.startsWith('/agent'))).toBe(false);
  });

  it('Agent navigation should contain only agent-permitted items', () => {
    const agentPerms = getPermissionsForRole(UserRole.AGENT);
    const visibleNav = AGENT_NAVIGATION.filter((item) => agentPerms.includes(item.permission));

    const paths = visibleNav.map((n) => n.path);
    expect(paths).toContain('/agent/dashboard');
    expect(paths).toContain('/agent/store');
    expect(paths).toContain('/agent/orders');
    expect(paths).toContain('/agent/wallet');
    expect(paths).toContain('/agent/customers');
    expect(paths).toContain('/agent/api');

    // No admin paths allowed
    expect(paths.some((p) => p.startsWith('/admin'))).toBe(false);
  });

  it('Admin navigation should contain all operations modules', () => {
    const adminPerms = getPermissionsForRole(UserRole.ADMIN);
    const visibleNav = ADMIN_NAVIGATION.filter((item) => adminPerms.includes(item.permission));

    const paths = visibleNav.map((n) => n.path);
    expect(paths).toContain('/admin/overview');
    expect(paths).toContain('/admin/users');
    expect(paths).toContain('/admin/orders');
    expect(paths).toContain('/admin/payments');
    expect(paths).toContain('/admin/ledger');
    expect(paths).toContain('/admin/reconciliation');
    expect(paths).toContain('/admin/provider');
    expect(paths).toContain('/admin/dlq');
    expect(paths).toContain('/admin/audit');
    expect(paths).toContain('/admin/settings');
  });
});

describe('ByteBeacon 2.0 — Presentation-Safe Status Sanitization', () => {
  it('Should map delivered/completed statuses to Delivered with success badge', () => {
    const res = mapToPresentationOrderStatus('COMPLETED');
    expect(res.status).toBe('DELIVERED');
    expect(res.label).toBe('Delivered');
    expect(res.badgeVariant).toBe('success');
    expect(res.customerMessage).toContain('delivered successfully');
  });

  it('Should sanitize internal operational and DLQ states to customer-safe Processing/Unable to complete', () => {
    // Internal operational states
    const provPending = mapToPresentationOrderStatus('PROVIDER_PENDING');
    expect(provPending.status).toBe('PROCESSING');
    expect(provPending.label).toBe('Processing');
    expect(provPending.customerMessage).not.toContain('GMPL');
    expect(provPending.customerMessage).not.toContain('DataHouse');
    expect(provPending.customerMessage).not.toContain('PROVIDER');

    const reconciling = mapToPresentationOrderStatus('RECONCILING');
    expect(reconciling.status).toBe('PROCESSING');

    const dlq = mapToPresentationOrderStatus('DLQ');
    expect(dlq.status).toBe('UNABLE_TO_COMPLETE');
    expect(dlq.label).toBe('Unable to complete');
    expect(dlq.customerMessage).not.toContain('DLQ');
    expect(dlq.customerMessage).not.toContain('Dead Letter');
  });

  it('Should map payment statuses correctly', () => {
    expect(mapToPresentationPaymentStatus('PAID').label).toBe('Paid');
    expect(mapToPresentationPaymentStatus('PAID').badgeVariant).toBe('success');
    expect(mapToPresentationPaymentStatus('FAILED').label).toBe('Failed');
    expect(mapToPresentationPaymentStatus('FAILED').badgeVariant).toBe('danger');
    expect(mapToPresentationPaymentStatus('PENDING').label).toBe('Pending');
    expect(mapToPresentationPaymentStatus('PENDING').badgeVariant).toBe('warning');
  });
});
