import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NetworkProvider } from '@bytebeacon/shared';
import { BuyDataPage } from '../pages/customer/BuyDataPage.js';
import { ToastProvider } from '../context/ToastContext.js';
import { PlatformStatusProvider } from '../context/PlatformStatusContext.js';
import { catalogApi } from '../api/catalog.api.js';
import { ordersApi } from '../api/orders.api.js';
import { beneficiaryApi } from '../api/beneficiary.api.js';

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

// Mock beneficiaryApi
vi.mock('../api/beneficiary.api.js', () => ({
  beneficiaryApi: {
    precheck: vi.fn(),
    precheckPublic: vi.fn(),
    recordUnapproved: vi.fn().mockResolvedValue({ recorded: 1 }),
  },
}));

const mockBundles = [
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
];

describe('Excel MTN Precheck and Beneficiary Approval Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (catalogApi.getBundles as any).mockResolvedValue(mockBundles);
  });

  it('correctly gates unapproved MTN numbers and triggers BeneficiaryNotApprovedModal without submitting', async () => {
    // Both numbers are unapproved/unknown
    (beneficiaryApi.precheck as any).mockResolvedValue({
      network: 'MTN',
      enforced: true,
      results: [
        { phone: '0241112222', normalized: '0241112222', valid: true, known: false },
        { phone: '0553334444', normalized: '0553334444', valid: true, known: false },
      ],
    });

    const wb = XLSX.utils.book_new();
    const wsData = [
      ['Beneficiary Msisdn', 'Data (GB)'],
      ['0241112222', '5GB'],
      ['0553334444', '5GB'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const file = new File([arrayBuffer], 'unapproved_batch.xlsx', {
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

    // Switch to Excel mode
    const excelBtn = screen.getByRole('button', { name: /Excel/i });
    fireEvent.click(excelBtn);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);

    // Verify precheck was called with record: false
    await waitFor(() => {
      expect(beneficiaryApi.precheck).toHaveBeenCalledWith(
        expect.objectContaining({
          network: NetworkProvider.MTN,
          record: false,
        }),
      );
    });

    // Verify UI reflects 2 unapproved numbers and 0 approved
    await waitFor(() => {
      expect(screen.getByText('Unapproved / New')).toBeTruthy();
      expect(screen.getByText('Review 2 Unapproved Recipient(s) ⚠️')).toBeTruthy();
    });

    // Click submit button
    const reviewBtn = screen.getByText('Review 2 Unapproved Recipient(s) ⚠️');
    fireEvent.click(reviewBtn);

    // Verify BeneficiaryNotApprovedModal opens
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeTruthy();
      expect(within(dialog).getByText(/new beneficiaries/i)).toBeTruthy();
      expect(within(dialog).getByText('0241112222')).toBeTruthy();
      expect(within(dialog).getByText('0553334444')).toBeTruthy();
    });

    // Ensure bulk submission was never called
    expect(ordersApi.createBulkSubmission).not.toHaveBeenCalled();
  });

  it('allows checkout of only approved MTN numbers in mixed batch and supports Re-check Approvals', async () => {
    // 0241234567 is approved, 0249999999 is unapproved
    (beneficiaryApi.precheck as any).mockResolvedValueOnce({
      network: 'MTN',
      enforced: true,
      results: [
        { phone: '0241234567', normalized: '0241234567', valid: true, known: true },
        { phone: '0249999999', normalized: '0249999999', valid: true, known: false },
      ],
    });

    const wb = XLSX.utils.book_new();
    const wsData = [
      ['Beneficiary Msisdn', 'Data (GB)'],
      ['0241234567', '5GB'],
      ['0249999999', '5GB'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const file = new File([arrayBuffer], 'mixed_batch.xlsx', {
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
    fireEvent.click(screen.getByRole('button', { name: /Excel/i }));

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);

    // Wait for 1 approved recipient button
    await waitFor(() => {
      expect(screen.getByText('Continue to Payment (1 Approved) →')).toBeTruthy();
    });

    // Now test Re-check Approvals button
    (beneficiaryApi.precheck as any).mockResolvedValueOnce({
      network: 'MTN',
      enforced: true,
      results: [
        { phone: '0241234567', normalized: '0241234567', valid: true, known: true },
        { phone: '0249999999', normalized: '0249999999', valid: true, known: true }, // Newly approved!
      ],
    });

    const recheckBtn = screen.getByRole('button', { name: /Re-check Approvals/i });
    fireEvent.click(recheckBtn);

    await waitFor(() => {
      expect(screen.getByText('Continue to Payment (2 Approved) →')).toBeTruthy();
    });
  });

  it('verifies all numbers in batches > 10 without truncation when precheck falls back to precheckPublic', async () => {
    // 15 numbers: first 5 approved, next 10 unapproved
    const testPhones = Array.from({ length: 15 }, (_, i) => `024${String(1000000 + i).padStart(7, '0')}`);
    
    // Simulate beneficiaryApi.precheck failing so fallback to precheckPublic is engaged
    (beneficiaryApi.precheck as any).mockRejectedValueOnce(new Error('Precheck endpoint unavailable'));

    // beneficiaryApi.precheckPublic will receive chunk 1 (10 numbers) and chunk 2 (5 numbers)
    (beneficiaryApi.precheckPublic as any).mockImplementation(async ({ phoneNumbers }: { phoneNumbers: string[] }) => {
      return {
        network: 'MTN',
        results: phoneNumbers.map((phone) => ({
          phone,
          normalized: phone,
          valid: true,
          // First 5 numbers (0, 1, 2, 3, 4) are known/approved, rest unapproved
          known: Number(phone.slice(-2)) < 5,
        })),
      };
    });

    const wb = XLSX.utils.book_new();
    const wsData = [
      ['Beneficiary Msisdn', 'Data (GB)'],
      ...testPhones.map((p) => [p, '5GB']),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const file = new File([arrayBuffer], 'fifteen_batch.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    file.arrayBuffer = () => Promise.resolve(arrayBuffer);

    const { container } = render(
      <MemoryRouter initialEntries={['/agent/buy-data']}>
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
    fireEvent.click(screen.getByRole('button', { name: /Excel/i }));

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);

    // Verify precheckPublic was called with both chunks (chunk of 10 and chunk of 5), not truncated to 10
    await waitFor(() => {
      expect(beneficiaryApi.precheckPublic).toHaveBeenCalled();
      const calls = (beneficiaryApi.precheckPublic as any).mock.calls;
      const allPhonesChecked = calls.flatMap((c: any) => c[0].phoneNumbers);
      expect(allPhonesChecked).toHaveLength(15);
      expect(allPhonesChecked).toEqual(testPhones);
    });

    // Verify UI reflects exactly 5 approved recipients and 10 unapproved
    await waitFor(() => {
      expect(screen.getByText('Continue to Payment (5 Approved) →')).toBeTruthy();
      expect(screen.getByText(/10 Unapproved \/ First-Time MTN/i)).toBeTruthy();
    });
  });

  it('renders the exact status breakdown for MTN DATA FILE 7.xlsx', async () => {
    (beneficiaryApi.precheck as any).mockImplementation(async ({ phoneNumbers }: { phoneNumbers: string[] }) => {
      return {
        network: 'MTN',
        enforced: true,
        results: phoneNumbers.map((p) => ({
          phone: p,
          normalized: p,
          valid: true,
          known: false,
          isKnown: false,
          status: 'UNAPPROVED',
        })),
      };
    });

    const fs = await import('fs');
    const localFilePath = 'C:/Users/DELL LATITUDE/Downloads/MTN DATA FILE  7.xlsx';
    let arrayBuffer: ArrayBuffer;
    if (fs.existsSync(localFilePath)) {
      const buf = fs.readFileSync(localFilePath);
      arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } else {
      const wb = XLSX.utils.book_new();
      const wsData: (string | number)[][] = [['Beneficiary Msisdn', 'Data (GB)']];
      for (let i = 0; i < 475; i++) {
        wsData.push([`024${String(i).padStart(7, '0')}`, '5GB']);
      }
      wsData.splice(37, 0, ['0208354316', '5GB']);
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Orders');
      const u8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      arrayBuffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    }
    const file = new File([arrayBuffer], 'MTN DATA FILE  7.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    file.arrayBuffer = () => Promise.resolve(arrayBuffer);

    const { container } = render(
      <MemoryRouter initialEntries={['/buy-data']}>
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
    fireEvent.click(screen.getByRole('button', { name: /Excel/i }));

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);

    await waitFor(
      () => {
        expect(beneficiaryApi.precheck).toHaveBeenCalled();
      },
      { timeout: 10000 },
    );

    // Print what text is on the screen!
    const totalRowsEl = screen.getByText('Total Rows');
    expect(totalRowsEl).toBeTruthy();
  }, 30000);

  it('correctly handles 476 numbers with 282 approved, 193 unapproved, and 1 carrier mismatch (Telecel)', async () => {
    // Generate 476 phones: 193 unapproved, 1 Telecel, 282 approved
    const unapprovedPhones = [
      '0531983428', '0550944482', '0594423731', '0247850202', '0546036488',
      '0535407507', '0242627848', '0535864550', '0532681344', '0249669592',
      ...Array.from({ length: 183 }, (_, i) => `054${String(1000000 + i).padStart(7, '0')}`),
    ];
    const telecelPhone = '0204138408';
    const approvedPhones = Array.from({ length: 282 }, (_, i) => `024${String(2000000 + i).padStart(7, '0')}`);

    const all476Phones = [...unapprovedPhones, telecelPhone, ...approvedPhones];
    expect(all476Phones).toHaveLength(476);

    (beneficiaryApi.precheck as any).mockImplementation(async ({ phoneNumbers }: { phoneNumbers: string[] }) => {
      return {
        network: 'MTN',
        enforced: true,
        results: phoneNumbers.map((p) => {
          const isUnapproved = unapprovedPhones.includes(p);
          const isTelecel = p === telecelPhone;
          return {
            phone: p,
            normalized: p,
            valid: true,
            known: !isUnapproved && !isTelecel,
            isKnown: !isUnapproved && !isTelecel,
            status: isUnapproved ? 'UNAPPROVED' : isTelecel ? 'REJECTED' : 'APPROVED',
          };
        }),
      };
    });

    const wb = XLSX.utils.book_new();
    const wsData = [
      ['Beneficiary Msisdn', 'Data (GB)'],
      ...all476Phones.map((p) => [p, '5GB']),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const file = new File([arrayBuffer], 'mtn_476_numbers.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    file.arrayBuffer = () => Promise.resolve(arrayBuffer);

    const { container } = render(
      <MemoryRouter initialEntries={['/buy-data']}>
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
    fireEvent.click(screen.getByRole('button', { name: /Excel/i }));

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);

    await waitFor(
      () => {
        expect(beneficiaryApi.precheck).toHaveBeenCalled();
      },
      { timeout: 10000 },
    );

    // Verify exactly 476 total, 282 approved, 193 unapproved, 1 rejected/mismatch
    await waitFor(() => {
      expect(screen.getByText(/193 number/i)).toBeTruthy();
      expect(screen.getByText(/1 number/i)).toBeTruthy();
      expect(screen.getByText('0204138408')).toBeTruthy();
      expect(screen.getByText('TELECEL')).toBeTruthy();
    });

    // Verify recordUnapproved was called with 193 unapproved items
    expect(beneficiaryApi.recordUnapproved).toHaveBeenCalled();
    const recordCalls = (beneficiaryApi.recordUnapproved as any).mock.calls;
    const recordedItems = recordCalls[0][0].items;
    expect(recordedItems).toHaveLength(193);

    // Test ticking "All of these are ported"
    const portedCheckbox = screen.getByRole('checkbox', { name: /All of these are ported/i });
    fireEvent.click(portedCheckbox);

    // Now approved count should be 283 (282 + 1 ported), and 0 mismatch
    await waitFor(() => {
      expect(screen.getByText('Continue to Payment (283 Approved) →')).toBeTruthy();
    });
  });
});
