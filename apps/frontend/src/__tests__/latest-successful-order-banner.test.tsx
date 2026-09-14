import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LatestSuccessfulOrderBanner } from '../components/commerce/LatestSuccessfulOrderBanner.js';
import { ordersApi } from '../api/orders.api.js';

vi.mock('../api/orders.api.js', () => ({
  ordersApi: {
    getLatestSuccessfulOrder: vi.fn(),
  },
}));

describe('LatestSuccessfulOrderBanner Suite', () => {
  const mockTelemetryResponse = {
    latest: {
      network: 'MTN',
      networkDisplayName: 'MTN',
      placedAt: '2026-09-13T23:55:00.000Z',
      deliveredAt: '2026-09-14T00:03:00.000Z',
      placedAtFormatted: 'Sep 13, 11:55 PM',
      deliveredAtFormatted: 'Sep 14, 12:03 AM',
      durationSeconds: 480,
      durationMinutes: 8,
      durationDisplay: 'Took about 8 mins.',
      estimatedDeliveryDisplay: 'Est. delivery: Less than 10 mins.',
    },
    byNetwork: {
      MTN: {
        network: 'MTN',
        networkDisplayName: 'MTN',
        placedAt: '2026-09-13T23:55:00.000Z',
        deliveredAt: '2026-09-14T00:03:00.000Z',
        placedAtFormatted: 'Sep 13, 11:55 PM',
        deliveredAtFormatted: 'Sep 14, 12:03 AM',
        durationSeconds: 480,
        durationMinutes: 8,
        durationDisplay: 'Took about 8 mins.',
        estimatedDeliveryDisplay: 'Est. delivery: Less than 10 mins.',
      },
      TELECEL: {
        network: 'TELECEL',
        networkDisplayName: 'Telecel',
        placedAt: '2026-09-13T23:50:00.000Z',
        deliveredAt: '2026-09-13T23:53:00.000Z',
        placedAtFormatted: 'Sep 13, 11:50 PM',
        deliveredAtFormatted: 'Sep 13, 11:53 PM',
        durationSeconds: 180,
        durationMinutes: 3,
        durationDisplay: 'Took about 3 mins.',
        estimatedDeliveryDisplay: 'Est. delivery: Less than 5 mins.',
      },
      AIRTELTIGO: {
        network: 'AIRTELTIGO',
        networkDisplayName: 'AT',
        placedAt: '2026-09-13T23:40:00.000Z',
        deliveredAt: '2026-09-13T23:45:00.000Z',
        placedAtFormatted: 'Sep 13, 11:40 PM',
        deliveredAtFormatted: 'Sep 13, 11:45 PM',
        durationSeconds: 300,
        durationMinutes: 5,
        durationDisplay: 'Took about 5 mins.',
        estimatedDeliveryDisplay: 'Est. delivery: Less than 10 mins.',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (ordersApi.getLatestSuccessfulOrder as any).mockResolvedValue(mockTelemetryResponse);
  });

  it('renders exact title, timestamps, duration, and estimated delivery matching reference photo', async () => {
    render(<LatestSuccessfulOrderBanner network="MTN" />);

    await waitFor(() => {
      expect(screen.getByText('Latest MTN Successful Order')).toBeInTheDocument();
    });

    expect(screen.getByText('Sep 13, 11:55 PM')).toBeInTheDocument();
    expect(screen.getByText('Sep 14, 12:03 AM')).toBeInTheDocument();
    expect(screen.getByText('Took about 8 mins.')).toBeInTheDocument();
    expect(screen.getByText('Est. delivery: Less than 10 mins.')).toBeInTheDocument();
  });

  it('dynamically adapts to Telecel network carrier selection', async () => {
    render(<LatestSuccessfulOrderBanner network="TELECEL" />);

    await waitFor(() => {
      expect(screen.getByText('Latest Telecel Successful Order')).toBeInTheDocument();
    });

    expect(screen.getByText('Sep 13, 11:50 PM')).toBeInTheDocument();
    expect(screen.getByText('Sep 13, 11:53 PM')).toBeInTheDocument();
    expect(screen.getByText('Took about 3 mins.')).toBeInTheDocument();
    expect(screen.getByText('Est. delivery: Less than 5 mins.')).toBeInTheDocument();
  });

  it('dynamically adapts to AT (AirtelTigo) network carrier selection', async () => {
    render(<LatestSuccessfulOrderBanner network="AT" />);

    await waitFor(() => {
      expect(screen.getByText('Latest AT Successful Order')).toBeInTheDocument();
    });

    expect(screen.getByText('Took about 5 mins.')).toBeInTheDocument();
  });

  it('renders compact layout when variant="compact"', async () => {
    render(<LatestSuccessfulOrderBanner network="MTN" variant="compact" />);

    await waitFor(() => {
      expect(screen.getByText('Latest MTN Order:')).toBeInTheDocument();
    });

    expect(screen.getByText('Took about 8 mins.')).toBeInTheDocument();
    expect(screen.getByText('Est. delivery: Less than 10 mins.')).toBeInTheDocument();
  });

  it('handles API errors with graceful fallback without throwing or breaking UI', async () => {
    (ordersApi.getLatestSuccessfulOrder as any).mockRejectedValue(new Error('Network offline'));

    render(<LatestSuccessfulOrderBanner network="MTN" />);

    await waitFor(() => {
      expect(screen.getByText('Latest MTN Successful Order')).toBeInTheDocument();
    });
    expect(screen.getByText('Took about 8 mins.')).toBeInTheDocument();
  });
});
