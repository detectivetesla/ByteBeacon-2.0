import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { NetworkProvider } from '@bytebeacon/shared';
import { BuyDataPage } from '../pages/customer/BuyDataPage.js';
import { PurchaseModal } from '../components/commerce/PurchaseModal.js';
import { ToastProvider } from '../context/ToastContext.js';
import { PlatformStatusProvider } from '../context/PlatformStatusContext.js';
import { catalogApi } from '../api/catalog.api.js';
import { ordersApi } from '../api/orders.api.js';

// Mock catalogApi
vi.mock('../api/catalog.api.js', () => ({
  catalogApi: {
    getBundles: vi.fn(),
    getPublicPackages: vi.fn(),
    getCachedPublicPackages: vi.fn(),
  },
}));

// Mock ordersApi
vi.mock('../api/orders.api.js', () => ({
  ordersApi: {
    createOrder: vi.fn(),
    createBulkSubmission: vi.fn(),
    getOrder: vi.fn(),
    trackOrder: vi.fn(),
    listOrders: vi.fn(),
    listAgentOrders: vi.fn(),
  },
}));

const mockMtnBundles = [
  {
    id: 'prod-mtn-1gb',
    sku: 'MTN-1GB',
    network: NetworkProvider.MTN,
    dataAmountMb: 1024,
    basePricePesewas: 600,
    agentPricePesewas: 380,
    validityDays: 30,
    validityDesc: 'Non-Expiry',
    popular: false,
    isActive: true,
  },
  {
    id: 'prod-mtn-5gb',
    sku: 'MTN-5GB',
    network: NetworkProvider.MTN,
    dataAmountMb: 5120,
    basePricePesewas: 2800,
    agentPricePesewas: 1900,
    validityDays: 30,
    validityDesc: 'Non-Expiry',
    popular: true,
    isActive: true,
  },
  {
    id: 'prod-mtn-10gb',
    sku: 'MTN-10GB',
    network: NetworkProvider.MTN,
    dataAmountMb: 10240,
    basePricePesewas: 5500,
    agentPricePesewas: 3800,
    validityDays: 30,
    validityDesc: 'Non-Expiry',
    popular: true,
    isActive: true,
  },
];

describe('BuyDataPage and PurchaseModal Live Dynamic Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (catalogApi.getBundles as any).mockResolvedValue(mockMtnBundles);
  });

  it('loads live catalog bundles and displays them in GB format', async () => {
    render(
      <MemoryRouter initialEntries={['/app/buy-data']}>
        <ToastProvider>
          <PlatformStatusProvider>
            <BuyDataPage />
          </PlatformStatusProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(catalogApi.getBundles).toHaveBeenCalledWith(NetworkProvider.MTN, 'CUSTOMER');
    });

    // Verify GB packages are rendered
    await waitFor(() => {
      expect(screen.getAllByText(/1 GB/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/5 GB/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/10 GB/i).length).toBeGreaterThan(0);
    });
  });

  it('switches between Single, Bulk, and Excel modes', async () => {
    render(
      <MemoryRouter initialEntries={['/app/buy-data']}>
        <ToastProvider>
          <PlatformStatusProvider>
            <BuyDataPage />
          </PlatformStatusProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Single Order Configuration')).toBeTruthy();
    });

    // Switch to Bulk mode
    const bulkButton = screen.getByRole('button', { name: /Bulk/i });
    fireEvent.click(bulkButton);

    expect(screen.getByText('Bulk Order (Multi-Recipient)')).toBeTruthy();

    // Switch to Excel mode
    const excelButton = screen.getByRole('button', { name: /Excel/i });
    fireEvent.click(excelButton);

    expect(screen.getByText(/Excel Batch Order Templates/i)).toBeTruthy();
    expect(screen.getByText(/Beneficiary Msisdn, Data \(GB\)/i)).toBeTruthy();
  });

  it('displays Data (GB) in template download action', async () => {
    render(
      <MemoryRouter initialEntries={['/app/buy-data']}>
        <ToastProvider>
          <PlatformStatusProvider>
            <BuyDataPage />
          </PlatformStatusProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    // Switch to Excel
    const excelButton = screen.getByRole('button', { name: /Excel/i });
    fireEvent.click(excelButton);

    const fullTemplateBtn = screen.getByRole('button', { name: /Download Full Template/i });
    expect(fullTemplateBtn).toBeTruthy();
  });

  it('PurchaseModal renders live wallet and Paystack checkout options and creates bulk orders', async () => {
    (ordersApi.createBulkSubmission as any).mockResolvedValue({
      id: 'bulk-batch-998877',
      name: 'Bulk Batch 1',
      totalOrders: 2,
    });

    const bulkItems = [
      {
        recipientPhone: '0241112222',
        productId: 'prod-mtn-5gb',
        dataDisplay: '5 GB',
        pricePesewas: 2800,
      },
      {
        recipientPhone: '0553334444',
        productId: 'prod-mtn-10gb',
        dataDisplay: '10 GB',
        pricePesewas: 5500,
      },
    ];

    render(
      <BrowserRouter>
        <ToastProvider>
          <PlatformStatusProvider>
            <PurchaseModal
              isOpen={true}
              onClose={() => {}}
              initialNetwork={NetworkProvider.MTN}
              customTitle="Test Batch Order"
              customPackageSummary="2 Packages (MTN)"
              customRecipientSummary="2 Recipients"
              customAmountDisplay="GH₵ 83.00"
              bulkItems={bulkItems}
              walletBalanceGhs={100}
              isGuestPurchase={false}
            />
          </PlatformStatusProvider>
        </ToastProvider>
      </BrowserRouter>,
    );

    expect(screen.getByText(/Test Batch Order/i)).toBeTruthy();
    expect(screen.getAllByText(/2 Packages \(MTN\)/i).length).toBeGreaterThan(0);
    expect(screen.getByText('GH₵ 83.00')).toBeTruthy();
    expect(screen.getByText('2 Recipients')).toBeTruthy();

    // Confirm purchase using wallet
    const confirmBtn = screen.getByRole('button', { name: /Confirm Purchase/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(ordersApi.createBulkSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            { recipientPhone: '0241112222', productId: 'prod-mtn-5gb' },
            { recipientPhone: '0553334444', productId: 'prod-mtn-10gb' },
          ],
        }),
      );
    });
  });

  it('parses uploaded real XLSX file cleanly without binary distortion', async () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['Beneficiary Msisdn', 'Data (GB)'],
      ['0241234567', '5GB'],
      ['0559876543', '10GB'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const file = new File([arrayBuffer], 'test_orders.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    file.arrayBuffer = () => Promise.resolve(arrayBuffer);

    const { container } = render(
      <MemoryRouter initialEntries={['/app/buy-data']}>
        <ToastProvider>
          <PlatformStatusProvider>
            <BuyDataPage />
          </PlatformStatusProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(catalogApi.getBundles).toHaveBeenCalled();
    });

    // Switch to Excel
    const excelButton = screen.getByRole('button', { name: /Excel/i });
    fireEvent.click(excelButton);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText(/2 Valid Recipients Detected/i)).toBeTruthy();
      expect(screen.getByText('0241234567')).toBeTruthy();
      expect(screen.getByText('0559876543')).toBeTruthy();
    });
  });
});
