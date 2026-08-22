/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../../test-setup.js';
import { MemoryRouter } from 'react-router-dom';
import {
  ResponsiveNavigation,
  ResponsivePage,
  ResponsiveContainer,
  ResponsiveGrid,
  ResponsiveCard,
  ResponsiveStatCard,
  ResponsiveDrawer,
  ResponsiveModal,
  ResponsiveFilterBar,
  ResponsiveToolbar,
  ResponsivePagination,
  ResponsiveTabs,
  ResponsiveForm,
  FormField,
  FormActions,
  ResponsiveTable,
  ResponsiveChart,
} from '../index.js';
import { LayoutDashboard, Package, Users } from 'lucide-react';

describe('ByteBeacon 2.0 — Phase 11.16 Responsive Primitives Suite', () => {
  // 1. ResponsiveNavigation
  describe('ResponsiveNavigation', () => {
    it('renders role-aware bottom navigation for admin', () => {
      const handleMore = vi.fn();
      render(
        <MemoryRouter initialEntries={['/admin/overview']}>
          <ResponsiveNavigation
            role="admin"
            onMoreClick={handleMore}
            unreadNotificationCount={3}
          />
        </MemoryRouter>
      );

      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Orders')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Alerts')).toBeInTheDocument();
      expect(screen.getByText('More')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // badge

      const moreBtn = screen.getByRole('button', { name: /more/i });
      fireEvent.click(moreBtn);
      expect(handleMore).toHaveBeenCalledTimes(1);
    });

    it('renders role-aware bottom navigation for customer', () => {
      const handleMore = vi.fn();
      render(
        <MemoryRouter initialEntries={['/app/dashboard']}>
          <ResponsiveNavigation role="customer" onMoreClick={handleMore} />
        </MemoryRouter>
      );

      expect(screen.getByText('Buy Data')).toBeInTheDocument();
      expect(screen.getByText('Wallet')).toBeInTheDocument();
    });

    it('renders role-aware bottom navigation for agent', () => {
      const handleMore = vi.fn();
      render(
        <MemoryRouter initialEntries={['/agent/dashboard']}>
          <ResponsiveNavigation role="agent" onMoreClick={handleMore} />
        </MemoryRouter>
      );

      expect(screen.getByText('Store')).toBeInTheDocument();
    });
  });

  // 2. ResponsivePage
  describe('ResponsivePage', () => {
    it('renders page header, breadcrumbs, actions, and content', () => {
      render(
        <ResponsivePage
          title="Orders Administration"
          subtitle="Real-time telecom order fulfillment"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Orders' }]}
          actions={<button type="button">Export Orders</button>}
        >
          <div>Orders Content</div>
        </ResponsivePage>
      );

      expect(screen.getByText('Orders Administration')).toBeInTheDocument();
      expect(screen.getByText('Real-time telecom order fulfillment')).toBeInTheDocument();
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Export Orders')).toBeInTheDocument();
      expect(screen.getByText('Orders Content')).toBeInTheDocument();
    });
  });

  // 3. ResponsiveContainer
  describe('ResponsiveContainer', () => {
    it('renders children with container wrapper', () => {
      render(
        <ResponsiveContainer maxWidth="xl">
          <div data-testid="container-child">Child Item</div>
        </ResponsiveContainer>
      );
      expect(screen.getByTestId('container-child')).toBeInTheDocument();
    });
  });

  // 4. ResponsiveGrid
  describe('ResponsiveGrid', () => {
    it('renders grid with multi-column layout', () => {
      render(
        <ResponsiveGrid columns={{ sm: 1, md: 2, lg: 4 }}>
          <div>Card 1</div>
          <div>Card 2</div>
        </ResponsiveGrid>
      );
      expect(screen.getByText('Card 1')).toBeInTheDocument();
      expect(screen.getByText('Card 2')).toBeInTheDocument();
    });
  });

  // 5. ResponsiveCard & ResponsiveStatCard
  describe('ResponsiveCard & ResponsiveStatCard', () => {
    it('renders card with title, subtitle, action, and footer', () => {
      render(
        <ResponsiveCard
          title="System Metrics"
          subtitle="Cluster performance"
          action={<button type="button">Refresh</button>}
          footer={<span>Footer note</span>}
        >
          <div>Card Body</div>
        </ResponsiveCard>
      );

      expect(screen.getByText('System Metrics')).toBeInTheDocument();
      expect(screen.getByText('Cluster performance')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
      expect(screen.getByText('Card Body')).toBeInTheDocument();
      expect(screen.getByText('Footer note')).toBeInTheDocument();
    });

    it('renders stat card with KPI value, trend, and subtitle', () => {
      render(
        <ResponsiveStatCard
          label="Total Revenue"
          value="GH₵ 42,500.00"
          accentColor="brand"
          trend={{ value: '12.4%', isPositive: true }}
          subtitle="vs last week"
        />
      );

      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('GH₵ 42,500.00')).toBeInTheDocument();
      expect(screen.getByText(/12.4%/)).toBeInTheDocument();
      expect(screen.getByText('vs last week')).toBeInTheDocument();
    });
  });

  // 6. ResponsiveDrawer & ResponsiveModal
  describe('ResponsiveDrawer & ResponsiveModal', () => {
    it('renders drawer and handles close action', () => {
      const handleClose = vi.fn();
      render(
        <ResponsiveDrawer
          isOpen={true}
          onClose={handleClose}
          title="Order #BB-102938"
          subtitle="Details and fulfillment timeline"
        >
          <div>Drawer Details</div>
        </ResponsiveDrawer>
      );

      expect(screen.getByText('Order #BB-102938')).toBeInTheDocument();
      expect(screen.getByText('Drawer Details')).toBeInTheDocument();

      const closeBtn = screen.getByRole('button', { name: /close drawer/i });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('renders modal with title and children', () => {
      const handleClose = vi.fn();
      render(
        <ResponsiveModal
          isOpen={true}
          onClose={handleClose}
          title="Confirm Action"
          subtitle="Please confirm before continuing"
          footer={<button type="button">Confirm</button>}
        >
          <div>Are you sure?</div>
        </ResponsiveModal>
      );

      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
      expect(screen.getByText('Are you sure?')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });
  });

  // 7. ResponsiveFilterBar & ResponsiveToolbar
  describe('ResponsiveFilterBar & ResponsiveToolbar', () => {
    it('handles search input change in filter bar', () => {
      const handleSearch = vi.fn();
      render(
        <ResponsiveFilterBar
          searchQuery="mtn"
          onSearchChange={handleSearch}
          searchPlaceholder="Filter plans..."
          filterControls={<select aria-label="Network"><option>All</option></select>}
        />
      );

      const input = screen.getByPlaceholderText('Filter plans...');
      expect(input).toHaveValue('mtn');
      fireEvent.change(input, { target: { value: 'telecel' } });
      expect(handleSearch).toHaveBeenCalledWith('telecel');
    });

    it('renders toolbar with primary action and secondary actions', () => {
      const handleSec = vi.fn();
      render(
        <ResponsiveToolbar
          primaryAction={<button type="button">Create Order</button>}
          secondaryActions={[
            { label: 'Export CSV', onClick: handleSec },
          ]}
        />
      );

      expect(screen.getByText('Create Order')).toBeInTheDocument();
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });
  });

  // 8. ResponsivePagination & ResponsiveTabs
  describe('ResponsivePagination & ResponsiveTabs', () => {
    it('renders pagination and navigates pages', () => {
      const handlePage = vi.fn();
      render(
        <ResponsivePagination
          currentPage={2}
          totalPages={5}
          totalItems={50}
          pageSize={10}
          onPageChange={handlePage}
        />
      );

      expect(screen.getByText(/2 \/ 5/)).toBeInTheDocument();
      const prevBtn = screen.getByRole('button', { name: /previous page/i });
      fireEvent.click(prevBtn);
      expect(handlePage).toHaveBeenCalledWith(1);
    });

    it('renders tabs and handles tab switching', () => {
      const handleTab = vi.fn();
      render(
        <ResponsiveTabs
          tabs={[
            { id: 'all', label: 'All Alerts', badge: 5 },
            { id: 'critical', label: 'Critical' },
          ]}
          activeTab="all"
          onTabChange={handleTab}
        />
      );

      expect(screen.getByText('All Alerts')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();

      const critTab = screen.getByRole('tab', { name: /critical/i });
      fireEvent.click(critTab);
      expect(handleTab).toHaveBeenCalledWith('critical');
    });
  });

  // 9. ResponsiveForm & ResponsiveTable & ResponsiveChart
  describe('ResponsiveForm & ResponsiveTable & ResponsiveChart', () => {
    it('renders responsive form with fields and actions', () => {
      const handleSubmit = vi.fn((e) => e.preventDefault());
      render(
        <ResponsiveForm onSubmit={handleSubmit} columns={2}>
          <FormField>
            <label htmlFor="user-name">Full Name</label>
            <input id="user-name" placeholder="John Doe" />
          </FormField>
          <FormActions>
            <button type="submit">Submit Form</button>
          </FormActions>
        </ResponsiveForm>
      );

      expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
      const submitBtn = screen.getByRole('button', { name: /submit form/i });
      fireEvent.click(submitBtn);
      expect(handleSubmit).toHaveBeenCalled();
    });

    it('renders responsive table with columns and data', () => {
      const testData = [
        { id: '1', name: 'MTN 10GB', network: 'MTN', price: 'GH₵ 20.00' },
      ];

      render(
        <ResponsiveTable
          columns={[
            { header: 'Name', accessor: 'name', priority: 'always' },
            { header: 'Network', accessor: 'network', priority: 'secondary' },
            { header: 'Price', accessor: 'price', priority: 'secondary' },
          ]}
          data={testData}
          keyExtractor={(item) => item.id}
        />
      );

      expect(screen.getAllByText('MTN 10GB').length).toBeGreaterThan(0);
      expect(screen.getAllByText('GH₵ 20.00').length).toBeGreaterThan(0);
    });

    it('renders responsive chart with accessible summary', () => {
      render(
        <ResponsiveChart
          title="Revenue Trend"
          subtitle="Past 30 days"
          accessibleSummary="Chart showing upward revenue growth of 15% over the past 30 days."
        >
          <div data-testid="chart-svg">Chart Content</div>
        </ResponsiveChart>
      );

      expect(screen.getByText('Revenue Trend')).toBeInTheDocument();
      expect(screen.getByText('Past 30 days')).toBeInTheDocument();
      expect(screen.getByTestId('chart-svg')).toBeInTheDocument();
      expect(screen.getByText(/Chart showing upward revenue growth/i)).toBeInTheDocument();
    });
  });
});
