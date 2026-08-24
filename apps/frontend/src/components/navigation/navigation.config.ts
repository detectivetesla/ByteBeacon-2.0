import React from 'react';
import { PermissionKey } from '../../auth/permissions.js';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Compass,
  Wallet,
  History,
  Settings,
  Store,
  ShoppingBag,
  Users,
  Key,
  BarChart3,
  Activity,
  CreditCard,
  Database,
  RefreshCw,
  Cpu,
  AlertOctagon,
  FileText,
  Bell,
  Clock,
  RotateCcw,
  Terminal,
  Webhook,
  BookOpen,
  User,
  ArrowDownToLine,
  Globe,
  Palette,
  DollarSign,
  Mail,
} from 'lucide-react';

export interface NavItemConfig {
  label: string;
  path: string;
  icon: React.ReactElement;
  permission: PermissionKey;
  badge?: string;
  color?: string;
}

export interface NavGroupConfig {
  title: string;
  items: NavItemConfig[];
}

/* =========================================================================
   CUSTOMER NAVIGATION GROUPS
   ========================================================================= */
export const CUSTOMER_NAVIGATION_GROUPS: NavGroupConfig[] = [
  {
    title: 'Main',
    items: [
      {
        label: 'Overview',
        path: '/app/dashboard',
        icon: React.createElement(LayoutDashboard, { size: 18, strokeWidth: 2.4, color: '#3B82F6' }),
        permission: 'dashboard.view',
        color: '#3B82F6',
      },
      {
        label: 'Buy Data',
        path: '/app/buy-data',
        icon: React.createElement(ShoppingCart, { size: 18, strokeWidth: 2.4, color: '#22C55E' }),
        permission: 'orders.create',
        color: '#22C55E',
      },
      {
        label: 'My Orders',
        path: '/app/orders',
        icon: React.createElement(Package, { size: 18, strokeWidth: 2.4, color: '#3B82F6' }),
        permission: 'orders.view_own',
        color: '#3B82F6',
      },
      {
        label: 'Track Order',
        path: '/app/track',
        icon: React.createElement(Compass, { size: 18, strokeWidth: 2.4, color: '#8B5CF6' }),
        permission: 'orders.view_own',
        color: '#8B5CF6',
      },
      {
        label: 'Pending MTN Approvals',
        path: '/app/pending-approvals',
        icon: React.createElement(Clock, { size: 18, strokeWidth: 2.4, color: '#FFCC00' }),
        permission: 'orders.view_own',
        color: '#FFCC00',
      },
    ],
  },
  {
    title: 'Money',
    items: [
      {
        label: 'Wallet',
        path: '/app/wallet',
        icon: React.createElement(Wallet, { size: 18, strokeWidth: 2.4, color: '#F59E0B' }),
        permission: 'wallet.view_own',
        color: '#F59E0B',
      },
      {
        label: 'Transactions',
        path: '/app/transactions',
        icon: React.createElement(History, { size: 18, strokeWidth: 2.4, color: '#06B6D4' }),
        permission: 'transactions.view_own',
        color: '#06B6D4',
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        label: 'Notifications',
        path: '/app/notifications',
        icon: React.createElement(Bell, { size: 18, strokeWidth: 2.4, color: '#8B5CF6' }),
        permission: 'profile.manage',
        color: '#8B5CF6',
      },
      {
        label: 'Profile',
        path: '/app/profile',
        icon: React.createElement(User, { size: 18, strokeWidth: 2.4, color: '#10B981' }),
        permission: 'profile.manage',
        color: '#10B981',
      },
      {
        label: 'Settings',
        path: '/app/settings',
        icon: React.createElement(Settings, { size: 18, strokeWidth: 2.4, color: '#64748B' }),
        permission: 'profile.manage',
        color: '#64748B',
      },
    ],
  },
];

export const CUSTOMER_NAVIGATION: NavItemConfig[] = CUSTOMER_NAVIGATION_GROUPS.flatMap((g) => g.items);

/* =========================================================================
   AGENT NAVIGATION GROUPS
   ========================================================================= */
export const AGENT_NAVIGATION_GROUPS: NavGroupConfig[] = [
  {
    title: 'Main',
    items: [
      {
        label: 'Overview',
        path: '/agent/dashboard',
        icon: React.createElement(LayoutDashboard, { size: 18, strokeWidth: 2.4, color: '#3B82F6' }),
        permission: 'dashboard.view',
        color: '#3B82F6',
      },
      {
        label: 'Buy Data',
        path: '/agent/buy-data',
        icon: React.createElement(ShoppingCart, { size: 18, strokeWidth: 2.4, color: '#22C55E' }),
        permission: 'orders.create',
        color: '#22C55E',
      },
      {
        label: 'Orders',
        path: '/agent/orders',
        icon: React.createElement(ShoppingBag, { size: 18, strokeWidth: 2.4, color: '#3B82F6' }),
        permission: 'agent_orders.manage',
        color: '#3B82F6',
      },
      {
        label: 'Track Order',
        path: '/agent/track',
        icon: React.createElement(Compass, { size: 18, strokeWidth: 2.4, color: '#8B5CF6' }),
        permission: 'agent_orders.manage',
        color: '#8B5CF6',
      },
      {
        label: 'Pending MTN Approvals',
        path: '/agent/pending-approvals',
        icon: React.createElement(Clock, { size: 18, strokeWidth: 2.4, color: '#FFCC00' }),
        permission: 'agent_orders.manage',
        color: '#FFCC00',
        badge: '2',
      },
      {
        label: 'Sub Agents',
        path: '/agent/customers',
        icon: React.createElement(Users, { size: 18, strokeWidth: 2.4, color: '#6366F1' }),
        permission: 'agent_customers.manage',
        color: '#6366F1',
      },
    ],
  },
  {
    title: 'Money',
    items: [
      {
        label: 'Wallet',
        path: '/agent/wallet',
        icon: React.createElement(Wallet, { size: 18, strokeWidth: 2.4, color: '#0EA5E9' }),
        permission: 'agent_wallet.manage',
        color: '#0EA5E9',
      },
      {
        label: 'Withdrawals',
        path: '/agent/withdrawals',
        icon: React.createElement(ArrowDownToLine, { size: 18, strokeWidth: 2.4, color: '#10B981' }),
        permission: 'agent_wallet.manage',
        color: '#10B981',
      },
      {
        label: 'Refunds',
        path: '/agent/refund-reports',
        icon: React.createElement(RotateCcw, { size: 18, strokeWidth: 2.4, color: '#6366F1' }),
        permission: 'agent_wallet.manage',
        color: '#6366F1',
      },
    ],
  },
  {
    title: 'Store',
    items: [
      {
        label: 'Storefront Setup',
        path: '/agent/store',
        icon: React.createElement(Store, { size: 18, strokeWidth: 2.4, color: '#F97316' }),
        permission: 'agent_store.manage',
        color: '#F97316',
      },
    ],
  },
  {
    title: 'Developer',
    items: [
      {
        label: 'API Keys',
        path: '/agent/api',
        icon: React.createElement(Key, { size: 18, strokeWidth: 2.4, color: '#8B5CF6' }),
        permission: 'agent_api.manage',
        color: '#8B5CF6',
      },
      {
        label: 'Sandbox',
        path: '/agent/sandbox',
        icon: React.createElement(Terminal, { size: 18, strokeWidth: 2.4, color: '#38BDF8' }),
        permission: 'agent_api.manage',
        color: '#38BDF8',
      },
      {
        label: 'API Usage',
        path: '/agent/api-usage',
        icon: React.createElement(Activity, { size: 18, strokeWidth: 2.4, color: '#8B5CF6' }),
        permission: 'agent_api.manage',
        color: '#8B5CF6',
      },
      {
        label: 'Webhooks',
        path: '/agent/webhooks',
        icon: React.createElement(Webhook, { size: 18, strokeWidth: 2.4, color: '#EC4899' }),
        permission: 'agent_api.manage',
        color: '#EC4899',
      },
      {
        label: 'API Docs',
        path: '/agent/docs',
        icon: React.createElement(BookOpen, { size: 18, strokeWidth: 2.4, color: '#3B82F6' }),
        permission: 'agent_api.manage',
        color: '#3B82F6',
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        label: 'Profile',
        path: '/agent/profile',
        icon: React.createElement(User, { size: 18, strokeWidth: 2.4, color: '#3B82F6' }),
        permission: 'profile.manage',
        color: '#3B82F6',
      },
      {
        label: 'Notifications',
        path: '/agent/notifications',
        icon: React.createElement(Bell, { size: 18, strokeWidth: 2.4, color: '#8B5CF6' }),
        permission: 'profile.manage',
        color: '#8B5CF6',
      },
      {
        label: 'Settings',
        path: '/agent/settings',
        icon: React.createElement(Settings, { size: 18, strokeWidth: 2.4, color: '#64748B' }),
        permission: 'profile.manage',
        color: '#64748B',
      },
    ],
  },
];

export const AGENT_NAVIGATION: NavItemConfig[] = AGENT_NAVIGATION_GROUPS.flatMap((g) => g.items);

/* =========================================================================
   AGENT STORE CONSOLE NAVIGATION GROUPS (Separate Standalone Portal)
   ========================================================================= */
export const STORE_NAVIGATION_GROUPS: NavGroupConfig[] = [
  {
    title: 'Store',
    items: [
      {
        label: 'Overview',
        path: '/store-console/overview',
        icon: React.createElement(LayoutDashboard, { size: 18, strokeWidth: 2.4, color: '#3B82F6' }),
        permission: 'agent_store.manage',
        color: '#3B82F6',
      },
      {
        label: 'Orders',
        path: '/store-console/orders',
        icon: React.createElement(ShoppingBag, { size: 18, strokeWidth: 2.4, color: '#8B5CF6' }),
        permission: 'agent_store.manage',
        color: '#8B5CF6',
      },
      {
        label: 'Products',
        path: '/store-console/products',
        icon: React.createElement(Package, { size: 18, strokeWidth: 2.4, color: '#10B981' }),
        permission: 'agent_store.manage',
        color: '#10B981',
      },
      {
        label: 'Customers',
        path: '/store-console/customers',
        icon: React.createElement(Users, { size: 18, strokeWidth: 2.4, color: '#06B6D4' }),
        permission: 'agent_store.manage',
        color: '#06B6D4',
      },
      {
        label: 'Analytics',
        path: '/store-console/analytics',
        icon: React.createElement(BarChart3, { size: 18, strokeWidth: 2.4, color: '#A855F7' }),
        permission: 'agent_store.manage',
        color: '#A855F7',
      },
    ],
  },
  {
    title: 'Storefront',
    items: [
      {
        label: 'Store Profile',
        path: '/store-console/profile',
        icon: React.createElement(Store, { size: 18, strokeWidth: 2.4, color: '#3B82F6' }),
        permission: 'agent_store.manage',
        color: '#3B82F6',
      },
      {
        label: 'Store Appearance',
        path: '/store-console/appearance',
        icon: React.createElement(Palette, { size: 18, strokeWidth: 2.4, color: '#EC4899' }),
        permission: 'agent_store.manage',
        color: '#EC4899',
      },
      {
        label: 'Store Link',
        path: '/store-console/link',
        icon: React.createElement(Globe, { size: 18, strokeWidth: 2.4, color: '#10B981' }),
        permission: 'agent_store.manage',
        color: '#10B981',
      },
    ],
  },
  {
    title: 'Finance',
    items: [
      {
        label: 'Revenue',
        path: '/store-console/finance',
        icon: React.createElement(DollarSign, { size: 18, strokeWidth: 2.4, color: '#10B981' }),
        permission: 'agent_store.manage',
        color: '#10B981',
      },
      {
        label: 'Transactions',
        path: '/store-console/transactions',
        icon: React.createElement(History, { size: 18, strokeWidth: 2.4, color: '#F59E0B' }),
        permission: 'agent_store.manage',
        color: '#F59E0B',
      },
    ],
  },
  {
    title: 'Support & Settings',
    items: [
      {
        label: 'Notifications',
        path: '/store-console/notifications',
        icon: React.createElement(Bell, { size: 18, strokeWidth: 2.4, color: '#8B5CF6' }),
        permission: 'agent_store.manage',
        color: '#8B5CF6',
      },
      {
        label: 'Settings',
        path: '/store-console/settings',
        icon: React.createElement(Settings, { size: 18, strokeWidth: 2.4, color: '#64748B' }),
        permission: 'agent_store.manage',
        color: '#64748B',
      },
    ],
  },
];

export const STORE_NAVIGATION: NavItemConfig[] = STORE_NAVIGATION_GROUPS.flatMap((g) => g.items);

/* =========================================================================
   ADMIN NAVIGATION GROUPS
   ========================================================================= */
export const ADMIN_NAVIGATION_GROUPS: NavGroupConfig[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Overview',
        path: '/admin/overview',
        icon: React.createElement(Activity, { size: 18, strokeWidth: 2.4, color: '#8B5CF6' }),
        permission: 'admin.dashboard.view',
        color: '#8B5CF6',
      },
      {
        label: 'Analytics',
        path: '/admin/analytics',
        icon: React.createElement(BarChart3, { size: 18, strokeWidth: 2.4, color: '#3B82F6' }),
        permission: 'admin.analytics.view',
        color: '#3B82F6',
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        label: 'Orders',
        path: '/admin/orders',
        icon: React.createElement(Package, { size: 18, strokeWidth: 2.4, color: '#3B82F6' }),
        permission: 'admin.orders.manage',
        color: '#3B82F6',
      },
      {
        label: 'Pending Approvals',
        path: '/admin/pending-approvals',
        icon: React.createElement(Clock, { size: 18, strokeWidth: 2.4, color: '#FFCC00' }),
        permission: 'admin.orders.manage',
        color: '#FFCC00',
      },
      {
        label: 'Failed Queue (DLQ)',
        path: '/admin/dlq',
        icon: React.createElement(AlertOctagon, { size: 18, strokeWidth: 2.4, color: '#EF4444' }),
        permission: 'admin.dlq.manage',
        color: '#EF4444',
      },
      {
        label: 'Reconciliation',
        path: '/admin/reconciliation',
        icon: React.createElement(RefreshCw, { size: 18, strokeWidth: 2.4, color: '#06B6D4' }),
        permission: 'admin.reconciliation.manage',
        color: '#06B6D4',
      },
    ],
  },
  {
    title: 'People & Access',
    items: [
      {
        label: 'User Directory',
        path: '/admin/users',
        icon: React.createElement(Users, { size: 18, strokeWidth: 2.4, color: '#3B82F6' }),
        permission: 'admin.users.manage',
        color: '#3B82F6',
      },
      {
        label: 'Agents',
        path: '/admin/agents',
        icon: React.createElement(User, { size: 18, strokeWidth: 2.4, color: '#10B981' }),
        permission: 'admin.agents.manage',
        color: '#10B981',
      },
    ],
  },
  {
    title: 'Commerce',
    items: [
      {
        label: 'Data Plans',
        path: '/admin/bundles',
        icon: React.createElement(ShoppingBag, { size: 18, strokeWidth: 2.4, color: '#EC4899' }),
        permission: 'admin.bundles.manage',
        color: '#EC4899',
      },
      {
        label: 'Agent Stores',
        path: '/admin/stores',
        icon: React.createElement(Store, { size: 18, strokeWidth: 2.4, color: '#F97316' }),
        permission: 'admin.users.manage',
        color: '#F97316',
      },
      {
        label: 'Networks & Providers',
        path: '/admin/provider',
        icon: React.createElement(Cpu, { size: 18, strokeWidth: 2.4, color: '#22C55E' }),
        permission: 'admin.provider.manage',
        color: '#22C55E',
      },
    ],
  },
  {
    title: 'Finance',
    items: [
      {
        label: 'Payments',
        path: '/admin/payments',
        icon: React.createElement(CreditCard, { size: 18, strokeWidth: 2.4, color: '#22C55E' }),
        permission: 'admin.payments.manage',
        color: '#22C55E',
      },
      {
        label: 'Transactions & Ledger',
        path: '/admin/ledger',
        icon: React.createElement(Database, { size: 18, strokeWidth: 2.4, color: '#F59E0B' }),
        permission: 'admin.ledger.view',
        color: '#F59E0B',
      },
    ],
  },
  {
    title: 'Communication',
    items: [
      {
        label: 'Broadcasts & Email',
        path: '/admin/communications',
        icon: React.createElement(Mail, { size: 18, strokeWidth: 2.4, color: '#6366F1' }),
        permission: 'admin.communications.manage',
        color: '#6366F1',
      },
      {
        label: 'Notifications',
        path: '/admin/notifications',
        icon: React.createElement(Bell, { size: 18, strokeWidth: 2.4, color: '#8B5CF6' }),
        permission: 'admin.dashboard.view',
        color: '#8B5CF6',
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        label: 'API & Developer Platform',
        path: '/admin/api-management',
        icon: React.createElement(Key, { size: 18, strokeWidth: 2.4, color: '#3B82F6' }),
        permission: 'admin.settings.manage',
        color: '#3B82F6',
      },
      {
        label: 'Audit Stream',
        path: '/admin/audit',
        icon: React.createElement(FileText, { size: 18, strokeWidth: 2.4, color: '#64748B' }),
        permission: 'admin.audit.view',
        color: '#64748B',
      },
      {
        label: 'Settings',
        path: '/admin/settings',
        icon: React.createElement(Settings, { size: 18, strokeWidth: 2.4, color: '#64748B' }),
        permission: 'admin.settings.manage',
        color: '#64748B',
      },
    ],
  },
];

export const ADMIN_NAVIGATION: NavItemConfig[] = ADMIN_NAVIGATION_GROUPS.flatMap((g) => g.items);
