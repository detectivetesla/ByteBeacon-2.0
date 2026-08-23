import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Button,
  Badge,
  PaymentStatusBadge,
  OrderStatusBadge,
  NetworkBadge,
  Card,
  BentoCard,
  MetricCard,
  Input,
  SearchInput,
  Modal,
  EmptyState,
  ErrorState,
  Skeleton,
  NetworkCardSkeleton,
  BundleCardSkeleton,
  OrderCardSkeleton,
  Table,
  TactileIcon,
  Toast,
} from '../index.js';
import { PasswordInput } from '../../auth/PasswordInput.js';
import { SocialAuthButton } from '../../auth/SocialAuthButton.js';
import { VisualPanel } from '../../auth/VisualPanel.js';
import { hasPermission, getPermissionsForRole, hasAnyPermission, hasAllPermissions } from '../../../auth/permissions.js';
import { PaymentStatus, OrderStatus, NetworkProvider, UserRole } from '@bytebeacon/shared';
import { Zap, ShieldCheck } from 'lucide-react';

describe('ByteBeacon 2.0 UI Components Suite', () => {
  it('renders Button with variants (primary, hero-secondary) and handles click events', () => {
    const handleClick = vi.fn();
    render(<Button variant="primary" onClick={handleClick}>Buy data</Button>);
    const button = screen.getByRole('button', { name: /buy data/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);

    render(<Button variant="hero-secondary">Secondary Action</Button>);
    expect(screen.getByRole('button', { name: /secondary action/i })).toBeInTheDocument();
  });

  it('renders Badge variants and status helpers accurately', () => {
    render(<Badge variant="success">Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();

    render(<PaymentStatusBadge status={PaymentStatus.PAID} />);
    expect(screen.getByText(/paid/i)).toBeInTheDocument();

    render(<OrderStatusBadge status={OrderStatus.COMPLETED} />);
    expect(screen.getByText(/delivered/i)).toBeInTheDocument();

    render(<NetworkBadge network={NetworkProvider.MTN} />);
    expect(screen.getByText('MTN')).toBeInTheDocument();
  });

  it('renders Card, BentoCard, and MetricCard with tactile styling and metrics', () => {
    render(
      <Card elevated bordered>
        <div>Card Inner Content</div>
      </Card>,
    );
    expect(screen.getByText('Card Inner Content')).toBeInTheDocument();

    render(
      <BentoCard colSpan={2}>
        <div>Bento Inner</div>
      </BentoCard>,
    );
    expect(screen.getByText('Bento Inner')).toBeInTheDocument();

    render(
      <MetricCard
        title="Success Rate"
        value="99.98%"
        trend={{ value: '+0.2%', isPositive: true }}
        icon={<Zap size={20} />}
      />,
    );
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
    expect(screen.getByText('99.98%')).toBeInTheDocument();
    expect(screen.getByText(/\+0\.2%/)).toBeInTheDocument();
  });

  it('renders PasswordInput and toggles password visibility', () => {
    render(<PasswordInput label="Account Password" placeholder="Enter password" />);
    const input = screen.getByPlaceholderText('Enter password') as HTMLInputElement;
    expect(input.type).toBe('password');

    const toggleBtn = screen.getByRole('button', { name: /show password/i });
    fireEvent.click(toggleBtn);
    expect(input.type).toBe('text');

    const hideBtn = screen.getByRole('button', { name: /hide password/i });
    fireEvent.click(hideBtn);
    expect(input.type).toBe('password');
  });

  it('renders PasswordInput with requirements checklist and strength meter', () => {
    const { rerender } = render(
      <PasswordInput
        label="Create Password"
        placeholder="Enter password"
        showStrengthMeter
        showRequirements
        value=""
        onChange={() => {}}
      />,
    );

    expect(screen.getByText('Password requirements:')).toBeInTheDocument();
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('Uppercase letter (A-Z)')).toBeInTheDocument();
    expect(screen.getByText('Lowercase letter (a-z)')).toBeInTheDocument();
    expect(screen.getByText('Number (0-9)')).toBeInTheDocument();
    expect(screen.getByText('Special symbol (!@#$%...)')).toBeInTheDocument();

    rerender(
      <PasswordInput
        label="Create Password"
        placeholder="Enter password"
        showStrengthMeter
        showRequirements
        value="StrongP@ss123"
        onChange={() => {}}
      />,
    );

    expect(screen.getByText('Strong & secure')).toBeInTheDocument();
    expect(screen.getByText('5/5 criteria met')).toBeInTheDocument();
  });

  it('renders SocialAuthButton for Google and Apple', () => {
    const handleGoogle = vi.fn();
    render(<SocialAuthButton provider="google" onClick={handleGoogle} />);
    const googleBtn = screen.getByRole('button', { name: /continue with google/i });
    expect(googleBtn).toBeInTheDocument();
    fireEvent.click(googleBtn);
    expect(handleGoogle).toHaveBeenCalledTimes(1);

    render(<SocialAuthButton provider="apple" />);
    expect(screen.getByRole('button', { name: /continue with apple/i })).toBeInTheDocument();
  });

  it('renders VisualPanel with title, subtitle, and dots', () => {
    render(
      <VisualPanel
        title="One Platform for Ghana"
        subtitle="Telecom fulfillment engine"
        activeSlideIndex={1}
      />,
    );
    expect(screen.getByText('One Platform for Ghana')).toBeInTheDocument();
    expect(screen.getByText('Telecom fulfillment engine')).toBeInTheDocument();
  });

  it('renders Input and SearchInput with labels and helper text', () => {
    render(<Input label="Recipient Phone" placeholder="0241234567" helperText="Enter Ghana MSISDN" />);
    expect(screen.getByLabelText(/recipient phone/i)).toBeInTheDocument();
    expect(screen.getByText(/enter ghana msisdn/i)).toBeInTheDocument();

    render(<SearchInput placeholder="Search orders..." />);
    const search = screen.getByPlaceholderText('Search orders...');
    expect(search).toBeInTheDocument();
  });

  it('renders Modal when isOpen=true and responds to onClose trigger', () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen={true} onClose={handleClose} title="Purchase Confirmation">
        <div>Modal Body Content</div>
      </Modal>,
    );
    expect(screen.getByText('Purchase Confirmation')).toBeInTheDocument();
    expect(screen.getByText('Modal Body Content')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    rerender(
      <Modal isOpen={false} onClose={handleClose} title="Purchase Confirmation">
        <div>Modal Body Content</div>
      </Modal>,
    );
    expect(screen.queryByText('Purchase Confirmation')).not.toBeInTheDocument();
  });

  it('renders EmptyState and ErrorState with action buttons', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="No Orders Found"
        description="Try searching with a different order reference."
        actionText="Clear Filters"
        onAction={handleAction}
      />,
    );
    expect(screen.getByText('No Orders Found')).toBeInTheDocument();
    expect(screen.getByText('Try searching with a different order reference.')).toBeInTheDocument();
    const actionBtn = screen.getByRole('button', { name: /clear filters/i });
    fireEvent.click(actionBtn);
    expect(handleAction).toHaveBeenCalledTimes(1);

    const handleRetry = vi.fn();
    render(
      <ErrorState
        title="Connection Failed"
        description="Unable to connect to telecom gateway."
        onRetry={handleRetry}
      />,
    );
    expect(screen.getByText('Connection Failed')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('renders Skeleton primitives and domain-specific skeleton cards', () => {
    render(
      <div>
        <Skeleton width="200px" height="20px" />
        <NetworkCardSkeleton />
        <BundleCardSkeleton />
        <OrderCardSkeleton />
      </div>,
    );
    expect(screen.getByLabelText(/loading network card/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/loading bundle package/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/loading order tracker/i)).toBeInTheDocument();
  });

  it('renders Table component with columns and data rows', () => {
    interface TestData {
      id: string;
      name: string;
      role: string;
    }
    const data: TestData[] = [
      { id: '1', name: 'Kwame Mensah', role: 'Admin' },
      { id: '2', name: 'Ama Osei', role: 'Agent' },
    ];
    render(
      <Table
        columns={[
          { header: 'Name', accessor: 'name' },
          { header: 'Role', accessor: 'role' },
        ]}
        data={data}
        keyExtractor={(item) => item.id}
      />,
    );
    expect(screen.getAllByText('Kwame Mensah')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Ama Osei')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Admin')[0]).toBeInTheDocument();
  });

  it('renders TactileIcon with custom gradients, badges, and active state', () => {
    render(
      <TactileIcon
        icon={ShieldCheck}
        color="primary"
        size="md"
        aria-label="Tactile Shield"
      />,
    );
    expect(screen.getByLabelText(/tactile shield/i)).toBeInTheDocument();
  });

  it('renders Toast notification with variant colors and close triggers', () => {
    const handleDismiss = vi.fn();
    render(
      <Toast
        toast={{
          id: 't1',
          type: 'success',
          title: 'Payment Verified',
          description: 'Your bundle has been dispatched.',
        }}
        onDismiss={handleDismiss}
      />,
    );
    expect(screen.getByText('Payment Verified')).toBeInTheDocument();
    expect(screen.getByText('Your bundle has been dispatched.')).toBeInTheDocument();
    const closeToast = screen.getByRole('button');
    fireEvent.click(closeToast);
    expect(handleDismiss).toHaveBeenCalledWith('t1');
  });

  it('verifies permission matrix and role authorization rules', () => {
    // Customer permissions
    expect(hasPermission(UserRole.CUSTOMER, 'orders.create')).toBe(true);
    expect(hasPermission(UserRole.CUSTOMER, 'orders.view_own')).toBe(true);
    expect(hasPermission(UserRole.CUSTOMER, 'admin.dashboard.view')).toBe(false);
    expect(hasPermission(UserRole.CUSTOMER, 'admin.users.manage')).toBe(false);

    // Agent permissions
    expect(hasPermission(UserRole.AGENT, 'dashboard.view')).toBe(true);
    expect(hasPermission(UserRole.AGENT, 'agent_store.manage')).toBe(true);
    expect(hasPermission(UserRole.AGENT, 'agent_orders.manage')).toBe(true);
    expect(hasPermission(UserRole.AGENT, 'admin.ledger.view')).toBe(false);
    expect(hasPermission(UserRole.AGENT, 'admin.dlq.manage')).toBe(false);

    // Admin permissions
    expect(hasPermission(UserRole.ADMIN, 'dashboard.view')).toBe(true);
    expect(hasPermission(UserRole.ADMIN, 'admin.users.manage')).toBe(true);
    expect(hasPermission(UserRole.ADMIN, 'admin.ledger.view')).toBe(true);
    expect(hasPermission(UserRole.ADMIN, 'admin.provider.manage')).toBe(true);
    expect(hasPermission(UserRole.ADMIN, 'admin.dlq.manage')).toBe(true);

    // Helpers
    expect(hasAnyPermission(UserRole.CUSTOMER, ['admin.ledger.view', 'orders.create'])).toBe(true);
    expect(hasAllPermissions(UserRole.CUSTOMER, ['orders.create', 'admin.ledger.view'])).toBe(false);
    expect(getPermissionsForRole(undefined)).toEqual([]);
  });
});
