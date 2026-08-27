import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Currency } from '@bytebeacon/shared';
import { OrderTrackingPage } from '../pages/public/OrderTrackingPage.js';
import { ordersApi } from '../api/orders.api.js';

vi.mock('../api/orders.api.js', () => ({
  ordersApi: {
    trackOrder: vi.fn(),
  },
}));

describe('Real-Time Delivery Tracker — OrderTrackingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Tracker headers, input box, and Track button', () => {
    render(
      <MemoryRouter>
        <OrderTrackingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Real-Time Delivery Tracker/i)).toBeInTheDocument();
    expect(screen.getByText(/Track Your Order/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter Order Reference/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Track/i })).toBeInTheDocument();
  });

  it('successfully tracks and renders delivery timeline for active order', async () => {
    vi.mocked(ordersApi.trackOrder).mockResolvedValueOnce({
      orderId: 'ORD-2026-TEST-999',
      status: 'DELIVERED',
      statusLabel: 'Data delivered',
      paymentStatus: 'PAID',
      product: {
        name: 'MTN 5 GB Data Bundle',
        network: 'MTN',
        volumeDisplay: '5 GB',
        validityDisplay: '30 Days',
      },
      recipientPhone: '0244123456',
      amountPesewas: 2400,
      amountDisplay: 'GH₵ 24.00',
      currency: Currency.GHS,
      createdAt: '2026-08-26T10:00:00.000Z',
      completedAt: '2026-08-26T10:00:45.000Z',
    });

    render(
      <MemoryRouter initialEntries={['/track?ref=ORD-2026-TEST-999']}>
        <OrderTrackingPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(ordersApi.trackOrder).toHaveBeenCalledWith('ORD-2026-TEST-999');
    });

    expect(await screen.findByText(/Order #ORD-2026-TEST-999/i)).toBeInTheDocument();
    expect(screen.getByText('0244123456')).toBeInTheDocument();
    expect(screen.getByText('5 GB')).toBeInTheDocument();
    expect(screen.getByText('GH₵ 24.00')).toBeInTheDocument();
    expect(screen.getAllByText(/Data Delivered/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Refresh Live Status/i)).toBeInTheDocument();
  });

  it('displays Order Not Found empty state when tracking query does not match', async () => {
    vi.mocked(ordersApi.trackOrder).mockResolvedValueOnce(null);

    render(
      <MemoryRouter>
        <OrderTrackingPage />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText(/Enter Order Reference/i);
    const trackBtn = screen.getByRole('button', { name: /Track/i });

    fireEvent.change(input, { target: { value: 'NONEXISTENT_REF' } });
    fireEvent.click(trackBtn);

    await waitFor(() => {
      expect(ordersApi.trackOrder).toHaveBeenCalledWith('NONEXISTENT_REF');
    });

    expect(await screen.findByText(/Order Not Found/i)).toBeInTheDocument();
    expect(screen.getByText(/No order record was found matching "NONEXISTENT_REF"/i)).toBeInTheDocument();
  });
});
