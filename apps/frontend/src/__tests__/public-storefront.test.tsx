import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PublicStorefrontPage } from '../pages/public/PublicStorefrontPage.js';
import { ToastProvider } from '../context/ToastContext.js';
import { PlatformStatusProvider } from '../context/PlatformStatusContext.js';
import { storesApi } from '../api/stores.api.js';
import { ordersApi } from '../api/orders.api.js';
import { NetworkProvider, Currency, PaymentStatus, OrderStatus } from '@bytebeacon/shared';


// Mock storesApi and ordersApi
vi.mock('../api/stores.api.js', () => ({
  storesApi: {
    getPublicStore: vi.fn(),
    publicCheckout: vi.fn(),
    verifyPublicPayment: vi.fn(),
    getStore: vi.fn(),
  },
  STOREFRONT_CONFIG: {
    PUBLIC_STOREFRONT_BASE_URL: 'https://apisolutions.store/store',
    getStoreUrl: (slug: string) => `https://apisolutions.store/store/${slug}`,
    getRelativeStorePath: (slug: string) => `/store/${slug}`,
    getWhatsAppUrl: (phone: string, _storeName?: string) => `https://wa.me/233${phone}`,
  },
}));

vi.mock('../api/orders.api.js', () => ({
  ordersApi: {
    trackOrder: vi.fn(),
    createOrder: vi.fn(),
  },
}));

describe('Public Customer Storefront Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders active store branding, products, and calculates authoritative retail prices', async () => {
    vi.mocked(storesApi.getPublicStore).mockResolvedValueOnce({
      store: {
        id: 'str_123',
        userId: 'usr_agent_1',
        storeName: 'DataHub Express',
        slug: 'datahub-express',
        tagline: 'Instant Automated Telecom Data Bundles 24/7',
        description: 'Direct automated delivery of MTN, Telecel, and AirtelTigo bundles across Ghana.',
        primaryColor: '#0066FF',
        accentColor: '#10B981',
        contactPhone: '0244123456',
        contactEmail: 'support@datahubexpress.com',
        contactWhatsapp: '+233244123456',
        paymentStatus: 'PAID',
        approvalStatus: 'APPROVED',
        storeStatus: 'ACTIVE',
        activationFeePesewas: 50000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      products: [
        {
          id: 'sp_1',
          catalogProductId: 'cp_1',
          sku: 'MTN-10GB',
          name: 'MTN 10GB Turbo',
          network: NetworkProvider.MTN,
          dataAmountMb: 10240,
          validityDays: 30,
          validityDesc: 'Non-Expiry',
          basePricePesewas: 4500,
          markupPesewas: 300,
          retailPricePesewas: 4800, // GH₵ 48.00
          popular: true,
        },
        {
          id: 'sp_2',
          catalogProductId: 'cp_2',
          sku: 'TELECEL-5GB',
          name: 'Telecel 5GB Fast',
          network: NetworkProvider.TELECEL,
          dataAmountMb: 5120,
          validityDays: 30,
          validityDesc: '30 Days',
          basePricePesewas: 2200,
          markupPesewas: 200,
          retailPricePesewas: 2400, // GH₵ 24.00
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/store/datahub-express']}>
        <PlatformStatusProvider>
          <ToastProvider>
            <Routes>
              <Route path="/store/:slug" element={<PublicStorefrontPage />} />
            </Routes>
          </ToastProvider>
        </PlatformStatusProvider>
      </MemoryRouter>
    );

    // Verify merchant branding loads
    expect(await screen.findByText('DataHub Express')).toBeInTheDocument();
    expect(screen.getByText('Verified Merchant')).toBeInTheDocument();
    expect(screen.getByText('Instant Automated Telecom Data Bundles 24/7')).toBeInTheDocument();
    expect(screen.getByText('10 GB')).toBeInTheDocument();
    expect(screen.getByText('GH₵ 48.00')).toBeInTheDocument();
    expect(screen.getByText('Non-Expiry')).toBeInTheDocument();
  });

  it('allows switching networks and filters products appropriately', async () => {
    vi.mocked(storesApi.getPublicStore).mockResolvedValueOnce({
      store: {
        id: 'str_123',
        userId: 'usr_agent_1',
        storeName: 'DataHub Express',
        slug: 'datahub-express',
        tagline: 'Instant Data',
        description: 'Direct delivery',
        primaryColor: '#0066FF',
        accentColor: '#10B981',
        paymentStatus: 'PAID',
        approvalStatus: 'APPROVED',
        storeStatus: 'ACTIVE',
        activationFeePesewas: 50000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      products: [
        {
          id: 'sp_1',
          catalogProductId: 'cp_1',
          sku: 'MTN-10GB',
          name: 'MTN 10GB Turbo',
          network: NetworkProvider.MTN,
          dataAmountMb: 10240,
          validityDays: 30,
          basePricePesewas: 4500,
          markupPesewas: 300,
          retailPricePesewas: 4800,
        },
        {
          id: 'sp_2',
          catalogProductId: 'cp_2',
          sku: 'TELECEL-5GB',
          name: 'Telecel 5GB Fast',
          network: NetworkProvider.TELECEL,
          dataAmountMb: 5120,
          validityDays: 30,
          basePricePesewas: 2200,
          markupPesewas: 200,
          retailPricePesewas: 2400,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/store/datahub-express']}>
        <PlatformStatusProvider>
          <ToastProvider>
            <Routes>
              <Route path="/store/:slug" element={<PublicStorefrontPage />} />
            </Routes>
          </ToastProvider>
        </PlatformStatusProvider>
      </MemoryRouter>
    );

    // Initial MTN product is visible
    expect(await screen.findByText('10 GB')).toBeInTheDocument();

    // Click Telecel button
    const telecelBtn = screen.getByRole('button', { name: /Telecel/i });
    fireEvent.click(telecelBtn);

    // Now Telecel bundle is visible
    expect(await screen.findByText('5 GB')).toBeInTheDocument();
    expect(screen.getByText('GH₵ 24.00')).toBeInTheDocument();
  });

  it('opens Express Checkout modal, validates Ghana recipient number, and triggers public checkout', async () => {
    vi.mocked(storesApi.getPublicStore).mockResolvedValueOnce({
      store: {
        id: 'str_123',
        userId: 'usr_agent_1',
        storeName: 'DataHub Express',
        slug: 'datahub-express',
        primaryColor: '#0066FF',
        accentColor: '#10B981',
        paymentStatus: 'PAID',
        approvalStatus: 'APPROVED',
        storeStatus: 'ACTIVE',
        activationFeePesewas: 50000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      products: [
        {
          id: 'sp_1',
          catalogProductId: 'cp_1',
          sku: 'MTN-10GB',
          name: 'MTN 10GB Turbo',
          network: NetworkProvider.MTN,
          dataAmountMb: 10240,
          validityDays: 30,
          basePricePesewas: 4500,
          markupPesewas: 300,
          retailPricePesewas: 4800,
        },
      ],
    });

    vi.mocked(storesApi.publicCheckout).mockResolvedValueOnce({
      order: {
        orderId: 'ord_sf_test_777',
        id: 'ord_uuid_777',
        recipientPhone: '0244123456',
        network: NetworkProvider.MTN,
        dataAmountMb: 10240,
        dataLabel: '10 GB',
        amountPesewas: 4800,
        amountGhs: 48.00,
        currency: 'GHS',
        paymentStatus: 'PENDING',
        orderStatus: 'CREATED',
        statusLabel: 'Order Created',
        storeName: 'DataHub Express',
        storeSlug: 'datahub-express',
      },
      payment: {
        reference: 'PST-SF-TEST-777',
        amountPesewas: 4800,
        amountGhs: 48.00,
        currency: 'GHS',
      },
    });

    vi.mocked(storesApi.verifyPublicPayment).mockResolvedValueOnce({
      orderId: 'ord_sf_test_777',
      status: 'READY_TO_PROCESS',
      statusLabel: 'Payment Confirmed',
      paymentStatus: 'PAID',
      product: {
        name: 'MTN 10 GB Data Bundle',
        network: NetworkProvider.MTN,
        volumeDisplay: '10 GB',
        validityDisplay: 'Non-Expiry',
      },
      recipientPhone: '0244123456',
      amountPesewas: 4800,
      amountDisplay: 'GH₵ 48.00',
      currency: 'GHS' as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(
      <MemoryRouter initialEntries={['/store/datahub-express']}>
        <PlatformStatusProvider>
          <ToastProvider>
            <Routes>
              <Route path="/store/:slug" element={<PublicStorefrontPage />} />
            </Routes>
          </ToastProvider>
        </PlatformStatusProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('10 GB')).toBeInTheDocument();

    // Click Buy Now
    const buyNowBtn = screen.getByRole('button', { name: /Buy Now/i });
    fireEvent.click(buyNowBtn);

    // Modal should open
    expect(await screen.findByText('Secure Customer Checkout')).toBeInTheDocument();
    expect(screen.getByText('Purchase 10 GB MTN')).toBeInTheDocument();

    // Enter phone number
    const phoneInput = screen.getByPlaceholderText('0244123456');
    fireEvent.change(phoneInput, { target: { value: '0244123456' } });

    // Submit Paystack payment
    const payBtn = screen.getByRole('button', { name: /Pay GH₵ 48.00 via Paystack/i });
    fireEvent.click(payBtn);

    await waitFor(() => {
      expect(storesApi.publicCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'datahub-express',
          productId: 'sp_1',
          recipientPhone: '0244123456',
          paymentMethod: 'PAYSTACK',
        })
      );
    });

    // Verification modal displayed
    expect(await screen.findByText('Bundle Dispatched!')).toBeInTheDocument();
    expect(screen.getByText(/ord_sf_test_777/i)).toBeInTheDocument();
  });

  it('allows opening in-store tracking modal and tracks order', async () => {
    vi.mocked(storesApi.getPublicStore).mockResolvedValueOnce({
      store: {
        id: 'str_123',
        userId: 'usr_agent_1',
        storeName: 'DataHub Express',
        slug: 'datahub-express',
        primaryColor: '#0066FF',
        accentColor: '#10B981',
        paymentStatus: 'PAID',
        approvalStatus: 'APPROVED',
        storeStatus: 'ACTIVE',
        activationFeePesewas: 50000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      products: [],
    });

    vi.mocked(ordersApi.trackOrder).mockResolvedValueOnce({
      id: 'ord_123',
      publicId: 'ord_sf_track_999',
      recipientPhone: '0244123456',
      network: NetworkProvider.MTN,
      dataAmountMb: 10240,
      amountPesewas: 4800,
      currency: Currency.GHS,
      paymentStatus: PaymentStatus.PAID,
      orderStatus: OrderStatus.COMPLETED,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/store/datahub-express']}>
        <PlatformStatusProvider>
          <ToastProvider>
            <Routes>
              <Route path="/store/:slug" element={<PublicStorefrontPage />} />
            </Routes>
          </ToastProvider>
        </PlatformStatusProvider>
      </MemoryRouter>
    );

    const trackBtn = await screen.findByRole('button', { name: /Track Order/i });
    fireEvent.click(trackBtn);

    expect(await screen.findByText('Track Order Status')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Order ID/i);
    fireEvent.change(searchInput, { target: { value: 'ord_sf_track_999' } });

    const searchBtn = screen.getByRole('button', { name: /Search/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(ordersApi.trackOrder).toHaveBeenCalledWith('ord_sf_track_999');
    });

    expect(await screen.findByText('ord_sf_track_999')).toBeInTheDocument();
  });

  it('renders store unavailable state when store is not found or inactive', async () => {
    vi.mocked(storesApi.getPublicStore).mockRejectedValueOnce(new Error('Storefront not found'));

    render(
      <MemoryRouter initialEntries={['/store/inactive-store']}>
        <PlatformStatusProvider>
          <ToastProvider>
            <Routes>
              <Route path="/store/:slug" element={<PublicStorefrontPage />} />
            </Routes>
          </ToastProvider>
        </PlatformStatusProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Storefront Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/is currently undergoing maintenance/i)).toBeInTheDocument();
    expect(screen.getByText(/Visit ByteBeacon Platform/i)).toBeInTheDocument();
  });

  it('correctly detects apisolutions.store host and extracts subdomain slug', async () => {
    const { isStorefrontHostname, extractStoreSlugFromHost, STOREFRONT_CONFIG } = await import('../config/storefront.config.js');

    // Apex domain
    expect(isStorefrontHostname('apisolutions.store')).toBe(true);
    expect(isStorefrontHostname('www.apisolutions.store')).toBe(true);
    expect(isStorefrontHostname('fastdata.apisolutions.store')).toBe(true);
    expect(isStorefrontHostname('bytebeacon.online')).toBe(false);
    expect(isStorefrontHostname('localhost')).toBe(false);

    // Subdomain extraction
    expect(extractStoreSlugFromHost('fastdata.apisolutions.store')).toBe('fastdata');
    expect(extractStoreSlugFromHost('express-data.apisolutions.store')).toBe('express-data');
    expect(extractStoreSlugFromHost('www.apisolutions.store')).toBeNull();
    expect(extractStoreSlugFromHost('apisolutions.store')).toBeNull();

    // Canonical store URLs
    expect(STOREFRONT_CONFIG.getStoreUrl('fastdata')).toContain('apisolutions.store/store/fastdata');
    expect(STOREFRONT_CONFIG.getMainPlatformUrl('/signin')).toContain('bytebeacon.online/signin');
  });

  it('renders storefront via direct /:slug route for customer links', async () => {
    vi.mocked(storesApi.getPublicStore).mockResolvedValueOnce({
      store: {
        id: 'str_direct_1',
        userId: 'usr_agent_direct',
        storeName: 'Direct Agent Store',
        slug: 'direct-slug',
        tagline: 'Instant Direct Data',
        description: 'Direct slug customer purchase.',
        primaryColor: '#0066FF',
        accentColor: '#10B981',
        paymentStatus: 'PAID',
        approvalStatus: 'APPROVED',
        storeStatus: 'ACTIVE',
        activationFeePesewas: 50000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      products: [],
    });

    render(
      <MemoryRouter initialEntries={['/direct-slug']}>
        <PlatformStatusProvider>
          <ToastProvider>
            <Routes>
              <Route path="/:slug" element={<PublicStorefrontPage />} />
            </Routes>
          </ToastProvider>
        </PlatformStatusProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Direct Agent Store')).toBeInTheDocument();
    expect(screen.getByText('Verified Merchant')).toBeInTheDocument();
    expect(screen.getByText('Merchant Portal')).toBeInTheDocument();
  });
});

